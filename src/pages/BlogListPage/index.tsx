import { useState, useMemo } from 'react';
import { BlogPost, BlogCategory } from '@/types/blog';
import Navigation from '@/components/Navigation';
import BlogListHeader from './components/BlogListHeader';
import BlogGrid from './components/BlogGrid';
import Pagination from './components/Pagination';
import styles from './index.module.css';

interface BlogListPageProps {
  posts?: BlogPost[];
  categories?: BlogCategory[];
  currentPage?: number;
  totalPages?: number;
  totalPosts?: number;
}

export default function BlogListPage({
  posts = [],
  categories = [],
  currentPage = 1,
  totalPages = 1,
  totalPosts = 0,
}: BlogListPageProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredPosts = useMemo(() => {
    if (activeCategory === 'all') return posts;
    return posts.filter((post) => post.category === activeCategory);
  }, [posts, activeCategory]);

  return (
    <>
      <Navigation />
      <div className={styles.blogListPage}>
        <div className="container">
          <BlogListHeader
            totalPosts={filteredPosts.length}
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
          <BlogGrid posts={filteredPosts} />
          {totalPages > 1 && activeCategory === 'all' && (
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
