import { Photo, PhotoCategory } from "@/types/photo";

// 示例照片数据 - 按分类组织
export const photos: Photo[] = [
  // 公园春景
  {
    id: "1",
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    alt: "公园春景1",
    category: "公园·春",
    title: "春日公园",
    description: "春天的公园，绿意盎然",
    date: "2024-03-15",
    location: "中央公园",
    width: 800,
    height: 1200,
    tags: ["春天", "公园", "绿色"],
  },
  {
    id: "2",
    src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
    alt: "公园春景2",
    category: "公园·春",
    title: "樱花绽放",
    date: "2024-03-20",
    width: 800,
    height: 600,
    tags: ["樱花", "公园", "春天"],
  },
  {
    id: "3",
    src: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800",
    alt: "公园春景3",
    category: "公园·春",
    title: "绿荫小径",
    date: "2024-03-18",
    width: 800,
    height: 1000,
    tags: ["小径", "绿荫", "公园"],
  },
  // 庭园夏日
  {
    id: "4",
    src: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800",
    alt: "庭园夏日1",
    category: "庭园·夏",
    title: "夏日庭园",
    date: "2024-06-15",
    width: 800,
    height: 800,
    tags: ["夏天", "庭园", "绿色"],
  },
  {
    id: "5",
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    alt: "庭园夏日2",
    category: "庭园·夏",
    title: "荷塘月色",
    date: "2024-06-20",
    width: 800,
    height: 1100,
    tags: ["荷花", "庭园", "夏天"],
  },
  // 文西秋色
  {
    id: "6",
    src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
    alt: "文西秋色1",
    category: "文西·秋",
    title: "秋叶满径",
    date: "2024-09-15",
    width: 800,
    height: 900,
    tags: ["秋天", "文西", "落叶"],
  },
  {
    id: "7",
    src: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800",
    alt: "文西秋色2",
    category: "文西·秋",
    title: "金桂飘香",
    date: "2024-09-20",
    width: 800,
    height: 700,
    tags: ["桂花", "秋天", "文西"],
  },
];

// 获取按分类分组的照片
export function getPhotosByCategories(): Record<string, Photo[]> {
  const groupedPhotos: Record<string, Photo[]> = {};

  photos.forEach((photo) => {
    if (!groupedPhotos[photo.category]) {
      groupedPhotos[photo.category] = [];
    }
    groupedPhotos[photo.category].push(photo);
  });

  // 按日期排序每个分类内的照片
  Object.keys(groupedPhotos).forEach((category) => {
    groupedPhotos[category].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  });

  return groupedPhotos;
}

// 获取所有分类
export function getAllCategories(): PhotoCategory[] {
  const categoryMap = new Map<string, number>();

  photos.forEach((photo) => {
    categoryMap.set(photo.category, (categoryMap.get(photo.category) || 0) + 1);
  });

  const categories: PhotoCategory[] = [];
  categoryMap.forEach((count, category) => {
    categories.push({
      id: category,
      name: category,
      count,
    });
  });

  return categories;
}

// 获取所有照片（用于模态框切换）
export function getAllPhotos(): Photo[] {
  return photos.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
