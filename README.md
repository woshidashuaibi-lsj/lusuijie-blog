# 个人博客项目

一个基于 Next.js 的现代化个人博客网站，支持静态站点生成(SSG)，部署在阿里云 OSS 上。

## 🚀 项目概览

### 功能特性

- 📝 **博客文章管理** - 支持 Markdown 文章展示
- 📸 **图片展示** - 个人摄影作品集
- 🏠 **个人主页** - 个人介绍和展示
- 📱 **响应式设计** - 适配移动端和桌面端
- ⚡ **静态站点生成** - 优秀的性能和 SEO
- 🔧 **自动化部署** - 一键构建和部署到阿里云 OSS

### 技术栈

- **前端框架**: Next.js 15.5.3
- **开发语言**: TypeScript
- **样式方案**: CSS Modules
- **部署平台**: 阿里云 OSS
- **构建工具**: Next.js Build
- **包管理器**: npm

## 📁 项目结构

```
my-blog/
├── pages/                    # Next.js 页面路由
│   ├── index.tsx            # 首页
│   ├── blog/                # 博客相关页面
│   │   ├── index.tsx        # 博客列表
│   │   └── [slug].tsx       # 博客详情
│   ├── photo/               # 图片展示页面
│   └── _app.tsx             # 应用入口
├── components/              # 公共组件
├── styles/                  # 样式文件
├── public/                  # 静态资源
├── scripts/                 # 构建和部署脚本
│   └── upload-oss.js       # OSS 上传脚本
├── .env.production         # 生产环境配置
├── next.config.js          # Next.js 配置
└── package.json            # 项目依赖
```

## 🛠 开发环境搭建

### 系统要求

- Node.js 18.x 或更高版本
- npm 8.x 或更高版本

### 安装步骤

1. **克隆项目**

   ```bash
   git clone <repository-url>
   cd my-blog
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **配置环境变量**

   ```bash
   # 复制环境变量模板
   cp .env.local.example .env.local

   # 编辑本地环境变量
   vim .env.local
   ```

4. **启动开发服务器**

   ```bash
   npm run dev
   ```

5. **访问应用**

   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## ⚙️ 环境配置

### 本地开发环境 (`.env.local`)

```env
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 生产环境 (`.env.production`)

```env
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://lusuijie.com.cn

# 阿里云OSS配置
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_REGION=oss-cn-beijing
OSS_BUCKET=lusuijie-blog-static
OSS_DOMAIN=lusuijie.com.cn
```

## 🚀 构建和部署

### 构建命令

| 命令             | 说明             |
| ---------------- | ---------------- |
| `npm run dev`    | 启动开发服务器   |
| `npm run build`  | 构建生产版本     |
| `npm run export` | 导出静态站点     |
| `npm run deploy` | 构建并部署到 OSS |

### 部署流程

项目使用阿里云 OSS 作为静态网站托管平台，支持自动化部署。

#### 1. 手动部署

```bash
# 构建并导出静态文件
npm run export

# 部署到 OSS
npm run deploy
```

#### 2. 部署原理

部署脚本 `scripts/upload-oss.js` 会：

1. 读取 `out/` 目录中的静态文件
2. 为不同文件类型设置合适的 Content-Type
3. 配置缓存策略（HTML: 1 小时，其他: 30 天）
4. 上传文件到阿里云 OSS
5. 输出访问地址

#### 3. OSS 配置要求

- ✅ **静态网站托管**已开启
- ✅ **默认首页**: `index.html`
- ✅ **默认 404 页**: `404.html`
- ✅ **读写权限**: 公共读
- ✅ **自定义域名**: `lusuijie.com.cn`（已备案）

## 📝 开发规范

### 代码规范

1. **组件命名**: 使用 PascalCase

   ```tsx
   // ✅ 正确
   const BlogCard = () => {};

   // ❌ 错误
   const blogCard = () => {};
   ```

2. **文件命名**:

   - 组件文件: PascalCase (如 `BlogCard.tsx`)
   - 页面文件: kebab-case (如 `blog-list.tsx`)
   - 工具文件: camelCase (如 `utils.ts`)

3. **样式文件**: 使用 CSS Modules

   ```tsx
   // BlogCard.module.css
   .container { ... }
   .title { ... }

   // BlogCard.tsx
   import styles from './BlogCard.module.css'
   ```

### Git 提交规范

使用约定式提交 (Conventional Commits):

```bash
feat: 添加新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建配置等
```

### 分支管理

```
main     # 主分支，生产环境代码
develop  # 开发分支
feature/* # 功能分支
hotfix/*  # 热修复分支
```

## 🏗 架构设计

### 页面架构

```
应用架构
├── Layout 布局组件
├── Pages 页面组件
│   ├── HomePage - 个人主页
│   ├── BlogListPage - 博客列表
│   ├── BlogPostPage - 博客详情
│   └── PhotoPage - 图片展示
└── Components 公共组件
    ├── Header - 头部导航
    ├── Footer - 页脚
    ├── BlogCard - 博客卡片
    └── PhotoGrid - 图片网格
```

### 数据流

```
Markdown 文件 → getStaticProps → SSG → 静态HTML → OSS托管
```

### 路由设计

| 路径           | 页面     | 说明               |
| -------------- | -------- | ------------------ |
| `/`            | 首页     | 个人介绍和最新内容 |
| `/blog`        | 博客列表 | 所有博客文章列表   |
| `/blog/[slug]` | 博客详情 | 具体博客文章内容   |
| `/photo`       | 图片展示 | 摄影作品集         |

## 🔧 部署配置

### 域名和 SSL

- **主域名**: `lusuijie.com.cn`
- **备案状态**: ✅ 已完成 ICP 备案
- **DNS 解析**: CNAME → `lusuijie-blog-static.oss-cn-beijing.aliyuncs.com`
- **SSL 证书**: 支持 HTTPS 访问

### CDN 配置

- **缓存策略**:
  - HTML 文件: 1 小时
  - 静态资源: 30 天
- **压缩**: 启用 Gzip
- **地域**: 全球加速

## 🐛 常见问题

### 开发问题

**Q: 开发服务器启动失败**

A: 检查 Node.js 版本，确保 ≥ 18.x

**Q: 样式不生效**

A: 确保使用 CSS Modules 语法，检查导入路径

### 部署问题

**Q: 部署后访问 404**

A: 检查 OSS 静态网站托管配置，确保默认首页设置为 `index.html`

**Q: 自定义域名无法访问**

A: 检查：

1. DNS 解析是否正确
2. 域名是否已备案
3. OSS 域名绑定是否成功

**Q: 图片或 CSS 文件无法加载**

A: 检查文件的 Content-Type 设置和缓存策略

### 性能优化

**Q: 页面加载慢**

A:

1. 使用 Next.js Image 组件优化图片
2. 启用 CDN 加速
3. 检查资源文件大小

## 📞 联系方式

- **作者**: 卢穗杰
- **邮箱**: lusuijie@maoyan.com
- **网站**: https://lusuijie.com.cn

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

---

## 🔄 更新日志

### v1.0.0 (2024-12-XX)

- ✨ 初始版本发布
- 🏗️ 完成基础架构搭建
- 🚀 集成阿里云 OSS 部署
- 📝 完善文档和开发规范
