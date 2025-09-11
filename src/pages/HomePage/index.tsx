import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import BlogList from '@/components/BlogList';
import { getAllPosts } from '@/lib/blog';

export default function HomePage() {
  const allPosts = getAllPosts();
  const featuredPosts = allPosts.slice(0, 3); // 显示最新的3篇文章

  return (
    <>
      <Navigation />
      <HeroSection />
      <BlogList posts={featuredPosts} />
    </>
  );
}