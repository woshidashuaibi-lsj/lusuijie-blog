import { getAllPosts } from '@/lib/blog';
import BlogListPage from '@/pages/BlogListPage';
import { Metadata } from 'next';

interface PageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export const metadata: Metadata = {
  title: '文章列表 | 我的博客',
  description: '浏览所有博客文章',
};

export default async function BlogRoute({ searchParams }: PageProps) {
  const { page } = await searchParams;
  const currentPage = parseInt(page || '1', 10);
  const postsPerPage = 10;

  const allPosts = getAllPosts();
  const totalPosts = allPosts.length;
  const totalPages = Math.ceil(totalPosts / postsPerPage);
  
  const startIndex = (currentPage - 1) * postsPerPage;
  const endIndex = startIndex + postsPerPage;
  const currentPosts = allPosts.slice(startIndex, endIndex);

  return (
    <BlogListPage
      posts={currentPosts}
      currentPage={currentPage}
      totalPages={totalPages}
      totalPosts={totalPosts}
    />
  );
}