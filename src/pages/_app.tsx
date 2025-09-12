import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>我的博客</title>
        <meta name="description" content="使用 Next.js 构建的个人博客网站" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.7.0/style.css"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
