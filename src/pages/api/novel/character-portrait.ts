/**
 * 角色标准像生成代理 API
 * POST /api/novel/character-portrait
 *
 * 流程：
 *   1. 转发到 fc-api 生成正面 + 侧面图（base64）及固化关键词
 *   2. 将两张图上传到 Supabase Storage，获取永久公开 URL
 *   3. 返回 { portraitUrl, sidePortraitUrl, promptKeywords }
 *      前端只需存 URL，不再存 base64，解决请求体过大问题
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { uploadAssetBase64 } from '@/lib/novelAssetUpload';

const FC_API_BASE = process.env.FC_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { name, appearance, role, setting, projectId } = req.body as {
    name?: string;
    appearance?: string;
    role?: string;
    setting?: string;
    /** 用于 Storage 路径隔离，不传时用随机 ID */
    projectId?: string;
  };

  if (!name) {
    return res.status(400).json({ message: '角色名称不能为空' });
  }

  try {
    // ── Step 1: 调用 fc-api 生成图片 ──────────────────────────────────────
    const resp = await fetch(`${FC_API_BASE}/api/novel/character-portrait`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, appearance, role, setting }),
    });

    const data = await resp.json() as {
      imageBase64?: string;
      sideImageBase64?: string;
      promptKeywords?: string;
      message?: string;
    };

    if (!resp.ok) {
      return res.status(resp.status).json(data);
    }

    // ── Step 2: 上传到 Supabase Storage ───────────────────────────────────
    const pid = projectId || `anon-${Date.now()}`;
    let portraitUrl: string | undefined;
    let sidePortraitUrl: string | undefined;

    // 并发上传正面 + 侧面
    const uploads = await Promise.allSettled([
      data.imageBase64
        ? uploadAssetBase64(data.imageBase64, pid, 'portrait-front')
        : Promise.resolve(undefined),
      data.sideImageBase64
        ? uploadAssetBase64(data.sideImageBase64, pid, 'portrait-side')
        : Promise.resolve(undefined),
    ]);

    if (uploads[0].status === 'fulfilled') {
      portraitUrl = uploads[0].value;
    } else {
      console.warn('[character-portrait] 正面图上传失败:', uploads[0].reason);
      // 上传失败时降级：返回 base64 data URL（仍可本地显示，但不能用于 subject_reference）
      portraitUrl = data.imageBase64 ? `data:image/jpeg;base64,${data.imageBase64}` : undefined;
    }

    if (uploads[1].status === 'fulfilled') {
      sidePortraitUrl = uploads[1].value;
    } else {
      console.warn('[character-portrait] 侧面图上传失败:', uploads[1].reason);
      sidePortraitUrl = data.sideImageBase64 ? `data:image/jpeg;base64,${data.sideImageBase64}` : undefined;
    }

    // ── Step 3: 返回 URL（不再返回 base64） ────────────────────────────────
    return res.status(200).json({
      portraitUrl,
      sidePortraitUrl,
      promptKeywords: data.promptKeywords || '',
    });

  } catch (e) {
    console.error('[character-portrait proxy]', e);
    return res.status(500).json({ message: '生成标准像失败' });
  }
}
