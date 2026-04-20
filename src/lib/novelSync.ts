/**
 * Novel Creator - Supabase 云端同步层
 *
 * 职责：
 * - 将 NovelProject 双写到 Supabase（云端备份，跨设备同步）
 * - 以 deviceId 为标识（无需登录），存储在 localStorage
 * - 所有操作均为"尽力而为"：失败时静默降级，不影响本地 IndexedDB 的正常使用
 *
 * 表结构（在 Supabase SQL Editor 执行）：
 *   create table if not exists novel_projects (
 *     id text primary key,
 *     device_id text not null,
 *     title text,
 *     data jsonb not null,
 *     updated_at timestamptz default now()
 *   );
 *   create index if not exists novel_projects_device_id_idx on novel_projects(device_id);
 */

import type { NovelProject } from '@/types/novel';

// ── Supabase 客户端（懒初始化，仅在浏览器环境）────────────────────────────────

let _supabase: import('@supabase/supabase-js').SupabaseClient | null = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (typeof window === 'undefined') return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // 环境变量未配置，云同步不可用，静默跳过
    return null;
  }

  // 动态 import 避免 SSR 问题
  // 注意：此处同步返回 null，异步初始化后续调用会正常使用
  import('@supabase/supabase-js').then(({ createClient }) => {
    _supabase = createClient(url, key);
  });

  return null;
}

// 等待 Supabase 客户端初始化完成（最多等 500ms）
async function waitForSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || typeof window === 'undefined') return null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    _supabase = createClient(url, key);
    return _supabase;
  } catch {
    return null;
  }
}

// ── 设备 ID ───────────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'novel_creator_device_id';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      // 生成一个随机 ID（8位，用于跨设备迁移时输入）
      id = Math.random().toString(36).slice(2, 10).toUpperCase();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

// ── 云端同步 API ──────────────────────────────────────────────────────────────

/**
 * 将项目上传到 Supabase（upsert）
 * 失败时静默降级，不抛出异常
 */
export async function syncProjectToCloud(project: NovelProject): Promise<void> {
  const supabase = await waitForSupabase();
  if (!supabase) return;

  const deviceId = getDeviceId();
  if (!deviceId) return;

  try {
    const { error } = await supabase
      .from('novel_projects')
      .upsert({
        id: project.id,
        device_id: deviceId,
        title: project.title,
        data: project,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.warn('[NovelSync] 云端同步失败（不影响本地）:', error.message);
    }
  } catch (e) {
    console.warn('[NovelSync] 云端同步异常（不影响本地）:', e);
  }
}

/**
 * 从 Supabase 拉取当前设备的所有项目
 */
export async function fetchProjectsFromCloud(): Promise<NovelProject[]> {
  const supabase = await waitForSupabase();
  if (!supabase) return [];

  const deviceId = getDeviceId();
  if (!deviceId) return [];

  try {
    const { data, error } = await supabase
      .from('novel_projects')
      .select('data, updated_at')
      .eq('device_id', deviceId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[NovelSync] 云端拉取失败:', error.message);
      return [];
    }

    return (data ?? []).map(row => row.data as NovelProject);
  } catch (e) {
    console.warn('[NovelSync] 云端拉取异常:', e);
    return [];
  }
}

/**
 * 用另一台设备的 deviceId 拉取项目（换设备恢复）
 */
export async function fetchProjectsByDeviceId(deviceId: string): Promise<NovelProject[]> {
  const supabase = await waitForSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('novel_projects')
      .select('data, updated_at')
      .eq('device_id', deviceId.toUpperCase().trim())
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[NovelSync] 换设备拉取失败:', error.message);
      return [];
    }

    return (data ?? []).map(row => row.data as NovelProject);
  } catch (e) {
    console.warn('[NovelSync] 换设备拉取异常:', e);
    return [];
  }
}

/**
 * 从云端删除项目
 */
export async function deleteProjectFromCloud(projectId: string): Promise<void> {
  const supabase = await waitForSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('novel_projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.warn('[NovelSync] 云端删除失败:', error.message);
    }
  } catch (e) {
    console.warn('[NovelSync] 云端删除异常:', e);
  }
}

// 触发懒初始化（在模块加载时启动，不阻塞）
if (typeof window !== 'undefined') {
  getSupabase();
}
