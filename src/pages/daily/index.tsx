import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { useState } from 'react';
import Navigation from '@/components/Navigation';
import { getDailyPostsByMonth, getAllDailyPosts } from '@/lib/daily';
import type { DailyPost, DailyMonthGroup } from '@/lib/daily';
import styles from './index.module.css';

interface DailyPageProps {
  groups: DailyMonthGroup[];
  latestPost: DailyPost | null;
}

export default function DailyPage({ groups, latestPost }: DailyPageProps) {
  // 默认选中最新一篇
  const [activeSlug, setActiveSlug] = useState<string>(latestPost?.slug || '');
  // 默认展开最新的月份分组
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    new Set(groups.length > 0 ? [groups[0].yearMonth] : [])
  );

  const toggleMonth = (yearMonth: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(yearMonth)) {
        next.delete(yearMonth);
      } else {
        next.add(yearMonth);
      }
      return next;
    });
  };

  // 找到当前选中的日报
  const allPosts = groups.flatMap(g => g.posts);
  const currentPost = allPosts.find(p => p.slug === activeSlug) || latestPost;

  if (!latestPost) {
    return (
      <>
        <Head>
          <title>AI 日报 - 卢穗杰的博客</title>
        </Head>
        <Navigation />
        <div className={styles.emptyState}>
          <p>暂无日报内容</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>AI 日报 - 卢穗杰的博客</title>
        <meta name="description" content="每日 AI 资讯速览，由 OpenClaw 自动聚合" />
      </Head>
      <Navigation />
      <div className={styles.dailyPage}>
        {/* 左侧：日期导航 */}
        <aside className={styles.sidebar}>
          {groups.map(group => (
            <div key={group.yearMonth} className={styles.monthGroup}>
              <button
                className={styles.monthToggle}
                onClick={() => toggleMonth(group.yearMonth)}
              >
                <span>{group.yearMonth.replace('-', '-')}</span>
                <span className={`${styles.arrow} ${expandedMonths.has(group.yearMonth) ? styles.arrowOpen : ''}`}>
                  ›
                </span>
              </button>
              {expandedMonths.has(group.yearMonth) && (
                <ul className={styles.dayList}>
                  {group.posts.map(post => (
                    <li key={post.slug}>
                      <button
                        className={`${styles.dayItem} ${activeSlug === post.slug ? styles.dayItemActive : ''}`}
                        onClick={() => setActiveSlug(post.slug)}
                      >
                        {/* 显示 MM-DD */}
                        {post.date.slice(5, 10).replace('-', '-')} AI资讯
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        {/* 右侧：日报内容预览 */}
        <main className={styles.content}>
          {currentPost && (
            <>
              {/* 摘要速览卡片 */}
              <div className={styles.summaryCard}>
                {currentPost.summary.split('，').filter(Boolean).map((item, i) => (
                  <p key={i} className={styles.summaryItem}>• {item.replace(/^[·•]\s*/, '')}</p>
                ))}
              </div>

              {/* 日期标题 + 跳转详情 */}
              <div className={styles.postHeader}>
                <h1 className={styles.postTitle}>{currentPost.date} AI 日报</h1>
                <Link href={`/daily/${currentPost.slug}`} className={styles.fullLink}>
                  查看完整日报 →
                </Link>
              </div>

              {/* 正文简要预览 */}
              <div className={styles.preview}>
                {currentPost.content
                  .split('\n')
                  .filter(line => line.trim() && !line.startsWith('---') && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('>'))
                  .map(line => line
                    .replace(/\*\*(.+?)\*\*/g, '$1')  // 去掉 **bold**
                    .replace(/\*(.+?)\*/g, '$1')       // 去掉 *italic*
                    .replace(/`(.+?)`/g, '$1')          // 去掉 `code`
                    .replace(/^[-•]\s*/, '')            // 去掉列表符号
                    .trim()
                  )
                  .filter(Boolean)
                  .slice(0, 5)
                  .join('\n')
                }
              </div>

              <Link href={`/daily/${currentPost.slug}`} className={styles.readMore}>
                阅读完整日报 →
              </Link>
            </>
          )}
        </main>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const groups = getDailyPostsByMonth();
  const allPosts = getAllDailyPosts();

  return {
    props: {
      groups,
      latestPost: allPosts[0] || null,
    },
  };
};
