# 书单 AI 问答（RAG）技术文档

> 记录博客书单页面「与书对话」功能的完整架构设计、实现过程以及踩坑实录。

---

## 一、什么是 RAG？

RAG（Retrieval-Augmented Generation，检索增强生成）是一种让大语言模型（LLM）基于特定文档内容进行回答的技术方案。

**解决的核心问题**：LLM 的训练数据有截止日期，且无法记住你私有的书籍内容。直接问 GPT「李飞飞在书里说了什么」，它要么乱编，要么说不知道。

RAG 的解法分三步：

```
用户提问
   ↓
① 检索：把问题转成向量，去数据库里找最相关的书籍段落
   ↓
② 拼装：把找到的段落作为上下文塞给 LLM
   ↓
③ 生成：LLM 基于这些段落生成回答
```

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                               │
│                   lusuijie.com.cn/book/...                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP POST /api/rag
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              fc-api（Node.js + Express）                         │
│              运行在阿里云 ECS：47.94.103.221:3001                │
│                                                                 │
│   ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐  │
│   │ /api/rag     │    │ /api/rag/build  │    │  /health     │  │
│   │  (问答接口)  │    │  (构建向量库)   │    │  (健康检查)  │  │
│   └──────┬───────┘    └────────┬────────┘    └──────────────┘  │
│          │                     │                                │
│          ▼                     ▼                                │
│   ┌─────────────────────────────────┐                          │
│   │       RAG 核心逻辑 (rag.ts)     │                          │
│   └──────┬──────────────────┬───────┘                          │
│          │                  │                                   │
│          ▼                  ▼                                   │
│   ┌────────────┐    ┌───────────────┐                          │
│   │ embeddings │    │     llm.ts    │                          │
│   │    .ts     │    │  MiniMax API  │                          │
│   │ DashScope  │    │  MiniMax-M2.7 │                          │
│   └─────┬──────┘    └───────┬───────┘                          │
└─────────┼───────────────────┼─────────────────────────────────┘
          │                   │
          ▼                   ▼
┌──────────────────┐  ┌──────────────────────┐
│  阿里云 DashScope │  │   MiniMax API        │
│  text-embedding  │  │   chatcompletion_v2  │
│  -v3 (1024维)    │  │   (生成回答)         │
└──────────────────┘  └──────────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│        Supabase PostgreSQL           │
│  表：rag_documents                   │
│  字段：id, collection, content,      │
│        metadata, embedding(REAL[])  │
└──────────────────────────────────────┘
```

---

## 三、数据流详解

### 3.1 构建阶段（一次性操作）

触发方式：在书籍对话页面点击「构建」按钮，调用 `POST /api/rag/build`。

```
书籍 JSON 文件
(fc-api/data/wo-kanjian-de-shijie.json)
        │
        ▼
  按章节读取全部文本
        │
        ▼
  RecursiveCharacterTextSplitter 切块
  ├── chunkSize: 500 字
  ├── chunkOverlap: 50 字（前后重叠，防止语义截断）
  └── separators: ['\n\n', '\n', '。', '！', '？', '；', ' ']
        │
        ▼
  514 个文本块（Chunk）
        │
        ▼
  每批 5 个，调用 DashScope Embedding API
  → 每个 Chunk 转成 1024 维的浮点数向量
        │
        ▼
  批量写入 Supabase rag_documents 表
  (先清空旧数据，再全量写入)
```

### 3.2 问答阶段（每次对话）

```
用户输入问题："李飞飞的童年经历是怎样的？"
        │
        ▼
  调用 DashScope Embedding API
  → 问题转成 1024 维向量
        │
        ▼
  从 Supabase 取出所有 rag_documents
  (当前 collection = 'wo-kanjian-de-shijie')
        │
        ▼
  在内存中计算余弦相似度（Cosine Similarity）
  附录章节额外 × 0.8 降权（避免附录内容干扰正文）
        │
        ▼
  取 TOP_K=5 个最相关的 Chunk
        │
        ▼
  拼装 System Prompt：
  "你是《我看见的世界》的AI助手，根据以下段落回答..."
  + 5 个相关段落作为上下文
        │
        ▼
  调用 MiniMax API（MiniMax-M2.7）
  temperature=0.3（偏确定性，减少幻觉）
  max_tokens=1024
        │
        ▼
  返回 { answer, sources } 给前端
```

---

## 四、关键技术选型

| 组件 | 选型 | 原因 |
|------|------|------|
| **Embedding 模型** | 阿里云 DashScope `text-embedding-v3` | 国内可直接访问，中文效果好，1024维，有免费额度 |
| **向量数据库** | Supabase PostgreSQL + `REAL[]` 列 | 免费，托管，无需自建；向量直接存普通数组列，用代码算相似度 |
| **LLM** | MiniMax `MiniMax-M2.7` | 国内可访问，中文能力强，有 API 免费额度 |
| **API 服务** | Node.js + Express，运行在阿里云 ECS | Next.js 静态导出不支持 API Routes，需要独立服务端 |
| **文本切割** | LangChain `RecursiveCharacterTextSplitter` | 按语义边界切割，保留上下文完整性 |

---

## 五、踩坑实录

### 坑 1：Next.js 静态导出后 API Routes 失效

**现象**：本地开发对话功能正常，部署后完全不工作。

**原因**：博客是纯静态站点，通过 `next build` + `output: 'export'` 生成 `out/` 目录上传到阿里云 OSS。OSS 是对象存储，只能托管静态文件，**无法运行 Node.js 代码**。Next.js 的 `/pages/api/` 下的 API Routes 在静态导出后会被直接忽略，根本不会生成任何文件。

**解决方案**：把 RAG 逻辑单独抽出来，作为独立的 `fc-api` 服务部署在阿里云 ECS（`47.94.103.221:3001`），前端通过 `NEXT_PUBLIC_API_BASE` 环境变量指向这个服务。

---

### 坑 2：本地 HuggingFace 模型在国内服务器无法下载

**现象**：本地开发完全正常，部署到国内 ECS 后调用接口返回 `{"message":"fetch failed"}`。

**根本原因**：最初使用 `@langchain/community` 的 `HuggingFaceTransformersEmbeddings`，模型是 `Xenova/bge-small-zh-v1.5`。这个方案在本地运行时会自动从 `huggingface.co` 下载 ONNX 格式的模型文件缓存到本地，后续直接本地推理。

但国内阿里云 ECS 服务器**完全无法访问 `huggingface.co`**（被防火长城屏蔽），导致模型下载失败，抛出 `fetch failed` 错误。

**为什么不能用自己部署的模型？**

理论上可以，但实际上有以下障碍：

1. **模型文件太大**：`bge-small-zh-v1.5` 的 ONNX 版本约 90MB，需要提前下载好再上传到服务器，流程繁琐
2. **内存占用高**：ONNX Runtime 在 Node.js 里运行需要加载模型权重到内存，512MB 的 ECS 压力很大，每次重启都要重新加载
3. **推理速度慢**：CPU 推理比 GPU 慢几十倍，单次 Embedding 计算可能需要数秒，对话体验极差
4. **维护成本高**：需要自己管理模型版本、更新、监控，而 API 服务方帮你搞定了这一切

**解决方案**：换用阿里云 DashScope 的 `text-embedding-v3` API。国内直接访问，延迟低，按量计费，免维护。

---

### 坑 3：服务器环境变量未加载（dotenv 缺失）

**现象**：服务器上 `.env` 文件明明有 `SUPABASE_DB_URL`，但接口返回 `{"message":"SUPABASE_DB_URL 环境变量未设置"}`。

**原因**：`fc-api` 的 `src/index.ts` 原先没有引入 `dotenv`。代码里虽然读取 `process.env.XXX`，但 `node dist/index.js` 直接运行时，Node.js 不会自动读取 `.env` 文件，只会读取系统环境变量（`export` 设置的或 PM2 配置里的）。

**解决方案**：在 `src/index.ts` 入口最顶部加上：

```typescript
import dotenv from 'dotenv';
dotenv.config(); // 必须在所有其他 import 之前执行
```

注意 `dotenv.config()` 必须在其他模块 `import` 之前调用，否则 `rag.ts`、`embeddings.ts` 等子模块在被加载时读取 `process.env` 已经来不及了。

---

### 坑 4：PM2 重启后环境变量不更新

**现象**：在服务器上修改了 `.env` 文件，执行 `pm2 restart all` 后，新的环境变量仍然不生效。

**原因**：PM2 在启动进程时会**缓存**一份环境变量快照，普通的 `restart` 只是重启进程，不会重新读取当前的环境变量。

**解决方案**：必须使用 `--update-env` 参数：

```bash
pm2 restart all --update-env
```

---

### 坑 5：CORS 跨域拦截（http vs https）

**现象**：问答功能在本地开发完全正常，部署到线上后浏览器控制台报 CORS 错误，Network 面板显示请求状态为「CORS 错误」。

**原因**：线上博客通过 HTTP 访问（`http://lusuijie.com.cn`），但服务器 CORS 白名单里只配置了 `https://lusuijie.com.cn`（注意协议）。浏览器在做跨域检查时，`http://` 和 `https://` 是**完全不同的 Origin**，一字之差导致被拒绝。

**解决方案**：在 `fc-api/src/index.ts` 的白名单里同时加上 http 和 https 两个版本：

```typescript
const allowedOrigins = [
  'https://lusuijie.com.cn',
  'http://lusuijie.com.cn',  // 新增
  'http://localhost:3000',
  'https://lusuijie-blog-static.oss-cn-beijing.aliyuncs.com',
];
```

---

### 坑 6：部署后线上内容不更新（out/ 目录是旧的）

**现象**：本地修改了书单数据，执行 `npm run deploy` 显示部署成功，但线上内容依然是旧的。

**原因**：`npm run deploy` = `npm run export && node scripts/upload-oss.js`，而 `export` 脚本是 `next build`。当时 `next.config.js` 里 `output: 'export'` 被注释掉了（注释说法是「静态导出不支持 API Routes」），导致 `next build` 只更新了 `.next/` 目录，**不会生成 `out/` 目录**。`upload-oss.js` 上传的 `out/` 是之前遗留的旧版本。

**解决方案**：恢复 `next.config.js` 中的 `output: 'export'`。API Routes 虽然在静态导出中不生效，但生产环境的 RAG 请求本来就走独立的 `fc-api` 服务，并不依赖 Next.js 的 API Routes，所以恢复这个配置不会有任何副作用。

```javascript
const nextConfig = {
  output: 'export',      // 恢复：生成 out/ 静态目录
  trailingSlash: true,   // 恢复：OSS 需要 /path/ 格式
  // ...
}
```

---

## 六、Supabase 数据库表结构

```sql
CREATE TABLE rag_documents (
  id          TEXT PRIMARY KEY,          -- 文档 ID，格式：doc-0, doc-1, ...
  collection  TEXT NOT NULL,             -- 书籍标识，如 'wo-kanjian-de-shijie'
  content     TEXT NOT NULL,             -- 文本块原文
  metadata    JSONB,                     -- 元数据：{ chapterTitle, type }
  embedding   REAL[],                    -- 1024 维浮点向量
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 按 collection 查询的索引
CREATE INDEX idx_rag_documents_collection ON rag_documents(collection);

-- 向量相似度搜索索引（IVFFlat 算法，余弦距离）
CREATE INDEX idx_rag_documents_embedding 
  ON rag_documents USING ivfflat (embedding real_cosine_ops);
```

> **为什么不用 pgvector 的 `<=>` 操作符做向量检索？**
>
> 完全可以，但当前数据量只有 514 条，在内存里做余弦相似度计算毫无压力。用 `SELECT * FROM rag_documents` 全量拉回来再排序，单次耗时不超过 100ms，暂时不需要优化。等书籍数量增多（> 10 万条）时再考虑换成 pgvector 原生向量检索。

---

## 七、环境变量说明

### fc-api/.env（服务器端）

| 变量名 | 说明 |
|--------|------|
| `MINIMAX_API_KEY` | MiniMax LLM API Key，用于生成回答 |
| `MINIMAX_GROUP_ID` | MiniMax 账号 Group ID |
| `SUPABASE_DB_URL` | Supabase PostgreSQL 连接串（Transaction Pooler） |
| `DASHSCOPE_API_KEY` | 阿里云 DashScope API Key，用于 Embedding |
| `PORT` | 服务监听端口，默认 3001 |

### .env.local（前端本地开发）

| 变量名 | 说明 |
|--------|------|
| `NEXT_PUBLIC_API_BASE` | RAG API 地址。本地开发指向线上 ECS，留空则走本地 Next.js API Routes |

### .env.production（前端生产构建）

| 变量名 | 说明 |
|--------|------|
| `NEXT_PUBLIC_API_BASE` | 生产环境指向 `http://47.94.103.221:3001` |

---

## 八、本地开发指南

本地开发不需要单独启动 `fc-api`，`.env.local` 里已配置 `NEXT_PUBLIC_API_BASE` 指向线上服务器，直接复用：

```bash
# 启动前端
npm run dev

# 访问书籍对话页面即可，RAG 请求会自动打到线上 fc-api
```

如果需要本地调试 `fc-api` 本身：

```bash
cd fc-api
npm run dev   # ts-node src/index.ts，监听 3001 端口
```

---

## 九、服务器部署流程

```bash
# 1. 本地编译
cd fc-api
npm run build          # tsc → dist/

# 2. 上传到服务器
scp -r dist/ .env root@47.94.103.221:~/fc-api/

# 3. 服务器上安装依赖（仅新增依赖时需要）
ssh root@47.94.103.221 "cd ~/fc-api && npm install"

# 4. 重启服务（--update-env 让新环境变量生效）
ssh root@47.94.103.221 "pm2 restart all --update-env"

# 5. 重建向量库（仅书籍数据变更时需要）
curl -X POST http://47.94.103.221:3001/api/rag/build
```
