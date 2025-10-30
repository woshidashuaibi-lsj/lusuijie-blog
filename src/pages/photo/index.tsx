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
        <title>照片墙 | 我的博客</title>
        <meta name="description" content="记录生活中的美好瞬间" />
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
