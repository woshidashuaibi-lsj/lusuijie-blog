/**
 * 场景资产生成代理 API
 * POST /api/novel/scene-asset
 *
 * 流程：
 *   1. 转发到 fc-api 生成场景参考图（base64）及关键词
 *   2. 将图片上传到 Supabase Storage，获取永久公开 URL
 *   3. 返回 { referenceImageUrl, promptKeywords, generatedPrompt }
 *      前端只需存 URL，不再存 base64
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { uploadAssetBase64 } from '@/lib/novelAssetUpload';

const FC_API_BASE = process.env.FC_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { name, description, worldStylePrompt, genre, projectId } = req.body as {
    name?: string;
    description?: string;
    worldStylePrompt?: string;
    genre?: string;
    /** 用于 Storage 路径隔离 */
    projectId?: string;
  };

  if (!name) {
    return res.status(400).json({ message: '场景名称不能为空' });
  }

  try {
    // ── Step 1: 调用 fc-api 生成图片 ──────────────────────────────────────
    const resp = await fetch(`${FC_API_BASE}/api/novel/scene-asset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, worldStylePrompt, genre }),
    });

    const data = await resp.json() as {
      imageBase64?: string;
      promptKeywords?: string;
      generatedPrompt?: string;
      message?: string;
    };

    if (!resp.ok) {
      return res.status(resp.status).json(data);
    }

    // ── Step 2: 上传到 Supabase Storage ───────────────────────────────────
    let referenceImageUrl: string | undefined;

    if (data.imageBase64) {
      const pid = projectId || `anon-${Date.now()}`;
      try {
        referenceImageUrl = await uploadAssetBase64(data.imageBase64, pid, 'scene');
      } catch (uploadErr) {
        console.warn('[scene-asset] Storage 上传失败，降级返回 base64:', uploadErr);
        // 降级：返回 base64 data URL（仍可本地显示）
        referenceImageUrl = `data:image/jpeg;base64,${data.imageBase64}`;
      }
    }

    // ── Step 3: 返回 URL ───────────────────────────────────────────────────
    return res.status(200).json({
      referenceImageUrl,
      promptKeywords: data.promptKeywords || '',
      generatedPrompt: data.generatedPrompt || '',
    });

  } catch (e) {
    console.error('[scene-asset proxy]', e);
    return res.status(500).json({ message: '生成场景参考图失败' });
  }
}
