const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 腾讯云 Serverless 必需配置
  env: {
    STATIC_URL: isProd ? process.env.STATIC_URL : "",
  },
  assetPrefix: isProd ? process.env.STATIC_URL : "",
  
  // 你的原有配置
  output: 'standalone',
  
  // 图片优化配置
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.myqcloud.com", // 腾讯云对象存储
      },
      {
        protocol: "https",
        hostname: "woshidashuaibi-lsj.github.io", // GitHub Pages 域名
      },
      {
        protocol: "https",
        hostname: "**.github.io", // 通用 GitHub Pages 域名
      },
    ],
  },

  // 压缩优化
  compress: true,
  
  // 生产环境移除 console
  ...(isProd && {
    compiler: {
      removeConsole: true,
    },
  }),

  // 实验性功能
  experimental: {
    mdxRs: true,
  },
};

module.exports = nextConfig;