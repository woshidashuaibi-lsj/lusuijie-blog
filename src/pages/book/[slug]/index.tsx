import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import booksData from '@/data/books.json';
import type { Book } from '@/components/BookReader';

const BookReader = dynamic(() => import('@/components/BookReader'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
      加载中…
    </div>
  ),
});

const BookAccessGate = dynamic(() => import('@/components/BookAccessGate'), {
  ssr: false,
  loading: () => null,
});

const { books } = booksData;

interface Props {
  book: Book;
}

export default function BookReaderPage({ book }: Props) {
  return (
    <>
      <Head>
        <title>{book.title} - 卢穗杰的博客</title>
        <meta name="description" content={`阅读《${book.title}》by ${book.author}`} />
      </Head>
      <BookAccessGate>
        <BookReader book={book} />
      </BookAccessGate>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = () => ({
  paths: books.map((b) => ({ params: { slug: b.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = ({ params }) => {
  const slug = params?.slug as string;
  const book = books.find((b) => b.slug === slug);
  if (!book) return { notFound: true };
  return { props: { book } };
};
