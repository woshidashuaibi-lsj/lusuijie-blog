import { BlogPost as BlogPostType } from '@/types/blog';
import Navigation from '@/components/Navigation';
import BlogHeader from './components/BlogHeader';
import BlogContent from './components/BlogContent';
import TableOfContents from './components/TableOfContents';
import styles from './index.module.css';

interface BlogPostPageProps {
  post?: BlogPostType;
  htmlContent?: string;
}

export default function BlogPostPage({ post, htmlContent = '' }: BlogPostPageProps) {
  // 如果没有文章数据，显示加载状态或错误页面
  if (!post) {
    return (
      <>
        <Navigation />
        <div className={styles.blogPostPage}>
          <div className="container">
            <div className={styles.errorState}>
              <h1>文章未找到</h1>
              <p>抱歉，无法找到您要查看的文章。</p>
            </div>
          </div>
        </div>
      </>
    );
  }

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