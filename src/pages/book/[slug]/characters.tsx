import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import path from 'path';
import fs from 'fs';
import booksData from '@/data/books.json';
import type { Character } from '@/types/character';
import CharacterGallery from '@/components/CharacterGallery';
import BookAccessGate from '@/components/BookAccessGate';
import styles from './characters.module.css';

const { books } = booksData;

// 世界主题配置（与 world.tsx 保持一致）
const BOOK_WORLDS: Record<string, {
  color: string;
  secondColor: string;
  bgGradient: string;
  emoji: string;
  subTheme: string;
  glowColor: string;
}> = {
  'dao-gui-yi-xian': {
    color: '#a78bfa',
    secondColor: '#7c3aed',
    glowColor: 'rgba(167, 139, 250, 0.35)',
    bgGradient: 'radial-gradient(ellipse at 30% 40%, #1e0050 0%, #0d0028 50%, #000 100%)',
    emoji: '🌀',
    subTheme: '仙侠异界',
  },
  'wo-kanjian-de-shijie': {
    color: '#38bdf8',
    secondColor: '#0ea5e9',
    glowColor: 'rgba(56, 189, 248, 0.35)',
    bgGradient: 'radial-gradient(ellipse at 70% 30%, #001e3c 0%, #000e20 50%, #000 100%)',
    emoji: '🌍',
    subTheme: '现实·科技',
  },
};

const DEFAULT_WORLD = {
  color: '#9ca3af',
  secondColor: '#6b7280',
  glowColor: 'rgba(156, 163, 175, 0.3)',
  bgGradient: 'radial-gradient(ellipse at 50% 50%, #111 0%, #000 100%)',
  emoji: '🌑',
  subTheme: '神秘',
};

interface CharactersPageProps {
  slug: string;
  title: string;
  characters: Character[];
}

// ─── 人物选择弹窗（扮演模式：选择 AI 角色）──────────────────────────────────

interface CharacterSelectorProps {
  characters: Character[];
  playerCharacterId: string;
  bookSlug: string;
  bookColor: string;
  onClose: () => void;
}

function CharacterSelector({ characters, playerCharacterId, bookSlug, bookColor, onClose }: CharacterSelectorProps) {
  const router = useRouter();
  const playerCharacter = characters.find(c => c.id === playerCharacterId);
  const availableCharacters = characters.filter(c => c.id !== playerCharacterId);

  const handleSelect = (aiCharacterId: string) => {
    router.push(`/book/${bookSlug}/chat?playerCharacter=${playerCharacterId}&aiCharacter=${aiCharacterId}`);
  };

  return (
    <div className={styles.selectorOverlay} onClick={onClose}>
      <div
        className={styles.selectorModal}
        style={{ borderColor: `${bookColor}44` }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.selectorHeader}>
          <div className={styles.selectorTitle}>
            <span style={{ color: bookColor }}>🎭</span> 选择对话对象
          </div>
          <button className={styles.selectorClose} onClick={onClose}>✕</button>
        </div>
        <p className={styles.selectorDesc}>
          你将以 <strong style={{ color: bookColor }}>{playerCharacter?.name || playerCharacterId}</strong> 的身份，
          与以下哪位角色展开对话？
        </p>
        <div className={styles.selectorList}>
          {availableCharacters.length === 0 ? (
            <p className={styles.selectorEmpty}>该书暂无其他可选人物</p>
          ) : (
            availableCharacters.map(c => (
              <button
                key={c.id}
                className={styles.selectorItem}
                style={{ borderColor: `${bookColor}33` }}
                onClick={() => handleSelect(c.id)}
              >
                <span className={styles.selectorItemAvatar}>{c.avatar}</span>
                <div className={styles.selectorItemInfo}>
                  <div className={styles.selectorItemName}>{c.name}</div>
                  <div className={styles.selectorItemRole}>{c.role}</div>
                </div>
                <span className={styles.selectorItemArrow} style={{ color: bookColor }}>→</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function CharactersPage({ slug, title, characters }: CharactersPageProps) {
  const router = useRouter();
  const world = BOOK_WORLDS[slug] || DEFAULT_WORLD;
  const [loaded, setLoaded] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [playAsId, setPlayAsId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  // 检测 URL 中的 playAs 参数，弹出人物选择框
  useEffect(() => {
    const { playAs } = router.query;
    if (playAs && typeof playAs === 'string') {
      setPlayAsId(playAs);
      setShowSelector(true);
      // 清除 URL 参数，避免刷新后重复弹出
      router.replace(`/book/${slug}/characters`, undefined, { shallow: true });
    }
  }, [router.query, slug, router]);

  return (
    <BookAccessGate>
    <>
      <Head>
        <title>{`${title} · 人物图鉴`}</title>
        <meta name="description" content={`探索《${title}》中的人物世界`} />
      </Head>

      <div
        className={`${styles.page} ${loaded ? styles.loaded : ''}`}
        style={{ background: world.bgGradient }}
      >
        {/* 背景光晕 */}
        <div
          className={styles.bgGlow}
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${world.glowColor}, transparent 70%)` }}
        />

        {/* 返回按钮 */}
        <Link
          href={`/book/${slug}/world`}
          className={styles.backBtn}
          style={{ color: world.color, borderColor: `${world.color}44` }}
        >
          ← 返回世界
        </Link>

        {/* 主内容 */}
        <div className={styles.main}>
          {/* 页面标题 */}
          <div className={styles.pageHeader}>
            <div
              className={styles.pageBadge}
              style={{ borderColor: world.color, color: world.color }}
            >
              {world.emoji} {world.subTheme}
            </div>
            <h1 className={styles.pageTitle} style={{ color: world.color }}>
              人物图鉴
            </h1>
            <p className={styles.pageDesc}>
              探索《{title}》中的人物世界，了解他们的性格与故事
            </p>
          </div>

          {/* 人物图鉴组件 */}
          <CharacterGallery
            bookSlug={slug}
            characters={characters}
            bookColor={world.color}
          />
        </div>

        {/* 底部光晕 */}
        <div
          className={styles.bottomGlow}
          style={{ background: `radial-gradient(ellipse at 50% 100%, ${world.glowColor}, transparent 70%)` }}
        />

        {/* 扮演模式：选择 AI 角色弹窗 */}
        {showSelector && playAsId && (
          <CharacterSelector
            characters={characters}
            playerCharacterId={playAsId}
            bookSlug={slug}
            bookColor={world.color}
            onClose={() => setShowSelector(false)}
          />
        )}
      </div>
    </>
    </BookAccessGate>
  );
}

export const getStaticPaths: GetStaticPaths = () => ({
  paths: books.map(b => ({ params: { slug: b.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<CharactersPageProps> = ({ params }) => {
  const slug = params?.slug as string;
  const book = books.find(b => b.slug === slug);
  if (!book) return { notFound: true };

  // 读取人物数据文件
  let characters: Character[] = [];
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'characters', `${slug}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as { characters?: Character[] };
      characters = data.characters || [];
    }
  } catch {
    characters = [];
  }

  return {
    props: {
      slug: book.slug,
      title: book.title,
      characters,
    },
  };
};
