import Link from 'next/link';
import { BlogPost } from '@/types/blog';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import styles from './index.module.css';

interface BlogItemProps {
  post: BlogPost;
  showDivider?: boolean;
}

export default function BlogItem({ post, showDivider = false }: BlogItemProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd', { locale: zhCN });
    } catch {
      return dateString;
    }
  };

  return (
    <article className={styles.blogItem}>
      <Link href={`/blog/${post.slug}`} className={styles.blogLink}>
        <h3 className={styles.blogTitle}>{post.title}</h3>
        <div className={styles.blogMeta}>
          <span className={styles.blogDate}>{formatDate(post.date)}</span>
          <span className={styles.separator}>·</span>
          <span className={styles.readingTime}>{post.readingTime}分钟</span>
          <span className={styles.separator}>·</span>
          <span className={styles.wordCount}>{post.content.length}字</span>
        </div>
        <p className={styles.blogExcerpt}>{post.description}</p>
      </Link>
      {showDivider && <div className={styles.blogDivider}></div>}
    </article>
  );
}