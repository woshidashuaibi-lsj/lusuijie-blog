import styles from './index.module.css';

interface BlogListHeaderProps {
  totalPosts: number;
}

export default function BlogListHeader({ totalPosts }: BlogListHeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>文章列表</h1>
      <p className={styles.subtitle}>
        共 <span className={styles.count}>{totalPosts}</span> 篇文章
      </p>
    </header>
  );
}