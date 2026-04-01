/**
 * RAG 核心逻辑 - Supabase PostgreSQL 版本
 * 向量化问题 -> Supabase 检索 -> 构建上下文 -> 调用 LLM -> 返回回答
 */

import { Pool } from 'pg';
import { getEmbeddings } from './embeddings';
import { callLLM } from './llm';

const COLLECTION_NAME = 'wo-kanjian-de-shijie';
const TOP_K = 5; // 返回 Top 5 结果，增加多样性

// 初始化 PostgreSQL 连接池
function getPool(): Pool {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL 环境变量未设置');
  }
  
  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

// 计算余弦相似度
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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

export async function query(question: string): Promise<RagResult> {
  const pool = getPool();
  const embeddings = getEmbeddings();

  try {
    // 1. 向量化问题
    const questionVector = await embeddings.embedQuery(question);

    // 2. 获取所有文档和它们的向量
    const result = await pool.query(
      'SELECT id, content, metadata, embedding FROM rag_documents WHERE collection = $1',
      [COLLECTION_NAME]
    );

    if (result.rows.length === 0) {
      return {
        answer: '抱歉，向量库为空，请先访问 /api/rag-build 构建向量库。',
        sources: [],
      };
    }

    // 3. 计算相似度并排序，对附录类内容（书评/目录/致谢）做降权
    const scoredDocs = result.rows
      .map((row: { id: string; content: string; metadata: { chapterTitle?: string; type?: string }; embedding: number[] }) => {
        const rawScore = cosineSimilarity(questionVector, row.embedding);
        // 附录内容降权 20%，确保正文优先被召回
        const penalty = row.metadata?.type === 'appendix' ? 0.8 : 1.0;
        const score = rawScore * penalty;
        return {
          id: row.id,
          content: row.content,
          chapterTitle: row.metadata?.chapterTitle || '未知章节',
          type: row.metadata?.type || 'main',
          score,
        };
      })
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, TOP_K);

    if (scoredDocs.length === 0) {
      return {
        answer: '抱歉，我没有找到相关内容来回答您的问题。',
        sources: [],
      };
    }

    // 4. 构建来源列表
    const sources: RagSource[] = scoredDocs.map((doc: { content: string; chapterTitle: string; score: number }) => ({
      chapterTitle: doc.chapterTitle,
      excerpt: doc.content.slice(0, 150) + (doc.content.length > 150 ? '...' : ''),
      score: doc.score,
    }));

    // 5. 构建上下文
    const contextParts = sources.map((s, i) => {
      return `[来源 ${i + 1}] 章节：${s.chapterTitle}\n${s.excerpt}`;
    });
    const context = contextParts.join('\n\n---\n\n');

    // 6. 调用 LLM
    const answer = await callLLM([
      {
        role: 'system',
        content: `你是一位帮助读者理解《我看见的世界》（李飞飞自传）的 AI 助手。
请根据以下书中的相关段落，用中文回答用户的问题。
回答要准确、简洁，并基于书中内容。如果提供的段落不足以回答问题，请如实说明。

相关段落：
${context}`,
      },
      {
        role: 'user',
        content: question,
      },
    ]);

    return { answer, sources };
  } finally {
    await pool.end();
  }
}

export async function buildVectorStore(
  docs: { pageContent: string; metadata: Record<string, unknown> }[]
): Promise<number> {
  const pool = getPool();
  const embeddings = getEmbeddings();

  try {
    // 1. 清空旧数据
    await pool.query('DELETE FROM rag_documents WHERE collection = $1', [COLLECTION_NAME]);

    // 2. 批量向量化并插入
    const batchSize = 5;
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      
      // 并行向量化
      const vectors = await Promise.all(
        batch.map(doc => embeddings.embedQuery(doc.pageContent))
      );

      // 批量插入
      for (let j = 0; j < batch.length; j++) {
        const docId = `doc-${i + j}`;
        const metadata = JSON.stringify(batch[j].metadata);
        
        await pool.query(
          `INSERT INTO rag_documents (id, collection, content, metadata, embedding) 
           VALUES ($1, $2, $3, $4, $5)`,
          [docId, COLLECTION_NAME, batch[j].pageContent, metadata, vectors[j]]
        );
      }
      
      console.log(`处理进度: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
    }

    return docs.length;
  } finally {
    await pool.end();
  }
}
