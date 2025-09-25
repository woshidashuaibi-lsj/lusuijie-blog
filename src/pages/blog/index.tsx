import { GetStaticProps } from 'next';
import { getAllPosts } from '@/lib/blog';
import type { BlogPost } from '@/types/blog';
import BlogListPage from '@/pages/BlogListPage';
import Head from 'next/head';

interface BlogPageProps {
  posts: BlogPost[];
  currentPage: number;
  totalPages: number;
  totalPosts: number;
}

export default function BlogRoute({ posts, currentPage, totalPages, totalPosts }: BlogPageProps) {
  return (
    <>
      <Head>
        <title>文章列表 | 我的博客</title>
        <meta name="description" content="浏览所有博客文章" />
      </Head>
      <BlogListPage
        posts={posts}
        currentPage={currentPage}
        totalPages={totalPages}
        totalPosts={totalPosts}
      />
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const allPosts = getAllPosts();

  return {
    props: {
      posts: allPosts,
      currentPage: 1,
      totalPages: 1,
      totalPosts: allPosts.length,
    },
  };
};
