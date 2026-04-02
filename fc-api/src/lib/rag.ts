/**
 * RAG 核心逻辑 - Supabase PostgreSQL 版本
 * 支持多本书，通过 collectionName 区分
 */

import { Pool } from 'pg';
import { getEmbeddings } from './embeddings';
import { callLLM, callLLMStream, LLMMessage } from './llm';

// 书籍信息配置
interface BookConfig {
  title: string;
  description: string;
  /** 角色扮演模式：AI 以书中角色身份回答 */
  roleplay?: {
    enabled: boolean;
    characterName: string;
    /** 注入到 system prompt 里的角色设定 */
    persona: string;
  };
}

const BOOK_CONFIGS: Record<string, BookConfig> = {
  'wo-kanjian-de-shijie': {
    title: '《我看见的世界》（李飞飞自传）',
    description: '李飞飞的 AI 人生传记',
    // 传记/自传类：用作者视角更合适，但不强制角色扮演
    roleplay: {
      enabled: false,
      characterName: '李飞飞',
      persona: '',
    },
  },
  'dao-gui-yi-xian': {
    title: '《道诡异仙》',
    description: '狐尾的笔所著东方玄幻小说',
    roleplay: {
      enabled: true,
      characterName: '李火旺',
      persona: `你现在是《道诡异仙》中的主角李火旺。
李火旺的人物特征：
- 表面上是一个现代精神病院里的病人，内心却极为通透冷静
- 习惯用"幻觉"来理解修仙世界里的一切，说话带着一种"在旁观自己"的疏离感
- 聪明、务实、有点玩世不恭，但骨子里重情义
- 常常用现代视角（医学、心理）来解释修仙界的奇异现象，语言接地气
- 偶尔会说"我的幻觉里..."或"按我师傅丹阳子的说法..."

回答时请用第一人称，以李火旺的口吻和语气来回应读者的问题。
如果问题涉及书中尚未发生的情节（你"尚未经历"的），可以说"这个我还不清楚，幻觉里还没到那一段"。
如果书中提供的段落不够回答问题，诚实地说"这个我也不太清楚，幻觉有时候不太完整"。`,
    },
  },
};

const TOP_K = 5;

function getPool(): Pool {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL 环境变量未设置');
  }
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 根据书籍配置生成 System Prompt（普通助手 or 角色扮演）*/
function buildSystemPrompt(bookConfig: BookConfig, context: string): string {
  const rp = bookConfig.roleplay;
  if (rp?.enabled && rp.persona) {
    // 角色扮演模式：AI 以书中角色身份回答
    return `${rp.persona}

以下是你（${rp.characterName}）在书中相关经历的片段，用来帮助你回答读者的问题：

${context}

请以${rp.characterName}的口吻和语气，用第一人称回答读者的问题。`;
  }
  // 普通助手模式
  return `你是一位帮助读者理解${bookConfig.title}的 AI 助手。
请根据以下书中的相关段落，用中文回答用户的问题。
回答要准确、简洁，并基于书中内容。如果提供的段落不足以回答问题，请如实说明。

相关段落：
${context}`;
}

export interface RagSource {
  chapterTitle: string;
  excerpt: string;
  score: number;
}

export interface RagResult {
  answer: string;
  sources: RagSource[];
}

export async function query(question: string, bookSlug = 'wo-kanjian-de-shijie'): Promise<RagResult> {
  const pool = getPool();
  const embeddings = getEmbeddings();
  const bookConfig = BOOK_CONFIGS[bookSlug] || BOOK_CONFIGS['wo-kanjian-de-shijie'];

  try {
    const questionVector = await embeddings.embedQuery(question);

    const result = await pool.query(
      'SELECT id, content, metadata, embedding FROM rag_documents WHERE collection = $1',
      [bookSlug]
    );

    if (result.rows.length === 0) {
      return { answer: '抱歉，向量库为空，请先构建向量库。', sources: [] };
    }

    const scoredDocs = result.rows
      .map((row: { id: string; content: string; metadata: { chapterTitle?: string; type?: string }; embedding: number[] }) => {
        const rawScore = cosineSimilarity(questionVector, row.embedding);
        const penalty = row.metadata?.type === 'appendix' ? 0.8 : 1.0;
        return {
          content: row.content,
          chapterTitle: row.metadata?.chapterTitle || '未知章节',
          score: rawScore * penalty,
        };
      })
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, TOP_K);

    const sources: RagSource[] = scoredDocs.map((doc: { content: string; chapterTitle: string; score: number }) => ({
      chapterTitle: doc.chapterTitle,
      excerpt: doc.content.slice(0, 150) + (doc.content.length > 150 ? '...' : ''),
      score: doc.score,
    }));

    const context = sources
      .map((s, i) => `[来源 ${i + 1}] 章节：${s.chapterTitle}\n${s.excerpt}`)
      .join('\n\n---\n\n');

    const answer = await callLLM([
      { role: 'system', content: buildSystemPrompt(bookConfig, context) },
      { role: 'user', content: question },
    ]);

    return { answer, sources };
  } finally {
    await pool.end();
  }
}

/**
 * 流式问答：返回 sources + MiniMax 原始 SSE 流
 * index.ts 负责解析流并推送 delta；若流中无内容，由 index.ts 兜底推送最终 message
 */
export async function queryStream(
  question: string,
  bookSlug = 'wo-kanjian-de-shijie'
): Promise<{ sources: RagSource[]; stream: ReadableStream<Uint8Array> }> {
  const pool = getPool();
  const embeddings = getEmbeddings();
  const bookConfig = BOOK_CONFIGS[bookSlug] || BOOK_CONFIGS['wo-kanjian-de-shijie'];

  try {
    const questionVector = await embeddings.embedQuery(question);

    const result = await pool.query(
      'SELECT id, content, metadata, embedding FROM rag_documents WHERE collection = $1',
      [bookSlug]
    );

    if (result.rows.length === 0) {
      throw new Error('向量库为空，请先构建向量库。');
    }

    const scoredDocs = result.rows
      .map((row: { id: string; content: string; metadata: { chapterTitle?: string; type?: string }; embedding: number[] }) => {
        const rawScore = cosineSimilarity(questionVector, row.embedding);
        const penalty = row.metadata?.type === 'appendix' ? 0.8 : 1.0;
        return {
          content: row.content,
          chapterTitle: row.metadata?.chapterTitle || '未知章节',
          score: rawScore * penalty,
        };
      })
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, TOP_K);

    const sources: RagSource[] = scoredDocs.map((doc: { content: string; chapterTitle: string; score: number }) => ({
      chapterTitle: doc.chapterTitle,
      excerpt: doc.content.slice(0, 150) + (doc.content.length > 150 ? '...' : ''),
      score: doc.score,
    }));

    const context = sources
      .map((s, i) => `[来源 ${i + 1}] 章节：${s.chapterTitle}\n${s.excerpt}`)
      .join('\n\n---\n\n');

    const messages: LLMMessage[] = [
      { role: 'system', content: buildSystemPrompt(bookConfig, context) },
      { role: 'user', content: question },
    ];

    const stream = await callLLMStream(messages);
    return { sources, stream };
  } finally {
    await pool.end();
  }
}

export async function buildVectorStore(
  docs: { pageContent: string; metadata: Record<string, unknown> }[],
  bookSlug = 'wo-kanjian-de-shijie'
): Promise<number> {
  const pool = getPool();
  const embeddings = getEmbeddings();

  try {
    await pool.query('DELETE FROM rag_documents WHERE collection = $1', [bookSlug]);

    const batchSize = 5;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const vectors = await Promise.all(batch.map(doc => embeddings.embedQuery(doc.pageContent)));

      for (let j = 0; j < batch.length; j++) {
        await pool.query(
          `INSERT INTO rag_documents (id, collection, content, metadata, embedding) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET collection = EXCLUDED.collection, content = EXCLUDED.content, metadata = EXCLUDED.metadata, embedding = EXCLUDED.embedding`,
          [`${bookSlug}-doc-${i + j}`, bookSlug, batch[j].pageContent, JSON.stringify(batch[j].metadata), vectors[j]]
        );
      }
      console.log(`[${bookSlug}] 构建进度: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
    }

    return docs.length;
  } finally {
    await pool.end();
  }
}
