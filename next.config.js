/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production' && process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  // output: 'export' 仅在静态导出构建时启用（npm run export）
  // 开发模式下必须关闭，否则 API Routes 全部 404
  ...(isProd ? { output: 'export' } : {}),
  trailingSlash: true,

  images: {
    // 静态导出（npm run export）模式下必须 unoptimized，
    // 普通 Next.js 服务端运行时开启图片优化
    unoptimized: isProd,
    formats: ['image/avif', 'image/webp'],
    // 不再需要外部域名白名单（头像已迁移本地）
    remotePatterns: [],
  },
  
  // 基于你的package.json中的MDX依赖
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
}

module.exports = nextConfig