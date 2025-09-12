'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './index.module.css';

interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
}

export default function Pagination({
  currentPage = 1,
  totalPages = 1
}: PaginationProps) {
  const searchParams = useSearchParams();
  
  const createPageUrl = (page: number) => {
    if (!searchParams) return '/blog';

    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', page.toString());
    }
    const paramString = params.toString();
    return `/blog${paramString ? `?${paramString}` : ''}`;
  };

  const getVisiblePages = () => {
    const delta = 2; // 当前页前后显示的页数
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  const visiblePages = getVisiblePages();

  return (
    <nav className={styles.pagination} aria-label="文章分页导航">
      <div className={styles.paginationContainer}>
        {/* 上一页 */}
        {currentPage > 1 && (
          <Link
            href={createPageUrl(currentPage - 1)}
            className={styles.pageLink}
            aria-label="上一页"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
            上一页
          </Link>
        )}

        {/* 页码 */}
        <div className={styles.pageNumbers}>
          {visiblePages.map((page, index) => (
            <span key={index}>
              {page === '...' ? (
                <span className={styles.dots}>...</span>
              ) : (
                <Link
                  href={createPageUrl(page as number)}
                  className={`${styles.pageNumber} ${
                    currentPage === page ? styles.active : ''
                  }`}
                >
                  {page}
                </Link>
              )}
            </span>
          ))}
        </div>

        {/* 下一页 */}
        {currentPage < totalPages && (
          <Link
            href={createPageUrl(currentPage + 1)}
            className={styles.pageLink}
            aria-label="下一页"
          >
            下一页
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
            </svg>
          </Link>
        )}
      </div>
      
      {/* 页面信息 */}
      <div className={styles.pageInfo}>
        第 {currentPage} 页，共 {totalPages} 页
      </div>
    </nav>
  );
}