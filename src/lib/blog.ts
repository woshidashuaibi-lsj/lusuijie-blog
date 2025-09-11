import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import remarkGfm from "remark-gfm";
import { BlogPost, BlogCategory } from "@/types/blog";

const postsDirectory = path.join(process.cwd(), "posts");

export function getAllPosts(): BlogPost[] {
  // 确保 posts 目录存在
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const categories = fs.readdirSync(postsDirectory);
  const allPosts: BlogPost[] = [];

  categories.forEach((category) => {
    const categoryPath = path.join(postsDirectory, category);
    if (fs.statSync(categoryPath).isDirectory()) {
      const files = fs.readdirSync(categoryPath);

      files.forEach((fileName) => {
        if (fileName.endsWith(".md")) {
          const slug = fileName.replace(/\.md$/, "");
          const post = getPostBySlug(slug, category);
          if (post) {
            allPosts.push(post);
          }
        }
      });
    }
  });

  return allPosts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPostBySlug(
  slug: string,
  category?: string
): BlogPost | null {
  try {
    let fullPath: string;
    let foundCategory = category;

    if (category) {
      fullPath = path.join(postsDirectory, category, `${slug}.md`);
    } else {
      // 如果没有指定分类，在所有分类中查找
      const categories = fs.readdirSync(postsDirectory);
      let foundPath = "";

      for (const cat of categories) {
        const testPath = path.join(postsDirectory, cat, `${slug}.md`);
        if (fs.existsSync(testPath)) {
          foundPath = testPath;
          foundCategory = cat;
          break;
        }
      }

      if (!foundPath) {
        return null;
      }
      fullPath = foundPath;
    }

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);

    // 计算阅读时间（简单估算：200字/分钟）
    const readingTime = Math.ceil(content.length / 200);

    return {
      slug,
      title: data.title || "",
      date: data.date || "",
      category: foundCategory || "",
      tags: data.tags || [],
      description: data.description || "",
      cover: data.cover || "",
      content,
      readingTime,
    };
  } catch (error) {
    console.error(`Error reading post ${slug}:`, error);
    return null;
  }
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(html, { sanitize: false })
    .process(markdown);

  return result.toString();
}

export function getAllCategories(): BlogCategory[] {
  const posts = getAllPosts();
  const categoryMap = new Map<string, BlogCategory>();

  posts.forEach((post) => {
    if (categoryMap.has(post.category)) {
      categoryMap.get(post.category)!.count++;
    } else {
      categoryMap.set(post.category, {
        name: post.category,
        slug: post.category,
        count: 1,
      });
    }
  });

  return Array.from(categoryMap.values());
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter((post) => post.category === category);
}
