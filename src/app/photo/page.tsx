import { getPhotosByCategories, getAllCategories, getAllPhotos } from '@/lib/photos';
import InstantPage from '@/pages/PhotoPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '照片墙 | 我的博客',
  description: '记录生活中的美好瞬间',
};

export default async function InstantRoute() {
  const photosByCategories = getPhotosByCategories();
  const categories = getAllCategories();
  const allPhotos = getAllPhotos();

  return (
    <InstantPage
      photosByCategories={photosByCategories}
      categories={categories}
      allPhotos={allPhotos}
    />
  );
}