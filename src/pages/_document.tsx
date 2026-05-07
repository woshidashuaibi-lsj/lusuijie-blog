import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        <link rel="icon" href="/favicon.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/favicon.jpg" />

        {/* CDN preconnect：减少 DNS 查询 + TLS 握手耗时 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />

        {/* 霞鹜文楷：只加载实际用到的 regular 字重，使用非阻塞方式避免渲染阻塞 */}
        {/* media="print" + onLoad 技巧：先以打印样式异步加载，加载完再切换为 all */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.7.0/lxgwwenkailite-regular.css"
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore onLoad on link is valid for this pattern
          media="print"
          onLoad="this.media='all'"
        />
        {/* noscript 兜底：JS 禁用时仍能加载字体 */}
        <noscript>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.7.0/lxgwwenkailite-regular.css"
          />
        </noscript>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
