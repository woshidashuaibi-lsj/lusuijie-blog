/**
 * 章节生成 API（SSE 流式输出）
 * POST /api/novel/generate
 * Input: { systemPrompt: string, chapterNumber: number, chapterTitle?: string }
 * Output: SSE 流
 *   event: delta  data: { text: string }
 *   event: done   data: {}
 *   event: error  data: { message: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { LLMMessage } from '@/lib/llm';

// MiniMax 流式 API 调用
async function callLLMStream(
  messages: LLMMessage[],
  onDelta: (text: string) => void
): Promise<void> {
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY 未配置');
  }

  const url = `https://api.minimax.chat/v1/text/chatcompletion_v2`;

  const body = {
    model: 'MiniMax-M2.7',
    messages,
    temperature: 0.75,   // 写作创意度高一些
    // 推理模型思考过程会消耗 token，需要留足 8192 保证 4000 字章节能完整输出
    max_tokens: 8192,
    stream: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`MiniMax API 错误: ${res.status} ${err}`);
  }

  const reader = res.body.getReader();
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
      if (raw === '[DONE]') return;

      try {
        const data = JSON.parse(raw);
        const delta = data?.choices?.[0]?.delta?.content;
        // 只发送实际内容 delta，忽略推理模型的 reasoning_content（思考过程）
        if (delta) {
          onDelta(delta);
        }
      } catch {
        // 忽略解析错误
      }
    }
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { systemPrompt, chapterNumber, chapterTitle } = req.body;

  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return res.status(400).json({ message: 'systemPrompt 不能为空' });
  }

  if (!chapterNumber || typeof chapterNumber !== 'number') {
    return res.status(400).json({ message: 'chapterNumber 必须是数字' });
  }

  // SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  function sendEvent(event: string, data: object) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

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
    await callLLMStream(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      (text) => {
        sendEvent('delta', { text });
      }
    );

    sendEvent('done', {});
    res.end();
  } catch (error) {
    console.error('[novel/generate] 章节生成失败:', error);
    const message = error instanceof Error ? error.message : '章节生成失败';
    sendEvent('error', { message });
    res.end();
  }
}
