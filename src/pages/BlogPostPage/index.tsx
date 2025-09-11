import { BlogPost as BlogPostType } from '@/types/blog';
import Navigation from '@/components/Navigation';
import BlogHeader from './components/BlogHeader';
import BlogContent from './components/BlogContent';
import TableOfContents from './components/TableOfContents';
import styles from './index.module.css';

interface BlogPostPageProps {
  post: BlogPostType;
  htmlContent: string;
}

export default function BlogPostPage({ post, htmlContent }: BlogPostPageProps) {
  return (
    <>
      <Navigation />
      <div className={styles.blogPostPage}>
        {/* 浮动的目录导航 */}
        <aside className={styles.floatingToc}>
          <TableOfContents htmlContent={htmlContent} />
        </aside>
        
        <div className="container">
          <article className={styles.articleWrapper}>
            <BlogHeader post={post} />
            <main className={styles.mainContent}>
              <BlogContent htmlContent={htmlContent} />
            </main>
          </article>
        </div>
      </div>
    </>
  );
}