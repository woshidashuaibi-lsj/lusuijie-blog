/**
 * FC API 服务入口
 * 包含：/api/rag（问答）、/api/rag/build（构建向量库）
 *
 * 本地开发：ts-node src/index.ts
 * FC 部署：通过 handler 导出
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { query, buildVectorStore } from './lib/rag';

// 读取书籍数据（打包时会把 JSON 文件一起带上）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const booksData = require('../data/wo-kanjian-de-shijie.json') as {
  chapters: { title: string; content: string; type?: string }[];
};

const app = express();

// CORS：允许你的博客域名跨域调用
const allowedOrigins = [
  'https://lusuijie.com.cn',
  'http://lusuijie.com.cn',
  'http://localhost:3000',
  // OSS 静态域名
  'https://lusuijie-blog-static.oss-cn-beijing.aliyuncs.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin（服务端请求）或在白名单内的域名
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// 健康检查
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/rag - 问答接口
app.post('/api/rag', async (req: Request, res: Response) => {
  const { question } = req.body as { question?: string };

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ message: '问题不能为空' });
  }

  if (question.trim().length > 500) {
    return res.status(400).json({ message: '问题过长，请控制在 500 字以内' });
  }

  try {
    const result = await query(question.trim());
    return res.status(200).json(result);
  } catch (error) {
    console.error('RAG 查询失败:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return res.status(500).json({ message });
  }
});

// POST /api/rag/build - 构建向量库接口
app.post('/api/rag/build', async (_req: Request, res: Response) => {
  try {
    const { chapters } = booksData;

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', '。', '！', '？', '；', ' '],
    });

    const docs: { pageContent: string; metadata: Record<string, unknown> }[] = [];
    for (const chapter of chapters) {
      const chunks = await splitter.splitText(chapter.content);
      for (const chunk of chunks) {
        docs.push({
          pageContent: chunk,
          metadata: {
            chapterTitle: chapter.title,
            type: chapter.type || 'main',
          },
        });
      }
    }

    const docCount = await buildVectorStore(docs);
    return res.status(200).json({ message: '向量库构建成功', docCount });
  } catch (error) {
    console.error('向量库构建失败:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return res.status(500).json({ message });
  }
});

// 启动本地服务（本地开发用）
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`FC API 服务运行在 http://localhost:${PORT}`);
  });
}

export { app };
