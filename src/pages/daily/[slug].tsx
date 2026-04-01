import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps, GetStaticPaths } from 'next';
import Navigation from '@/components/Navigation';
import TableOfContents from '@/pages/BlogPostPage/components/TableOfContents';
import { getAllDailyPosts, getDailyPostBySlug, dailyMarkdownToHtml } from '@/lib/daily';
import type { DailyPost } from '@/lib/daily';
import styles from './[slug].module.css';

interface DailyDetailPageProps {
  post: DailyPost;
  htmlContent: string;
  prevPost: { slug: string; date: string } | null;
  nextPost: { slug: string; date: string } | null;
}

export default function DailyDetailPage({ post, htmlContent, prevPost, nextPost }: DailyDetailPageProps) {
  return (
    <>
      <Head>
        <title>{post.date} AI 日报 - 卢穗杰的博客</title>
        <meta name="description" content={post.summary} />
      </Head>
      <Navigation />
      <div className={styles.detailPage}>
        {/* 左侧目录 */}
        <aside className={styles.toc}>
          <TableOfContents htmlContent={htmlContent} />
        </aside>

        <div className={styles.container}>
          <article className={styles.article}>
            {/* 返回 */}
            <Link href="/daily" className={styles.backLink}>
              ← 返回日报列表
            </Link>

            {/* 标题 */}
            <header className={styles.header}>
              <h1 className={styles.title}>{post.date} AI 日报</h1>
              {post.summary && (
                <p className={styles.summary}>{post.summary}</p>
              )}
            </header>

            {/* 正文 */}
            <main
              className={`${styles.prose} prose`}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            {/* 上下篇导航 */}
            <nav className={styles.pagination}>
              {nextPost ? (
                <Link href={`/daily/${nextPost.slug}`} className={styles.pageLink}>
                  ← {nextPost.date}
                </Link>
              ) : <span />}
              {prevPost ? (
                <Link href={`/daily/${prevPost.slug}`} className={`${styles.pageLink} ${styles.pageLinkRight}`}>
                  {prevPost.date} →
                </Link>
              ) : <span />}
            </nav>
          </article>
        </div>
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getAllDailyPosts();
  return {
    paths: posts.map(p => ({ params: { slug: p.slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.slug as string;
  const post = getDailyPostBySlug(slug);
  if (!post) return { notFound: true };

  const htmlContent = await dailyMarkdownToHtml(post.content);

  // 找上下篇（倒序排列，所以 prev 是更新的，next 是更旧的）
  const allPosts = getAllDailyPosts(); // 已按日期倒序
  const idx = allPosts.findIndex(p => p.slug === slug);

  const prevPost = idx > 0
    ? { slug: allPosts[idx - 1].slug, date: allPosts[idx - 1].date }
    : null;
  const nextPost = idx < allPosts.length - 1
    ? { slug: allPosts[idx + 1].slug, date: allPosts[idx + 1].date }
    : null;

  return {
    props: {
      post,
      htmlContent,
      prevPost,
      nextPost,
    },
  };
};
