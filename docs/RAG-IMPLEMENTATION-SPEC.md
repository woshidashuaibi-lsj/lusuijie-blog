# 《我看见的世界》RAG 向量检索系统 - 需求规格说明书 (v2)

## 1. 概述

### 1.1 项目背景
- **目标**：为博客的《我看见的世界》书籍添加 AI 问答功能
- **核心价值**：让用户可以通过自然语言提问，了解书中内容
- **面试价值**：掌握 RAG 开发能力，包括 Embedding、向量检索、LLM 集成

### 1.2 成本优化方案
- **全程使用免费/低成本方案**
- Embedding：**HuggingFace 本地模型**（免费，不花任何钱）
- LLM：**Minimax API**（复用现有 key）

### 1.3 数据来源
- **原始数据**：`我看见的世界 ([美]李飞飞).epub`
- **已提取**：34 个章节，存储于 `src/data/wo-kanjian-de-shijie.json`

---

## 2. 技术方案

### 2.1 成本对比

| 组件 | OpenAI 方案 | 推荐方案（本文） | 节省 |
|------|------------|-----------------|------|
| **Embedding** | $0.02/1M tokens | **免费**（HuggingFace 本地） | 100% |
| **LLM** | $0.15/1M tokens | **Minimax**（已有 key） | 按 Minimax 定价 |
| **向量数据库** | Chroma | Chroma（免费） | - |
| **总成本** | 微量 | **几乎为零** | ✅ |

### 2.2 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                    RAG 架构 v2（低成本版）                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│   │ books.json  │ ───▶ │ 构建脚本    │ ───▶ │ Chroma DB   │     │
│   │ (源数据)    │      │             │      │ (持久化)    │     │
│   └─────────────┘      └─────────────┘      └─────────────┘     │
│                               │                                    │
│                               ▼                                    │
│                      ┌─────────────────┐                          │
│                      │ HuggingFace     │                          │
│                      │ Embedding       │                          │
│                      │ (本地模型，免费) │                          │
│                      └─────────────────┘                          │
│                                                  │                │
│   ┌─────────────┐      ┌─────────────┐         │                │
│   │ 用户问题    │ ───▶ │ API Route   │ ───▶    │                │
│   └─────────────┘      │ /api/rag    │         ▼                │
│                         └─────────────┘      ┌─────────────┐     │
│                                               │ 相似度检索   │     │
│                                               └─────────────┘     │
│                                               ┌─────────────┐     │
│                                               │ Minimax LLM │     │
│   ┌─────────────┐      ┌─────────────┐        │ (生成回答)  │     │
│   │ 前端问答页  │ ◀─── │ API Response│ ◀──────└─────────────┘     │
│   │ /book/chat  │      └─────────────┘                             │
│   └─────────────┘                                                   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 核心组件选型

| 组件 | 选型 | 说明 |
|------|------|------|
| **向量数据库** | Chroma | 本地持久化，免费 |
| **Embedding** | `Xenogen-embed` 或 `bge-small-zh` | HuggingFace 中文模型，免费本地运行 |
| **LLM** | Minimax (`abab6.5s-chat`) | 已有 key，按量计费 |
| **框架** | Vercel AI SDK | Next.js 原生支持 |

### 2.4 为什么选这个方案？

#### HuggingFace Embedding 优势
- ✅ **完全免费**（本地运行，不消耗 API）
- ✅ **隐私更好**（数据不发送到第三方）
- ✅ **一次部署，长期使用**（模型只加载一次）
- ✅ 中文支持好（bge-small-zh 是中文优化模型）

#### Minimax LLM 优势
- ✅ 复用现有 key，无需额外注册
- ✅ 支持 Chat Completions API
- ✅ 性价比高

---

## 3. 文件结构

```
my-blog/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── rag/
│   │           ├── route.ts              # RAG 问答 API
│   │           └── build/route.ts         # 触发构建向量库
│   ├── components/
│   │   └── BookChat/                      # 问答组件
│   │       ├── index.tsx
│   │       └── index.module.css
│   ├── lib/
│   │   ├── rag.ts                         # RAG 核心逻辑
│   │   ├── embeddings.ts                   # HuggingFace Embedding
│   │   └── llm.ts                         # Minimax LLM 调用
│   └── data/
│       └── wo-kanjian-de-shijie.json      # 《我看见的世界》数据
├── scripts/
│   └── build-vectorstore.ts               # 向量库构建脚本
├── data/
│   └── vectorstore/                        # Chroma 持久化目录
└── docs/
    └── RAG-IMPLEMENTATION-SPEC.md          # 本文档
```

---

## 4. 核心代码逻辑

### 4.1 Embedding（使用 HuggingFace）

```typescript
// src/lib/embeddings.ts
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings';

const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: 'Xenogen-embed',  // 或 'sentence-transformers/bge-small-zh-v1.5'
  device: 'cpu',  // CPU 运行（数据量小，够用）
});

// 示例：生成单个文本的向量
const vector = await embeddings.embedQuery('李飞飞为什么选择研究人工智能？');
// 返回: number[] (384 维向量)
```

**支持的模型**：
| 模型 | 维度 | 中文支持 | 速度 |
|------|------|---------|------|
| `bge-small-zh-v1.5` | 512 | ⭐⭐⭐ 专为中文 | 快 |
| `Xenogen-embed` | 768 | ⭐⭐ 中等 | 快 |
| `m3e-small` | 512 | ⭐⭐⭐ 专为中文 | 快 |

### 4.2 LLM（使用 Minimax）

```typescript
// src/lib/llm.ts
import MiniMax from '@minimax/minimax-node';

const minimax = new MiniMax({
  apiKey: process.env.MINIMAX_API_KEY,
});

// 调用 LLM
async function generateAnswer(context: string, question: string) {
  const response = await minimax.chat.completions.create({
    model: 'abab6.5s-chat',  // 或其他可用模型
    messages: [
      {
        role: 'user',
        content: `根据以下内容回答问题：\n\n${context}\n\n问题：${question}`,
      },
    ],
  });
  
  return response.choices[0].message.content;
}
```

### 4.3 Chunking 策略

```typescript
const CHUNK_SIZE = 500;        // 每块字符数
const CHUNK_OVERLAP = 50;       // 块间重叠
```

### 4.4 RAG 查询流程

```typescript
// src/lib/rag.ts
async function query(question: string) {
  // 1. 向量化用户问题
  const questionVector = await embeddings.embedQuery(question);
  
  // 2. 检索最相似的 Top-K 片段
  const results = await chroma.similaritySearchVector(questionVector, 3);
  
  // 3. 构建上下文
  const context = results.map(r => r.pageContent).join('\n\n');
  
  // 4. 调用 LLM 生成回答
  const answer = await generateAnswer(context, question);
  
  return { answer, sources: results };
}
```

---

## 5. API 设计

### 5.1 RAG 问答接口

**Endpoint**: `POST /api/rag`

**Request**:
```json
{
  "question": "李飞飞为什么选择研究人工智能？"
}
```

**Response**:
```json
{
  "answer": "根据书中内容，李飞飞选择研究人工智能是因为...",
  "sources": [
    {
      "chapterTitle": "Something to Chase",
      "excerpt": "十几岁的我疯狂地痴迷与热爱物理学...",
      "score": 0.85
    }
  ]
}
```

### 5.2 构建向量库接口

**Endpoint**: `POST /api/rag/build`

**Response**:
```json
{
  "success": true,
  "chunks": 156,
  "message": "向量库构建完成"
}
```

---

## 6. 实现步骤

### Phase 1: 基础设施
1. [ ] 安装依赖：`chromadb`, `@langchain/community`, `@minimax/minimax-node`
2. [ ] 创建 `scripts/build-vectorstore.ts` 向量库构建脚本
3. [ ] 创建 `src/lib/embeddings.ts` HuggingFace Embedding 封装
4. [ ] 创建 `src/lib/llm.ts` Minimax LLM 封装
5. [ ] 创建 `src/lib/rag.ts` RAG 核心逻辑

### Phase 2: API
6. [ ] 创建 `src/app/api/rag/route.ts` 问答 API
7. [ ] 创建 `src/app/api/rag/build/route.ts` 构建触发 API

### Phase 3: 前端
8. [ ] 创建 `src/components/BookChat/` 问答组件
9. [ ] 创建书籍详情页入口 `/book/[slug]/chat`
10. [ ] 添加"与书对话"按钮到书籍详情页

### Phase 4: 测试 & 优化
11. [ ] 本地测试问答效果
12. [ ] 调整 Chunk Size 和 Top-K 参数
13. [ ] 部署验证

---

## 7. 环境变量

```bash
# .env.local
MINIMAX_API_KEY=your_minimax_key_here
MINIMAX_GROUP_ID=your_group_id_here
```

---

## 8. 面试能聊的重点

### 8.1 RAG 核心概念
- **为什么需要 RAG**：最新信息 / 私有知识 / 减少幻觉
- **RAG vs Fine-tuning**：RAG 更灵活、成本低、可解释性强

### 8.2 Embedding 模型选择
- **向量维度**：维度越高精度越高，但存储/计算成本也高
- **中文支持**：通用模型 vs 中文专用模型（bge-small-zh）
- **模型大小**：数据量小的时候，本地模型足够用

### 8.3 Chunking 策略
- **如何选 chunk size**：太小说丢失上下文，太大说检索精度下降
- **重叠的作用**：边界内容不会因切分而丢失

### 8.4 成本优化
- **为什么用 HuggingFace Embedding**：完全免费，本地运行
- **隐私考量**：数据不发送第三方，更安全

---

## 9. 验收标准

- [ ] `npm run build` 构建成功，无报错
- [ ] `POST /api/rag/build` 能成功构建向量库
- [ ] `POST /api/rag` 能返回基于书籍内容的回答
- [ ] 前端页面能正常显示问答结果和引用来源
- [ ] 回答内容与书籍相关，非幻觉输出

---

## 10. 成本估算（最终）

| 项目 | 费用 |
|------|------|
| **Embedding** | **免费**（HuggingFace 本地模型） |
| **向量数据库** | **免费**（Chroma 本地） |
| **LLM 推理** | Minimax（你已有 key） |
| **总成本** | **≈ 0**（除 LLM 按量计费外） |

---

## 11. ⚠️ 注意事项

1. **Minimax API Key**：需要额外配置 `MINIMAX_GROUP_ID`
2. **首次构建**：HuggingFace 模型需要下载（约 100MB），之后本地缓存
3. **冷启动**：Serverless 环境下模型加载较慢，建议用 Edge Runtime
