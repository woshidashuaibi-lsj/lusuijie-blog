import { GetServerSideProps } from 'next';
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

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const page = parseInt((query.page as string) || '1', 10);
  const postsPerPage = 10;

  const allPosts = getAllPosts();
  const totalPosts = allPosts.length;
  const totalPages = Math.ceil(totalPosts / postsPerPage);

  const startIndex = (page - 1) * postsPerPage;
  const endIndex = startIndex + postsPerPage;
  const currentPosts = allPosts.slice(startIndex, endIndex);

  return {
    props: {
      posts: currentPosts,
      currentPage: page,
      totalPages,
      totalPosts,
    },
  };
};
