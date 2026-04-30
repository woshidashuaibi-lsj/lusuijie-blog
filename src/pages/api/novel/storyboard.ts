/**
 * 分镜结构生成 API
 * POST /api/novel/storyboard
 * Input: {
 *   content: string,          // 章节正文
 *   chapterNumber: number,
 *   chapterTitle?: string,
 *   characters?: { name: string; appearance: string }[]  // 主要角色外貌描述
 * }
 * Output: { panels: StoryboardPanel[] }
 *
 * 用 MiniMax 文本模型将章节内容拆解成 4~6 格分镜，
 * 角色外貌描述统一注入每格 imagePrompt，保证连贯性。
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { StoryboardPanel } from '@/types/storyboard';
import { callLLM } from '@/lib/llm';

interface CharacterRef {
  name: string;
  appearance: string; // 中文外貌描述，将翻译并固定到每格 prompt
}

/** 将角色列表格式化为供 LLM 参考的描述块 */
function buildCharacterBlock(characters: CharacterRef[]): string {
  if (!characters || characters.length === 0) return '';
  return `\n\n【主要角色外貌（必须在每格 imagePrompt 中严格保持一致）】\n` +
    characters.map(c => `- ${c.name}：${c.appearance}`).join('\n');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { content, chapterNumber, chapterTitle, characters } = req.body as {
    content: string;
    chapterNumber: number;
    chapterTitle?: string;
    characters?: CharacterRef[];
  };

  if (!content || typeof content !== 'string' || content.trim().length < 50) {
    return res.status(400).json({ message: '章节内容不能为空（至少 50 字）' });
  }

  const chapterLabel = chapterTitle
    ? `第${chapterNumber}章《${chapterTitle}》`
    : `第${chapterNumber}章`;

  const charBlock = buildCharacterBlock(characters || []);

  const systemPrompt = `你是一位专业的漫画分镜导演，擅长将小说章节转化为电影级分镜脚本。
你的核心职责是：从章节中提取 4~6 个最具画面感的关键场景，生成结构化分镜。

【关键原则：角色一致性】
同一角色在每一格分镜中必须使用完全相同的外貌描述词（英文），包括：
- 发色、发型（hair color & style）
- 眼睛颜色（eye color）
- 服装特征（outfit keywords）
- 体型特征（build/height）
不允许在不同格中对同一角色使用不同描述，这会导致 AI 生图角色不连贯。${charBlock}

【imagePrompt 写作规范】
- 必须用英文
- 格式：[角色固定描述], [当前动作/表情], [场景环境], [构图], [画风], [光线]
- 画风统一使用：manga illustration, anime style, cinematic lighting
- 每格 prompt 控制在 60 词以内
- 角色描述必须完全一致（逐字复用）

【输出格式】
严格返回 JSON 数组，不包含任何前缀、说明或 markdown 代码块：
[
  {
    "index": 1,
    "sceneType": "outdoor",
    "narration": "旁白（中文，20字以内，概述本格画面）",
    "imagePrompt": "英文绘图提示词（60词以内）",
    "figures": [
      {
        "name": "角色名",
        "pose": "stand",
        "positionX": "center",
        "dialogue": "对话（可选，10字以内，没有则省略此字段）"
      }
    ]
  }
]

【字段约束】
- sceneType: "outdoor" | "indoor" | "abstract"
- pose: "stand" | "sit" | "run" | "fight" | "fall"
- positionX: "left" | "center" | "right"
- figures 可以为空数组（纯环境/物件镜头）`;

  const userPrompt = `请为以下${chapterLabel}生成 4~6 格分镜脚本：

${content.trim().slice(0, 3000)}`;

  try {
    const raw = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 4096, temperature: 0.5 }
    );

    // 提取 JSON，兼容 LLM 可能包裹 markdown 代码块
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // 有时 LLM 会在数组前后加多余文字，尝试提取第一个 [...] 块
    const arrMatch = jsonStr.match(/(\[[\s\S]*\])/);
    if (arrMatch) {
      jsonStr = arrMatch[1];
    }

    const panels = JSON.parse(jsonStr) as StoryboardPanel[];

    if (!Array.isArray(panels) || panels.length === 0) {
      throw new Error('LLM 返回的分镜格式不正确');
    }

    // 补全 index（防止 LLM 漏写）
    const normalized = panels.map((p, i) => ({
      index: p.index ?? i + 1,
      sceneType: p.sceneType ?? 'abstract',
      narration: p.narration ?? '',
      imagePrompt: p.imagePrompt ?? '',
      figures: Array.isArray(p.figures) ? p.figures : [],
    }));

    return res.status(200).json({ panels: normalized });
  } catch (error) {
    console.error('[novel/storyboard] 分镜生成失败:', error);
    const message = error instanceof Error ? error.message : '分镜生成失败，请重试';
    return res.status(500).json({ message });
  }
}
