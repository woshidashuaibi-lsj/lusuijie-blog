/**
 * LLM 封装 - MiniMax API
 * 模型：MiniMax-M2.7（推理模型）
 * 环境变量：MINIMAX_API_KEY, MINIMAX_GROUP_ID
 *
 * 注意：MiniMax-M2.7 是推理模型，自带 reasoning（思考过程）会消耗大量 token。
 * 必须保证 max_tokens 足够大（4096+），否则思考过程会把所有 token 吃完，导致 content 为空。
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallLLMOptions {
  /** 最大输出 token 数（含推理 token）。默认 4096，复杂任务可调高到 8192 */
  maxTokens?: number;
  /** 温度，0-1，默认 0.7 */
  temperature?: number;
}

export async function callLLM(
  messages: LLMMessage[],
  options: CallLLMOptions = {}
): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;

  if (!apiKey || !groupId) {
    throw new Error('MINIMAX_API_KEY 或 MINIMAX_GROUP_ID 未配置');
  }

  const url = `https://api.minimax.chat/v1/text/chatcompletion_v2`;

  const body = {
    model: 'MiniMax-M2.7',
    messages,
    temperature: options.temperature ?? 0.7,
    // 必须给足够大的 max_tokens：推理模型的思考过程本身会占用 token
    // 1024 时思考过程会把配额耗尽导致 content 为空，至少需要 4096
    max_tokens: options.maxTokens ?? 4096,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API 错误: ${res.status} ${err}`);
  }

  const data = await res.json();

  // finish_reason 为 length 说明被截断，打印警告但继续尝试使用内容
  const finishReason = data?.choices?.[0]?.finish_reason;
  if (finishReason === 'length') {
    console.warn('[LLM] 输出被截断（finish_reason: length），考虑提高 maxTokens');
  }

  const content = data?.choices?.[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new Error(`MiniMax API 返回格式异常: ${JSON.stringify(data)}`);
  }

  // content 为空字符串且有 reasoning_content，说明思考过程把 token 耗尽了
  if (content === '') {
    const reasoning = data?.choices?.[0]?.message?.reasoning_content || '';
    if (reasoning) {
      throw new Error(
        `输出 token 不足：推理过程消耗了全部 token（${options.maxTokens ?? 4096}），` +
        `请联系开发者提高 maxTokens 限制。`
      );
    }
    throw new Error('MiniMax API 返回了空内容，请重试');
  }

  return content as string;
}
