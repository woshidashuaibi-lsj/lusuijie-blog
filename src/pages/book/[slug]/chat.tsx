/**
 * 动态对话页 /book/[slug]/chat
 * 支持 URL 参数：
 *   ?character=[id]                          - 读者模式：与指定角色对话
 *   ?playerCharacter=[id]&aiCharacter=[id]   - 玩家扮演模式
 *
 * 注意：项目使用 output: 'export' 静态导出，API Routes 不可用。
 * 人物数据通过静态 import JSON 在构建期注入，不使用 fs/path（避免 autoExport 问题）。
 */
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import booksData from '@/data/books.json';

const BookChat = dynamic(() => import('@/components/BookChat'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
      加载中…
    </div>
  ),
});

const BookAccessGate = dynamic(() => import('@/components/BookAccessGate'), {
  ssr: false,
  loading: () => null,
});

import type { Character } from '@/types/character';

// 静态 import 各书籍人物数据（Next.js 支持 JSON 静态导入，不触发 autoExport）
import daoGuiCharactersData from '@/data/characters/dao-gui-yi-xian.json';
import woKanjianCharactersData from '@/data/characters/wo-kanjian-de-shijie.json';

const CHARACTERS_MAP: Record<string, Character[]> = {
  'dao-gui-yi-xian': (daoGuiCharactersData as { characters: Character[] }).characters,
  'wo-kanjian-de-shijie': (woKanjianCharactersData as { characters: Character[] }).characters,
};

const { books } = booksData;

interface ChatPageProps {
  slug: string;
  title: string;
  characters: Character[];
}

export default function BookChatPage({ slug, title, characters }: ChatPageProps) {
  const router = useRouter();
  const { character, playerCharacter, aiCharacter } = router.query;

  // 静态导出下 router.query 首次渲染为空，等 isReady 后再挂载 BookChat
  // 避免 characterId 初始化为 undefined 导致 AI 走主角 fallback
  if (!router.isReady) return null;

  return (
    <BookAccessGate>
      <>
        <Head>
          <title>与《{title}》对话 - 卢穗杰的博客</title>
          <meta name="description" content={`AI 问答：基于《${title}》内容的智能对话`} />
        </Head>
        <BookChat
          bookSlug={slug}
          bookTitle={title}
          characters={characters}
          initialCharacterId={typeof character === 'string' ? character : undefined}
          playerCharacterId={typeof playerCharacter === 'string' ? playerCharacter : undefined}
          aiCharacterId={typeof aiCharacter === 'string' ? aiCharacter : undefined}
        />
      </>
    </BookAccessGate>
  );
}

export const getStaticPaths: GetStaticPaths = () => ({
  paths: books.map(b => ({ params: { slug: b.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<ChatPageProps> = ({ params }) => {
  const slug = params?.slug as string;
  const book = books.find(b => b.slug === slug);
  if (!book) return { notFound: true };

  const characters: Character[] = CHARACTERS_MAP[slug] || [];

  return {
    props: {
      slug: book.slug,
      title: book.title,
      characters,
    },
  };
};
