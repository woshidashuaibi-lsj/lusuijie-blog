/**
 * BookAccessGate
 *
 * 统一处理所有 /book/* 页面的访问控制：
 *   1. loading   — 检查中，显示加载
 *   2. no_session — 未登录，显示 GitHub 登录按钮
 *   3. need_code  — 已登录但无邀请码，显示邀请码输入框（含小人动画）
 *   4. granted    — 已授权，直接渲染子内容
 */
import { useState, useEffect, useRef } from 'react';
import {
  checkAccess,
  claimCode,
  signInWithGitHub,
  getCurrentUser,
  subscribeAuthChange,
  type AccessStatus,
  type ClaimResult,
} from '@/lib/inviteCode';
import styles from './index.module.css';

interface Props {
  children: React.ReactNode;
}

// ─────────────────────────────────────────────
// 小人动画（复用 BookInviteGate 的实现）
// ─────────────────────────────────────────────
type CharState = 'idle' | 'peek' | 'hide';

function Pupil({ size, maxDist }: { size: number; maxDist: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [off, setOff] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const dist = Math.min(Math.hypot(e.clientX - cx, e.clientY - cy), maxDist);
      setOff({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
    };
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, [maxDist]);
  return (
    <div ref={ref} className={styles.pupilWrap} style={{ width: size, height: size }}>
      <div className={styles.pupil} style={{ transform: `translate(${off.x}px, ${off.y}px)` }} />
    </div>
  );
}

function Eye({ size, blinking }: { size: number; blinking: boolean }) {
  return (
    <div className={styles.eye}
      style={{ width: size, height: blinking ? 2 : size, borderRadius: blinking ? 2 : '50%' }}>
      {!blinking && <Pupil size={size * 0.52} maxDist={size * 0.3} />}
    </div>
  );
}

interface CharCfg {
  color: string; w: number; h: number; radius: string;
  border?: string; eyeSize: number; eyeGap: number; eyeTop: string;
  mouth?: boolean; peekDy: number; hideDy: number; zIndex: number;
}
const PEEK_ROT = -4;
const HIDE_ROT = 4;
const CHARS: CharCfg[] = [
  { color: '#7c3aed', w: 90,  h: 210, radius: '18px 18px 8px 8px', eyeSize: 17, eyeGap: 15, eyeTop: '27%', peekDy: 30, hideDy: 10, zIndex: 3 },
  { color: '#18181b', w: 72,  h: 165, radius: '12px 12px 4px 4px', border: '2px solid rgba(255,255,255,0.18)', eyeSize: 13, eyeGap: 11, eyeTop: '28%', peekDy: 22, hideDy: 8,  zIndex: 2 },
  { color: '#f97316', w: 120, h: 80,  radius: '50% 50% 12px 12px', eyeSize: 12, eyeGap: 26, eyeTop: '18%', peekDy: 8,  hideDy: 4,  zIndex: 5 },
  { color: '#eab308', w: 62,  h: 118, radius: '32px 32px 12px 12px', eyeSize: 11, eyeGap: 9,  eyeTop: '25%', mouth: true, peekDy: 18, hideDy: 8,  zIndex: 4 },
  { color: '#ec4899', w: 78,  h: 96,  radius: '50%', eyeSize: 11, eyeGap: 18, eyeTop: '28%', mouth: true, peekDy: 12, hideDy: 6,  zIndex: 1 },
];

function Character({ cfg, state, override }: { cfg: CharCfg; state: CharState; override: boolean }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => { setBlink(false); loop(); }, 150); }, Math.random() * 4000 + 2500); };
    const init = setTimeout(loop, Math.random() * 2000);
    return () => { clearTimeout(t!); clearTimeout(init); };
  }, []);

  const isPeek = state === 'peek' || override;
  const isHide = state === 'hide' && !override;
  const rot = isPeek ? PEEK_ROT : isHide ? HIDE_ROT : 0;
  const dy  = isPeek ? -cfg.peekDy : 0;
  const h   = isPeek ? cfg.h + cfg.peekDy : isHide ? cfg.h + cfg.hideDy : cfg.h;
  const eyesLeft = isPeek ? '60%' : isHide ? '40%' : '50%';
  const mouthStyle: React.CSSProperties = {
    width: isPeek ? 22 : isHide ? 12 : 18,
    borderRadius: isPeek ? '0 0 8px 8px' : isHide ? '8px 8px 0 0' : '2px',
    height: isPeek ? 5 : isHide ? 4 : 3,
    background: isPeek ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.28)',
  };
  return (
    <div className={styles.char} style={{ width: cfg.w, height: h, background: cfg.color, borderRadius: cfg.radius, border: cfg.border, transform: `rotate(${rot}deg) translateY(${dy}px)`, zIndex: cfg.zIndex }}>
      <div className={styles.eyes} style={{ top: cfg.eyeTop, left: eyesLeft, gap: cfg.eyeGap }}>
        <Eye size={cfg.eyeSize} blinking={blink} />
        <Eye size={cfg.eyeSize} blinking={blink} />
      </div>
      {cfg.mouth && <div className={styles.mouth} style={mouthStyle} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// 邀请码输入面板（已登录但无码时显示）
// ─────────────────────────────────────────────
function CodePanel({ username, avatar, onClaimed }: {
  username: string; avatar: string; onClaimed: () => void;
}) {
  const [code, setCode]       = useState('');
  const [show, setShow]       = useState(false);
  const [shaking, setShaking] = useState(false);
  const [errMsg, setErrMsg]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [peeking, setPeeking] = useState(false);

  const typing = code.length > 0;
  const charState: CharState = typing && !show ? 'hide' : typing && show ? 'peek' : 'idle';

  useEffect(() => {
    if (typing && show) {
      const t = setTimeout(() => { setPeeking(true); setTimeout(() => setPeeking(false), 900); }, Math.random() * 3000 + 1800);
      return () => clearTimeout(t);
    }
    setPeeking(false);
  }, [typing, show, peeking]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setErrMsg('');
    const result: ClaimResult = await claimCode(code);
    setLoading(false);
    if (result === 'ok') {
      setDone(true);
      setTimeout(onClaimed, 700);
      return;
    }
    const msgs: Record<ClaimResult, string> = {
      ok: '',
      not_found: '邀请码不存在，请检查后重试',
      already_used: '该邀请码已被使用',
      already_bound: '你已经绑定了邀请码',
      error: '验证失败，请稍后重试',
    };
    setErrMsg(msgs[result]);
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  return (
    <div className={`${styles.gate} ${done ? styles.out : ''}`}>
      <div className={styles.left}>
        <div className={styles.crowd}>
          {CHARS.map((c, i) => <Character key={i} cfg={c} state={charState} override={peeking} />)}
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.card}>
          {/* 已登录用户信息 */}
          <div className={styles.userRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar} alt={username} className={styles.avatar} />
            <span className={styles.username}>{username}</span>
          </div>
          <h1 className={styles.title}>星际图书馆</h1>
          <p className={styles.sub}>输入邀请码解锁访问权限</p>
          <form onSubmit={submit}>
            <div className={`${styles.field} ${shaking ? styles.shake : ''}`}>
              <input
                type={show ? 'text' : 'password'}
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setErrMsg(''); }}
                placeholder="BOOK-XXXX-XXXX"
                className={styles.input}
                autoComplete="off"
                autoFocus
                disabled={loading}
              />
              <button type="button" className={styles.eye2} onClick={() => setShow(v => !v)}>
                {!show
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                }
              </button>
            </div>
            {errMsg && <p className={styles.err}>{errMsg}</p>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? '验证中…' : '进入宇宙 →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 未登录面板
// ─────────────────────────────────────────────
function LoginPanel() {
  const [loading, setLoading] = useState(false);
  return (
    <div className={styles.gate}>
      <div className={styles.left}>
        <div className={styles.crowd}>
          {CHARS.map((c, i) => <Character key={i} cfg={c} state="idle" override={false} />)}
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.card}>
          <h1 className={styles.title}>星际图书馆</h1>
          <p className={styles.sub}>登录后输入邀请码即可访问</p>
          <button
            className={styles.githubBtn}
            disabled={loading}
            onClick={async () => { setLoading(true); await signInWithGitHub(); }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            {loading ? '跳转中…' : '使用 GitHub 登录'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 模块级缓存：同一会话只查一次 Supabase
// ─────────────────────────────────────────────
let _cachedStatus: Exclude<AccessStatus, 'loading'> | null = null;
let _cachedUser: { name: string; avatar: string } | null = null;

// 登出或绑定成功后清除缓存
export function clearAccessCache() {
  _cachedStatus = null;
  _cachedUser = null;
}

// ─────────────────────────────────────────────
// 主门控组件
// ─────────────────────────────────────────────
export default function BookAccessGate({ children }: Props) {
  // 有缓存时直接用，避免 loading 闪烁
  const [status, setStatus] = useState<AccessStatus>(
    _cachedStatus ?? 'loading'
  );
  const [userInfo, setUserInfo] = useState<{ name: string; avatar: string } | null>(
    _cachedUser
  );

  const refresh = async (force = false) => {
    // 有缓存且不强制刷新，直接用
    if (!force && _cachedStatus) {
      setStatus(_cachedStatus);
      setUserInfo(_cachedUser);
      return;
    }
    // 静默检查：不显示 loading，直接在后台完成
    const result = await checkAccess();
    const resolved = result ?? 'granted';
    _cachedStatus = resolved;

    if (resolved === 'need_code' || resolved === 'no_session') {
      const u = await getCurrentUser();
      if (u) {
        _cachedUser = {
          name: u.user_metadata?.user_name ?? u.email ?? '用户',
          avatar: u.user_metadata?.avatar_url ?? '',
        };
      }
    }
    setStatus(resolved);
    setUserInfo(_cachedUser);
  };

  useEffect(() => {
    refresh();
    let unsub: (() => void) | undefined;
    // auth 变化时强制刷新缓存
    subscribeAuthChange(() => {
      _cachedStatus = null;
      _cachedUser = null;
      refresh(true);
    }).then(fn => { unsub = fn; });
    return () => { unsub?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // loading 时直接渲染 children，避免遮挡页面内容
  // 一旦确认需要拦截才覆盖显示门控
  if (status === 'loading') {
    return <>{children}</>;
  }

  if (status === 'no_session') {
    return <LoginPanel />;
  }

  if (status === 'need_code') {
    return (
      <CodePanel
        username={userInfo?.name ?? ''}
        avatar={userInfo?.avatar ?? ''}
        onClaimed={() => {
          _cachedStatus = 'granted';
          _cachedUser = null;
          refresh(true);
        }}
      />
    );
  }

  // granted（或降级）
  return <>{children}</>;
}
