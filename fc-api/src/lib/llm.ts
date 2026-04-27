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

  // === 诊断日志 START ===
  console.log('[callLLM] rawText length:', rawText.length);
  console.log('[callLLM] rawText lines count:', rawText.split('\n').filter(l => l.trim()).length);
  console.log('[callLLM] rawText (first 1000):', rawText.slice(0, 1000));
  // === 诊断日志 END ===

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
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log(`[callLLM] parsing line[${i}] (len=${line.length}):`, line.slice(0, 200));
    try {
      const parsed = JSON.parse(line) as MiniMaxResp;
      // 优先找有 choices 的行
      if (parsed.choices) {
        console.log(`[callLLM] found choices at line[${i}], choices[0].message keys:`, Object.keys(parsed.choices?.[0]?.message || {}));
        console.log(`[callLLM] content (200):`, (parsed.choices?.[0]?.message?.content || '').slice(0, 200));
        console.log(`[callLLM] reasoning_content (200):`, (parsed.choices?.[0]?.message?.reasoning_content || '').slice(0, 200));
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
      console.log(`[callLLM] line[${i}] JSON.parse failed:`, (e as Error).message.slice(0, 100));
      // 解析失败忽略这行，继续下一行
    }
  }

  if (!data) {
    console.error('[callLLM] 无法解析响应, raw (first 500):', rawText.slice(0, 500));
    throw new Error('MiniMax API 响应解析失败：未找到有效的 choices 数据');
  }

  const msg = data.choices?.[0]?.message;
  const content = msg?.content;

  if (content && content.trim().length > 0) {
    console.log('[callLLM] content OK, length:', content.length, 'preview:', content.slice(0, 200));
    return content;
  }

  // content 为空或空字符串时：尝试从 reasoning_content 提取 JSON
  // MiniMax-M2.7 有时在限流/异常情况下把结果放在 reasoning_content 里，content 为空
  const reasoning = msg?.reasoning_content || '';
  console.warn('[callLLM] content 为空, reasoning_content length:', reasoning.length);
  console.warn('[callLLM] reasoning_content (前300):', reasoning.slice(0, 300));

  if (reasoning.trim().length > 0) {
    // 尝试从 reasoning_content 里提取 JSON 数组或对象（给 characters/extract 等场景用）
    const jsonMatch = reasoning.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      reasoning.match(/(\[[\s\S]*?\]|\{[\s\S]*?\})(?:\s*$)/);
    if (jsonMatch) {
      const extracted = (jsonMatch[1] || jsonMatch[0]).trim();
      console.warn('[callLLM] 从 reasoning_content 提取到 JSON, len:', extracted.length);
      return extracted;
    }
    // 没有 JSON 结构，reasoning_content 是纯文本分析，不能用作业务结果
  }

  console.error('[callLLM] content 为空且无法从 reasoning 提取, full data:', JSON.stringify(data).slice(0, 500));
  throw new Error('LLM 返回内容为空');
}

/** 流式调用，返回 Response 的 body（SSE 原始流），由调用方负责管道转发 */
export async function callLLMStream(messages: LLMMessage[], options: CallLLMOptions = {}): Promise<ReadableStream<Uint8Array>> {
  const { apiKey } = getKeys();

  const MAX_RETRY = 3;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    if (attempt > 0) {
      // 限流重试前等待 1.5s
      await new Promise(r => setTimeout(r, 1500));
      console.warn(`[callLLMStream] 第 ${attempt + 1} 次重试...`);
    }

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
    } catch (fetchErr) {
      clearTimeout(timer);
      lastErr = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      console.warn(`[callLLMStream] fetch 失败 (attempt ${attempt + 1}):`, lastErr.message);
      continue;
    } finally {
      clearTimeout(timer);
    }

    // 529 限流：重试
    if (res.status === 529) {
      const errText = await res.text().catch(() => '');
      lastErr = new Error(`MiniMax 限流: 529 ${errText.slice(0, 200)}`);
      console.warn(`[callLLMStream] 529 限流 (attempt ${attempt + 1}), 等待重试...`);
      continue;
    }

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`MiniMax API 错误: ${res.status} ${err}`);
    }

    if (!res.body) {
      throw new Error('MiniMax API 未返回流');
    }

    return res.body;
  }

  throw lastErr ?? new Error('MiniMax 流式请求失败，已重试 3 次');
}
