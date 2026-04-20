/**
 * RAG 核心逻辑 - Supabase PostgreSQL 版本
 * 支持多本书，通过 collectionName 区分
 * 支持从书中自动提取角色人设（extractPersona）
 * 支持角色扮演对话：单角色（读者模式）和双角色（玩家扮演模式）
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { getEmbeddings } from './embeddings';
import { callLLM, callLLMStream, LLMMessage } from './llm';

// ─── 人物数据接口（与前端 src/types/character.ts 保持一致）────────────────────

interface CharacterData {
  id: string;
  name: string;
  avatar: string;
  role: string;
  traits: string[];
  speechStyle: string;
  persona: string;
  relations: Array<{ characterId: string; description: string }>;
}

/** 读取书籍人物数据（从 src/data/characters/ 目录读取，与 Next.js 共享数据源）*/
function loadCharactersData(bookSlug: string): CharacterData[] {
  try {
    // fc-api 部署在项目根目录的子目录，数据文件在 ../src/data/characters/
    const filePath = path.join(__dirname, '../../..', 'src', 'data', 'characters', `${bookSlug}.json`);
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as { characters?: CharacterData[] };
    return data.characters || [];
  } catch {
    return [];
  }
}

/** 根据 characterId 获取人物数据 */
function getCharacterById(bookSlug: string, characterId: string): CharacterData | null {
  const characters = loadCharactersData(bookSlug);
  return characters.find(c => c.id === characterId) || null;
}

// ─── 书籍配置 ────────────────────────────────────────────────────────────────

interface BookConfig {
  title: string;
  /** 角色扮演模式基础配置，persona 可以为空（等待自动提取后填充） */
  roleplay: {
    enabled: boolean;
    characterName: string;
    /** 手写的兜底人设，自动提取成功后会被覆盖 */
    fallbackPersona: string;
  };
}

const BOOK_CONFIGS: Record<string, BookConfig> = {
  'wo-kanjian-de-shijie': {
    title: '《我看见的世界》（李飞飞自传）',
    roleplay: {
      enabled: true,
      characterName: '李飞飞',
      fallbackPersona: `你现在是《我看见的世界》的作者李飞飞本人。
李飞飞的人物特征：
- 华裔美国科学家，AI 领域先驱，ImageNet 的创始人
- 说话严谨而充满温情，善于用故事和比喻讲解复杂概念
- 对科学充满热情，同时重视人文关怀和 AI 伦理
- 经历过移民的艰辛，对家庭和老师的恩情始终铭记
- 偶尔会说"在我的研究生涯中..."或"当我第一次看到这个问题..."

回答时请用第一人称，以李飞飞本人的口吻和语气来回应读者的问题。
如果书中提供的段落不够回答问题，诚实地说"这部分我在书中没有详细展开"。`,
    },
  },
  'dao-gui-yi-xian': {
    title: '《道诡异仙》',
    roleplay: {
      enabled: true,
      characterName: '李火旺',
      fallbackPersona: `你现在是《道诡异仙》中的主角李火旺。
李火旺的人物特征：
- 表面上是一个现代精神病院里的病人，内心却极为通透冷静
- 习惯用"幻觉"来理解修仙世界里的一切，说话带着一种"在旁观自己"的疏离感
- 聪明、务实、有点玩世不恭，但骨子里重情义
- 常常用现代视角（医学、心理）来解释修仙界的奇异现象，语言接地气
- 偶尔会说"我的幻觉里..."或"按我师傅丹阳子的说法..."

回答时请用第一人称，以李火旺的口吻和语气来回应读者的问题。
如果问题涉及书中尚未发生的情节，可以说"这个我还不清楚，幻觉里还没到那一段"。
如果书中提供的段落不够回答问题，诚实地说"这个我也不太清楚，幻觉有时候不太完整"。`,
    },
  },
};

// ─── 人设持久化（存到 data/personas/ 目录）────────────────────────────────────

const PERSONA_DIR = path.join(__dirname, '../../data/personas');

function getPersonaPath(bookSlug: string): string {
  return path.join(PERSONA_DIR, `${bookSlug}.txt`);
}

/** 读取已保存的人设，不存在则返回 null */
function loadSavedPersona(bookSlug: string): string | null {
  try {
    const p = getPersonaPath(bookSlug);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8').trim();
    }
  } catch {}
  return null;
}

/** 保存人设到文件 */
function savePersona(bookSlug: string, persona: string): void {
  if (!fs.existsSync(PERSONA_DIR)) {
    fs.mkdirSync(PERSONA_DIR, { recursive: true });
  }
  fs.writeFileSync(getPersonaPath(bookSlug), persona, 'utf8');
}

/** 获取当前使用的人设（优先已保存的，否则用兜底）*/
function getPersona(bookSlug: string): string {
  const saved = loadSavedPersona(bookSlug);
  if (saved) return saved;
  const config = BOOK_CONFIGS[bookSlug];
  return config?.roleplay?.fallbackPersona || '';
}

// ─── 自动提取人设 ──────────────────────────────────────────────────────────────

/**
 * 从书的前 N 章内容，让 AI 总结主角的人设，存到本地文件
 * @param bookSlug  书籍 slug
 * @param chapters  书籍章节数组
 * @param sampleCount 取前多少章作为样本（默认 30）
 */
export async function extractPersona(
  bookSlug: string,
  chapters: { title: string; content: string }[],
  sampleCount = 30
): Promise<string> {
  const config = BOOK_CONFIGS[bookSlug];
  if (!config) throw new Error(`未知书籍: ${bookSlug}`);

  const { characterName, enabled } = config.roleplay;
  if (!enabled) throw new Error(`${bookSlug} 未开启角色扮演模式`);

  // 取前 sampleCount 章，每章截取前 800 字避免 token 过多
  const sample = chapters
    .slice(0, sampleCount)
    .map(ch => `【${ch.title}】\n${ch.content.slice(0, 800)}`)
    .join('\n\n---\n\n');

  console.log(`[${bookSlug}] 开始提取人设，样本章节: ${Math.min(sampleCount, chapters.length)} 章`);

  const messages: Parameters<typeof callLLM>[0] = [
    {
      role: 'system',
      content: `你是一位专业的文学分析师，擅长从小说原文中提炼角色的性格特征，并将其转化为可以用于角色扮演的人设描述。`,
    },
    {
      role: 'user',
      content: `以下是《${config.title}》的前 ${Math.min(sampleCount, chapters.length)} 章节内容：

${sample}

请根据以上内容，为主角「${characterName}」生成一段详细的角色扮演人设描述，要求：
1. 用"你现在是..."开头，直接描述角色身份
2. 总结角色的核心性格特征（3-6条），每条一行，用"-"开头
3. 描述角色的说话风格、习惯用语、口头禅
4. 说明角色如何面对"不知道"或"无法回答"的情况
5. 整个描述控制在 400 字以内，简洁有力
6. 只输出人设描述文本，不要加任何解释或前言`,
    },
  ];

  // 限流时自动重试（最多 3 次，间隔 3s）
  let persona = '';
  const MAX_RETRY = 3;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      persona = await callLLM(messages);
      break;
    } catch (e) {
      const msg = (e as Error).message;
      if (attempt < MAX_RETRY && msg.includes('限流')) {
        console.warn(`[${bookSlug}] 人设提取限流，第 ${attempt} 次重试，等待 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }

  console.log(`[${bookSlug}] 人设提取完成，长度: ${persona.length} 字`);
  savePersona(bookSlug, persona);
  return persona;
}

// ─── System Prompt 构建 ────────────────────────────────────────────────────────

/**
 * 构建单角色 System Prompt（读者模式）
 * @param bookSlug 书籍 slug
 * @param context  RAG 检索到的上下文
 * @param characterId 可选，指定人物 ID（优先级高于默认主角）
 */
function buildSystemPrompt(bookSlug: string, context: string, characterId?: string): string {
  const config = BOOK_CONFIGS[bookSlug] || BOOK_CONFIGS['wo-kanjian-de-shijie'];

  // 优先使用 characterId 指定的人物数据
  if (characterId) {
    const character = getCharacterById(bookSlug, characterId);
    if (character && character.persona) {
      return `${character.persona}

以下是你（${character.name}）相关的书中片段，用来帮助你回答读者的问题：

${context}

请以${character.name}的口吻和语气，用第一人称回答读者的问题。`;
    }
  }

  // 使用默认主角人设
  const rp = config.roleplay;
  if (rp?.enabled) {
    const persona = getPersona(bookSlug);
    if (persona) {
      return `${persona}

以下是你（${rp.characterName}）在书中相关经历的片段，用来帮助你回答读者的问题：

${context}

请以${rp.characterName}的口吻和语气，用第一人称回答读者的问题。`;
    }
  }

  // 兜底：普通助手模式
  return `你是一位帮助读者理解${config.title}的 AI 助手。
请根据以下书中的相关段落，用中文回答用户的问题。
回答要准确、简洁，并基于书中内容。如果提供的段落不足以回答问题，请如实说明。

相关段落：
${context}`;
}

/**
 * 构建双角色 System Prompt（玩家扮演模式）
 * AI 以 aiCharacterId 身份对话，同时告知对方（玩家）是 playerCharacterId
 * @param bookSlug          书籍 slug
 * @param context           RAG 检索到的上下文
 * @param aiCharacterId     AI 扮演的人物 ID
 * @param playerCharacterId 玩家扮演的人物 ID
 */
export function buildDualRoleSystemPrompt(
  bookSlug: string,
  context: string,
  aiCharacterId: string,
  playerCharacterId: string
): string {
  const aiCharacter = getCharacterById(bookSlug, aiCharacterId);
  const playerCharacter = getCharacterById(bookSlug, playerCharacterId);

  // 如果找不到 AI 角色，降级为单角色模式
  if (!aiCharacter) {
    return buildSystemPrompt(bookSlug, context);
  }

  const playerInfo = playerCharacter
    ? `重要背景：你正在与书中的另一位角色「${playerCharacter.name}」对话。
「${playerCharacter.name}」的身份：${playerCharacter.role}
「${playerCharacter.name}」的性格：${playerCharacter.traits.slice(0, 3).join('；')}`
    : '';

  return `${aiCharacter.persona}

${playerInfo}

以下是与当前对话相关的书中片段：

${context}

请保持「${aiCharacter.name}」的口吻与人物性格，以第一人称回应对方。不要打破人物扮演，始终以${aiCharacter.name}的视角说话。`;
}

// ─── 公共类型 ──────────────────────────────────────────────────────────────────

export interface RagSource {
  chapterTitle: string;
  excerpt: string;
  score: number;
}

export interface RagResult {
  answer: string;
  sources: RagSource[];
}

// ─── 数据库工具 ────────────────────────────────────────────────────────────────

const TOP_K = 5;

function getPool(): Pool {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('SUPABASE_DB_URL 环境变量未设置');
  return new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function retrieveTopK(pool: Pool, bookSlug: string, questionVector: number[]) {
  const result = await pool.query(
    'SELECT id, content, metadata, embedding FROM rag_documents WHERE collection = $1',
    [bookSlug]
  );
  if (result.rows.length === 0) return [];

  return result.rows
    .map((row: { content: string; metadata: { chapterTitle?: string; type?: string }; embedding: number[] }) => {
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
}

// ─── 对外接口 ──────────────────────────────────────────────────────────────────

export async function query(question: string, bookSlug = 'wo-kanjian-de-shijie'): Promise<RagResult> {
  const pool = getPool();
  const embeddings = getEmbeddings();

  try {
    const questionVector = await embeddings.embedQuery(question);
    const topDocs = await retrieveTopK(pool, bookSlug, questionVector);

    if (topDocs.length === 0) {
      return { answer: '抱歉，向量库为空，请先构建向量库。', sources: [] };
    }

    const sources: RagSource[] = topDocs.map((doc: { content: string; chapterTitle: string; score: number }) => ({
      chapterTitle: doc.chapterTitle,
      excerpt: doc.content.slice(0, 150) + (doc.content.length > 150 ? '...' : ''),
      score: doc.score,
    }));

    const context = sources
      .map((s, i) => `[来源 ${i + 1}] 章节：${s.chapterTitle}\n${s.excerpt}`)
      .join('\n\n---\n\n');

    const answer = await callLLM([
      { role: 'system', content: buildSystemPrompt(bookSlug, context) },
      { role: 'user', content: question },
    ]);

    return { answer, sources };
  } finally {
    await pool.end();
  }
}

/**
 * 流式问答：返回 sources + MiniMax 原始 SSE 流
 * @param question          用户问题
 * @param bookSlug          书籍 slug
 * @param characterId       读者模式：AI 扮演的人物 ID（可选，不传则用默认主角）
 * @param playerCharacterId 玩家扮演模式：玩家的人物 ID（传入则进入双角色模式）
 */
export async function queryStream(
  question: string,
  bookSlug = 'wo-kanjian-de-shijie',
  characterId?: string,
  playerCharacterId?: string
): Promise<{ sources: RagSource[]; stream: ReadableStream<Uint8Array> }> {
  const pool = getPool();
  const embeddings = getEmbeddings();

  try {
    const questionVector = await embeddings.embedQuery(question);
    const topDocs = await retrieveTopK(pool, bookSlug, questionVector);

    if (topDocs.length === 0) {
      throw new Error('向量库为空，请先构建向量库。');
    }

    const sources: RagSource[] = topDocs.map((doc: { content: string; chapterTitle: string; score: number }) => ({
      chapterTitle: doc.chapterTitle,
      excerpt: doc.content.slice(0, 150) + (doc.content.length > 150 ? '...' : ''),
      score: doc.score,
    }));

    const context = sources
      .map((s, i) => `[来源 ${i + 1}] 章节：${s.chapterTitle}\n${s.excerpt}`)
      .join('\n\n---\n\n');

    // 根据是否传入 playerCharacterId 决定使用单角色还是双角色 system prompt
    let systemPrompt: string;
    if (playerCharacterId && characterId && playerCharacterId !== characterId) {
      // 玩家扮演模式：characterId 是 AI 角色，playerCharacterId 是玩家角色
      systemPrompt = buildDualRoleSystemPrompt(bookSlug, context, characterId, playerCharacterId);
    } else {
      // 读者模式：characterId 可选
      systemPrompt = buildSystemPrompt(bookSlug, context, characterId);
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
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

/** 获取当前人设状态（供接口查询用）*/
export function getPersonaStatus(bookSlug: string): { hasSaved: boolean; source: 'extracted' | 'fallback'; persona: string } {
  const saved = loadSavedPersona(bookSlug);
  const config = BOOK_CONFIGS[bookSlug];
  if (saved) {
    return { hasSaved: true, source: 'extracted', persona: saved };
  }
  return {
    hasSaved: false,
    source: 'fallback',
    persona: config?.roleplay?.fallbackPersona || '',
  };
}
