/**
 * 生成 sitemap.xml 和 robots.txt
 * 在 npm run export 之后调用，生成文件到 out/ 目录
 * 用法：node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const SITE_URL = 'https://lusuijie.com.cn';
const OUT_DIR = path.join(__dirname, '..', 'out');
const POSTS_DIR = path.join(__dirname, '..', 'posts');

// 固定页面
const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/blog/', priority: '0.9', changefreq: 'daily' },
  { url: '/daily/', priority: '0.9', changefreq: 'daily' },
  { url: '/book/', priority: '0.8', changefreq: 'weekly' },
  { url: '/photo/', priority: '0.7', changefreq: 'weekly' },
  { url: '/guestbook/', priority: '0.6', changefreq: 'weekly' },
  { url: '/about/', priority: '0.6', changefreq: 'monthly' },
];

// 读取所有博客文章
function getBlogPosts() {
  const urls = [];
  const categories = ['tech', 'life', 'photos'];

  for (const cat of categories) {
    const dir = path.join(POSTS_DIR, cat);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      const fullPath = path.join(dir, file);
      const { data } = matter(fs.readFileSync(fullPath, 'utf8'));
      const date = data.date instanceof Date
        ? data.date.toISOString().slice(0, 10)
        : String(data.date || '').slice(0, 10);

      urls.push({
        url: `/blog/${slug}/`,
        priority: '0.7',
        changefreq: 'monthly',
        lastmod: date,
      });
    }
  }
  return urls;
}

// 读取所有日报
function getDailyPosts() {
  const dir = path.join(POSTS_DIR, 'daily');
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const slug = file.replace(/\.md$/, '');
    return {
      url: `/daily/${slug}/`,
      priority: '0.6',
      changefreq: 'never',
      lastmod: slug,
    };
  });
}

// 生成 sitemap.xml
function generateSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const blogPosts = getBlogPosts();
  const dailyPosts = getDailyPosts();

  const allUrls = [
    ...staticPages.map(p => ({ ...p, lastmod: today })),
    ...blogPosts,
    ...dailyPosts,
  ];

  const xmlItems = allUrls.map(({ url, priority, changefreq, lastmod }) => `
  <url>
    <loc>${SITE_URL}${url}</loc>
    <lastmod>${lastmod || today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
</urlset>`;

  const outPath = path.join(OUT_DIR, 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`✅ sitemap.xml 生成成功，共 ${allUrls.length} 条 URL → ${outPath}`);
}

// 生成 robots.txt
function generateRobots() {
  const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

  const outPath = path.join(OUT_DIR, 'robots.txt');
  fs.writeFileSync(outPath, robots, 'utf8');
  console.log(`✅ robots.txt 生成成功 → ${outPath}`);
}

// 执行
if (!fs.existsSync(OUT_DIR)) {
  console.error('❌ out/ 目录不存在，请先运行 npm run export');
  process.exit(1);
}

generateSitemap();
generateRobots();
