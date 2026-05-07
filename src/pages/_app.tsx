import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* 默认 title，各页面会覆盖 */}
        <title>卢穗杰的博客</title>
        <meta name="description" content="卢穗杰的个人博客，记录技术思考、AI 日报、阅读笔记与生活随想。" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="author" content="卢穗杰" />
        <meta name="robots" content="index, follow" />

        {/* 全局 og */}
        <meta property="og:site_name" content="卢穗杰的博客" />
        <meta property="og:locale" content="zh_CN" />

        {/* favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.jpg" />

        {/* 字体通过 _document.tsx 加载，此处不重复引入 */}
      </Head>
      <Component {...pageProps} />
    </>
  );
}
