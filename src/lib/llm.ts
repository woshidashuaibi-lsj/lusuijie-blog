/**
 * LLM 封装 - MiniMax API
 * 模型：abab6.5s-chat
 * 环境变量：MINIMAX_API_KEY, MINIMAX_GROUP_ID
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLLM(messages: LLMMessage[]): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;

  if (!apiKey || !groupId) {
    throw new Error('MINIMAX_API_KEY 或 MINIMAX_GROUP_ID 未配置');
  }

  const url = `https://api.minimax.chat/v1/text/chatcompletion_v2`;

  const body = {
    model: 'MiniMax-M2.7',
    messages,
    temperature: 0.3,
    max_tokens: 1024,
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
  console.log('MiniMax API 原始响应:', JSON.stringify(data, null, 2));
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`MiniMax API 返回格式异常: ${JSON.stringify(data)}`);
  }
  return content as string;
}
