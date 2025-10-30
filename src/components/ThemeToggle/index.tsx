'use client';

import React, { useEffect, useState } from 'react';
import styles from './index.module.css';

const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const isDarkBefore = document.documentElement.classList.contains('dark');
    
    localStorage.setItem('theme', isDarkBefore ? 'light' : 'dark');

    const hasViewTransitions = 'startViewTransition' in document;

    if (!hasViewTransitions) {
      document.documentElement.classList.toggle('dark');
      return;
    }

    // 直接调用而不提取方法
    const transition = (document as typeof document & {
      startViewTransition: (callback: () => void) => { ready: Promise<void> };
    }).startViewTransition(() => {
      document.documentElement.classList.toggle('dark');
    });

    transition.ready.then(() => {
      const { clientX, clientY } = event;
      const endRadius = Math.hypot(
        Math.max(clientX, innerWidth - clientX),
        Math.max(clientY, innerHeight - clientY)
      );

      if (isDarkBefore) {
        // 从暗色到亮色：新的亮色内容展开
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${clientX}px ${clientY}px)`,
              `circle(${endRadius}px at ${clientX}px ${clientY}px)`,
            ],
          },
          {
            duration: 450,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      } else {
        // 从亮色到暗色
        document.documentElement.animate(
          {
            clipPath: [
              `circle(${endRadius}px at ${clientX}px ${clientY}px)`,
              `circle(0px at ${clientX}px ${clientY}px)`,
            ],
          },
          {
            duration: 450,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-old(root)',
          }
        );
        
        document.documentElement.animate(
          {
            opacity: [0, 1],
          },
          {
            duration: 450,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      }
    });
  };

  if (!mounted) {
    return <div className={styles.themeButton}></div>;
  }

  return (
    <button 
      className={styles.themeButton} 
      onClick={toggleTheme}
      aria-label="切换主题"
      title="切换主题"
    >
      🌓
    </button>
  );
};

export default ThemeToggle;