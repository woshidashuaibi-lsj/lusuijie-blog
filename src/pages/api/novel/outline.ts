/**
 * 大纲生成 API
 * POST /api/novel/outline
 * Input: { idea: string }
 * Output: OutlineData (JSON)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { OutlineData } from '@/types/novel';
import { callLLM } from '@/lib/llm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { idea } = req.body;

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

  const userPrompt = `请根据以下故事灵感，生成完整的小说大纲：

${idea.trim()}`;

  try {
    const content = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // 解析 JSON，处理可能的 markdown 代码块包裹
    let jsonStr = content.trim();
    // 移除可能的 ```json ... ``` 包裹
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const outline = JSON.parse(jsonStr) as Partial<OutlineData>;

    // 验证必填字段
    const required: Array<keyof OutlineData> = ['genre', 'theme', 'logline', 'setting', 'conflict', 'arc', 'estimatedChapters'];
    for (const field of required) {
      if (!outline[field] && outline[field] !== 0) {
        throw new Error(`AI 返回的大纲缺少字段: ${field}`);
      }
    }

    const result: OutlineData = {
      idea: idea.trim(),
      genre: String(outline.genre || ''),
      theme: String(outline.theme || ''),
      logline: String(outline.logline || ''),
      setting: String(outline.setting || ''),
      conflict: String(outline.conflict || ''),
      arc: String(outline.arc || ''),
      estimatedChapters: Number(outline.estimatedChapters) || 30,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('[novel/outline] 大纲生成失败:', error);
    const message = error instanceof Error ? error.message : '大纲生成失败，请重试';
    return res.status(500).json({ message });
  }
}
