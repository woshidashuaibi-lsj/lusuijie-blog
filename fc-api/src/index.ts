/**
 * FC API 服务入口
 * 包含：/api/rag（问答）、/api/rag/stream（流式问答）、/api/rag/build（构建向量库）
 *
 * 本地开发：ts-node src/index.ts
 * FC 部署：通过 handler 导出
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { query, queryStream, buildVectorStore } from './lib/rag';

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

// POST /api/rag - 普通问答接口
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

// POST /api/rag/stream - 流式问答接口（SSE）
app.post('/api/rag/stream', async (req: Request, res: Response) => {
  const { question } = req.body as { question?: string };

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ message: '问题不能为空' });
  }
  if (question.trim().length > 500) {
    return res.status(400).json({ message: '问题过长，请控制在 500 字以内' });
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // 最多重试 3 次（应对 MiniMax 2064 限流错误）
  const MAX_RETRY = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    if (attempt > 0) {
      // 重试前等待 1s
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      const { sources, stream } = await queryStream(question.trim());

      // 先把 sources 发给前端（每次都发，前端会覆盖）
      send('sources', sources);

      // 逐块解析 MiniMax SSE
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let deltaCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') continue;
          try {
            const json = JSON.parse(raw) as {
              choices?: Array<{
                delta?: { content?: string; reasoning_content?: string };
                message?: { content?: string; reasoning_content?: string };
                finish_reason?: string;
              }>;
              base_resp?: { status_code?: number; status_msg?: string };
            };

            // 检测 MiniMax 限流错误（2064 等非 0 status_code），抛出后触发重试
            const statusCode = json.base_resp?.status_code;
            if (statusCode !== undefined && statusCode !== 0) {
              throw new Error(`MiniMax 限流: ${statusCode} ${json.base_resp?.status_msg || ''}`);
            }

            const choice = json.choices?.[0];
            if (!choice) continue;

            // 流式 delta：取 content 或 reasoning_content
            const delta = choice?.delta?.content || choice?.delta?.reasoning_content || '';
            if (delta) {
              send('delta', { text: delta });
              deltaCount++;
            }

            // 兜底：finish 时如果有完整 message 且之前没有 delta，一次性推送
            if (choice?.finish_reason && choice?.message && deltaCount === 0) {
              const msgContent = choice.message.content || choice.message.reasoning_content || '';
              if (msgContent) {
                send('delta', { text: msgContent });
                deltaCount++;
              }
            }
          } catch (parseErr) {
            // 如果是限流错误，重新抛出触发重试
            if (parseErr instanceof Error && parseErr.message.startsWith('MiniMax 限流')) {
              throw parseErr;
            }
            // 其他解析失败忽略
          }
        }
      }

      send('done', {});
      return; // 成功，退出重试循环

    } catch (retryErr) {
      lastError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
      console.warn(`RAG 流式查询第 ${attempt + 1} 次失败:`, lastError.message);
      // 限流错误才重试，其他错误直接退出
      if (!lastError.message.startsWith('MiniMax 限流')) break;
    }
  }

  // 所有重试均失败
  if (lastError) {
    console.error('RAG 流式查询失败:', lastError.message);
    send('error', { message: lastError.message });
  }

  res.end();
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
