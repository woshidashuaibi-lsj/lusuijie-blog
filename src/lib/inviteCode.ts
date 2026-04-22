import type { SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

async function getClient(): Promise<SupabaseClient | null> {
  if (_client) return _client;
  if (typeof window === 'undefined') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    _client = createClient(url, key);
    return _client;
  } catch {
    return null;
  }
}

export type AccessStatus = 'loading' | 'no_session' | 'granted' | 'need_code';

/**
 * 检查当前登录用户是否有访问权限
 * 调用 check_invite_access() RPC（security definer，绕过 RLS）
 */
export async function checkAccess(): Promise<Exclude<AccessStatus, 'loading'> | null> {
  const sb = await getClient();
  if (!sb) return null;

  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return 'no_session';

    const { data, error } = await sb.rpc('check_invite_access');
    if (error) {
      console.warn('[InviteCode] checkAccess rpc error:', error.message);
      return null;
    }
    return data === true ? 'granted' : 'need_code';
  } catch {
    return null;
  }
}

export type ClaimResult = 'ok' | 'not_found' | 'already_used' | 'already_bound' | 'error';

/**
 * 绑定邀请码
 * 调用 claim_invite_code(p_code) RPC（security definer，原子操作）
 */
export async function claimCode(code: string): Promise<ClaimResult> {
  const sb = await getClient();
  if (!sb) return 'error';

  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return 'error';

    const { data, error } = await sb.rpc('claim_invite_code', {
      p_code: code.trim().toUpperCase(),
    });

    if (error) {
      console.warn('[InviteCode] claimCode rpc error:', error.message);
      return 'error';
    }

    return (data as ClaimResult) ?? 'error';
  } catch {
    return 'error';
  }
}

export async function signInWithGitHub(redirectPath?: string): Promise<void> {
  const sb = await getClient();
  if (!sb || typeof window === 'undefined') return;
  const origin = window.location.origin;
  const back = redirectPath ?? window.location.pathname;
  await sb.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: `${origin}${back}` },
  });
}

export async function getCurrentUser() {
  const sb = await getClient();
  if (!sb) return null;
  try {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function subscribeAuthChange(cb: (uid: string | null) => void) {
  const sb = await getClient();
  if (!sb) return () => {};
  const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
    cb(session?.user?.id ?? null);
  });
  return () => subscription.unsubscribe();
}
