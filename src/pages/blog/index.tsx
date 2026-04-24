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
        <title>文章列表 | 卢穗杰的博客</title>
        <meta name="description" content="卢穗杰的博客文章，涵盖前端技术、AI、阅读笔记与生活随想。" />
        <link rel="canonical" href="https://lusuijie.com.cn/blog/" />
        <meta property="og:title" content="文章列表 | 卢穗杰的博客" />
        <meta property="og:description" content="卢穗杰的博客文章，涵盖前端技术、AI、阅读笔记与生活随想。" />
        <meta property="og:url" content="https://lusuijie.com.cn/blog/" />
        <meta property="og:type" content="website" />
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
