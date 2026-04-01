/**
 * 触发构建向量库 API
 * POST /api/rag/build
 * 输出：{ message: string, docCount: number }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { buildVectorStore } from '@/lib/rag';
import booksData from '@/data/wo-kanjian-de-shijie.json';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { chapters } = booksData as { chapters: { title: string; content: string }[] };

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '。', '！', '？', '；', ' '],
    });

    const docs: { pageContent: string; metadata: Record<string, unknown> }[] = [];
    for (const chapter of chapters) {
      const chunks = await splitter.splitText(chapter.content);
      for (const chunk of chunks) {
        docs.push({
          pageContent: chunk,
          metadata: { chapterTitle: chapter.title },
        });
      }
    }

    const docCount = await buildVectorStore(docs);

    return res.status(200).json({
      message: '向量库构建成功',
      docCount,
    });
  } catch (error) {
    console.error('向量库构建失败:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return res.status(500).json({ message });
  }
}
