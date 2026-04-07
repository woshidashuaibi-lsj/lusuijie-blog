import { GetStaticProps } from 'next';
import { getAllPosts, getAllCategories } from '@/lib/blog';
import type { BlogPost, BlogCategory } from '@/types/blog';
import BlogListPage from '@/pages/BlogListPage';
import Head from 'next/head';

interface BlogPageProps {
  posts: BlogPost[];
  categories: BlogCategory[];
  currentPage: number;
  totalPages: number;
  totalPosts: number;
}

export default function BlogRoute({ posts, categories, currentPage, totalPages, totalPosts }: BlogPageProps) {
  return (
    <>
      <Head>
        <title>文章列表 | 阿杰的博客</title>
        <meta name="description" content="浏览所有博客文章" />
      </Head>
      <BlogListPage
        posts={posts}
        categories={categories}
        currentPage={currentPage}
        totalPages={totalPages}
        totalPosts={totalPosts}
      />
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const allPosts = getAllPosts();
  const categories = getAllCategories();

  return {
    props: {
      posts: allPosts,
      categories,
      currentPage: 1,
      totalPages: 1,
      totalPosts: allPosts.length,
    },
  };
};
