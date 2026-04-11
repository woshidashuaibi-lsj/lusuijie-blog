import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import booksData from '@/data/books.json';
import styles from './world.module.css';

const { books } = booksData;

// 世界主题配置（与书单页保持一致）
const BOOK_WORLDS: Record<string, {
  theme: string;
  subTheme: string;
  color: string;
  secondColor: string;
  glowColor: string;
  bgGradient: string;
  atmosphere: string;
  worldDesc: string;
  emoji: string;
  particleEmojis: string[];
  ambientText: string[];
  readLabel: string;
  chatLabel: string;
  chatEnabled: boolean;
  chatCharacter?: string;
}> = {
  'dao-gui-yi-xian': {
    theme: '道诡异仙',
    subTheme: '仙侠异界',
    color: '#a78bfa',
    secondColor: '#7c3aed',
    glowColor: 'rgba(167, 139, 250, 0.4)',
    bgGradient: 'radial-gradient(ellipse at 30% 40%, #1e0050 0%, #0d0028 50%, #000 100%)',
    atmosphere: '杯山之下，幻觉横行',
    worldDesc: '杯山下的精神病院里，李火旺分不清哪些是真实，哪些是幻觉。道诡横行，人心叵测，仙与鬼的边界在这里模糊。',
    emoji: '🌀',
    particleEmojis: ['✨', '🌙', '⚡', '🔮', '💫'],
    ambientText: ['道可道，非常道', '幻即是真', '仙鬼之间'],
    readLabel: '进入幻觉·阅读原著',
    chatLabel: '与李火旺对话',
    chatEnabled: true,
    chatCharacter: '李火旺',
  },
  'wo-kanjian-de-shijie': {
    theme: '我看见的世界',
    subTheme: '现实·科技',
    color: '#38bdf8',
    secondColor: '#0ea5e9',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    bgGradient: 'radial-gradient(ellipse at 70% 30%, #001e3c 0%, #000e20 50%, #000 100%)',
    atmosphere: '从农村到硅谷，用AI改变世界',
    worldDesc: '李飞飞的自传——一个中国移民女孩，如何成为 AI 领域最重要的科学家之一，用一张《ImageNet》改变了整个世界。',
    emoji: '🌍',
    particleEmojis: ['🔬', '💡', '🌐', '⚙️', '📡'],
    ambientText: ['AI is the new electricity', '看见，才能改变', 'ImageNet 改变世界'],
    readLabel: '翻阅传记·阅读原著',
    chatLabel: '与李飞飞对话',
    chatEnabled: true,
    chatCharacter: '李飞飞',
  },
};

// 默认世界配置（fallback）
const DEFAULT_WORLD = {
  theme: '未知世界',
  subTheme: '神秘',
  color: '#9ca3af',
  secondColor: '#6b7280',
  glowColor: 'rgba(156, 163, 175, 0.3)',
  bgGradient: 'radial-gradient(ellipse at 50% 50%, #111 0%, #000 100%)',
  atmosphere: '等待探索',
  worldDesc: '这是一个尚未被记录的世界...',
  emoji: '🌑',
  particleEmojis: ['✨'],
  ambientText: ['神秘', '未知', '探索'],
  readLabel: '阅读原著',
  chatLabel: '与人物对话',
  chatEnabled: false,
};

interface WorldProps {
  slug: string;
  title: string;
  author: string;
  cover: string;
}

// 飘动粒子
interface FloatParticle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  opacity: number;
  delay: number;
}

function FloatingParticles({ emojis, color }: { emojis: string[]; color: string }) {
  const [particles] = useState<FloatParticle[]>(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 16 + 10,
      speed: Math.random() * 12 + 8,
      drift: (Math.random() - 0.5) * 40,
      opacity: Math.random() * 0.4 + 0.1,
      delay: Math.random() * -15,
    }))
  );

  return (
    <div className={styles.particles}>
      {particles.map(p => (
        <div
          key={p.id}
          className={styles.particle}
          style={{
            left: `${p.x}%`,
            bottom: `-5%`,
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            animationDuration: `${p.speed}s`,
            animationDelay: `${p.delay}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

export default function WorldPage({ slug, title, author, cover }: WorldProps) {
  const router = useRouter();
  const world = BOOK_WORLDS[slug] || DEFAULT_WORLD;
  const [loaded, setLoaded] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitTarget, setExitTarget] = useState('');
  const [ambientIndex, setAmbientIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  // 轮播氛围文字
  useEffect(() => {
    const interval = setInterval(() => {
      setAmbientIndex(i => (i + 1) % world.ambientText.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [world.ambientText.length]);

  const navigateTo = (path: string) => {
    setExitTarget(path);
    setExiting(true);
    setTimeout(() => router.push(path), 500);
  };

  // 查找对应的 chat 页路径
  const chatPath = `/book/${slug}/chat`;
  const readPath = `/book/${slug}`;

  return (
    <>
      <Head>
        <title>{`进入《${title}》的世界`}</title>
        <meta name="description" content={world.worldDesc} />
      </Head>

      <div
        className={`${styles.worldPage} ${loaded ? styles.loaded : ''} ${exiting ? styles.exiting : ''}`}
        style={{ background: world.bgGradient }}
      >
        <FloatingParticles emojis={world.particleEmojis} color={world.color} />

        {/* 返回按钮 */}
        <button
          className={styles.backBtn}
          onClick={() => navigateTo('/book')}
          style={{ color: world.color, borderColor: `${world.color}44` }}
        >
          ← 返回星际图书馆
        </button>

        {/* 主内容区 */}
        <div className={styles.worldMain}>
          {/* 左：书封面 + 信息 */}
          <div className={styles.bookSide}>
            <div
              className={styles.coverWrapper}
              style={{ boxShadow: `0 0 60px ${world.glowColor}, 0 0 120px ${world.glowColor}` }}
            >
              <img
                src={cover}
                alt={title}
                className={styles.cover}
              />
              <div
                className={styles.coverOverlay}
                style={{ background: `linear-gradient(to bottom, transparent 60%, ${world.secondColor}88)` }}
              />
            </div>
            <div className={styles.bookMeta}>
              <div className={styles.bookMetaTitle}>{title}</div>
              <div className={styles.bookMetaAuthor}>{author}</div>
            </div>
          </div>

          {/* 右：世界信息 + 入口 */}
          <div className={styles.worldSide}>
            {/* 世界标题 */}
            <div className={styles.worldBadge} style={{ borderColor: world.color, color: world.color }}>
              {world.emoji} {world.subTheme}
            </div>
            <h1 className={styles.worldTitle} style={{ color: world.color }}>
              {world.theme}
            </h1>
            <div className={styles.worldAtmo}>{world.atmosphere}</div>
            <p className={styles.worldDesc}>{world.worldDesc}</p>

            {/* 氛围语 */}
            <div className={styles.ambientText} style={{ color: `${world.color}aa` }}>
              {world.ambientText[ambientIndex]}
            </div>

            {/* 两个入口按钮 */}
            <div className={styles.enterGates}>
              {/* 阅读原著 */}
              <button
                className={styles.gateBtn}
                onClick={() => navigateTo(readPath)}
                style={{
                  background: `linear-gradient(135deg, ${world.secondColor}33, ${world.secondColor}11)`,
                  borderColor: world.color,
                  color: '#fff',
                }}
              >
                <div className={styles.gateBtnIcon} style={{ color: world.color }}>📖</div>
                <div className={styles.gateBtnContent}>
                  <div className={styles.gateBtnLabel}>{world.readLabel}</div>
                  <div className={styles.gateBtnSub}>沉浸式阅读，逐章探索</div>
                </div>
                <div className={styles.gateBtnArrow} style={{ color: world.color }}>→</div>
              </button>

              {/* 与人物对话 */}
              {world.chatEnabled ? (
                <button
                  className={styles.gateBtn}
                  onClick={() => navigateTo(chatPath)}
                  style={{
                    background: `linear-gradient(135deg, ${world.secondColor}55, ${world.secondColor}22)`,
                    borderColor: world.color,
                    color: '#fff',
                  }}
                >
                  <div className={styles.gateBtnIcon} style={{ color: world.color }}>💬</div>
                  <div className={styles.gateBtnContent}>
                    <div className={styles.gateBtnLabel}>{world.chatLabel}</div>
                    <div className={styles.gateBtnSub}>
                      {world.chatCharacter ? `与 ${world.chatCharacter} 展开对话` : 'AI 角色扮演'}
                    </div>
                  </div>
                  <div className={styles.gateBtnArrow} style={{ color: world.color }}>→</div>
                </button>
              ) : (
                <div
                  className={`${styles.gateBtn} ${styles.gateBtnDisabled}`}
                >
                  <div className={styles.gateBtnIcon}>💬</div>
                  <div className={styles.gateBtnContent}>
                    <div className={styles.gateBtnLabel}>角色对话</div>
                    <div className={styles.gateBtnSub}>即将开放</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部光效装饰 */}
        <div
          className={styles.bottomGlow}
          style={{ background: `radial-gradient(ellipse at 50% 100%, ${world.glowColor}, transparent 70%)` }}
        />
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = () => ({
  paths: books.map(b => ({ params: { slug: b.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<WorldProps> = ({ params }) => {
  const slug = params?.slug as string;
  const book = books.find(b => b.slug === slug);
  if (!book) return { notFound: true };
  return {
    props: {
      slug: book.slug,
      title: book.title,
      author: book.author,
      cover: book.cover,
    },
  };
};
