/** GitHub Pages 项目站前缀。本地 dev 为空。 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** 站点根地址，不含末尾斜杠。 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://woshidashuaibi-lsj.github.io/lusuijie-blog';

/** 给 /public 下的绝对路径加上 basePath。已是外链的原样返回。 */
export function withBase(path: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path;
  return `${BASE_PATH}${path}`;
}

/** Markdown 转出的 HTML 里，根路径图片和链接要带上 basePath。 */
export function prefixRootPaths(html: string): string {
  if (!BASE_PATH) return html;
  return html.replace(/(src|href)="\//g, `$1="${BASE_PATH}/`);
}
