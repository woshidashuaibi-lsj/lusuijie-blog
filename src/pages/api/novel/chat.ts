/**
 * 通用 AI 对话 API（用于向导步骤中的各类 AI 辅助功能）
 * POST /api/novel/chat
 * Input: { systemPrompt: string, userPrompt: string }
 * Output: { content: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM } from '@/lib/llm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { systemPrompt, userPrompt } = req.body;

  if (!userPrompt || typeof userPrompt !== 'string') {
    return res.status(400).json({ message: 'userPrompt 不能为空' });
  }

  try {
    const content = await callLLM([
      {
        role: 'system',
        content: systemPrompt || '你是一个有创意的写作助手，帮助用户创作小说。',
      },
      { role: 'user', content: userPrompt },
    ]);

    return res.status(200).json({ content });
  } catch (error) {
    console.error('[novel/chat] AI 调用失败:', error);
    const message = error instanceof Error ? error.message : 'AI 调用失败';
    return res.status(500).json({ message });
  }
}
