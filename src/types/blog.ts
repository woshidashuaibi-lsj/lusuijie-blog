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
  /** 预计算的字数，列表页用此字段替代 content.length，避免传输全文内容 */
  wordCount?: number;
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
