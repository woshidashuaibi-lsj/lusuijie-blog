'use client';

import { useEffect, useRef } from 'react';
import { Photo } from '@/types/photo';
import PhotoCard from '../PhotoCard';
import styles from './index.module.css';

interface PhotoGridProps {
  photosByCategories: Record<string, Photo[]>;
  onPhotoClick: (photo: Photo) => void;
  onActiveCategoryChange: (category: string) => void;
}

export default function PhotoGrid({
  photosByCategories,
  onPhotoClick,
  onActiveCategoryChange,
}: PhotoGridProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const categoryRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    // 创建交叉观察器来监听当前可见的分类
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const categoryId = entry.target.getAttribute('data-category-id');
            if (categoryId) {
              onActiveCategoryChange(categoryId);
            }
          }
        });
      },
      {
        rootMargin: '-20% 0px -20% 0px',
        threshold: 0.1,
      }
    );

    // 观察所有分类标题
    categoryRefs.current.forEach((element) => {
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onActiveCategoryChange]);

  const setCategoryRef = (categoryId: string, element: HTMLElement | null) => {
    if (element) {
      categoryRefs.current.set(categoryId, element);
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    } else {
      const existingElement = categoryRefs.current.get(categoryId);
      if (existingElement && observerRef.current) {
        observerRef.current.unobserve(existingElement);
      }
      categoryRefs.current.delete(categoryId);
    }
  };

  if (Object.keys(photosByCategories).length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📸</div>
        <h3>暂无照片</h3>
        <p>还没有上传任何照片</p>
      </div>
    );
  }

  return (
    <div className={styles.photoGrid}>
      {Object.entries(photosByCategories).map(([category, photos]) => (
        <section key={category} className={styles.categorySection}>
          <h2
            id={`category-${category}`}
            ref={(el) => setCategoryRef(category, el)}
            data-category-id={category}
            className={styles.categoryTitle}
          >
            {category}
          </h2>
          <div className={styles.photosGrid}>
            {photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onClick={() => onPhotoClick(photo)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}