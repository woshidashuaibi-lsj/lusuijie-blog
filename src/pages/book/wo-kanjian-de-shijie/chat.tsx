import Head from 'next/head';
import BookChat from '@/components/BookChat';

const BOOK_TITLE = '我看见的世界';
const BOOK_SLUG = 'wo-kanjian-de-shijie';

export default function BookChatPage() {
  return (
    <>
      <Head>
        <title>与《{BOOK_TITLE}》对话 - 卢穗杰的博客</title>
        <meta name="description" content={`AI 问答：基于《${BOOK_TITLE}》内容的智能对话`} />
      </Head>
      <BookChat bookSlug={BOOK_SLUG} bookTitle={BOOK_TITLE} />
    </>
  );
}
