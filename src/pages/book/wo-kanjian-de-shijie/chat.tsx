import Head from 'next/head';
import { useRouter } from 'next/router';
import BookChat from '@/components/BookChat';

const BOOK_TITLE = '我看见的世界';
const BOOK_SLUG = 'wo-kanjian-de-shijie';

export default function BookChatPage() {
  const router = useRouter();
  const { character, playerCharacter, aiCharacter } = router.query;

  return (
    <>
      <Head>
        <title>与《{BOOK_TITLE}》对话 - 卢穗杰的博客</title>
        <meta name="description" content={`AI 问答：基于《${BOOK_TITLE}》内容的智能对话`} />
      </Head>
      <BookChat
        bookSlug={BOOK_SLUG}
        bookTitle={BOOK_TITLE}
        initialCharacterId={typeof character === 'string' ? character : undefined}
        playerCharacterId={typeof playerCharacter === 'string' ? playerCharacter : undefined}
        aiCharacterId={typeof aiCharacter === 'string' ? aiCharacter : undefined}
      />
    </>
  );
}
