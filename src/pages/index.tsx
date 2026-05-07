import { GetStaticProps } from 'next';
import { getAllPosts } from '@/lib/blog';
import type { BlogPost } from '@/types/blog';
import HomePage from './HomePage';
import Head from 'next/head';

interface HomePageProps {
  featuredPosts: BlogPost[];
}

const SITE_URL = 'https://lusuijie.com.cn';

// JSON-LD 结构化数据：WebSite + Person + SiteNavigationElement
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: '卢穗杰的博客',
      description: '天真的理想主义者，记录技术、阅读与生活的个人博客',
      inLanguage: 'zh-CN',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/blog/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: '卢穗杰',
      alternateName: 'lusuijie',
      url: SITE_URL,
      image: `${SITE_URL}/favicon.jpg`,
      description: '天真的理想主义者，前端开发者，热爱阅读与创作',
      sameAs: [
        'https://github.com/woshidashuaibi-lsj',
      ],
    },
    {
      '@type': 'SiteLinksSearchBox',
      '@id': `${SITE_URL}/#sitelinks`,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/blog/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

// 站点导航结构化数据（帮助 Google 识别 Sitelinks）
const navJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: '卢穗杰的博客导航',
  itemListElement: [
    {
      '@type': 'SiteLinksSearchBox',
      position: 1,
      url: `${SITE_URL}/`,
      name: '主页',
    },
    {
      '@type': 'ListItem',
      position: 2,
      url: `${SITE_URL}/blog/`,
      name: '文章',
    },
    {
      '@type': 'ListItem',
      position: 3,
      url: `${SITE_URL}/daily/`,
      name: 'AI 日报',
    },
    {
      '@type': 'ListItem',
      position: 4,
      url: `${SITE_URL}/book/`,
      name: '书单',
    },
    {
      '@type': 'ListItem',
      position: 5,
      url: `${SITE_URL}/photo/`,
      name: '照片',
    },
    {
      '@type': 'ListItem',
      position: 6,
      url: `${SITE_URL}/guestbook/`,
      name: '留言板',
    },
  ],
};

export default function Home({ featuredPosts }: HomePageProps) {
  return (
    <>
      <Head>
        <title>卢穗杰的博客 | 天真的理想主义者</title>
        <meta name="description" content="卢穗杰的个人博客，记录技术思考、AI 日报、阅读笔记与生活随想。前端开发 · 阅读 · 创作。" />
        <meta name="keywords" content="卢穗杰,个人博客,前端开发,AI日报,阅读,技术" />
        <link rel="canonical" href={SITE_URL} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:site_name" content="卢穗杰的博客" />
        <meta property="og:title" content="卢穗杰的博客 | 天真的理想主义者" />
        <meta property="og:description" content="卢穗杰的个人博客，记录技术思考、AI 日报、阅读笔记与生活随想。" />
        <meta property="og:image" content={`${SITE_URL}/favicon.jpg`} />
        <meta property="og:image:width" content="400" />
        <meta property="og:image:height" content="400" />
        <meta property="og:locale" content="zh_CN" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="卢穗杰的博客" />
        <meta name="twitter:description" content="天真的理想主义者，记录技术、阅读与生活。" />
        <meta name="twitter:image" content={`${SITE_URL}/favicon.jpg`} />

        {/* JSON-LD 结构化数据 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(navJsonLd) }}
        />
      </Head>
      <HomePage featuredPosts={featuredPosts} />
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const allPosts = getAllPosts();
  // 只取最新 3 篇，且去掉 content 字段（节省 ~80% JSON 体积）
  // wordCount 预计算好传过来，供 BlogItem 显示字数
  const featuredPosts = allPosts.slice(0, 3).map(({ content, ...rest }) => ({
    ...rest,
    wordCount: content.length,
    content: '', // 保留字段结构兼容性，但置空
  }));

  return {
    props: {
      featuredPosts,
    },
  };
};
