export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  category: string;
  tags: string[];
  description: string;
  cover?: string;
  content: string;
  readingTime: number;
}

export interface BlogCategory {
  name: string;
  slug: string;
  count: number;
  description?: string;
}

export interface PhotoAlbum {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  images: {
    url: string;
    alt: string;
    caption?: string;
  }[];
  date: string;
}
