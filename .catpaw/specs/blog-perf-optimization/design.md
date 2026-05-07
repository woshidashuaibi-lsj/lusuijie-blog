# 博客性能优化方案

## 目标

将首页 Lighthouse Performance 从 **61 → 85+**，核心改善 LCP（4.4s → <2.5s）、FCP（2.0s → <1.2s）、Speed Index（8.0s → <3s）。

---

## 问题诊断（来自 Lighthouse）

| # | 问题 | 根因 | 影响 |
|---|------|------|------|
| 🔴 P0 | `book.js` 单包 **3 MB** | BookChat/RAG 等所有书籍代码打包进同一 chunk | LCP +3s，首屏阻塞 |
| 🔴 P1 | 霞鹜文楷 **6 个 CSS 全量加载**（100% unused，~180KB） | `_app.tsx` 全量引入 `style.css`（含所有字重变体）| FCP +160ms，CSS 阻塞渲染 |
| 🟠 P2 | 头像图片托管在 **GitHub Pages**（260KB，缓存仅10min，有 Cookie 问题） | `HeroSection` 硬编码外部 URL | LCP 图片慢，Inspector 报 Cookie Warning |
| 🟠 P3 | `images: { unoptimized: true }` | `next.config.js` 关闭了图片优化 | 所有图片无压缩、无 WebP、无懒加载优化 |
| 🟡 P4 | 首页 `/blog.json` 和 `/daily.json` 各加载 **263KB / 211KB** | `getStaticProps` 一次返回所有文章数据 | 首屏多余网络负载 |
| 🟡 P5 | `next/font` 未使用，字体加载链路长（CDN → 6个CSS → N个woff2） | 使用 jsDelivr CDN，无 `font-display: swap` 控制 | Speed Index 偏高 |

---

## 优化方案（按优先级）

### P0 — 拆分 `book.js` 巨包（预计 LCP -1.5s）

**根因**：`src/pages/book/index.tsx` 直接 import `BookAccessGate`、`BookChat` 等大型依赖，Next.js 将所有书籍相关代码（包括 RAG/LLM 客户端逻辑）打包进首页 chunk。

**方案**：对重型组件改用 `dynamic import`。

```ts
// src/pages/book/index.tsx（修改）
const BookAccessGate = dynamic(() => import('@/components/BookAccessGate'), { ssr: false });

// src/pages/book/[slug]/chat.tsx（修改）
const BookChat = dynamic(() => import('@/components/BookChat'), {
  loading: () => <div>加载中...</div>,
  ssr: false,
});
```

同理，`NovelCreator` 及其子组件也应 dynamic import。

---

### P1 — 精简霞鹜文楷字体加载（预计 FCP -160ms）

**根因**：`_app.tsx` 引入 `style.css` 会拉取 6 个字重 CSS（bold/regular/light × 2组），首页只用到 `LXGW WenKai Lite Regular`。

**方案**：替换为只引入单个字重，并加 `font-display: swap`。

```tsx
// src/pages/_document.tsx（修改）
// 只引入实际用到的 regular 字重，删掉全量 style.css
<link
  rel="preconnect"
  href="https://cdn.jsdelivr.net"
  crossOrigin="anonymous"
/>
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.7.0/lxgwwenkailite-regular.css"
  media="print"
  onLoad="this.media='all'"
/>
<noscript>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.7.0/lxgwwenkailite-regular.css" />
</noscript>
```

同时在 `globals.css` 的 `@font-face` 添加 `font-display: swap`（若直接用 CSS 变量则无需改）。

---

### P2 — 头像迁移到本地（消除 Cookie Warning，节省 LCP）

**根因**：`HeroSection` 中头像 URL 指向 `woshidashuaibi-lsj.github.io`，存在 Cookie 跨域问题，且缓存仅 10 分钟，Next.js Image 优化被 `unoptimized: true` 关闭。

**方案**：
1. 将头像下载到 `/public/images/avatar.png`
2. 修改 `HeroSection/index.tsx` 引用本地路径
3. 开启有限的图片优化（至少对本地图片）

```tsx
// src/components/HeroSection/index.tsx（修改）
<Image
  src="/images/avatar.png"   // 改为本地路径
  alt="个人头像"
  width={150}
  height={150}
  priority                    // 标记为 LCP 图片，优先加载
  className={styles.avatarImage}
/>
```

```js
// next.config.js（修改）
images: {
  unoptimized: false,          // 开启 Next.js Image 优化
  formats: ['image/avif', 'image/webp'],
  remotePatterns: [],          // 不再需要外部域名
},
```

---

### P3 — 首页数据瘦身（减少 blog.json / daily.json 体积）

**根因**：首页 `getStaticProps` 返回了全量文章数据（263KB），但首页只展示最新 3 篇。日报列表页也全量返回了所有文章的 content 字段。

**方案**：精简 props，只返回必要字段。

```ts
// src/pages/index.tsx getStaticProps（修改）
const featuredPosts = allPosts.slice(0, 3).map(p => ({
  slug: p.slug,
  title: p.title,
  date: p.date,
  category: p.category,
  excerpt: p.excerpt,
  // 不传 content 字段（节省 ~80%）
}));
```

```ts
// src/pages/daily/index.tsx getStaticProps（修改）
// 列表只保留 slug/date/summary，不传 content
const groups = getDailyPostsByMonth().map(g => ({
  ...g,
  posts: g.posts.map(p => ({
    slug: p.slug,
    date: p.date,
    summary: p.summary,
    // content 留给详情页，不在列表里传
  }))
}));
```

---

### P4 — 添加字体 preconnect（减少 DNS/TLS 延迟）

在 `_document.tsx` 为 CDN 域名添加 `preconnect`：

```tsx
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
```

---

## 改动文件汇总

| 文件 | 改动类型 | 预期收益 |
|------|----------|----------|
| `src/pages/book/index.tsx` | dynamic import BookAccessGate | book.js 包体积 -60% |
| `src/pages/book/[slug]/chat.tsx` | dynamic import BookChat | 减少首屏 JS 解析 |
| `src/pages/_app.tsx` | 删除全量 style.css 引入 | 减少 CSS 阻塞 ~180KB |
| `src/pages/_document.tsx` | 精简字体加载 + preconnect | FCP -160ms |
| `src/components/HeroSection/index.tsx` | 头像改本地路径 + priority | LCP 提前，消除 Cookie 警告 |
| `next.config.js` | 开启图片优化 | 图片压缩 + WebP |
| `src/pages/index.tsx` | getStaticProps 瘦身 | blog.json -80% |
| `src/pages/daily/index.tsx` | getStaticProps 去掉 content | daily.json -70% |

---

## 预期改善

| 指标 | 当前 | 目标 |
|------|------|------|
| Performance | 61 | **85+** |
| FCP | 2.0s | <1.2s |
| LCP | 4.4s | <2.5s |
| Speed Index | 8.0s | <3.5s |
| TBT | 0ms | 0ms（保持） |
| CLS | ~0 | ~0（保持） |

> 注意：下次 Lighthouse 测试请使用**无痕模式**，避免 Chrome 扩展（2.4GB 额外 JS）污染 unused-javascript 数据。

