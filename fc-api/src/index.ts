/**
 * FC API 服务入口
 * 包含：/api/rag（问答）、/api/rag/stream（流式问答）、/api/rag/build（构建向量库）
 * 支持多本书，通过 bookSlug 参数区分
 *
 * 本地开发：ts-node src/index.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { query, queryStream, buildVectorStore, extractPersona, getPersonaStatus } from './lib/rag';
import { callLLM, callLLMStream } from './lib/llm';

const app = express();

// CORS：允许你的博客域名跨域调用
const allowedOrigins = [
  'https://lusuijie.com.cn',
  'http://lusuijie.com.cn',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
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

// 读取书籍章节数据
function loadBookData(bookSlug: string): { chapters: { id?: number; title: string; content: string; type?: string }[] } {
  const dataDir = path.join(__dirname, '..', 'data');
  const filePath = path.join(dataDir, `${bookSlug}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`书籍数据文件不存在: ${bookSlug}.json`);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(filePath) as { chapters: { id?: number; title: string; content: string; type?: string }[] };
}

// POST /api/rag - 普通问答接口
app.post('/api/rag', async (req: Request, res: Response) => {
  const { question, bookSlug = 'wo-kanjian-de-shijie' } = req.body as { question?: string; bookSlug?: string };

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ message: '问题不能为空' });
  }
  if (question.trim().length > 500) {
    return res.status(400).json({ message: '问题过长，请控制在 500 字以内' });
  }

  try {
    const result = await query(question.trim(), bookSlug);
    return res.status(200).json(result);
  } catch (error) {
    console.error('RAG 查询失败:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return res.status(500).json({ message });
  }
});

// POST /api/rag/stream - 流式问答接口（SSE）
app.post('/api/rag/stream', async (req: Request, res: Response) => {
  const {
    question,
    bookSlug = 'wo-kanjian-de-shijie',
    characterId,
    playerCharacterId,
  } = req.body as {
    question?: string;
    bookSlug?: string;
    characterId?: string;
    playerCharacterId?: string;
  };

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
      const { sources, stream } = await queryStream(
        question.trim(),
        bookSlug,
        characterId,
        playerCharacterId
      );

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
              }> | null;
              base_resp?: { status_code?: number; status_msg?: string };
              input_sensitive?: boolean;
              output_sensitive?: boolean;
              output_sensitive_type?: number;
            };

            // 检测 MiniMax 限流错误（2064 等非 0 status_code），抛出后触发重试
            const statusCode = json.base_resp?.status_code;
            if (statusCode !== undefined && statusCode !== 0) {
              throw new Error(`MiniMax 限流: ${statusCode} ${json.base_resp?.status_msg || ''}`);
            }

            // 安全策略触发：input_sensitive 或 output_sensitive 为 true
            if (json.input_sensitive || json.output_sensitive) {
              console.warn('[stream] MiniMax 安全策略触发, output_sensitive_type:', json.output_sensitive_type);
              send('error', { code: 'content_filter', message: '该问题触发了内容安全策略，请换个方式提问。' });
              res.end();
              return;
            }

            // choices 为 null/空 且 token 为 0 = MiniMax 限流（2064）返回的空响应
            if (json.choices === null || json.choices?.length === 0) {
              const usageTokens = (json as { usage?: { total_tokens?: number } }).usage?.total_tokens;
              if (usageTokens === 0) {
                throw new Error('MiniMax 限流: choices=null total_tokens=0');
              }
              continue;
            }

            const choice = json.choices?.[0];
            if (!choice) continue;

            // 流式 delta：content 和 reasoning_content 分开推送，前端可区分展示
            const answerDelta = choice?.delta?.content || '';
            const thinkingDelta = choice?.delta?.reasoning_content || '';

            if (thinkingDelta) {
              send('delta', { text: thinkingDelta, type: 'thinking' });
              deltaCount++;
            }
            if (answerDelta) {
              send('delta', { text: answerDelta, type: 'answer' });
              deltaCount++;
            }

            // 兜底：整个流结束后如果 deltaCount===0（一个 delta 都没推过），
            // 说明 MiniMax 以非流式方式返回了内容（只有 finish 帧的 message），从 message 补推
            if (choice?.finish_reason && choice?.message && deltaCount === 0) {
              const msgContent = choice.message.content || '';
              const msgThinking = choice.message.reasoning_content || '';
              if (msgThinking) {
                send('delta', { text: msgThinking, type: 'thinking' });
                deltaCount++;
              }
              if (msgContent) {
                send('delta', { text: msgContent, type: 'answer' });
                deltaCount++;
              }
              if (deltaCount === 0) {
                console.warn('[stream] finish 但 message 也为空，完整 choice:', JSON.stringify(choice));
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
// body: { bookSlug?: string }  默认构建 wo-kanjian-de-shijie
app.post('/api/rag/build', async (req: Request, res: Response) => {
  const { bookSlug = 'wo-kanjian-de-shijie' } = req.body as { bookSlug?: string };

  try {
    const booksData = loadBookData(bookSlug);
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

    const docCount = await buildVectorStore(docs, bookSlug);
    return res.status(200).json({ message: `[${bookSlug}] 向量库构建成功`, docCount });
  } catch (error) {
    console.error('向量库构建失败:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return res.status(500).json({ message });
  }
});

// POST /api/rag/extract-persona - 从书中自动提取角色人设
// body: { bookSlug?: string; sampleCount?: number }
app.post('/api/rag/extract-persona', async (req: Request, res: Response) => {
  const { bookSlug = 'wo-kanjian-de-shijie', sampleCount = 30 } = req.body as {
    bookSlug?: string;
    sampleCount?: number;
  };

  try {
    const booksData = loadBookData(bookSlug);
    const { chapters } = booksData;
    const persona = await extractPersona(bookSlug, chapters, sampleCount);
    return res.status(200).json({
      message: `[${bookSlug}] 人设提取成功`,
      persona,
      sampleChapters: Math.min(sampleCount, chapters.length),
    });
  } catch (error) {
    console.error('人设提取失败:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return res.status(500).json({ message });
  }
});

// GET /api/rag/persona-status - 查询当前人设状态
app.get('/api/rag/persona-status', (req: Request, res: Response) => {
  const bookSlug = (req.query.bookSlug as string) || 'wo-kanjian-de-shijie';
  try {
    const status = getPersonaStatus(bookSlug);
    return res.status(200).json({ bookSlug, ...status });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return res.status(500).json({ message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 小说创作 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 从 AI 返回文本中提取 JSON 对象或数组，并清理常见格式问题
 * 
 * 改进：
 * 1. 优先提取 markdown 代码块中的 JSON
 * 2. 使用括号匹配算法找最后一个完整的 JSON 块（避免把思维链里的 { 当起点）
 * 3. 清理全角引号
 */
function extractJSON(text: string, type: 'object' | 'array' = 'object'): string {
  let s = text.trim();

  // 1. 优先从 markdown 代码块提取
  const codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    s = codeBlockMatch[1].trim();
  }

  // 2. 清理全角引号
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');

  // 3. 找第一个完整的目标类型 JSON 块（[ 找最外层数组，{ 找最外层对象）
  //    遇到目标起始符后，用括号深度匹配找到对应结束符，立即返回
  const [openChar, closeChar] = type === 'array' ? ['[', ']'] : ['{', '}'];

  for (let i = 0; i < s.length; i++) {
    if (s[i] === openChar) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < s.length; j++) {
        const c = s[j];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === openChar) depth++;
        else if (c === closeChar) {
          depth--;
          if (depth === 0) {
            // 找到第一个完整的块，直接返回
            return s.slice(i, j + 1);
          }
        }
      }
    }
  }

  // 降级：返回原始文本（让 JSON.parse 抛出更清晰的错误）
  return s;
}

// POST /api/novel/chat - 通用 AI 对话（向导步骤使用）
app.post('/api/novel/chat', async (req: Request, res: Response) => {
  const { systemPrompt, userPrompt } = req.body as { systemPrompt?: string; userPrompt?: string };

  if (!userPrompt || typeof userPrompt !== 'string') {
    return res.status(400).json({ message: 'userPrompt 不能为空' });
  }

  try {
    const content = await callLLM([
      { role: 'system', content: systemPrompt || '你是一位专业的小说创作助手，帮助用户规划和创作长篇小说。' },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.7 });
    return res.status(200).json({ content });
  } catch (error) {
    console.error('[novel/chat] AI 调用失败:', error);
    return res.status(500).json({ message: error instanceof Error ? error.message : 'AI 调用失败' });
  }
});

// POST /api/novel/outline - 大纲生成
app.post('/api/novel/outline', async (req: Request, res: Response) => {
  const { idea } = req.body as { idea?: string };

  if (!idea || typeof idea !== 'string' || idea.trim().length === 0) {
    return res.status(400).json({ message: '故事灵感不能为空' });
  }
  if (idea.trim().length > 2000) {
    return res.status(400).json({ message: '故事灵感请控制在 2000 字以内' });
  }

  const systemPrompt = `你是一位经验丰富的小说策划编辑，专门帮助作者将模糊的创作灵感整理成系统化的故事大纲。
你的任务是根据用户提供的故事想法，生成一份结构完整、逻辑清晰的小说大纲。

【输出要求】
必须以 JSON 格式返回，包含以下字段：
- genre: 小说类型（如：玄幻、仙侠、都市、科幻、历史、悬疑、言情等）
- theme: 核心主题（一句话，如"在无情的修炼世界中寻找人性温暖"）
- logline: 故事概述（2-3句话，说清楚主角是谁、面临什么问题、追求什么目标）
- setting: 故事背景（时代、地点、世界概况，100字以内）
- conflict: 核心冲突（主角与什么对抗？内部冲突vs外部冲突，100字以内）
- arc: 故事走向（起承转合，分4个阶段简述，200字以内）
- estimatedChapters: 预计章节数（整数，根据故事规模判断，建议30-200）

【注意】
- 只返回 JSON 对象，不要有任何前缀、说明或 markdown 代码块
- 所有字段必须有内容，不能为空字符串
- estimatedChapters 必须是数字类型`;

  try {
    const content = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请根据以下故事灵感，生成完整的小说大纲：\n\n${idea.trim()}` },
    ], { temperature: 0.7 });

    // 尝试解析 JSON
    let outline: Record<string, unknown> | null = null;
    let parseError: string | null = null;

    try {
      const jsonStr = extractJSON(content);
      outline = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'JSON 解析失败';
      console.warn('[novel/outline] JSON 解析失败，原始内容 (前500字):', content.slice(0, 500));
    }

    // 解析成功：正常返回结构化数据
    if (outline) {
      return res.status(200).json({
        idea: idea.trim(),
        genre: String(outline.genre || ''),
        theme: String(outline.theme || ''),
        logline: String(outline.logline || ''),
        setting: String(outline.setting || ''),
        conflict: String(outline.conflict || ''),
        arc: String(outline.arc || ''),
        estimatedChapters: Number(outline.estimatedChapters) || 30,
      });
    }

    // 解析失败兜底：把 AI 原始返回文本透传给前端
    // 前端可以展示给用户，避免白屏或无意义的报错
    console.warn('[novel/outline] 使用兜底模式，解析错误:', parseError);
    return res.status(200).json({
      idea: idea.trim(),
      genre: '',
      theme: '',
      logline: content.slice(0, 200),  // 用原始内容作为 logline 展示
      setting: '',
      conflict: '',
      arc: content,                      // 原始全文放到 arc 字段，前端可展示
      estimatedChapters: 30,
      _rawContent: content,              // 透传原始内容，前端可用于调试
      _parseError: parseError,
    });
  } catch (error) {
    console.error('[novel/outline] 大纲生成失败:', error);
    return res.status(500).json({ message: error instanceof Error ? error.message : '大纲生成失败，请重试' });
  }
});

// POST /api/novel/summarize - 章节摘要生成
app.post('/api/novel/summarize', async (req: Request, res: Response) => {
  const { content, chapterNumber, title } = req.body as {
    content?: string;
    chapterNumber?: number;
    title?: string;
  };

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ message: '章节内容不能为空' });
  }

  const systemPrompt = `你是一位专业的小说编辑，擅长提炼故事核心内容。
你的任务是将一个完整章节压缩为简短的故事摘要，供 AI 在创作后续章节时参考。

【摘要要求】
1. 字数严格控制在 300 汉字以内
2. 必须包含：本章核心事件（发生了什么）、人物关键变化（情绪/关系/状态）、已埋设或回收的伏笔提示
3. 使用过去时态，客观陈述，不加评论
4. 直接输出摘要文字，不要有任何前缀、标题或格式标记`;

  const chapterLabel = title ? `第${chapterNumber}章《${title}》` : `第${chapterNumber}章`;

  try {
    let summary = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请为以下${chapterLabel}生成摘要：\n\n${content.slice(0, 8000)}` },
    ], { temperature: 0.3 });

    summary = summary.trim();

    // 超出 300 汉字时截断
    const chineseChars = summary.match(/[\u4e00-\u9fff]/g) || [];
    if (chineseChars.length > 300) {
      let count = 0;
      let cutPos = summary.length;
      for (let i = 0; i < summary.length; i++) {
        if (/[\u4e00-\u9fff]/.test(summary[i])) {
          count++;
          if (count >= 300) { cutPos = i + 1; break; }
        }
      }
      summary = summary.slice(0, cutPos) + '…';
    }

    return res.status(200).json({ summary });
  } catch (error) {
    console.error('[novel/summarize] 摘要生成失败:', error);
    return res.status(500).json({ message: error instanceof Error ? error.message : '摘要生成失败' });
  }
});

// POST /api/novel/suggest - AI 修改建议
app.post('/api/novel/suggest', async (req: Request, res: Response) => {
  const { content, worldContext, chapterNumber } = req.body as {
    content?: string;
    worldContext?: string;
    chapterNumber?: number;
  };

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ message: '章节内容不能为空' });
  }

  const systemPrompt = `你是一位资深小说编辑，专注于长篇网络小说的质量提升。
你的任务是对用户提交的章节草稿提供专业的修改意见。

【评审维度】
1. 节奏感：场景推进是否合适，是否有拖沓或过于跳跃的问题
2. 逻辑性：情节是否符合前设定，人物行为是否有合理动机
3. 人物一致性：人物性格、说话方式是否与设定一致
4. 悬念钩子：结尾是否足够吸引人读下一章
5. 描写深度：关键情节是否有足够的细节描写

【输出格式】
以 JSON 数组返回，每条意见包含：
- dimension: 评审维度名称（从上面5个维度中选择）
- issue: 发现的问题（具体指出）
- suggestion: 修改建议（给出可操作的改进方向）

只返回发现问题的维度（无问题的维度不需要返回），最多返回5条，最少1条。
只返回 JSON 数组，不要其他说明。`;

  const contextSection = worldContext ? `【小说背景参考】\n${worldContext.slice(0, 1000)}\n\n` : '';

  try {
    const responseText = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${contextSection}请评审第${chapterNumber}章草稿：\n\n${content.slice(0, 6000)}` },
    ], { temperature: 0.5 });

    let suggestions: unknown[] | null = null;
    let parseError: string | null = null;

    try {
      const jsonStr = extractJSON(responseText, 'array');
      const parsed = JSON.parse(jsonStr) as unknown[];
      if (Array.isArray(parsed)) suggestions = parsed;
      else parseError = 'AI 返回的不是数组格式';
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'JSON 解析失败';
      console.warn('[novel/suggest] JSON 解析失败，原始内容 (前300字):', responseText.slice(0, 300));
    }

    // 解析成功
    if (suggestions) {
      return res.status(200).json({ suggestions });
    }

    // 兜底：把原始文本作为一条建议返回，不报错
    console.warn('[novel/suggest] 使用兜底模式，解析错误:', parseError);
    return res.status(200).json({
      suggestions: [{
        dimension: 'AI 原始建议',
        issue: '返回格式解析失败',
        suggestion: responseText,
      }],
      _parseError: parseError,
    });
  } catch (error) {
    console.error('[novel/suggest] 建议生成失败:', error);
    return res.status(500).json({ message: error instanceof Error ? error.message : '建议生成失败' });
  }
});

// POST /api/novel/generate - 章节生成（SSE 流式输出）
app.post('/api/novel/generate', async (req: Request, res: Response) => {
  const { systemPrompt, chapterNumber, chapterTitle } = req.body as {
    systemPrompt?: string;
    chapterNumber?: number;
    chapterTitle?: string;
  };

  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return res.status(400).json({ message: 'systemPrompt 不能为空' });
  }
  if (!chapterNumber || typeof chapterNumber !== 'number') {
    return res.status(400).json({ message: 'chapterNumber 必须是数字' });
  }

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const chapterLabel = chapterTitle
    ? `第${chapterNumber}章《${chapterTitle}》`
    : `第${chapterNumber}章`;

  const userPrompt = `请根据上述故事圣经，创作${chapterLabel}的完整内容。

【写作要求】
1. 字数：2000-4000字
2. 开头直接进入剧情，不需要写章节标题
3. 保持与前文一致的叙事风格
4. 如有伏笔任务，自然融入行文中
5. 章节结尾留有悬念或情绪钩子，引导读者继续阅读

请开始创作：`;

  try {
    const stream = await callLLMStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { maxTokens: 8192, temperature: 0.75 });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (raw === '[DONE]') {
          sendEvent('done', {});
          res.end();
          return;
        }
        try {
          const data = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = data?.choices?.[0]?.delta?.content;
          // 只转发实际内容，忽略 reasoning_content（推理过程）
          if (delta) sendEvent('delta', { text: delta });
        } catch {
          // 忽略解析错误
        }
      }
    }

    sendEvent('done', {});
    res.end();
  } catch (error) {
    console.error('[novel/generate] 章节生成失败:', error);
    sendEvent('error', { message: error instanceof Error ? error.message : '章节生成失败' });
    res.end();
  }
});

// POST /api/novel/storyboard - 分镜生成
app.post('/api/novel/storyboard', async (req: Request, res: Response) => {
  const { content, chapterNumber, chapterTitle, characters } = req.body as {
    content?: string;
    chapterNumber?: number;
    chapterTitle?: string;
    characters?: { name: string; appearance?: string }[];
  };

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ message: '章节内容不能为空' });
  }

  const charNames = Array.isArray(characters)
    ? characters.map((c) => c.name).join('、')
    : '';

  // 角色外貌映射表，用于生成 imagePrompt
  const charAppearanceMap: Record<string, string> = {};
  if (Array.isArray(characters)) {
    for (const c of characters) {
      if (c.name && c.appearance) {
        charAppearanceMap[c.name] = c.appearance;
      }
    }
  }

  const VALID_POSES = ['stand', 'sit', 'run', 'fight', 'fall'];
  const VALID_SCENES = ['outdoor', 'indoor', 'abstract'];
  const VALID_POS = ['left', 'center', 'right'];

  // 内容截取：最多传 5000 字给 LLM
  const contentForLLM = content.trim().slice(0, 5000);

  // 用 few-shot 示例引导模型直接输出 JSON
  const systemPrompt = `你是专业的漫画分镜脚本编辑。只输出一个 JSON 数组，不要任何解释、标题或代码块标记。

你的职责是：
1. 仔细阅读章节内容，理解故事节奏、场景转换和情感变化
2. 自主决定需要多少格分镜（通常每个独立场景/事件1格，情绪强烈的关键时刻可单独一格）
3. 确保分镜覆盖：开场环境、主要事件经过、高潮冲突、情感收尾
4. 每格必须包含 imagePrompt（英文），用于 AI 图像生成，描述该格的场景画面

输出示例（严格按此格式）：
[{"index":1,"sceneType":"outdoor","narration":"晨雾笼罩山峰","imagePrompt":"misty mountain peak at dawn, anime style, young man standing, soft light","figures":[{"name":"林逸","pose":"stand","positionX":"center","dialogue":"今日必有大事"}]},{"index":2,"sceneType":"indoor","narration":"结果令人震惊","imagePrompt":"dimly lit hall, young man with shocked expression, elder pointing, dramatic lighting, anime style","figures":[{"name":"林逸","pose":"fall","positionX":"center","dialogue":"怎么可能"}]}]

字段规则（必须严格遵守，否则渲染失败）：
- index：从1开始的连续整数
- sceneType：只能是 outdoor 或 indoor 或 abstract（内心/梦境/回忆用abstract）
- narration：场景旁白，≤20字，可省略
- imagePrompt：英文图像描述，包含场景环境+人物动态+光线氛围+风格，必填，50字以内
- figures：人物数组，每格1到2人，不能为空数组
- figures[].name：人物姓名，必须用已知人物名
- figures[].pose：只能是 stand 或 sit 或 run 或 fight 或 fall
- figures[].positionX：只能是 left 或 center 或 right（2人时一左一右）
- figures[].dialogue：台词，≤15字，关键对白才加，可省略

已知人物及外貌：${charNames || '主角'}${Object.keys(charAppearanceMap).length > 0 ? '\n人物外貌参考：' + Object.entries(charAppearanceMap).map(([n, a]) => `${n}: ${a}`).join('；') : ''}
注意：每格 figures 不能为空！imagePrompt 必须是英文，且融入人物外貌特征！`;

  const userPrompt = `请为以下章节设计完整的漫画分镜。根据故事内容自主决定格数（不要有数量限制，有几个独立场景就画几格），按叙事顺序推进。只输出JSON数组，不要其他文字：

第${chapterNumber}章《${chapterTitle}》
${contentForLLM}`;

  try {
    const llmOutput = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.1, maxTokens: 4096 }
    );
    console.log('[storyboard] llmOutput length:', llmOutput.length);
    console.log('[storyboard] llmOutput full:', llmOutput);

    const jsonStr = extractJSON(llmOutput, 'array');
    console.log('[storyboard] jsonStr length:', jsonStr.length);
    console.log('[storyboard] jsonStr full:', jsonStr.slice(0, 2000));

    let parsed: Record<string, unknown>[];
    try {
      parsed = JSON.parse(jsonStr) as Record<string, unknown>[];
    } catch (parseErr) {
      console.error('[storyboard] JSON.parse failed:', (parseErr as Error).message);
      console.error('[storyboard] jsonStr that failed:', jsonStr);
      throw parseErr;
    }

    console.log('[storyboard] parsed length:', parsed.length);
    console.log('[storyboard] parsed[0]:', JSON.stringify(parsed[0]));

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('LLM 未返回有效的分镜数组');
    }

    // 默认人物名（取已知人物第一个，否则用"主角"）
    const defaultCharName = charNames ? charNames.split('、')[0] : '主角';

    const panels = parsed.slice(0, 40).map((p, i) => {
      console.log(`[storyboard] panel[${i}] raw figures:`, JSON.stringify(p.figures));
      const rawFigures = Array.isArray(p.figures) ? p.figures : [];
      const mappedFigures = rawFigures
        .slice(0, 2)
        .map((f: Record<string, unknown>) => ({
          name: String(f.name || defaultCharName),
          pose: VALID_POSES.includes(f.pose as string) ? (f.pose as string) : 'stand',
          positionX: VALID_POS.includes(f.positionX as string) ? (f.positionX as string) : 'center',
          ...(f.dialogue ? { dialogue: String(f.dialogue).slice(0, 15) } : {}),
        }));

      // figures 为空时补一个默认站立人物，避免渲染空白格
      const figures = mappedFigures.length > 0
        ? mappedFigures
        : [{ name: defaultCharName, pose: 'stand', positionX: 'center' }];

      // 生成 imagePrompt：优先用 LLM 返回的，否则根据场景和人物自动生成
      let imagePrompt = '';
      if (p.imagePrompt && typeof p.imagePrompt === 'string') {
        imagePrompt = String(p.imagePrompt).slice(0, 200);
      } else {
        // fallback：根据场景和人物自动拼接英文描述
        const sceneDesc = p.sceneType === 'outdoor' ? 'outdoor scene' : p.sceneType === 'indoor' ? 'indoor scene' : 'abstract dreamlike scene';
        const figDesc = figures.map((f: { name: string; pose: string }) => {
          const appearance = charAppearanceMap[f.name];
          return appearance ? `${f.name} (${appearance}), ${f.pose}ing` : `${f.name}, ${f.pose}ing`;
        }).join(', ');
        const narration = p.narration ? String(p.narration) : '';
        imagePrompt = `${sceneDesc}, ${figDesc}${narration ? ', ' + narration : ''}, anime style, manga panel, detailed`;
      }

      return {
        index: i + 1,
        sceneType: VALID_SCENES.includes(p.sceneType as string) ? p.sceneType : 'abstract',
        ...(p.narration ? { narration: String(p.narration).slice(0, 20) } : {}),
        imagePrompt,
        figures,
      };
    });

    return res.status(200).json({ panels });
  } catch (error) {
    console.error('[novel/storyboard] 分镜生成失败:', error);
    return res.status(500).json({ message: error instanceof Error ? error.message : '分镜生成失败' });
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
