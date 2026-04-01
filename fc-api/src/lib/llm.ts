/**
 * LLM 封装 - MiniMax API
 * 模型：MiniMax-M2.7
 * 环境变量：MINIMAX_API_KEY, MINIMAX_GROUP_ID
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MINIMAX_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

function getKeys() {
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;
  if (!apiKey || !groupId) {
    throw new Error('MINIMAX_API_KEY 或 MINIMAX_GROUP_ID 未配置');
  }
  return { apiKey, groupId };
}

/** 普通非流式调用（用于 build 等场景） */
export async function callLLM(messages: LLMMessage[]): Promise<string> {
  const { apiKey } = getKeys();

  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API 错误: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  const msg = data?.choices?.[0]?.message;
  const content = msg?.content || msg?.reasoning_content;
  if (!content) {
    throw new Error(`MiniMax API 返回格式异常: ${JSON.stringify(data)}`);
  }
  return content;
}

/** 流式调用，返回 Response 的 body（SSE 原始流），由调用方负责管道转发 */
export async function callLLMStream(messages: LLMMessage[]): Promise<ReadableStream<Uint8Array>> {
  const { apiKey } = getKeys();

  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages,
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API 错误: ${res.status} ${err}`);
  }

  if (!res.body) {
    throw new Error('MiniMax API 未返回流');
  }

  return res.body;
}
