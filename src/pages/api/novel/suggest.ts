/**
 * AI 修改建议 API
 * POST /api/novel/suggest
 * Input: { content: string, worldContext: string, chapterNumber: number }
 * Output: { suggestions: Array<{ dimension: string; issue: string; suggestion: string }> }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM } from '@/lib/llm';

interface Suggestion {
  dimension: string;
  issue: string;
  suggestion: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { content, worldContext, chapterNumber } = req.body;

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

  const contextSection = worldContext
    ? `【小说背景参考】\n${worldContext.slice(0, 1000)}\n\n`
    : '';

  const userPrompt = `${contextSection}请评审第${chapterNumber}章草稿：

${content.slice(0, 6000)}`;

  try {
    const responseText = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // 解析 JSON
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // 尝试找到 JSON 数组
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const suggestions = JSON.parse(jsonStr) as Suggestion[];

    if (!Array.isArray(suggestions)) {
      throw new Error('AI 返回格式错误');
    }

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('[novel/suggest] 建议生成失败:', error);
    const message = error instanceof Error ? error.message : '建议生成失败';
    return res.status(500).json({ message });
  }
}
