import Giscus from '@giscus/react';
import { BlogPost } from '@/types/blog';
import styles from './index.module.css';
import { useEffect, useState } from 'react';

interface CommentsProps {
  post: BlogPost;
}

export default function Comments({ post }: CommentsProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  // 监听主题变化（如果你有主题切换功能）
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mediaQuery.matches ? 'dark' : 'light');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  return (
    <div className={styles.commentsSection}>
      <h3 className={styles.commentsTitle}>评论区</h3>
      <div className={styles.giscusWrapper}>
        <Giscus
          id="comments"
          repo="woshidashuaibi-lsj/lusuijie-blog" // 替换为你的仓库
          repoId="R_kgDOPt-UIg" // 从 giscus.app 获取
          category="General" // 或者你创建的其他分类
          categoryId="DIC_kwDOPt-UIs4CwECz" // 从 giscus.app 获取
          mapping="pathname" // 使用路径作为讨论映射
          strict="0"
          reactionsEnabled="1"
          emitMetadata="1"
          inputPosition="top"
          theme={theme} // 可以设置为 "light", "dark", "preferred_color_scheme" 等
          lang="zh-CN"
          loading="lazy"
        />
      </div>
    </div>
  );
}