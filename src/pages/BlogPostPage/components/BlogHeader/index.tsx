import { BlogPost } from '@/types/blog';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Image from 'next/image';
import styles from './index.module.css';

interface BlogHeaderProps {
  post: BlogPost;
}

export default function BlogHeader({ post }: BlogHeaderProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy年MM月dd日', { locale: zhCN });
    } catch {
      return dateString;
    }
  };

  return (
    <header className={styles.blogHeader}>
      {/* {post.cover && (
        <div className={styles.coverImage}>
          <Image
            src={post.cover}
            alt={post.title}
            width={1200}
            height={400}
            priority
            className={styles.coverImg}
          />
        </div>
      )} */}
      
      <div className={styles.headerContent}>
        <div className={styles.meta}>
          <span className={styles.category}>{post.category}</span>
          <span className={styles.separator}>·</span>
          <time className={styles.date}>{formatDate(post.date)}</time>
          <span className={styles.separator}>·</span>
          <span className={styles.readingTime}>{post.readingTime} 分钟阅读</span>
        </div>
        
        <h1 className={styles.title}>{post.title}</h1>
        
        {post.description && (
          <p className={styles.description}>{post.description}</p>
        )}
        
        {post.tags && post.tags.length > 0 && (
          <div className={styles.tags}>
            {post.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}