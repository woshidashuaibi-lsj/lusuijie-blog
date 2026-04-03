# RAG 召回优化完整方案

> 基于本项目（《我看见的世界》AI 问答）的实践，深度解析业界成熟的 RAG 召回优化方法论。

---

**如何判断召回率**

你提 10 个你知道答案在哪里的问题，看 Top-5 里平均有几个"命中"了正确段落。
10 个问题里，有 8 个在 Top-5 里能找到正确段落 → 召回率 80% 以上，不错
10 个问题里，只有 4-5 个能找到 → 召回率 40-50%，需要优化
每次 LLM 的回答里引用的来源你自己看着有 2/3 是相关的 → Precision 约 60%，可接受

## 一、问题诊断：当前系统为什么不够好

### 1.1 性能问题（最紧迫）

```
当前流程耗时分析：
  用户提问 → 向量化（DashScope）：200ms
           ↓ Supabase 全表拉向量：6108条 × 1024维 ≈ 几百KB：300ms
           ↓ Node.js 计算余弦相似度 × 6108 次：8-9s ← 性能瓶颈！
           ↓ 排序取 Top-5：100ms
           ↓ LLM 调用生成：5-10s

  用户看到回答：14-20s 总延迟 ⚠️
```

**根本原因**：用 Node.js 全表扫描做向量检索，时间复杂度 O(n)，随数据量线性增长。

### 1.2 召回质量问题

**症状**：

- 某些问题找不到相关内容，或关键内容排名靠后
- 人名、地名等专有词汇容易被忽视（"李飞飞" 可能被映射到与其他名字相近的向量）
- 书评、目录等元数据内容混入结果，造成噪声

**根因链路**：

```
用户问题
  ↓ 查询理解不足（口语化，过于简短）
查询向量
  ↓ Embedding 模型能力有限（bge-small 是轻量模型，语义区分度有限）
  + 没有做查询优化（改写、HyDE、多查询）
  ↓ 向量检索结果不精准
Top-K 候选
  ↓ 没有重排序，纯按相似度分数排序
  + 相似度分数依赖模型质量，可靠性一般
  ↓ 排序不准
最终 Top-5
  ↓ 没有压缩去噪
喂给 LLM
  ↓ LLM 从嘈杂上下文中提取信息，容易出错
回答质量低
```

---

## 二、五层优化架构

完整的 RAG 召回优化分为五个递进的层次，从查询侧到生成侧，逐步提升质量：

```
┌────────────────────────────────────────────────────────┐
│              Layer 1: 查询优化                          │
│   让问题本身更适合向量检索，而非直接用原始问题          │
└────────────────┬───────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────┐
│              Layer 2: 索引优化                          │
│   优化数据存储结构，使得数据天然更易被检索              │
└────────────────┬───────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────┐
│              Layer 3: 检索优化                          │
│   从 O(n) 全表扫描优化为 O(log n) 索引检索             │
│   + 多路并行检索融合                                   │
└────────────────┬───────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────┐
│              Layer 4: 重排序                           │
│   粗召回后用更精细的方法重新排序，提升精确率            │
└────────────────┬───────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────┐
│              Layer 5: 上下文优化                        │
│   优化喂给 LLM 的内容，减少噪声，保留完整性            │
└────────────────────────────────────────────────────────┘
```

---

## 三、Layer 1：查询优化（Query Optimization）

**核心思想**：用户的原始问题往往不适合向量检索。通过 LLM 改造问题，让查询向量更接近文档向量。

### 3.1 查询改写（Query Rewriting）

**问题**：用户输入通常口语化、简短、有歧义，直接向量化效果不理想。

```
用户输入 → 分析 → 改写成检索友好型 → 向量化
```

**具体例子**：

```
原始："李飞飞小时候咋样？"
改写后："李飞飞的童年成长经历、家庭背景、求学过程与性格形成"
```

**为什么有效**：

- Embedding 模型对正式书面语的理解优于口语
- 补充了隐含的多个维度，向量检索覆盖面更广
- "咋样" 这种模糊词汇被具体化

**实现代码**：

```typescript
async function rewriteQuery(question: string): Promise<string> {
  const prompt = `
请将以下用户的自然语言问题改写为更适合文献检索的学术表述。要求：
1. 补充隐含的背景或维度
2. 用正式书面语替代口语和缩写
3. 保留原问题的核心语义，但更结构化

用户问题：${question}

改写后的表述：`;

  const response = await callLLM(prompt);
  return response;
}

// 使用
const originQ = "李飞飞小时候咋样？";
const optimizedQ = await rewriteQuery(originQ);
// 返回："李飞飞的童年成长经历、家庭背景、求学过程与性格形成"
```

**成本**：+200ms LLM 调用，可选（可通过缓存优化）。

---

### 3.2 假设文档嵌入（HyDE - Hypothetical Document Embeddings）

**核心洞察**：问题的向量空间和答案的向量空间不完全对齐。

```
问题向量：比较抽象，往往较短，表达一个疑问
答案向量：具体、完整的描述或陈述

直接计算相似度，两者在向量空间中"位置关系"未必理想
```

**改进方案**：先让 LLM 生成一段假设答案，再用假设答案的向量去检索（而不是用问题的向量）。

**图示**：

```
方案 A（直接查询）：
  问题："李飞飞为什么去美国？"
  embed("李飞飞为什么去美国？") → 向量Q
  书中："李飞飞为了追求物理学梦想移民美国求学..."
  embed("李飞飞为了追求物理学梦想...") → 向量D
  cos_sim(Q, D) = 0.65 ← 一般

方案 B（HyDE）：
  LLM 生成假设答案：
  "李飞飞在青年时期深受对人工智能的热情和对科学研究的执着所驱动，
   她决定赴美深造，进入斯坦福大学开始了她在计算机视觉领域的开创性工作。"

  embed(假设答案) → 向量H
  cos_sim(H, D) = 0.82 ← 更高！ ✅
```

**为什么有效**：

- 假设答案和真实答案在向量空间中"同类型"，更接近
- 避免了问题在向量空间中相对"孤立"的状态

**实现代码**：

```typescript
async function hydeQuery(question: string): Promise<number[]> {
  const hypotheticalAnswerPrompt = `
基于以下问题，请生成一段假设的、来自原著的直接回答。
要求生成的内容应该类似于原著中的实际答案，风格和表达方式要贴近原文。

问题：${question}

假设的原文回答（100-150字）：`;

  const hypotheticalAnswer = await callLLM(hypotheticalAnswerPrompt);

  // 用假设答案的向量去检索
  const queryVector = await embeddings.embedQuery(hypotheticalAnswer);
  return queryVector;
}
```

**成本**：+300ms（LLM 调用 + Embedding），但可显著提升相关性。

---

### 3.3 多查询扩展（Multi-Query Expansion）

**问题**：一个问题可能从多个角度切入，单一查询容易遗漏。

**解法**：用 LLM 生成多个语义等价但措辞不同的查询，分别检索再合并。

```
原始问题："李飞飞对深度学习的贡献是什么"
  ↓ LLM 生成多个角度
├─ "李飞飞在神经网络方面的研究成果"
├─ "李飞飞如何推动计算机视觉发展"
├─ "李飞飞设计的 ImageNet 项目"
└─ "李飞飞对 AI 民主化的影响"
  ↓
各自检索 Top-10 → 合并去重 → RRF 融合 → Top-5 结果
```

**优势**：

- 多个角度覆盖更多相关段落
- 某个查询可能在某些段落的相似度计算上优于其他查询

**实现代码**：

```typescript
async function multiQueryExpansion(question: string): Promise<number[][]> {
  const expansionPrompt = `
给定以下问题，请生成 4 个从不同角度切入、表述不同但语义等价的查询。
每个查询单独成行。

原始问题：${question}

不同角度的查询：`;

  const expansionResult = await callLLM(expansionPrompt);
  const queries = expansionResult.split("\n").filter((q) => q.trim());

  // 各自向量化
  const vectors: number[][] = [];
  for (const q of queries) {
    const vec = await embeddings.embedQuery(q);
    vectors.push(vec);
  }

  return vectors;
}

// 使用
const queryVectors = await multiQueryExpansion("李飞飞的贡献");
// 对每个向量分别做检索，再用 RRF 融合排序
```

**成本**：+500ms（多个 LLM 调用 + Embedding），但召回覆盖率明显提升。

---

## 四、Layer 2：索引优化（Indexing Optimization）

**核心思想**：数据的存储和组织方式从根本上决定了检索效率和效果的上限。

### 4.1 分块策略对比与演进

书籍内容需要被切分成可向量化的小段。不同的切分策略影响巨大：

#### 方案 1：固定大小切块（当前方案）

```
原文 → 按 500 字切分 → Chunk 1 | Chunk 2 | Chunk 3 | ...
        ↓ 向量化
     向量库
```

**问题**：

- 可能在句子中间截断，"第10章李火旺..."被切成两个 Chunk，语义破碎
- 小 Chunk 信息量不足，容易与无关内容相似度接近

#### 方案 2：语义分块（Semantic Chunking）

先用语言模型判断文本的段落边界，按意义段落切分，而非按字符数。

```
原文 → 句子切分 → 段落检测 → 语义边界分块 → Chunk 1 | Chunk 2 | ...
```

**优势**：

- 完全尊重原文的语义边界
- 每个 Chunk 都是完整的思想单位

**成本**：建索引时需要 LLM 多次调用，成本高。

#### 方案 3：滑动窗口（Sliding Window）— 当前已部分采用

```
原文
 ├─ Chunk A (字0-500)      ← 包含字250-500
 ├─ Chunk B (字450-950)    ← 重叠 50 字，包含字250-500
 └─ Chunk C (字900-1400)   ← 重叠 50 字，包含字900-950
```

**作用**：防止重要信息在块的边界被切断。

#### 方案 4：父子分块（Parent-Child Chunking）⭐ 推荐

**这是当前业界最优方案**，分离检索精度和上下文完整性的需求：

```
原文（2000 字段落）
  │
  ├─ 父块（未向量化，仅存储）
  │   2000 字完整段落 → 喂给 LLM 提供完整上下文
  │
  ├─ 子块 1（200 字）→ 向量化 → 数据库
  ├─ 子块 2（200 字）→ 向量化 → 数据库
  ├─ 子块 3（200 字）→ 向量化 → 数据库
  └─ 子块 4（200 字）→ 向量化 → 数据库
      每个子块存储与父块的关联 ID
```

**检索流程**：

```
问题向量 → 匹配子块（精确定位，200字）
         ↓ 获取关联的父块 ID
         ↓ 从数据库取出对应的 2000 字父块
         ↓ 喂给 LLM（完整上下文）
```

**效果对比**：

| 方案        | 向量化粒度  | 喂给 LLM 的内容 | 精度  | 上下文完整性 |
| ----------- | ----------- | --------------- | ----- | ------------ |
| 500字固定块 | 500字       | 500字           | 中    | 中 ❌        |
| 语义分块    | 不定        | 不定            | 高    | 不定         |
| 父子分块    | 200字（精） | 2000字（完整）  | 高 ✅ | 高 ✅        |

**类比**：像图书馆里的目录索引和完整的书。目录（子块）帮你精确定位，但你实际读的是整个章节（父块）。

---

### 4.2 Metadata 增强与过滤

给每个 Chunk 附加结构化元数据，用于后续的过滤、排序和重排：

**建议的 Metadata 字段**：

```json
{
  "id": "dao-gui-yi-xian-ch3-p2",
  "bookSlug": "dao-gui-yi-xian",
  "chapterNumber": 3,
  "chapterTitle": "第三章：宗门试炼",
  "type": "main", // "main" | "appendix" | "introduction"
  "contentType": "narrative", // "narrative" | "dialogue" | "description"
  "wordCount": 487,
  "keywords": ["宗门", "试炼", "李火旺", "突破"],
  "sentiment": "action", // "calm" | "action" | "emotional"
  "chapterSummary": "李火旺初入宗门，面对严苛的试炼...",
  "importance": 0.8 // 0-1, 由专家标注或 LLM 评估
}
```

**使用方式 - 检索后重排**：

```typescript
function rerankWithMetadata(chunks: Chunk[], question: string): Chunk[] {
  const keywords = extractKeywords(question);

  return chunks
    .map((chunk) => {
      let score = chunk.rawCosineSimilarity;

      // 1. 类型权重：附录/导言降权
      if (chunk.metadata.type === "appendix") {
        score *= 0.7; // 附录可靠性较低
      } else if (chunk.metadata.type === "introduction") {
        score *= 0.85;
      }

      // 2. 长度权重：太短信息量不足
      if (chunk.metadata.wordCount < 100) {
        score *= 0.8;
      }

      // 3. 关键词命中加权
      const hitKeywords = keywords.filter(
        (k) => chunk.content.includes(k) || chunk.metadata.keywords.includes(k),
      ).length;
      if (hitKeywords > 0) {
        score *= 1 + hitKeywords * 0.15; // 每命中一个加 15%
      }

      // 4. 内容类型权重（对话通常比描述更具体）
      if (
        (chunk.metadata.contentType === "dialogue" &&
          question.includes("对话")) ||
        question.includes("说")
      ) {
        score *= 1.1;
      }

      // 5. 重要度权重（由 LLM 或专家预先评估）
      score *= 0.8 + chunk.metadata.importance * 0.4;

      return { ...chunk, adjustedScore: score };
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore);
}
```

**Metadata 的获取方式**：

```typescript
// 方式 1：构建索引时用 LLM 提取（初始成本高，但一次性）
async function extractMetadata(chunk: string): Promise<Metadata> {
  const prompt = `
请分析以下文本片段，提取关键元数据。返回 JSON 格式：

${chunk}

返回格式：
{
  "keywords": ["关键词1", "关键词2"],
  "contentType": "narrative|dialogue|description",
  "sentiment": "calm|action|emotional",
  "importance": 0.0-1.0
}`;

  const result = await callLLM(prompt);
  return JSON.parse(result);
}

// 方式 2：从原文结构直接解析（快速，但信息有限）
function extractMetadataFromStructure(
  chunk: string,
  chapterInfo: ChapterInfo,
): Metadata {
  const hasDialogue = chunk.includes("说") || chunk.includes('"');
  const importance = chunk.length / 500; // 简单启发式

  return {
    contentType: hasDialogue ? "dialogue" : "narrative",
    wordCount: chunk.length,
    importance: Math.min(importance, 1.0),
    ...chapterInfo,
  };
}
```

---

## 五、Layer 3：检索优化（Retrieval Optimization）

**核心问题**：当前瓶颈是用 Node.js 全表拉向量、O(n) 全表扫描。

### 5.1 迁移至 pgvector（P0 优先级）

**问题分析**：

```
当前流程：
  SELECT embedding FROM rag_documents  ← 6108 条，每条 1024 维
  网络传输 6108 × 1024 × 4字节 = 25MB 数据
  Node.js 计算 6108 次余弦相似度 = 8-9 秒 ⚠️

改进后：
  数据库内部计算，只返回 Top-5 结果 5 条记录
  网络传输几 KB
  < 100ms ✅
```

**迁移步骤**：

#### Step 1：开启 pgvector 扩展

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Step 2：修改字段类型

```sql
-- 当前字段类型
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'rag_documents' AND column_name = 'embedding';
-- 结果：embedding | ARRAY

-- 修改为 vector 类型
ALTER TABLE rag_documents
ALTER COLUMN embedding TYPE vector(1024)
USING embedding::vector(1024);
```

#### Step 3：创建高性能索引（HNSW）

```sql
-- HNSW 是分层图结构，查询时从粗层逐步精化，O(log n) 复杂度
CREATE INDEX rag_documents_embedding_hnsw
ON rag_documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 参数说明：
-- m = 16：每个节点最多 16 个邻边（更大 = 更精确但内存占用大）
-- ef_construction = 64：构建索引时的搜索范围（更大 = 构建更慢但质量更好）
```

**为什么选 HNSW 而非 IVFFlat**：

| 算法    | 原理                   | 优点                      | 缺点            | 适用场景                  |
| ------- | ---------------------- | ------------------------- | --------------- | ------------------------- |
| Flat    | 暴力全量比对           | 100% 精确                 | 速度慢 O(n)     | 数据量 < 10K              |
| IVFFlat | 先分桶再在桶内搜索     | 速度中等，内存小          | 需调参（nlist） | 数据量 10K-100K           |
| HNSW    | 多层图，粗定位逐层精化 | 速度快 O(log n)，准确度高 | 内存占用稍大    | 数据量 > 100K，当前最主流 |

#### Step 4：查询语法

```sql
-- 查询前 5 最相关的文档
SELECT
  id,
  content,
  metadata,
  1 - (embedding <=> $1::vector) AS score  -- <=> 是 pgvector 的距离操作符
FROM rag_documents
WHERE collection = $2
ORDER BY embedding <=> $1::vector
LIMIT 5;

-- <=> 的含义：计算两个向量间的欧氏距离
-- 距离越小 → 相似度越高
-- 1 - distance = 相似度分数（0-1）
```

**性能提升预测**：

```
当前：8-9 秒
预期：< 100ms

原因：
  - 网络传输：25MB → KB，提升 10000倍
  - 计算：全表 O(n) → HNSW O(log n)，提升 1000 倍
  - 总体：10-100 倍提升
```

**Node.js 迁移代码**：

```typescript
// 当前实现（全表拉取）
async function retrieveTopK_Current(queryVector: number[], k: number) {
  const { data: allChunks } = await supabase
    .from('rag_documents')
    .select('id,content,embedding')
    .eq('collection', bookSlug);

  // 在 Node.js 里计算所有相似度
  const scored = allChunks.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryVector, chunk.embedding)
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

// 改进实现（数据库内检索）
async function retrieveTopK_Improved(queryVector: number[], k: number) {
  const { data: topChunks } = await supabase.rpc(
    'search_documents',  // PostgreSQL 函数
    {
      query_vector: queryVector,
      collection_name: bookSlug,
      top_k: k
    }
  );

  return topChunks;
}

// 对应的 PostgreSQL 函数
CREATE OR REPLACE FUNCTION search_documents(
  query_vector vector,
  collection_name text,
  top_k int
)
RETURNS TABLE (id text, content text, metadata jsonb, score float8)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_vector) AS score
  FROM rag_documents d
  WHERE d.collection = collection_name
  ORDER BY d.embedding <=> query_vector
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql;
```

---

### 5.2 混合检索（Hybrid Search）—— 最主流方案

**核心问题**：纯向量检索对专有名词（人名、地名）不敏感。

```
向量检索的弱点：
  "李飞飞为什么去美国"
  → 向量：[...语义表示...]
  → 能理解"去" ≈ "移居" ≈ "前往"
  → 但可能错过直接提到"李飞飞"的段落（向量可能不够相似）

BM25 关键词检索的弱点：
  "李飞飞为什么去美国"
  → 分词：[李飞飞] [为什么] [去] [美国]
  → 能精确匹配包含这些词的段落
  → 但无法理解"移居美国" ≠ "去美国"（同义词）
```

**混合方案**：向量检索 + BM25 全文检索，结果用 RRF 融合。

#### 混合检索的工作流

```
用户问题
  ├─ 路线 A：向量检索
  │  ├─ embed(问题) → 向量
  │  ├─ pgvector 搜索 → Top-20 候选（按相似度排序）
  │  └─ 得到排名：[文档1, 文档5, 文档12, ...]
  │
  └─ 路线 B：BM25 全文检索
     ├─ 分词 + IDF 权重
     ├─ 全文索引搜索 → Top-20 候选（按关键词匹配度排序）
     └─ 得到排名：[文档2, 文档1, 文档8, ...]

合并结果用 RRF（Reciprocal Rank Fusion）融合
  ├─ 文档1：在路线A排名第1，路线B排名第2 → RRF = 1/61 + 1/62 = 0.0325
  ├─ 文档5：在路线A排名第2，路线B没命中 → RRF = 1/62 + 0 = 0.0161
  └─ 文档2：在路线A没命中，路线B排名第1 → RRF = 0 + 1/61 = 0.0164

最终排序：[文档1, 文档2, 文档5, ...] ← 文档1 得分最高（两路都靠前）
```

#### RRF 融合公式详解

```
RRF_score(doc_i) = Σ_j [ 1 / (k + rank_ij) ]

其中：
  k = 60（防止头部得分差异过大的平衡因子）
  rank_ij = 文档 i 在第 j 路检索中的排名
  Σ_j = 对所有检索路线求和

例子：
  文档 A：向量排名 1，BM25 排名 5
  RRF_A = 1/(60+1) + 1/(60+5) = 0.0164 + 0.0154 = 0.0318

  文档 B：向量排名 3，BM25 没命中
  RRF_B = 1/(60+3) + 0 = 0.0149

  → 文档 A 的 RRF 分数更高，排名靠前
```

#### Supabase 实现

```sql
-- Step 1：启用全文搜索扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2：创建 GiST 索引用于模糊匹配
CREATE INDEX rag_documents_content_gist
ON rag_documents
USING gist (content gist_trgm_ops);

-- Step 3：混合检索查询（RRF 融合）
WITH vector_results AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
  FROM rag_documents
  WHERE collection = $2
  LIMIT 20  -- 向量检索 Top-20
),
keyword_results AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY similarity(content, $3) DESC) AS rank
  FROM rag_documents
  WHERE collection = $2
    AND content % $3  -- % 操作符：trigram 相似度
  LIMIT 20  -- BM25 检索 Top-20
),
rrf_scores AS (
  SELECT
    COALESCE(v.id, k.id) AS id,
    COALESCE(1.0 / (60 + v.rank), 0) +
    COALESCE(1.0 / (60 + k.rank), 0) AS rrf_score
  FROM vector_results v
  FULL OUTER JOIN keyword_results k USING (id)
)
SELECT
  d.id,
  d.content,
  d.metadata,
  r.rrf_score
FROM rrf_scores r
JOIN rag_documents d ON d.id = r.id
ORDER BY r.rrf_score DESC
LIMIT 5;
```

#### Node.js 调用

```typescript
async function hybridSearch(
  queryText: string,
  bookSlug: string,
  topK: number = 5,
) {
  // 1. 向量检索
  const queryVector = await embeddings.embedQuery(queryText);
  const vectorResults = await supabase
    .from("rag_documents")
    .select("id,content,metadata")
    .eq("collection", bookSlug)
    .order("embedding", {
      operator: "<->", // pgvector 距离操作符
      foreignTable: queryVector,
    })
    .limit(20);

  // 2. 关键词检索（BM25）
  const { data: keywordResults } = await supabase.rpc("keyword_search", {
    query_text: queryText,
    collection_name: bookSlug,
    top_k: 20,
  });

  // 3. RRF 融合（在应用层做，或数据库函数）
  const rrf = await supabase.rpc("hybrid_search_rrf", {
    query_vector: queryVector,
    query_text: queryText,
    collection_name: bookSlug,
    top_k: topK,
  });

  return rrf;
}
```

**混合检索的优势**：

```
场景 1：人名查询 "李飞飞的童年"
  向量检索：可能找到 "张伟的小时候"（名字向量接近）❌
  BM25：精确匹配 "李飞飞"，排名靠前 ✅
  混合：BM25 命中加强，最终排名优化 ✅✅

场景 2：语义查询 "AI 大牛的成长故事"
  向量检索：理解 "大牛" ≈ "杰出人物"，匹配到相关内容 ✅
  BM25：可能找不到（没有 "大牛" 这个词组）❌
  混合：向量检索命中加强，最终排名优化 ✅✅
```

---

## 六、Layer 4：重排序（Reranking）

**思想**：粗召回追求高覆盖率（Recall），精排追求高准确度（Precision）。

### 6.1 Bi-Encoder vs Cross-Encoder

**Bi-Encoder（向量检索）**：

```
query 和 doc 分别编码：
  query_vector = embed_model(query)   ← 一次
  doc_vector = embed_model(doc)       ← 可预计算
  score = cosine(query_vector, doc_vector)

特点：
  ✅ 速度极快（可提前计算所有向量）
  ✅ 可建索引，O(log n) 检索
  ❌ query 和 doc 没有深度交互，精度有限
  用途：快速粗召回
```

**Cross-Encoder（精排）**：

```
query 和 doc 一起输入模型：
  score = model([query, doc])

特点：
  ✅ 精度高，query 和 doc 充分交互
  ❌ 速度慢，每次都要重新计算（不能预计算）
  用途：Top-20 精排序到 Top-5
```

**架构**：

```
粗召回（Bi-Encoder，快）
  ├─ 向量检索 → Top-50
  └─ BM25 → Top-50
         ↓ 合并去重 → Top-50 候选
         ↓
精排序（Cross-Encoder，慢但准）
  └─ Top-5 结果
```

### 6.2 推荐的 Cross-Encoder 模型

**本地开源模型**（无 API 调用成本）：

- `BAAI/bge-reranker-v2-m3`：中文效果好，470M 参数，可在 CPU 上运行
- `BAAI/bge-reranker-large`：英文优先，更大但效果最好

**商业 API**：

- `Cohere Rerank API`：按调用量付费，效果顶级
- `OpenAI Reranker`（待发布）

### 6.3 本项目当前的规则重排（Rule-based Reranking）

不用模型，用人工规则调整相似度分数，成本低但有限制：

```typescript
function rerankChunks(chunks: Chunk[], question: string): Chunk[] {
  const keywords = extractKeywords(question);

  return chunks
    .map((chunk) => {
      let score = chunk.rawCosineSimilarity;

      // 规则 1：内容类型权重
      if (chunk.metadata.type === "appendix") score *= 0.8;
      if (chunk.metadata.type === "main") score *= 1.0;

      // 规则 2：长度权重（太短信息量不足）
      const len = chunk.content.length;
      if (len < 100) score *= 0.7;
      if (len > 1000) score *= 1.05; // 长内容可能覆盖更多问题

      // 规则 3：关键词命中加权
      const hitKeywords = keywords.filter((k) => chunk.content.includes(k));
      if (hitKeywords.length > 0) {
        score *= 1 + hitKeywords.length * 0.15;
      }

      // 规则 4：章节权威性（开篇通常权威性高）
      if (chunk.metadata.chapterNumber <= 3) score *= 1.05;

      return { ...chunk, rerankScore: score };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore);
}
```

**限制**：

- 规则是人工定义，可能不够通用
- 权重系数（0.8, 0.7 等）是启发式的，不同场景可能不适用
- 改进空间大

---

## 七、Layer 5：上下文优化（Context Optimization）

**核心问题**：Top-5 结果直接拼接喂给 LLM，可能有噪声、冗余和"丢失中间"效应。

### 7.1 上下文压缩（Context Compression）

**现象**：5 个 Chunk（每个 500 字）= 2500 字喂给 LLM，其中可能只有 500 字与问题相关。

```
Top-5 检索结果
  Chunk 1：500 字，其中 100 字相关 ← 80% 噪声
  Chunk 2：500 字，其中 150 字相关 ← 70% 噪声
  Chunk 3：500 字，其中 80 字相关 ← 84% 噪声
  Chunk 4：500 字，其中 120 字相关 ← 76% 噪声
  Chunk 5：500 字，其中 50 字相关 ← 90% 噪声

总计：2500 字输入 → LLM 要从中筛选真正相关的 500 字
```

**压缩方案**：

#### 方案 A：LLM 提取（效果最好，成本高）

```typescript
async function compressContext(
  chunks: Chunk[],
  question: string,
): Promise<string> {
  const fullContext = chunks.map((c) => c.content).join("\n\n");

  const compressionPrompt = `
以下是与用户问题相关的原文段落集合。
请提取其中与问题最相关的核心信息，去除冗余和无关内容。
保留原文措辞，只做精简。

用户问题：${question}

原文段落：
${fullContext}

压缩后的相关内容（保留原文，只去除无关部分）：`;

  const compressedContext = await callLLM(compressionPrompt);
  return compressedContext;
}
```

#### 方案 B：关键句提取（速度快，准确度一般）

```typescript
function extractKeysentences(
  chunks: Chunk[],
  question: string,
  topN: number = 10,
): string[] {
  const keywords = extractKeywords(question);
  const sentences: Array<{ text: string; score: number }> = [];

  for (const chunk of chunks) {
    const chunkSentences = chunk.content.split(/[。！？\n]/);
    for (const sent of chunkSentences) {
      // 计算句子与问题的匹配度
      const keywordHits = keywords.filter((k) => sent.includes(k)).length;
      const score = keywordHits / keywords.length;

      if (score > 0) {
        sentences.push({ text: sent, score });
      }
    }
  }

  return sentences
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.text);
}
```

**成本-效益**：

- 方案 A（LLM）：+300ms，但回答准确度显著提升
- 方案 B（启发式）：无额外成本，但效果不稳定

---

### 7.2 Lost in the Middle 问题

**现象**（Liu et al., 2023）：LLM 对长上下文的"头部"和"尾部"更敏感，**中间内容容易被忽略**。

```
正常排列（不理想）：
  Chunk 1（最相关）   ← LLM 重视 ✅
  Chunk 2（第二）     ← LLM 关注 ✅
  Chunk 3（第三）     ← LLM 容易忽视 ❌ ← 中间的被丢失
  Chunk 4（第四）     ← LLM 关注 ✅
  Chunk 5（第五）     ← LLM 重视 ✅

优化排列（推荐）：
  Chunk 1（最相关）   ← 首位，LLM 重视 ✅
  Chunk 3（第三）     ← 中间相关度次
  Chunk 5（第五）     ← 末位，LLM 重视 ✅
  Chunk 4（第四）     ← 中间
  Chunk 2（第二）     ← 末位也重视
```

**实现方式**：

```typescript
function optimizeContextOrder(chunks: Chunk[]): Chunk[] {
  // 将相关性分数最高的放在首尾，次高的放中间
  const sorted = [...chunks].sort((a, b) => b.score - a.score);

  const result: Chunk[] = [];
  let left = 0;
  let right = sorted.length - 1;
  let turn = "left";

  while (left <= right) {
    if (turn === "left") {
      result.push(sorted[left++]);
      turn = "right";
    } else {
      result.push(sorted[right--]);
      turn = "left";
    }
  }

  return result;
}

// 效果演示
// 输入顺序（按分数）：[0.95, 0.82, 0.78, 0.75, 0.71]
// 输出顺序（首尾高）：[0.95, 0.78, 0.71, 0.75, 0.82]
//              ↑ 首   ↑ 中   ↑ 尾
```

---

## 八、完整优化架构（五层合并）

```
用户提问 "李飞飞为什么去美国？"
  │
  ├─ Layer 1 查询优化
  │  ├─ 查询改写："李飞飞赴美留学的原因、动机与决策过程"
  │  ├─ HyDE："假设答案"向量检索
  │  └─ 多查询扩展：生成 3 个不同角度
  │
  ├─ Layer 2 索引优化
  │  ├─ 父子分块：200字 child 检索，2000字 parent 喂 LLM
  │  └─ Metadata 增强：关键词、内容类型、重要度
  │
  ├─ Layer 3 检索优化
  │  ├─ pgvector HNSW：O(log n) 向量检索 < 10ms
  │  └─ 混合检索 + RRF 融合：向量 + BM25
  │     → Top-20 候选
  │
  ├─ Layer 4 重排序
  │  ├─ Cross-Encoder 精排（可选）
  │  └─ 规则重排：type/length/keyword 权重
  │     → Top-5 结果
  │
  └─ Layer 5 上下文优化
     ├─ 上下文压缩：2500字 → 800字
     └─ Lost-in-Middle 排列优化
        → 最终上下文

        │
        ▼ 喂给 LLM

        "李飞飞由于对物理学的热爱和追求科研梦想，
         在高中时期决定赴美深造。她成功申请进入
         普林斯顿大学，后来转入斯坦福大学，
         在那里开启了她对深度学习和计算机视觉的
         开创性研究......"

        ▼ LLM 生成回答

        "李飞飞之所以去美国，主要是为了追求物理学
         和计算机科学的研究梦想。她从小就对科学充满
         热情，通过进入顶尖美国大学，她得以从事
         开创性的人工智能研究，最终成为这个领域的
         先驱和领导者......"
```

---

## 九、落地优先级与成本-收益分析

| 优先级    | 优化项                 | 当前状态 | 预期收益                   | 实现成本                   | ROI        |
| --------- | ---------------------- | -------- | -------------------------- | -------------------------- | ---------- |
| 🔴 P0     | pgvector + HNSW        | 待实现   | 8-9s → <100ms，**质变**    | 修改 schema + SQL          | ⭐⭐⭐⭐⭐ |
| 🔴 P0     | 混合检索 RRF 融合      | 待实现   | 召回率提升 20-30%          | 中等，写 SQL + 应用层融合  | ⭐⭐⭐⭐   |
| 🟡 P1     | 父子分块重建索引       | 待实现   | 上下文完整性显著提升       | 重新构建索引（1-2小时）    | ⭐⭐⭐⭐   |
| 🟡 P1     | Cross-Encoder Reranker | 待实现   | 排序精度提升 15-20%        | 加载本地模型（470M）       | ⭐⭐⭐     |
| 🟡 P1     | Metadata 增强          | 待实现   | 过滤/重排更精准            | 低，修改 schema + LLM 提取 | ⭐⭐⭐     |
| 🟢 P2     | HyDE 查询扩展          | 待实现   | 语义匹配提升 10-15%        | +1 LLM 调用                | ⭐⭐       |
| 🟢 P2     | 多查询扩展             | 待实现   | 覆盖率提升 15%             | +3-4 LLM 调用 + Embedding  | ⭐⭐       |
| 🟢 P2     | 上下文压缩             | 待实现   | Token 消耗 -30%，噪声 -50% | +1 LLM 调用                | ⭐⭐       |
| 🟢 P2     | Context Reordering     | 待实现   | 回答质量微调               | 极低                       | ⭐         |
| ✅ 已实现 | Metadata type 降权     | 已实现   | 附录干扰 -80%              | 极低                       | ⭐⭐⭐     |
| ✅ 已实现 | Top-K 从 3 → 5         | 已实现   | 覆盖率 +20%                | 极低                       | ⭐⭐⭐     |

---

## 十、面试常见考点

### Q1：为什么 RAG 比 Fine-tuning 更适合你的场景？

| 维度         | RAG                    | Fine-tuning      |
| ------------ | ---------------------- | ---------------- |
| **知识更新** | 实时（加新书到向量库） | 需要重新训练     |
| **幻觉问题** | 回答有源可溯，减少幻觉 | 仍然存在         |
| **成本**     | 低（推理阶段检索）     | 高（GPU 训练）   |
| **灵活性**   | 极高（随时改索引）     | 低（固化在参数） |

**本项目答案**："这是一个知识库问答系统，用户可能随时加新书。RAG 能实时把新内容索引进去，用户第二天就能提问新书的内容。如果用 Fine-tuning，每加一本书都要重新训练一遍模型，成本太高。"

---

### Q2：为什么当前性能瓶颈在数据库检索，如何优化？

**当前问题**：全表拉向量到 Node.js，O(n) 全表扫描。

**优化方案**：

1. 用 pgvector 的 HNSW 索引，让数据库内部做向量检索，O(log n)
2. 性能从 8-9 秒降到 < 100ms，质变级别

**代码演示**：

```sql
CREATE INDEX ON rag_documents
USING hnsw (embedding vector_cosine_ops);

-- 查询时直接数据库内算 Top-5
SELECT content FROM rag_documents
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

---

### Q3：纯向量检索的弱点是什么，如何弥补？

**弱点**：对专有名词（人名、地名）不敏感。

- "李飞飞" 和 "张伟" 的向量可能相近（都是人名）
- 无法精确匹配

**弥补方案**：混合检索

- 向量检索：理解语义
- BM25 全文检索：精确匹配关键词
- RRF 融合：两路结果去重和排序

**效果**：两个弱点互补，最终结果更准确。

---

### Q4：Chunk Size 如何选择？

**经验值**：

- 中文叙事类（小说）：512-1000 字/块
- 技术文档：200-500 字/块
- 对话类：100-300 字/块

**最优方案**：父子分块

- 小块（200 字）：用于精确向量检索
- 大块（2000 字）：喂给 LLM 提供完整上下文
- 两全其美

---

### Q5：如何评估 RAG 系统质量？

**RAGAS 框架的三个核心指标**：

| 指标                               | 含义                         | 计算方式                                    |
| ---------------------------------- | ---------------------------- | ------------------------------------------- |
| **Faithfulness（忠实度）**         | 回答是否有依据（无幻觉）     | 让 LLM 判断每句话是否可从上下文推导         |
| **Answer Relevancy（答案相关性）** | 回答是否切题                 | 反向让 LLM 从回答生成问题，比对原问题相似度 |
| **Context Recall（上下文召回率）** | 检索结果是否包含答题所需信息 | 需要 Ground Truth 标注                      |

**本项目评估方法**：

```
构建人工标注集（50-100 个问题）
  ├─ 每个问题标注"正确的 Top-5 段落"（Ground Truth）
  ├─ 运行 RAG 系统，获取"检索到的 Top-5 段落"
  └─ 对比：
      Recall = 交集 / Ground Truth 数量
      Precision = 交集 / 检索结果数量
      F1 = 2 × Recall × Precision / (Recall + Precision)
```

---

_最后更新：2026-04-03_
