import { GetStaticProps } from 'next';
import { getAllPosts } from '@/lib/blog';
import type { BlogPost } from '@/types/blog';
import HomePage from './HomePage';

interface HomePageProps {
  featuredPosts: BlogPost[];
}

export default function Home({ featuredPosts }: HomePageProps) {
  return <HomePage featuredPosts={featuredPosts} />;
}

export const getStaticProps: GetStaticProps = async () => {
  const allPosts = getAllPosts();
  const featuredPosts = allPosts.slice(0, 3); // 显示最新的3篇文章

  return {
    props: {
      featuredPosts,
    },
  };
};
