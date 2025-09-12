import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import BlogList from '@/components/BlogList';
import type { BlogPost } from '@/types/blog';

interface HomePageProps {
  featuredPosts?: BlogPost[];
}

export default function HomePage({ featuredPosts = [] }: HomePageProps) {
  return (
    <>
      <Navigation />
      <HeroSection />
      <BlogList posts={featuredPosts} />
    </>
  );
}