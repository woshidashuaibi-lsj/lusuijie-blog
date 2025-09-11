'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BlogPost } from '@/types/blog';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import styles from './index.module.css';

interface BlogCardProps {
  post: BlogPost;
}

export default function BlogCard({ post }: BlogCardProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy年MM月dd日', { locale: zhCN });
    } catch {
      return dateString;
    }
  };

  return (
    <article className={styles.blogItem}>
      <Link href={`/blog/${post.slug}`} className={styles.itemLink}>
        <div className={styles.itemContent}>
          {/* 左侧封面图片 */}
          {post.cover && (
            <div className={styles.imageContainer}>
              <Image
                src={post.cover}
                alt={post.title}
                width={200}
                height={120}
                className={styles.image}
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            </div>
          )}
          
          {/* 右侧内容区域 */}
          <div className={styles.content}>
            {/* 元信息 */}
            <div className={styles.meta}>
              <span className={styles.category}>{post.category}</span>
              <span className={styles.separator}>·</span>
              <time className={styles.date}>{formatDate(post.date)}</time>
              <span className={styles.separator}>·</span>
              <span className={styles.readingTime}>{post.readingTime}分钟阅读</span>
            </div>
            
            {/* 标题 */}
            <h2 className={styles.title}>{post.title}</h2>
            
            {/* 描述 */}
            <p className={styles.description}>{post.description}</p>
            
            {/* 标签 */}
            {post.tags && post.tags.length > 0 && (
              <div className={styles.tags}>
                {post.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className={styles.tag}>
                    #{tag}
                  </span>
                ))}
                {post.tags.length > 4 && (
                  <span className={styles.moreTag}>+{post.tags.length - 4}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}