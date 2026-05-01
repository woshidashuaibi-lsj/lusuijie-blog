/**
 * Novel Asset Upload - 将生成图片（base64）上传到 Supabase Storage
 *
 * Bucket：novel-assets（需在 Supabase Dashboard 手动创建并设为 Public）
 *
 * 路径规则：novel-assets/{projectId}/{type}/{uuid}.jpg
 *   type: 'portrait-front' | 'portrait-side' | 'scene'
 *
 * 返回 Supabase Storage 的公开永久 URL，可直接传给 MiniMax subject_reference
 */

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'novel-assets';

/**
 * 创建带 service_role key 的服务端 Supabase 客户端
 * （用于在 Next.js API Route 中绕过 RLS，直接写入 Storage）
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

/**
 * 将 base64 图片上传到 Supabase Storage，返回公开访问 URL
 *
 * @param base64    纯 base64 字符串（不含 data: 前缀）
 * @param projectId 项目 ID（用于隔离不同小说的资产）
 * @param type      资产类型前缀
 * @returns 公开永久 URL
 */
export async function uploadAssetBase64(
  base64: string,
  projectId: string,
  type: string
): Promise<string> {
  const supabase = getServiceClient();

  // base64 → Buffer
  const buffer = Buffer.from(base64, 'base64');

  // 生成唯一文件路径
  const uuid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const filePath = `${projectId}/${type}/${uuid}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
      cacheControl: '31536000', // 1 年强缓存
    });

  if (error) {
    throw new Error(`Supabase Storage 上传失败: ${error.message}`);
  }

  // 获取公开 URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}
