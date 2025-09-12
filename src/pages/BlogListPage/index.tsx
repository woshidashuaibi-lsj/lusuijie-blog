import { BlogPost } from '@/types/blog';
import Navigation from '@/components/Navigation';
import BlogListHeader from './components/BlogListHeader';
import BlogGrid from './components/BlogGrid';
import Pagination from './components/Pagination';
import styles from './index.module.css';

interface BlogListPageProps {
  posts?: BlogPost[];
  currentPage?: number;
  totalPages?: number;
  totalPosts?: number;
}

export default function BlogListPage({
  posts = [],
  currentPage = 1,
  totalPages = 1,
  totalPosts = 0,
}: BlogListPageProps) {
  return (
    <>
      <Navigation />
      <div className={styles.blogListPage}>
        <div className="container">
          <BlogListHeader totalPosts={totalPosts} />
          <BlogGrid posts={posts} />
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
            />
          )}
        </div>
      </div>
    </>
  );
}