'use client';

import { useState } from 'react';
import { Photo, PhotoCategory } from '@/types/photo';
import Navigation from '@/components/Navigation';
import CategorySidebar from './components/CategorySidebar';
import PhotoGrid from './components/PhotoGrid';
import PhotoModal from './components/PhotoModal';
import styles from './index.module.css';

interface InstantPageProps {
  photosByCategories?: Record<string, Photo[]>;
  categories?: PhotoCategory[];
  allPhotos?: Photo[];
}

export default function InstantPage({
  photosByCategories = {},
  categories = [],
  allPhotos = [],
}: InstantPageProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('');

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };

  const handlePrevPhoto = () => {
    if (!selectedPhoto || !allPhotos || allPhotos.length === 0) return;
    const currentIndex = allPhotos.findIndex(p => p.id === selectedPhoto.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : allPhotos.length - 1;
    setSelectedPhoto(allPhotos[prevIndex]);
  };

  const handleNextPhoto = () => {
    if (!selectedPhoto || !allPhotos || allPhotos.length === 0) return;
    const currentIndex = allPhotos.findIndex(p => p.id === selectedPhoto.id);
    const nextIndex = currentIndex < allPhotos.length - 1 ? currentIndex + 1 : 0;
    setSelectedPhoto(allPhotos[nextIndex]);
  };

  return (
    <>
      <Navigation />
      <div className={styles.instantPage}>
        <div className={styles.pageContainer}>
          {/* 左侧分类导航 */}
          <aside className={styles.sidebar}>
            <CategorySidebar
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </aside>
          
          {/* 右侧照片网格 */}
          <main className={styles.mainContent}>
            <PhotoGrid 
              photosByCategories={photosByCategories}
              onPhotoClick={handlePhotoClick}
              onActiveCategoryChange={setActiveCategory}
            />
          </main>
        </div>
      </div>

      {/* 照片预览模态框 */}
      {selectedPhoto && allPhotos && allPhotos.length > 0 && (
        <PhotoModal
          photo={selectedPhoto}
          totalPhotos={allPhotos.length}
          currentIndex={allPhotos.findIndex(p => p.id === selectedPhoto.id) + 1}
          onClose={handleCloseModal}
          onPrev={handlePrevPhoto}
          onNext={handleNextPhoto}
        />
      )}
    </>
  );
}