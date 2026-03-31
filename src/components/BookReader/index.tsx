'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import ReaderSettings, { ReaderSettings as ReaderSettingsType, loadSettings } from '@/components/ReaderSettings';
import styles from './index.module.css';

export interface Book {
  slug: string;
  title: string;
  author: string;
  cover: string;
  rating: number;
  myComment: string;
  chapters: { id: number; title: string; content: string }[];
}

interface BookReaderProps {
  book: Book;
}

function loadProgress(slug: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`book-progress-${slug}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

function saveProgress(slug: string, chapterId: number) {
  try {
    localStorage.setItem(`book-progress-${slug}`, String(chapterId));
  } catch {}
}

const BG_THEMES: Record<ReaderSettingsType['background'], { bg: string; color: string; chapterBg: string }> = {
  light: { bg: '#ffffff', color: '#333333', chapterBg: '#f7f8fa' },
  sepia: { bg: '#f4ecd8', color: '#5b4636', chapterBg: '#ede0c8' },
  dark: { bg: '#2c2c2c', color: '#c8c8c8', chapterBg: '#383838' },
  black: { bg: '#000000', color: '#888888', chapterBg: '#111111' },
};

export default function BookReader({ book }: BookReaderProps) {
  const [currentChapterIdx, setCurrentChapterIdx] = useState(() => {
    const saved = loadProgress(book.slug);
    const idx = book.chapters.findIndex((c) => c.id === saved);
    return idx >= 0 ? idx : 0;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ReaderSettingsType>(loadSettings);
  const contentRef = useRef<HTMLDivElement>(null);

  const chapter = book.chapters[currentChapterIdx];

  const goToChapter = useCallback((idx: number) => {
    if (idx < 0 || idx >= book.chapters.length) return;
    setCurrentChapterIdx(idx);
    saveProgress(book.slug, book.chapters[idx].id);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [book]);

  useEffect(() => {
    const saved = loadProgress(book.slug);
    const idx = book.chapters.findIndex((c) => c.id === saved);
    if (idx >= 0) setCurrentChapterIdx(idx);
  }, [book]);

  const theme = BG_THEMES[settings.background];

  return (
    <div className={styles.reader} style={{ background: theme.bg, color: theme.color }}>
      {/* Top bar */}
      <div className={styles.topBar} style={{ borderBottomColor: theme.chapterBg }}>
        <Link href="/book" className={styles.backBtn} style={{ color: settings.background === 'light' ? '#6366f1' : theme.color }}>
          ← 书单
        </Link>
        <div className={styles.bookMeta}>
          <span className={styles.bookTitle}>{book.title}</span>
          <span className={styles.chapterTitle}>{chapter.title}</span>
        </div>
        <button className={styles.settingsBtn} onClick={() => setShowSettings(true)} style={{ color: settings.background === 'light' ? '#6366f1' : theme.color }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.09 7.09 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41H10.02a.484.484 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L1.05 9.91a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94 0 .31.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.86c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>
          </svg>
        </button>
      </div>

      {/* Chapter nav */}
      <div className={styles.chapterNav} style={{ background: theme.chapterBg }}>
        <button
          className={styles.navBtn}
          onClick={() => goToChapter(currentChapterIdx - 1)}
          disabled={currentChapterIdx === 0}
          style={{ opacity: currentChapterIdx === 0 ? 0.3 : 1 }}
        >
          ← 上一章
        </button>

        <div className={styles.chapterDots}>
          {book.chapters.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === currentChapterIdx ? styles.dotActive : ''}`}
              onClick={() => goToChapter(i)}
              aria-label={`第 ${i + 1} 章`}
            />
          ))}
        </div>

        <button
          className={styles.navBtn}
          onClick={() => goToChapter(currentChapterIdx + 1)}
          disabled={currentChapterIdx === book.chapters.length - 1}
          style={{ opacity: currentChapterIdx === book.chapters.length - 1 ? 0.3 : 1 }}
        >
          下一章 →
        </button>
      </div>

      {/* Content */}
      <div
        className={styles.content}
        ref={contentRef}
        style={{ fontSize: settings.fontSize + 'px', lineHeight: 1.8 }}
      >
        <h1 className={styles.chapterHeading}>{chapter.title}</h1>
        <div className={styles.chapterContent}>
          {chapter.content.split('\n\n').map((para, i) => (
            <p key={i} style={{ marginBottom: '1.2em' }}>{para}</p>
          ))}
        </div>

        {/* Chapter footer nav */}
        <div className={styles.footerNav}>
          {currentChapterIdx > 0 && (
            <button className={styles.footerNavBtn} onClick={() => goToChapter(currentChapterIdx - 1)}>
              ← {book.chapters[currentChapterIdx - 1].title}
            </button>
          )}
          {currentChapterIdx < book.chapters.length - 1 && (
            <button className={styles.footerNavBtn} onClick={() => goToChapter(currentChapterIdx + 1)}>
              {book.chapters[currentChapterIdx + 1].title} →
            </button>
          )}
        </div>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${((currentChapterIdx + 1) / book.chapters.length) * 100}%` }}
          />
          <span className={styles.progressText}>
            {currentChapterIdx + 1} / {book.chapters.length}
          </span>
        </div>
      </div>

      {showSettings && (
        <ReaderSettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
