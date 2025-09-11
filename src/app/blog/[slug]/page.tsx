import { getAllPosts, getPostBySlug, markdownToHtml } from '@/lib/blog';
import { notFound } from 'next/navigation';
import BlogPostPage from '@/pages/BlogPostPage';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// 生成静态参数
export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// 生成页面元数据
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params; // 添加 await
  const post = getPostBySlug(slug);
  
  if (!post) {
    return {
      title: '文章未找到',
    };
  }

  return {
    title: `${post.title} | 我的博客`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      images: post.cover ? [post.cover] : [],
    },
  };
}

// 页面组件
export default async function Page({ params }: PageProps) {
  const { slug } = await params; // 添加 await
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const htmlContent = await markdownToHtml(post.content);

  return <BlogPostPage post={post} htmlContent={htmlContent} />;
}