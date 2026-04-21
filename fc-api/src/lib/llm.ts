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

export interface CallLLMOptions {
  maxTokens?: number;
  temperature?: number;
}

/** 普通非流式调用（用于 build 等场景） */
export async function callLLM(messages: LLMMessage[], options: CallLLMOptions = {}): Promise<string> {
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
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API 错误: ${res.status} ${err}`);
  }

  const rawText = await res.text();

  // MiniMax 有时会返回多行 JSON（限流错误行 + 实际响应行拼在一起）
  // 逐行尝试解析，找到包含 choices 的那行
  type MiniMaxResp = {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
    type?: string;
    error?: { message?: string };
    base_resp?: { status_code?: number; status_msg?: string };
  };

  let data: MiniMaxResp | null = null;
  const lines = rawText.split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as MiniMaxResp;
      // 优先找有 choices 的行
      if (parsed.choices) {
        data = parsed;
        break;
      }
      // 检测限流错误
      if (parsed.type === 'error' || (parsed.base_resp && parsed.base_resp.status_code !== 0)) {
        const errMsg = parsed.error?.message || parsed.base_resp?.status_msg || '限流';
        throw new Error(`MiniMax 限流: ${errMsg}`);
      }
    } catch (e) {
      if ((e as Error).message.startsWith('MiniMax 限流')) throw e;
      // 解析失败忽略这行，继续下一行
    }
  }

  if (!data) {
    console.error('[callLLM] 无法解析响应, raw (first 500):', rawText.slice(0, 500));
    throw new Error('MiniMax API 响应解析失败：未找到有效的 choices 数据');
  }

  const msg = data.choices?.[0]?.message;
  // 只取 content 字段，不 fallback 到 reasoning_content（推理内容不是业务结果）
  // reasoning_content 是思维链文本，不能当作 JSON 或业务响应返回
  const content = msg?.content;
  if (!content) {
    // 调试：打印完整响应帮助排查
    console.warn('[callLLM] content 为空, msg:', JSON.stringify(msg)?.slice(0, 300));
    throw new Error(`MiniMax API 返回内容为空: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return content;
}

/** 流式调用，返回 Response 的 body（SSE 原始流），由调用方负责管道转发 */
export async function callLLMStream(messages: LLMMessage[], options: CallLLMOptions = {}): Promise<ReadableStream<Uint8Array>> {
  const { apiKey } = getKeys();

  // 30 秒超时，防止 fetch 无限挂起导致 "fetch failed"
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(MINIMAX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages,
        temperature: options.temperature ?? 0.75,
        max_tokens: options.maxTokens ?? 8192,
        stream: true,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API 错误: ${res.status} ${err}`);
  }

  if (!res.body) {
    throw new Error('MiniMax API 未返回流');
  }

  return res.body;
}
