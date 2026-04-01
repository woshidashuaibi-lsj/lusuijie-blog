# GitHub Actions 自动部署文档

> 记录博客从推送代码到线上更新的完整自动化流程，以及配置过程中踩过的所有坑。

---

## 一、整体流程

```
本地写代码
    │
    │  git push origin main
    ▼
GitHub 仓库（main 分支有新提交）
    │
    │  触发 .github/workflows/deploy.yml
    ▼
GitHub Actions Runner（ubuntu-latest）
    │
    ├── 1. Checkout 拉取代码
    ├── 2. Setup Node.js 20
    ├── 3. npm ci --legacy-peer-deps（安装依赖）
    ├── 4. npm run build（构建静态文件到 out/）
    └── 5. node scripts/upload-oss.js（上传到阿里云 OSS）
    │
    ▼
阿里云 OSS（lusuijie-blog-static）
    │
    ▼
用户浏览器访问 lusuijie.com.cn
```

---

## 二、Workflow 文件详解（`.github/workflows/deploy.yml`）

```yaml
name: Deploy to OSS

on:
  push:
    branches:
      - main          # 只有推送到 main 分支才触发

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      # Step 1: 拉取代码
      - name: Checkout
        uses: actions/checkout@v4

      # Step 2: 安装 Node.js 20，开启 npm 缓存加速
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Step 3: 安装依赖（必须加 --legacy-peer-deps，见踩坑 1）
      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      # Step 4: 构建，注入前端需要的环境变量
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SITE_URL: ${{ secrets.NEXT_PUBLIC_SITE_URL }}
          NEXT_PUBLIC_API_BASE: ${{ secrets.NEXT_PUBLIC_API_BASE }}
          NEXT_PUBLIC_GITHUB_TOKEN: ${{ secrets.NEXT_PUBLIC_GITHUB_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.DEPLOY_GITHUB_TOKEN }}   # 注意别名，见踩坑 4

      # Step 5: 上传 out/ 目录到阿里云 OSS
      - name: Upload to OSS
        run: node scripts/upload-oss.js
        env:
          OSS_ACCESS_KEY_ID: ${{ secrets.OSS_ACCESS_KEY_ID }}
          OSS_ACCESS_KEY_SECRET: ${{ secrets.OSS_ACCESS_KEY_SECRET }}
          OSS_REGION: ${{ secrets.OSS_REGION }}
          OSS_BUCKET: ${{ secrets.OSS_BUCKET }}
          OSS_DOMAIN: ${{ secrets.OSS_DOMAIN }}
```

---

## 三、需要配置的 GitHub Secrets

进入仓库 **Settings → Secrets and variables → Actions → New repository secret**，逐一添加：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `OSS_ACCESS_KEY_ID` | 阿里云 AccessKey ID | `LTAI5tKirxmrLr...` |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | `GD4hVQWS5V3aZw...` |
| `OSS_REGION` | OSS 区域 | `oss-cn-beijing` |
| `OSS_BUCKET` | Bucket 名称 | `lusuijie-blog-static` |
| `OSS_DOMAIN` | 访问域名 | `lusuijie.com.cn` |
| `NEXT_PUBLIC_SITE_URL` | 博客域名 | `https://lusuijie.com.cn` |
| `NEXT_PUBLIC_API_BASE` | FC API 地址 | `http://47.94.103.221:3001` |
| `NEXT_PUBLIC_GITHUB_TOKEN` | GitHub Token（留言板用） | `ghp_xxx...` |
| `DEPLOY_GITHUB_TOKEN` | GitHub Personal Access Token | `github_pat_xxx...` |

> ⚠️ **注意**：Secrets 添加后无法查看明文，只能覆盖更新。建议在本地 `.env.production` 保留一份备份（确保该文件在 `.gitignore` 中）。

---

## 四、上传脚本说明（`scripts/upload-oss.js`）

脚本逻辑：

1. 加载环境变量（本地从 `.env.production`，CI 从 GitHub Secrets 注入）
2. 初始化 `ali-oss` 客户端
3. 测试 OSS 连接
4. 递归遍历 `out/` 目录，逐文件上传
5. HTML 文件设置较短的缓存时间（1 小时），静态资源设置长缓存（30 天）

```js
// 本地开发时从 .env.production 加载；CI 环境变量已由 GitHub Actions 注入
// override: false 确保不覆盖 CI 已注入的变量
require('dotenv').config({ path: '.env.production', override: false })
```

---

## 五、踩过的坑

### 坑 1：`npm ci` 因 peer dependency 冲突失败

**报错**：
```
npm error Conflicting peer dependency: dotenv@16.6.1
npm error   peer dotenv@"^16.4.5" from @browserbasehq/stagehand@1.14.0
npm error   from node_modules/@langchain/community
```

**原因**：
- `package.json` 里 `dotenv` 是 `^17.2.2`（devDependencies）
- `@langchain/community` 间接依赖 `@browserbasehq/stagehand`，它要求 `dotenv@^16.x`
- `npm ci` 默认严格校验 peer dependency，版本不兼容直接退出

**解决**：
```yaml
- name: Install dependencies
  run: npm ci --legacy-peer-deps  # 忽略间接 peer dependency 冲突
```

---

### 坑 2：TypeScript 编译报 `Cannot find module 'express'`

**报错**：
```
./fc-api/src/index.ts:12:44
Type error: Cannot find module 'express' or its corresponding type declarations.
```

**原因**：根 `tsconfig.json` 的 `include: ["**/*.ts", "**/*.tsx"]` 把 `fc-api/` 目录也扫进来了，但 `fc-api` 有自己独立的 `package.json` 和 `tsconfig.json`，它的依赖（`express`、`cors` 等）没有安装在根目录的 `node_modules` 里。

**解决**：在根 `tsconfig.json` 的 `exclude` 里加上 `fc-api`：
```json
{
  "exclude": ["node_modules", "fc-api"]
}
```

同时在 `eslint.config.mjs` 的 `ignores` 里也加上 `fc-api/**`，避免 ESLint 扫描后端代码。

---

### 坑 3：ESLint Warning 导致构建失败

**报错**：
```
./src/components/Comments/index.tsx
10:36 Warning: 'post' is defined but never used.  @typescript-eslint/no-unused-vars

./src/pages/book/index.tsx
19:7 Warning: Using `<img>` could result in slower LCP...  @next/next/no-img-element

Failed to compile.
```

**原因**：`next/core-web-vitals` ESLint 配置会把某些 warning 升级为 error，导致 `Failed to compile`。

**解决**：
1. `Comments` 组件里未使用的 `post` 参数改为 `_post`（下划线前缀是 TS 约定的"有意忽略"标记）
2. 书单页的 `<img>` 是为了实现 `onError` 回退逻辑，无法直接换成 `<Image />`，在 `eslint.config.mjs` 里将该规则降级为 `warn`：

```js
{
  rules: {
    "@next/next/no-img-element": "warn",
  },
}
```

---

### 坑 4：上传 OSS 时 `Region` 和 `Bucket` 为空

**报错**：
```
🔧 OSS配置检查:
- Region:
- Bucket:
- AccessKey ID: ...
Error: require accessKeyId, accessKeySecret
```

**原因**：GitHub 仓库的 **Repository Secrets 是空的**，从未配置过。`${{ secrets.OSS_* }}` 全部取到空字符串，`ali-oss` 初始化时校验失败。

**解决**：进入仓库 **Settings → Secrets and variables → Actions**，添加所有必要的 Secrets（见上方第三节的完整列表）。

---

### 坑 5：dotenv 读取 `.env.production` 覆盖 CI 注入的变量

**现象**：即使 GitHub Secrets 配置正确，`upload-oss.js` 里的 `dotenv.config()` 可能干扰 CI 环境变量的读取。

**原因**：`dotenv.config({ path: '.env.production' })` 默认 `override: true`，若 `.env.production` 里有同名变量（即使为空），会覆盖掉 GitHub Actions 已注入的值。CI 环境里没有 `.env.production` 文件，dotenv 注入 0 个变量，但早期版本的行为不稳定。

**解决**：加上 `override: false`，确保 dotenv 永远不会覆盖已有的环境变量：
```js
require('dotenv').config({ path: '.env.production', override: false })
```

---

## 六、本地部署 vs CI 部署对比

| 对比项 | 本地 `npm run deploy` | GitHub Actions |
|--------|----------------------|----------------|
| 触发方式 | 手动执行 | git push 到 main 自动触发 |
| 环境变量来源 | `.env.production` 文件 | GitHub Secrets |
| 适用场景 | 快速更新、紧急修复 | 日常迭代、日报更新 |
| 优点 | 快，无需等待 | 自动化，推送即部署 |
| 缺点 | 需要本地有 `.env.production` | 首次需要配置 Secrets |

---

## 七、日常使用流程

**正常更新内容（推荐）**：

```bash
# 编写日报/博客内容
git add .
git commit -m "feat: 新增 XXXX 日报"
git push origin main
# → 自动触发 GitHub Actions → 约 1-2 分钟后线上更新
```

**紧急修复或本地验证后直接部署**：

```bash
npm run deploy
# 等价于 npm run export && node scripts/upload-oss.js
```

---

*文档生成日期：2026-04-01*
