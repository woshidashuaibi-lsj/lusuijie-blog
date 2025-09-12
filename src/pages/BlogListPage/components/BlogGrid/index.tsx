import { BlogPost } from '@/types/blog';
import BlogCard from '../BlogCard';
import styles from './index.module.css';

interface BlogGridProps {
  posts?: BlogPost[];
}

export default function BlogGrid({ posts = [] }: BlogGridProps) {
  if (!posts || posts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>暂无文章</h3>
        <p>还没有发布任何文章</p>
      </div>
    );
  }

  return (
    <div className={styles.blogGrid}>
      {posts.map((post) => (
        <BlogCard key={post.slug} post={post} />
      ))}
    </div>
  );
}