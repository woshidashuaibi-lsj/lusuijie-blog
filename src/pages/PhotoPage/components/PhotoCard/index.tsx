'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Photo } from '@/types/photo';
import styles from './index.module.css';

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
}

export default function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setIsError(true);
  };

  if (isError) {
    return (
      <div className={styles.photoCard}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <p>图片加载失败</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.photoCard} onClick={onClick}>
      <div className={styles.imageContainer}>
        {/* 毛玻璃加载占位符 */}
        <div className={`${styles.placeholder} ${isLoaded ? styles.loaded : ''}`}>
          <div className={styles.shimmer}></div>
        </div>
        
        {/* 实际图片 */}
        <Image
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          className={`${styles.image} ${isLoaded ? styles.visible : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
        
        {/* 简单的悬停效果覆盖层 - 不显示图标 */}
        <div className={styles.hoverOverlay}></div>
      </div>
    </div>
  );
}