/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production' && process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  // output: 'export' 仅在静态导出构建时启用（npm run export）
  // 开发模式下必须关闭，否则 API Routes 全部 404
  ...(isProd ? { output: 'export' } : {}),
  trailingSlash: true,

  images: {
    unoptimized: true,
  },
  
  // 基于你的package.json中的MDX依赖
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
}

module.exports = nextConfig