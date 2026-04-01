/**
 * RAG 核心逻辑 - Supabase PostgreSQL 版本
 */

import { Pool } from 'pg';
import { getEmbeddings } from './embeddings';
import { callLLM } from './llm';

const COLLECTION_NAME = 'wo-kanjian-de-shijie';
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
    const questionVector = await embeddings.embedQuery(question);

    const result = await pool.query(
      'SELECT id, content, metadata, embedding FROM rag_documents WHERE collection = $1',
      [COLLECTION_NAME]
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
      {
        role: 'system',
        content: `你是一位帮助读者理解《我看见的世界》（李飞飞自传）的 AI 助手。
请根据以下书中的相关段落，用中文回答用户的问题。
回答要准确、简洁，并基于书中内容。如果提供的段落不足以回答问题，请如实说明。

相关段落：
${context}`,
      },
      { role: 'user', content: question },
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
    await pool.query('DELETE FROM rag_documents WHERE collection = $1', [COLLECTION_NAME]);

    const batchSize = 5;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const vectors = await Promise.all(batch.map(doc => embeddings.embedQuery(doc.pageContent)));

      for (let j = 0; j < batch.length; j++) {
        await pool.query(
          `INSERT INTO rag_documents (id, collection, content, metadata, embedding) VALUES ($1, $2, $3, $4, $5)`,
          [`doc-${i + j}`, COLLECTION_NAME, batch[j].pageContent, JSON.stringify(batch[j].metadata), vectors[j]]
        );
      }
      console.log(`构建进度: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
    }

    return docs.length;
  } finally {
    await pool.end();
  }
}
