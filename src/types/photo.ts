export interface Photo {
  id: string;
  src: string;
  alt: string;
  category: string;
  title?: string;
  description?: string;
  tags?: string[];
  date: string;
  location?: string;
  width: number;
  height: number;
}

export interface PhotoCategory {
  id: string;
  name: string;
  description?: string;
  count: number;
}
