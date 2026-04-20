/**
 * 章节摘要生成 API
 * POST /api/novel/summarize
 * Input: { content: string, chapterNumber: number, title?: string }
 * Output: { summary: string }
 * 
 * 摘要约束：≤300汉字，包含关键事件/人物变化/伏笔状态
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM } from '@/lib/llm';

// 中文字数统计
function countChinese(text: string): number {
  return (text.match(/[\u4e00-\u9fff]/g) || []).length;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { content, chapterNumber, title } = req.body;

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

  const chapterLabel = title
    ? `第${chapterNumber}章《${title}》`
    : `第${chapterNumber}章`;

  const userPrompt = `请为以下${chapterLabel}生成摘要：

${content.slice(0, 8000)}`; // 截断超长内容

  try {
    let summary = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    summary = summary.trim();

    // 验证摘要长度
    const chineseCount = countChinese(summary);
    if (chineseCount > 300) {
      // 超出限制，继续截断并追加省略号
      // 找到第300个汉字的位置
      let count = 0;
      let cutPos = summary.length;
      for (let i = 0; i < summary.length; i++) {
        if (/[\u4e00-\u9fff]/.test(summary[i])) {
          count++;
          if (count >= 300) {
            cutPos = i + 1;
            break;
          }
        }
      }
      summary = summary.slice(0, cutPos) + '…';
    }

    return res.status(200).json({ summary });
  } catch (error) {
    console.error('[novel/summarize] 摘要生成失败:', error);
    const message = error instanceof Error ? error.message : '摘要生成失败';
    return res.status(500).json({ message });
  }
}
