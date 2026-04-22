import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import booksData from '@/data/books.json';
import BookReader from '@/components/BookReader';
import BookAccessGate from '@/components/BookAccessGate';
import type { Book } from '@/components/BookReader';

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
