import { GetStaticProps } from 'next';
import { getPhotosByCategories, getAllCategories, getAllPhotos } from '@/lib/photos';
import type { Photo, PhotoCategory } from '@/types/photo';
import InstantPage from '@/pages/PhotoPage';
import Head from 'next/head';

interface PhotoPageProps {
  photosByCategories: Record<string, Photo[]>;
  categories: PhotoCategory[];
  allPhotos: Photo[];
}

export default function PhotoRoute({ photosByCategories, categories, allPhotos }: PhotoPageProps) {
  return (
    <>
      <Head>
        <title>照片墙 | 卢穗杰的博客</title>
        <meta name="description" content="卢穗杰的照片墙，记录生活中的美好瞬间与旅行风景。" />
        <link rel="canonical" href="https://lusuijie.com.cn/photo/" />
        <meta property="og:title" content="照片墙 | 卢穗杰的博客" />
        <meta property="og:description" content="记录生活中的美好瞬间与旅行风景。" />
        <meta property="og:url" content="https://lusuijie.com.cn/photo/" />
        <meta property="og:type" content="website" />
      </Head>
      <InstantPage
        photosByCategories={photosByCategories}
        categories={categories}
        allPhotos={allPhotos}
      />
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const photosByCategories = getPhotosByCategories();
  const categories = getAllCategories();
  const allPhotos = getAllPhotos();

  return {
    props: {
      photosByCategories,
      categories,
      allPhotos,
    },
  };
};
