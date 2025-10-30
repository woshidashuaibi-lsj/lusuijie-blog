import Head from 'next/head';
import Navigation from '@/components/Navigation';
import styles from './index.module.css';

const books = [
  {
    title: '小王子',
    author: '圣埃克苏佩里',
    link: 'https://baike.baidu.com/item/%E5%B0%8F%E7%8E%8B%E5%AD%90/10395636',
    cover: 'https://bkimg.cdn.bcebos.com/pic/2e2eb9389b504fc2d562b7a4e2dde71190ef6dce?x-bce-process=image/resize,m_lfit,w_220,h_300', // 百度百科图片
    rating: 9.2,
    myComment: '童话般的哲理故事，适合任何年龄段。每次重读都有新感悟。',
  },
  {
    title: '人类简史',
    author: '尤瓦尔·赫拉利',
    link: 'https://baike.baidu.com/item/%E4%BA%BA%E7%B1%BB%E7%AE%80%E5%8F%B2/16391835',
    cover: 'https://bkimg.cdn.bcebos.com/pic/43a7d933c895d14348d1f4d17bf082025baf07f4?x-bce-process=image/resize,m_lfit,w_220,h_300', // 百度百科图片
    rating: 9.0,
    myComment: '用平实的语言讲述人类发展，开阔视野，值得反复思考。',
  },
  {
    title: '活着',
    author: '余华',
    link: 'https://baike.baidu.com/item/%E6%B4%BB%E7%9D%80/16860',
    cover: 'https://bkimg.cdn.bcebos.com/pic/6609c93d70cf3bc7c57c1b0bdb00baa1cd112a2c?x-bce-process=image/resize,m_lfit,w_220,h_300', // 百度百科图片
    rating: 9.5,
    myComment: '感人至深的人性故事，平淡却震撼。',
  },
  // 可以继续补充
];

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
        </header>
        <main className={styles.booklistMain}>
          <div className={styles.bookGrid}>
            {books.map((book) => (
              <div key={book.title} className={styles.bookCard}>
                <a href={book.link} target="_blank" rel="noopener noreferrer">
                  <img src={book.cover} alt={book.title} className={styles.bookCover} />
                </a>
                <div className={styles.bookInfo}>
                  <h3 className={styles.bookTitle}>
                    <a href={book.link} target="_blank" rel="noopener noreferrer">
                      {book.title}
                    </a>
                  </h3>
                  <p className={styles.bookAuthor}>作者：{book.author}</p>
                  <p className={styles.bookRating}>
                    评分：<span className={styles.ratingNum}>{book.rating}</span>
                  </p>
                  <div className={styles.myComment}>
                    {book.myComment}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}