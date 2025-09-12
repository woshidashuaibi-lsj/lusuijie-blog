'use client';

import { useState, useEffect } from 'react';
import { PhotoCategory } from '@/types/photo';
import styles from './index.module.css';

interface CategorySidebarProps {
  categories?: PhotoCategory[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function CategorySidebar({
  categories = [],
  activeCategory,
  onCategoryChange,
}: CategorySidebarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 延迟显示动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    // 调用父组件的回调函数
    onCategoryChange(categoryId);

    // 滚动到对应的分类
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    }
  };

  // 如果没有分类数据，返回空组件
  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <div 
      className={`${styles.sidebar} ${isHovered ? styles.hovered : ''} ${isVisible ? styles.visible : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={styles.sidebarContent}>
        <nav className={styles.categoryNav}>
          <ul className={styles.categoryList}>
            {categories.map((category) => (
              <li key={category.id} className={styles.categoryItem}>
                <button
                  onClick={() => handleCategoryClick(category.id)}
                  className={`${styles.categoryButton} ${
                    activeCategory === category.id ? styles.active : ''
                  }`}
                >
                  <span className={styles.categoryName}>{category.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}