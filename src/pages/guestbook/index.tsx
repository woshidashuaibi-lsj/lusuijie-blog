import Head from 'next/head';
import GuestbookPage from '@/components/GuestbookPage';

export default function GuestbookRoute() {
  return (
    <>
      <Head>
        <title>留言板 - 卢穗杰的博客</title>
        <meta name="description" content="欢迎在我的博客留言，分享你的想法！" />
      </Head>
      <GuestbookPage />
    </>
  );
}