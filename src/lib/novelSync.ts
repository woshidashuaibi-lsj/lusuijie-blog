/**
 * Novel Creator - Supabase 云端同步层
 *
 * 认证方式：Supabase Auth（GitHub OAuth）
 * - 已登录：用 user.id 作为数据归属标识，数据与账号绑定，跨设备自动同步
 * - 未登录：降级到 device_id（localStorage 随机码），功能不受影响但不跨设备
 *
 * 表结构（在 Supabase SQL Editor 执行）：
 *   create table if not exists novel_projects (
 *     id text primary key,
 *     user_id text,           -- 登录用户的 auth.uid()（已登录时使用）
 *     device_id text,         -- 设备码（未登录时使用）
 *     title text,
 *     data jsonb not null,
 *     updated_at timestamptz default now()
 *   );
 *   create index if not exists novel_projects_user_id_idx on novel_projects(user_id);
 *   create index if not exists novel_projects_device_id_idx on novel_projects(device_id);
 */

import type { NovelProject } from '@/types/novel';
import type { SupabaseClient, User } from '@supabase/supabase-js';

// ── Supabase 客户端（懒初始化，仅在浏览器环境）────────────────────────────────

let _supabase: SupabaseClient | null = null;

async function waitForSupabase(): Promise<SupabaseClient | null> {
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

// ── 当前登录用户（带内存缓存，避免频繁发 /auth/v1/user）──────────────────────

/** 缓存的用户对象，null = 未登录，undefined = 未初始化 */
let _cachedUser: User | null | undefined = undefined;
/** 上次刷新 user 缓存的时间戳（ms）*/
let _userCachedAt = 0;
/** 缓存有效期：30 秒。在此时间内不重复请求 /auth/v1/user */
const USER_CACHE_TTL = 30_000;

/**
 * 获取当前登录的 Supabase 用户（未登录返回 null）
 * 内存缓存 30s，避免 AI 生成过程中每次 saveProject 都发请求
 */
export async function getCurrentUser(): Promise<User | null> {
  // 缓存命中
  if (_cachedUser !== undefined && Date.now() - _userCachedAt < USER_CACHE_TTL) {
    return _cachedUser;
  }

  const supabase = await waitForSupabase();
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    _cachedUser = user;
    _userCachedAt = Date.now();
    return user;
  } catch {
    return null;
  }
}

/** 登出或切换账号时主动清除缓存 */
export function clearUserCache() {
  _cachedUser = undefined;
  _userCachedAt = 0;
}

/**
 * 订阅登录状态变化
 */
export async function onAuthStateChange(callback: (user: User | null) => void) {
  const supabase = await waitForSupabase();
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    // auth 切换时清除缓存，下次调用 getCurrentUser 会重新请求
    clearUserCache();
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

/**
 * 发起 GitHub OAuth 登录
 * 登录成功后跳回 /book/create/
 */
export async function signInWithGitHub(): Promise<void> {
  const supabase = await waitForSupabase();
  if (!supabase) return;

  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/book/create/`
    : 'https://lusuijie.com.cn/book/create/';

  await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  });
}

/**
 * 退出登录
 */
export async function signOut(): Promise<void> {
  const supabase = await waitForSupabase();
  if (!supabase) return;
  clearUserCache();
  await supabase.auth.signOut();
}

// ── 设备 ID（未登录时的降级方案）─────────────────────────────────────────────

const DEVICE_ID_KEY = 'novel_creator_device_id';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10).toUpperCase();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

// ── 获取当前数据归属标识 ───────────────────────────────────────────────────────

/**
 * 返回 { userId, deviceId }
 * 已登录时 userId 有值；未登录时只有 deviceId
 */
async function getOwnerIds(): Promise<{ userId: string | null; deviceId: string }> {
  const user = await getCurrentUser();
  return {
    userId: user?.id ?? null,
    deviceId: getDeviceId(),
  };
}

// ── 云端同步 API ──────────────────────────────────────────────────────────────

/**
 * 将项目上传到 Supabase（upsert）
 * 失败时静默降级，不抛出异常
 */
export async function syncProjectToCloud(project: NovelProject): Promise<void> {
  const supabase = await waitForSupabase();
  if (!supabase) return;

  const { userId, deviceId } = await getOwnerIds();

  try {
    const { error } = await supabase
      .from('novel_projects')
      .upsert({
        id: project.id,
        user_id: userId,        // 已登录时有值，否则 null
        device_id: deviceId,    // 始终记录设备码（方便迁移历史数据）
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
 * 从 Supabase 拉取当前用户/设备的所有项目
 * 已登录优先按 user_id 查，未登录按 device_id 查
 */
export async function fetchProjectsFromCloud(): Promise<NovelProject[]> {
  const supabase = await waitForSupabase();
  if (!supabase) return [];

  const { userId, deviceId } = await getOwnerIds();

  try {
    let query = supabase
      .from('novel_projects')
      .select('data, updated_at');

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

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
 * 用另一台设备的 deviceId 拉取项目（换设备恢复，仅未登录场景用）
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
