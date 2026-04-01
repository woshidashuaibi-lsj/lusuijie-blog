/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export' 已移除：静态导出模式不支持 API Routes（RAG 接口需要服务端运行）
  // trailingSlash 已移除：trailing slash 会导致 API Routes 308 重定向后 404

  images: {
    unoptimized: true,
  },
  
  // 基于你的package.json中的MDX依赖
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
}

module.exports = nextConfig