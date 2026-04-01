import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';

const dailyDirectory = path.join(process.cwd(), 'posts/daily');

export interface DailyPost {
  slug: string;       // 文件名，如 2026-04-01
  title: string;      // frontmatter title
  date: string;       // 2026-04-01
  summary: string;    // 一句话摘要
  content: string;    // 原始 markdown
}

export interface DailyMonthGroup {
  yearMonth: string;  // 如 2026-04
  label: string;      // 如 2026年04月
  posts: DailyPost[];
}

/** 读取所有日报，按日期倒序 */
export function getAllDailyPosts(): DailyPost[] {
  if (!fs.existsSync(dailyDirectory)) return [];

  const files = fs.readdirSync(dailyDirectory).filter(f => f.endsWith('.md'));

  const posts = files.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(dailyDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
      slug,
      title: data.title || slug,
      date: data.date || slug,
      summary: data.summary || '',
      content,
    } as DailyPost;
  });

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

/** 按年月分组，用于左侧导航 */
export function getDailyPostsByMonth(): DailyMonthGroup[] {
  const posts = getAllDailyPosts();
  const map = new Map<string, DailyPost[]>();

  for (const post of posts) {
    const yearMonth = post.date.slice(0, 7); // 2026-04
    if (!map.has(yearMonth)) map.set(yearMonth, []);
    map.get(yearMonth)!.push(post);
  }

  return Array.from(map.entries()).map(([yearMonth, monthPosts]) => {
    const [year, month] = yearMonth.split('-');
    return {
      yearMonth,
      label: `${year}年${month}月`,
      posts: monthPosts,
    };
  });
}

/** 获取单篇日报 */
export function getDailyPostBySlug(slug: string): DailyPost | null {
  const fullPath = path.join(dailyDirectory, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);

  return {
    slug,
    title: data.title || slug,
    date: data.date || slug,
    summary: data.summary || '',
    content,
  };
}

/** Markdown 转 HTML */
export async function dailyMarkdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(html, { sanitize: false })
    .process(markdown);
  return result.toString();
}
