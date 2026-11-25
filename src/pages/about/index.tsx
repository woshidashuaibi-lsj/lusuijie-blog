import Head from 'next/head';
import { SITE_URL } from '@/lib/site';
import AboutPagePage from '@/pages/AboutPage';

export default function GuestbookRoute() {
  return (
    <>
      <Head>
        <title>关于我 | 卢穗杰的博客</title>
        <meta name="description" content="卢穗杰，天真的理想主义者。前端开发者，热爱阅读与创作。" />
        <link rel="canonical" href={`${SITE_URL}/about/`} />
        <meta property="og:title" content="关于我 | 卢穗杰的博客" />
        <meta property="og:description" content="卢穗杰，天真的理想主义者。前端开发者，热爱阅读与创作。" />
        <meta property="og:url" content={`${SITE_URL}/about/`} />
        <meta property="og:type" content="profile" />
        <meta property="og:image" content={`${SITE_URL}/favicon.jpg`} />
      </Head>
      <AboutPagePage />
    </>
  );
}