import Head from 'next/head';
import { useRouter } from 'next/router';
import BookChat from '@/components/BookChat';
import charactersData from '@/data/characters/dao-gui-yi-xian.json';
import type { Character } from '@/types/character';

const BOOK_TITLE = '道诡异仙';
const BOOK_SLUG = 'dao-gui-yi-xian';
const characters = (charactersData as { characters: Character[] }).characters;

export default function BookChatPage() {
  const router = useRouter();
  const { character, playerCharacter, aiCharacter } = router.query;

  console.log('[chat.tsx] router.query:', router.query);
  console.log('[chat.tsx] characters loaded:', characters.map(c => c.id));

  return (
    <>
      <Head>
        <title>与《{BOOK_TITLE}》对话 - 卢穗杰的博客</title>
        <meta name="description" content={`AI 问答：基于《${BOOK_TITLE}》内容的智能对话`} />
      </Head>
      <BookChat
        bookSlug={BOOK_SLUG}
        bookTitle={BOOK_TITLE}
        characters={characters}
        initialCharacterId={typeof character === 'string' ? character : undefined}
        playerCharacterId={typeof playerCharacter === 'string' ? playerCharacter : undefined}
        aiCharacterId={typeof aiCharacter === 'string' ? aiCharacter : undefined}
      />
    </>
  );
}
