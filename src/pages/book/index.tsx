import Head from 'next/head';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import booksData from '@/data/books.json';
import styles from './index.module.css';
import { useState } from 'react';

const { books } = booksData;

// 默认书籍封面
const DEFAULT_COVER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMjAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iMjIwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjExMCIgeT0iMTUwIiBmb250LWZhbWlseT0ic2Fuc3NhbnMiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIxLjIiPumqj+S4jzwvdGV4dD48L3N2Zz4=';

function BookCard({ book }: { book: typeof books[number] }) {
  const [imgError, setImgError] = useState(false);
  const coverSrc = imgError ? DEFAULT_COVER : book.cover;

  return (
    <Link href={`/book/${book.slug}`} className={styles.bookCard}>
      <img 
        src={coverSrc} 
        alt={book.title} 
        className={styles.bookCover}
        onError={() => setImgError(true)}
      />
      <div className={styles.bookInfo}>
        <h3 className={styles.bookTitle}>{book.title}</h3>
        <p className={styles.bookAuthor}>{book.author}</p>
        <p className={styles.bookRating}>
          <span className={styles.ratingStars}>{'★'.repeat(Math.round(book.rating))}</span>
          <span className={styles.ratingNum}>{book.rating}</span>
        </p>
        <div className={styles.myComment}>{book.myComment}</div>
        <div className={styles.readHint}>
          <span>点击阅读 →</span>
          <span className={styles.chapterCount}>{book.chapters.length} 章</span>
        </div>
      </div>
    </Link>
  );
}

export default function BookListPage() {
  return (
    <>
      <Head>
        <title>书单 - 卢穗杰的博客</title>
        <meta name="description" content="我的读书书单，推荐好书与阅读心得。" />
      </Head>
      <Navigation />
      <div className={styles.booklistContainer}>
        <header className={styles.header}>
          <h1>我的书单 <span className={styles.bookEmoji}>📚</span></h1>
          <p className={styles.subtitle}>点击书籍开始阅读</p>
        </header>
        <main className={styles.booklistMain}>
          <div className={styles.bookGrid}>
            {books.map((book) => (
              <BookCard key={book.slug} book={book} />
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
