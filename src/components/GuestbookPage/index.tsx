import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Giscus from '@giscus/react';
import styles from './index.module.css';

export default function GuestbookPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // 监听主题变化
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
    <>
      <Navigation />
      <div className="container">
        <header className={styles.header}>
          <h1>留言板</h1>
          <p className={styles.subtitle}>
            欢迎留下你的足迹，分享任何你想说的话！
            <br />
            <small>💡 使用 GitHub 账号登录即可留言</small>
          </p>
        </header>

        <main className={styles.guestbookContainer}>
          <div className={styles.instructionsCard}>
            <h3>📝 如何留言？</h3>
            <ul>
              <li>✅ 点击下方 Sign in with GitHub 按钮</li>
              <li>✅ 使用你的 GitHub 账号登录</li>
              <li>✅ 在评论框中写下你的留言</li>
              <li>✅ 支持 Markdown 语法和 Emoji</li>
              <li>✅ 可以回复其他人的留言</li>
            </ul>
          </div>

          <div className={styles.giscusWrapper}>
            <Giscus
              id="guestbook"
              repo="woshidashuaibi-lsj/lusuijie-blog"
              repoId="R_kgDOPt-UIg"
              category="guestbookQA" // 为留言板创建专门的分类
              categoryId="DIC_kwDOPt-UIs4CwEQw" 
              mapping="specific"
              term="guestbook" // 固定的讨论主题
              strict="0"
              reactionsEnabled="1"
              emitMetadata="1"
              inputPosition="top"
              theme={theme}
              lang="zh-CN"
              loading="lazy"
            />
          </div>
        </main>
      </div>
    </>
  );
}