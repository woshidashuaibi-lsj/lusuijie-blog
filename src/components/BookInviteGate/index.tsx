import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './index.module.css';

interface Props {
  onSuccess: () => void;
}

const INVITE_CODES = (process.env.NEXT_PUBLIC_INVITE_CODES || 'bookworm2024')
  .split(',').map(s => s.trim()).filter(Boolean);

type CharState = 'idle' | 'peek' | 'hide';

// ── 眼珠（跟鼠标）────────────────────────────────────────────────
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

// ── 眼睛（白色眼眶）────────────────────────────────────────────────
function Eye({ size, blinking }: { size: number; blinking: boolean }) {
  return (
    <div
      className={styles.eye}
      style={{ width: size, height: blinking ? 2 : size, borderRadius: blinking ? 2 : '50%' }}
    >
      {!blinking && <Pupil size={size * 0.52} maxDist={size * 0.3} />}
    </div>
  );
}

// ── 角色配置 ──────────────────────────────────────────────────────
interface Char {
  color: string;
  w: number;
  h: number;
  radius: string;
  border?: string;
  eyeSize: number;
  eyeGap: number;
  eyeTop: string;
  mouth?: boolean;
  peekDy: number;
  hideDy: number;
  zIndex: number;
}

// 所有角色倾斜角度统一 4deg
const PEEK_ROT = -4;
const HIDE_ROT = 4;

const CHARS: Char[] = [
  {
    color: '#7c3aed', w: 90, h: 210,
    radius: '18px 18px 8px 8px',
    eyeSize: 17, eyeGap: 15, eyeTop: '27%',
    mouth: false,
    peekDy: 30, hideDy: 10, zIndex: 3,
  },
  {
    color: '#18181b', w: 72, h: 165,
    radius: '12px 12px 4px 4px',
    border: '2px solid rgba(255,255,255,0.18)',
    eyeSize: 13, eyeGap: 11, eyeTop: '28%',
    mouth: false,
    peekDy: 22, hideDy: 8, zIndex: 2,
  },
  {
    color: '#f97316', w: 120, h: 80,
    radius: '50% 50% 12px 12px',
    eyeSize: 12, eyeGap: 26, eyeTop: '18%',
    mouth: false,
    peekDy: 8, hideDy: 4, zIndex: 5,
  },
  {
    color: '#eab308', w: 62, h: 118,
    radius: '32px 32px 12px 12px',
    eyeSize: 11, eyeGap: 9, eyeTop: '25%',
    mouth: true,
    peekDy: 18, hideDy: 8, zIndex: 4,
  },
  {
    color: '#ec4899', w: 78, h: 96,
    radius: '50%',
    eyeSize: 11, eyeGap: 18, eyeTop: '28%',
    mouth: true,
    peekDy: 12, hideDy: 6, zIndex: 1,
  },
];

// ── 单角色 ────────────────────────────────────────────────────────
function Character({ cfg, state, override }: { cfg: Char; state: CharState; override: boolean }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); loop(); }, 150);
      }, Math.random() * 4000 + 2500);
    };
    const init = setTimeout(loop, Math.random() * 2000);
    return () => { clearTimeout(t!); clearTimeout(init); };
  }, []);

  const isPeek = state === 'peek' || override;
  const isHide = state === 'hide' && !override;

  const rot = isPeek ? PEEK_ROT : isHide ? HIDE_ROT : 0;
  const dy  = isPeek ? -cfg.peekDy : 0;
  const h   = isPeek ? cfg.h + cfg.peekDy : isHide ? cfg.h + cfg.hideDy : cfg.h;

  // 眼睛容器 left：hide=40%，peek=60%，idle=50%
  const eyesLeft = isPeek ? '60%' : isHide ? '40%' : '50%';

  // 嘴巴
  const mouthStyle: React.CSSProperties = {
    width: isPeek ? 22 : isHide ? 12 : 18,
    borderRadius: isPeek ? '0 0 8px 8px' : isHide ? '8px 8px 0 0' : '2px',
    height: isPeek ? 5 : isHide ? 4 : 3,
    background: isPeek ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.28)',
  };

  return (
    <div
      className={styles.char}
      style={{
        width: cfg.w,
        height: h,
        background: cfg.color,
        borderRadius: cfg.radius,
        border: cfg.border,
        transform: `rotate(${rot}deg) translateY(${dy}px)`,
        zIndex: cfg.zIndex,
      }}
    >
      {/* 眼睛：left 动态偏移表达看的方向 */}
      <div
        className={styles.eyes}
        style={{ top: cfg.eyeTop, left: eyesLeft, gap: cfg.eyeGap }}
      >
        <Eye size={cfg.eyeSize} blinking={blink} />
        <Eye size={cfg.eyeSize} blinking={blink} />
      </div>

      {cfg.mouth && <div className={styles.mouth} style={mouthStyle} />}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────
export default function BookInviteGate({ onSuccess }: Props) {
  const [code, setCode]       = useState('');
  const [show, setShow]       = useState(false);  // password visible
  const [error, setError]     = useState('');
  const [shaking, setShaking] = useState(false);
  const [done, setDone]       = useState(false);
  const [peeking, setPeeking] = useState(false);

  const typing = code.length > 0;
  const charState: CharState = typing && !show ? 'hide' : typing && show ? 'peek' : 'idle';

  // 密码可见时偷瞄循环
  useEffect(() => {
    if (typing && show) {
      const t = setTimeout(() => {
        setPeeking(true);
        setTimeout(() => setPeeking(false), 900);
      }, Math.random() * 3000 + 1800);
      return () => clearTimeout(t);
    }
    setPeeking(false);
  }, [typing, show, peeking]);

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (INVITE_CODES.includes(code.trim())) {
      setDone(true);
      setTimeout(onSuccess, 700);
    } else {
      setError('邀请码不正确，请重试');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  }, [code, onSuccess]);

  return (
    <div className={`${styles.gate} ${done ? styles.out : ''}`}>
      {/* 左：小人 */}
      <div className={styles.left}>
        <div className={styles.crowd}>
          {CHARS.map((c, i) => (
            <Character key={i} cfg={c} state={charState} override={peeking} />
          ))}
        </div>
      </div>

      {/* 右：表单 */}
      <div className={styles.right}>
        <div className={styles.card}>
          <h1 className={styles.title}>星际图书馆</h1>
          <p className={styles.sub}>需要邀请码才能进入</p>

          <form onSubmit={submit}>
            <div className={`${styles.field} ${shaking ? styles.shake : ''}`}>
              <input
                type={show ? 'text' : 'password'}
                value={code}
                onChange={e => { setCode(e.target.value); setError(''); }}
                placeholder="请输入邀请码"
                className={styles.input}
                autoComplete="off"
                autoFocus
              />
              <button type="button" className={styles.eye2} onClick={() => setShow(v => !v)}>
                {!show ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
            {error && <p className={styles.err}>{error}</p>}
            <button type="submit" className={styles.btn}>进入宇宙 →</button>
          </form>
        </div>
      </div>
    </div>
  );
}
