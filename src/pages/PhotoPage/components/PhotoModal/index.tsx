'use client';

import { useEffect } from 'react';
import { Photo } from '@/types/photo';
import { withBase } from '@/lib/site';
import styles from './index.module.css';

interface PhotoModalProps {
  photo?: Photo;
  totalPhotos?: number;
  currentIndex?: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function PhotoModal({
  photo,
  totalPhotos = 0,
  currentIndex = 1,
  onClose,
  onPrev,
  onNext,
}: PhotoModalProps) {
  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onPrev();
          break;
        case 'ArrowRight':
          onNext();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden'; // 禁止背景滚动

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, onPrev, onNext]);

  // 如果没有照片数据，显示错误状态
  if (!photo) {
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div className={styles.topBar}>
            <button className={styles.closeButton} onClick={onClose} aria-label="关闭">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <div className={styles.errorState}>
            <h3>照片加载失败</h3>
            <p>无法显示照片内容</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* 顶部信息栏 */}
        <div className={styles.topBar}>
          <div className={styles.photoCounter}>
            {currentIndex} / {totalPhotos}
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="关闭">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* 图片区域容器 */}
        <div className={styles.imageArea}>
          {/* 左箭头 - 在图片左边 */}
          <button 
            className={`${styles.navButton} ${styles.prevButton}`} 
            onClick={onPrev} 
            aria-label="上一张"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>

          {/* 图片容器 */}
          <div className={styles.imageContainer}>
            <img
              src={withBase(photo.src)}
              alt={photo.alt}
              className={styles.image}
              style={{ objectFit: 'contain' }}
            />
          </div>

          {/* 右箭头 - 在图片右边 */}
          <button 
            className={`${styles.navButton} ${styles.nextButton}`} 
            onClick={onNext} 
            aria-label="下一张"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
            </svg>
          </button>
        </div>

        {/* 底部信息 */}
        {(photo.title || photo.description) && (
          <div className={styles.bottomInfo}>
            {photo.title && <h3 className={styles.photoTitle}>{photo.title}</h3>}
            {photo.description && <p className={styles.photoDescription}>{photo.description}</p>}
            {photo.location && (
              <div className={styles.photoMeta}>
                📍 {photo.location}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}