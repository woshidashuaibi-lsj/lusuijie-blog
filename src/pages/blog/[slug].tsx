import { GetStaticProps, GetStaticPaths } from 'next';
import { getAllPosts, getPostBySlug, markdownToHtml } from '@/lib/blog';
import type { BlogPost } from '@/types/blog';
import BlogPostPage from '@/pages/BlogPostPage';
import Head from 'next/head';

interface BlogPostProps {
  post: BlogPost;
  htmlContent: string;
}

export default function BlogPost({ post, htmlContent }: BlogPostProps) {
  if (!post) {
    return <div>文章未找到</div>;
  }

  return (
    <>
      <Head>
        <title>{post.title} | 卢穗杰的博客</title>
        <meta name="description" content={post.description || `阅读《${post.title}》- 卢穗杰的博客`} />
        <link rel="canonical" href={`https://lusuijie.com.cn/blog/${post.slug}/`} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description || `阅读《${post.title}》- 卢穗杰的博客`} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://lusuijie.com.cn/blog/${post.slug}/`} />
        <meta property="og:image" content={post.cover || 'https://lusuijie.com.cn/favicon.jpg'} />
        <meta property="article:published_time" content={post.date} />
        <meta property="article:author" content="卢穗杰" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              author: {
                '@type': 'Person',
                name: '卢穗杰',
                url: 'https://lusuijie.com.cn',
              },
              url: `https://lusuijie.com.cn/blog/${post.slug}/`,
              image: post.cover || 'https://lusuijie.com.cn/favicon.jpg',
            }),
          }}
        />
      </Head>
      <BlogPostPage post={post} htmlContent={htmlContent} />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getAllPosts();
  const paths = posts.map((post) => ({
    params: { slug: post.slug },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.slug as string;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      notFound: true,
    };
  }

  const htmlContent = await markdownToHtml(post.content);

  return {
    props: {
      post,
      htmlContent,
    },
  };
};
