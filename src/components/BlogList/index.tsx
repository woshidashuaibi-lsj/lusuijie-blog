import { BlogPost } from '@/types/blog';
import BlogItem from '@/components/BlogItem';
import styles from './index.module.css';

interface BlogListProps {
  posts: BlogPost[];
  title?: string;
}

export default function BlogList({ posts, title = "推荐阅读" }: BlogListProps) {
  return (
    <section className={styles.blogListSection}>
      <div className="container">
        <h2 className={styles.sectionTitle}>{title}</h2>
        <div className={styles.blogList}>
          {posts.map((post, index) => (
            <BlogItem 
              key={post.slug} 
              post={post} 
              showDivider={index < posts.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}