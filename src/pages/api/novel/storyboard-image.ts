/**
 * 分镜图片生成 API
 * POST /api/novel/storyboard-image
 * Input: {
 *   prompt: string,              // 英文绘图 prompt（由 storyboard API 生成）
 *   characterRefs?: string[]     // 角色参考图 URL 列表（用于 subject_reference 保证角色一致性）
 * }
 * Output: { imageBase64: string }  // jpeg base64 字符串
 *
 * 调用 MiniMax image-01 生图，若提供 characterRefs 则启用 subject_reference 锁定外貌，
 * 保证同一章节不同分镜格中角色外貌高度一致。
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const MINIMAX_IMAGE_URL = 'https://api.minimaxi.com/v1/image_generation';

interface SubjectReference {
  type: 'character';
  image_file: string; // 角色参考图 URL
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: 'MINIMAX_API_KEY 未配置' });
  }

  const { prompt, characterRefs } = req.body as {
    prompt: string;
    characterRefs?: string[]; // 角色参考图 URL
  };

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ message: 'prompt 不能为空' });
  }

  // 构建请求体
  const payload: Record<string, unknown> = {
    model: 'image-01',
    prompt: prompt.trim(),
    aspect_ratio: '16:9',
    response_format: 'base64',
  };

  // 如果提供了角色参考图，启用 subject_reference 保持角色外貌一致性
  if (characterRefs && characterRefs.length > 0) {
    const subjectReferences: SubjectReference[] = characterRefs
      .filter((url) => url && typeof url === 'string' && url.startsWith('http'))
      .map((url) => ({
        type: 'character',
        image_file: url,
      }));

    if (subjectReferences.length > 0) {
      payload.subject_reference = subjectReferences;
    }
  }

  try {
    const response = await fetch(MINIMAX_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[storyboard-image] MiniMax API 错误:', response.status, errText);
      return res.status(502).json({ message: `MiniMax 生图失败: ${response.status}` });
    }

    const data = await response.json();
    const images: string[] | undefined = data?.data?.image_base64;

    if (!images || images.length === 0) {
      console.error('[storyboard-image] 返回数据异常:', JSON.stringify(data));
      return res.status(502).json({ message: 'MiniMax 生图返回数据异常' });
    }

    // 只取第一张
    return res.status(200).json({ imageBase64: images[0] });
  } catch (error) {
    console.error('[storyboard-image] 生图请求失败:', error);
    const message = error instanceof Error ? error.message : '生图失败，请重试';
    return res.status(500).json({ message });
  }
}
