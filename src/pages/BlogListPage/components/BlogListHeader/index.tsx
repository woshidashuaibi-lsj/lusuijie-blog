import { BlogCategory } from '@/types/blog';
import styles from './index.module.css';

interface BlogListHeaderProps {
  totalPosts: number;
  categories?: BlogCategory[];
  activeCategory?: string;
  onCategoryChange?: (category: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  daily: 'Daily',
  life: 'Life',
  tech: 'Tech',
  photos: 'Photos',
};

export default function BlogListHeader({
  totalPosts,
  categories = [],
  activeCategory = 'all',
  onCategoryChange,
}: BlogListHeaderProps) {
  const tabs = [
    { slug: 'all', name: '全部', count: null },
    ...categories.map((cat) => ({
      slug: cat.slug,
      name: CATEGORY_LABELS[cat.slug] ?? cat.name,
      count: cat.count,
    })),
  ];

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>文章列表</h1>
      <p className={styles.subtitle}>
        共 <span className={styles.count}>{totalPosts}</span> 篇文章
      </p>

      {tabs.length > 1 && (
        <nav className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.slug}
              className={`${styles.tab} ${activeCategory === tab.slug ? styles.tabActive : ''}`}
              onClick={() => onCategoryChange?.(tab.slug)}
            >
              {tab.name}
              {tab.count !== null && (
                <span className={styles.tabCount}>{tab.count}</span>
              )}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
