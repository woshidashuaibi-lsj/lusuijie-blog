/**
 * 分镜生成代理 API
 * POST /api/novel/storyboard
 *
 * 流程：
 *   1. 透传请求到 fc-api（fc-api 负责 LLM 拆分镜 + MiniMax 生图）
 *   2. fc-api 返回 panels，每格含 imageBase64
 *   3. 将每格图片上传 Supabase Storage，替换 base64 为永久 URL
 *   4. 返回 { panels } 给前端
 *
 * 如果 Supabase 上传失败，降级返回 base64 data URL（仍可展示）
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { uploadAssetBase64 } from '@/lib/novelAssetUpload';

const FC_API_BASE = process.env.FC_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '';

// Next.js 默认 body 限制 4mb，分镜响应可能含多张 base64 图片，需要放大
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
    responseLimit: '50mb',
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { content, chapterNumber, chapterTitle, characters, worldStylePrompt, sceneAssets, projectId } = req.body as {
    content?: string;
    chapterNumber?: number;
    chapterTitle?: string;
    characters?: unknown[];
    worldStylePrompt?: string;
    sceneAssets?: unknown[];
    projectId?: string;
  };

  if (!content || typeof content !== 'string' || content.trim().length < 10) {
    return res.status(400).json({ message: '章节内容不能为空' });
  }

  if (!FC_API_BASE) {
    return res.status(500).json({ message: '未配置 FC_API_BASE 环境变量' });
  }

  try {
    // ── Step 1: 调用 fc-api 生成分镜结构 + 图片（base64） ─────────────────
    const fcRes = await fetch(`${FC_API_BASE}/api/novel/storyboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, chapterNumber, chapterTitle, characters, worldStylePrompt, sceneAssets }),
    });

    const fcData = await fcRes.json() as {
      panels?: Array<Record<string, unknown>>;
      message?: string;
    };

    if (!fcRes.ok) {
      return res.status(fcRes.status).json({ message: fcData.message || '分镜生成失败' });
    }

    const panels = fcData.panels;
    if (!Array.isArray(panels) || panels.length === 0) {
      return res.status(200).json({ panels: [] });
    }

    // ── Step 2: 上传每格图片到 Supabase Storage ───────────────────────────
    const pid = projectId || `storyboard-${Date.now()}`;

    const panelsWithUrls = await Promise.all(
      panels.map(async (panel, i) => {
        const base64 = panel.imageBase64 as string | undefined;
        if (!base64) return panel; // 生图失败的格，原样返回（无图）

        try {
          const url = await uploadAssetBase64(base64, pid, `panel-${i + 1}`);
          // 替换 base64 为 URL，删掉 imageBase64 字段（节省传输体积）
          const { imageBase64: _dropped, ...rest } = panel;
          void _dropped;
          return { ...rest, imageUrl: url };
        } catch (uploadErr) {
          console.warn(`[storyboard] panel[${i}] 上传失败，降级 base64:`, uploadErr);
          // 上传失败时降级：用 base64 data URL（前端可展示但体积大）
          return { ...panel, imageUrl: `data:image/jpeg;base64,${base64}` };
        }
      })
    );

    return res.status(200).json({ panels: panelsWithUrls });

  } catch (e) {
    console.error('[storyboard proxy]', e);
    return res.status(500).json({ message: e instanceof Error ? e.message : '分镜生成失败' });
  }
}
