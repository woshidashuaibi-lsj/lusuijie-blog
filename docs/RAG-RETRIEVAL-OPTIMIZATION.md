# RAG 召回优化完整方案

> 基于本项目（《我看见的世界》AI 问答）的实践，整理业界成熟的 RAG 召回优化方法论。

---

## 一、问题诊断：为什么召回质量差？

```
用户问题 → Embedding → 向量检索 → Top-K → LLM 生成
              ↑                ↑
         语义理解弱        排序不准
```

召回质量差的根因链路：

**查询理解不足 → 检索粗糙 → 排序失准 → 上下文噪声 → 回答质量低**

本项目遇到的具体问题：
- Embedding 模型使用本地小模型（`bge-small-zh-v1.5`），语义区分度有限
- 全表拉取后在 Node.js 里计算余弦相似度，性能 O(n) 全表扫描
- 书评、目录等短内容与正文相似度分数接近，噪声干扰严重
- 没有重排序，纯相似度分数对短文本不公平

---

## 二、RAG Pipeline 五层优化方案

### 第一层：查询优化（Query Optimization）

#### 1.1 查询改写（Query Rewriting）

用户输入往往口语化、不完整，先用 LLM 改写成更适合检索的表达：

```
用户：李飞飞小时候咋样？
改写：李飞飞的童年成长经历、家庭背景与求学历程
```

实现思路：
```typescript
async function rewriteQuery(question: string): Promise<string> {
  const prompt = `请将以下用户问题改写为更适合文档检索的表达，保留核心语义，使用书面语：\n${question}`;
  return await callLLM([{ role: 'user', content: prompt }]);
}
```

#### 1.2 假设文档嵌入 HyDE（Hypothetical Document Embeddings）

核心思想：问题和答案在向量空间中分布不同，用"假设答案"的向量去检索比用"问题"的向量更准。

```
原始：embed("李飞飞童年经历？")     → 检索
HyDE：LLM 生成假设答案 → embed(假设答案) → 检索（更准确）
```

实现思路：
```typescript
async function hydeQuery(question: string): Promise<number[]> {
  const hypotheticalAnswer = await callLLM([{
    role: 'user',
    content: `请根据问题生成一段假设性的书中原文回答（100字左右）：${question}`
  }]);
  return await embeddings.embedQuery(hypotheticalAnswer);
}
```

#### 1.3 多查询扩展（Multi-Query）

一个问题生成 3-5 个不同角度的变体，分别检索再合并去重，提升召回覆盖率：

```
原始问题 → [变体1, 变体2, 变体3] → 分别检索 → 结果合并去重（RRF 融合）
```

---

### 第二层：索引优化（Indexing Optimization）

#### 2.1 分块策略对比

| 方案 | 原理 | 适用场景 | 推荐度 |
|---|---|---|---|
| 固定大小切块 | 按字符数切割 | 简单快速，基线方案 | ⭐⭐ |
| 语义分块 | 按段落/句子语义边界切 | 正文叙事类内容 | ⭐⭐⭐ |
| **父子分块** | 小块检索 + 大块喂 LLM | 需要精确检索+完整上下文 | ⭐⭐⭐⭐⭐ |
| 滑动窗口 | 块间有重叠（overlap） | 防止关键信息被切断 | ⭐⭐⭐ |

**父子分块（Parent-Child Chunking）** 是当前业界最优方案：

```
父块（2000字）→ 不向量化，仅存储，喂给 LLM 提供完整上下文
子块（200字） → 向量化，用于精确语义检索

检索流程：用子块找到最相关位置 → 返回对应父块内容给 LLM
```

#### 2.2 Metadata 增强

Metadata 是召回质量的重要杠杆，越丰富越好：

```json
{
  "chapterTitle": "Chapter 3",
  "type": "main",           // main / appendix，用于降权
  "chapterIndex": 2,        // 章节顺序，支持时序推理
  "wordCount": 13702,       // 字数
  "keywords": ["童年", "物理学", "移民"],  // LLM 预提取关键词
  "summary": "李飞飞青少年时期..."         // 章节摘要
}
```

---

### 第三层：检索优化（Retrieval Optimization）

#### 3.1 接入 pgvector 做数据库内向量检索（P0 优先级）

**当前问题**：把全表 embedding 拉到 Node.js 里计算，O(n) 全表扫描，极其低效。

**正确做法**：让数据库做向量检索，性能从 O(n) 变为 O(log n)。

```sql
-- Step 1: 开启 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: 修改 embedding 字段类型
ALTER TABLE rag_documents
ALTER COLUMN embedding TYPE vector(384);

-- Step 3: 创建 HNSW 索引（比 IVFFlat 更快更准）
CREATE INDEX ON rag_documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 4: 查询时直接数据库内计算 Top-K
SELECT content, metadata,
       1 - (embedding <=> $1::vector) AS score
FROM rag_documents
WHERE collection = 'wo-kanjian-de-shijie'
ORDER BY embedding <=> $1::vector
LIMIT 20;
```

#### 3.2 混合检索（Hybrid Search）← 当前最主流方案

**核心思想**：纯向量检索对关键词匹配弱（人名、地名），纯关键词检索对语义理解弱，混合两者取长补短。

```
向量检索（语义相似）→ Top-20
BM25 全文检索（关键词）→ Top-20
           ↓
        RRF 融合排序
           ↓
        融合 Top-20
```

**RRF（Reciprocal Rank Fusion）融合公式**：

```
RRF_score(doc) = Σ 1 / (k + rank_i)
```

其中 k=60（超参数，防止头部文档得分过高），rank_i 是该文档在第 i 路检索中的排名。

优势：不依赖各路检索的绝对分数，只看排名，避免分数量纲不一致问题。

Supabase 实现（利用 `pg_trgm` 做全文检索）：

```sql
-- 开启 trigram 扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 创建全文索引
CREATE INDEX ON rag_documents USING gin (content gin_trgm_ops);

-- 混合检索 SQL（向量 + 关键词，RRF 融合）
WITH vector_results AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
  FROM rag_documents WHERE collection = $2
  LIMIT 20
),
keyword_results AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY similarity(content, $3) DESC) AS rank
  FROM rag_documents WHERE collection = $2 AND content % $3
  LIMIT 20
)
SELECT d.id, d.content, d.metadata,
       COALESCE(1.0/(60+v.rank), 0) + COALESCE(1.0/(60+k.rank), 0) AS rrf_score
FROM rag_documents d
LEFT JOIN vector_results v ON d.id = v.id
LEFT JOIN keyword_results k ON d.id = k.id
WHERE v.id IS NOT NULL OR k.id IS NOT NULL
ORDER BY rrf_score DESC
LIMIT 5;
```

---

### 第四层：重排序（Reranking）

粗召回（向量/混合检索）追求**高召回率**，精排（Reranking）追求**高精确率**。

#### 4.1 Cross-Encoder Reranker

Bi-Encoder vs Cross-Encoder 对比：

```
Bi-Encoder（双塔模型）：
  embed(query) → 向量A
  embed(doc)   → 向量B
  score = cosine(A, B)
  优点：可预计算，检索快
  缺点：query 和 doc 独立编码，交互信息丢失

Cross-Encoder（交叉编码器）：
  input = [query, doc] → 同时输入
  score = model(query, doc)
  优点：深度交互，精度高
  缺点：不能预计算，速度慢（只适合精排）
```

典型流程：
```
粗召回 Top-50（Bi-Encoder，快）
       ↓
精排 Top-5（Cross-Encoder，慢但准）
       ↓
   输入 LLM
```

推荐模型：
- `BAAI/bge-reranker-v2-m3`（中文效果好，免费本地运行）
- `Cohere Rerank API`（商业服务，效果更好，按调用量付费）

#### 4.2 基于规则的后处理重排（当前项目已实现）

```typescript
function rerankWithRules(docs: Doc[], question: string): Doc[] {
  const keywords = extractKeywords(question); // 分词提取关键词

  return docs.map(doc => {
    let score = doc.rawScore;

    // 1. 内容类型权重（附录降权）
    if (doc.metadata.type === 'appendix') score *= 0.8;

    // 2. 内容长度权重（太短信息量不足）
    if (doc.content.length < 100) score *= 0.7;

    // 3. 关键词命中奖励
    const hitCount = keywords.filter(k => doc.content.includes(k)).length;
    score *= (1 + hitCount * 0.1);

    // 4. 章节权威性权重（可扩展）
    // if (doc.metadata.chapterIndex < 3) score *= 1.05; // 开篇章节权威性高

    return { ...doc, score };
  }).sort((a, b) => b.score - a.score);
}
```

---

### 第五层：上下文优化（Context Optimization）

#### 5.1 上下文压缩（Context Compression）

将 Top-5 结果直接拼接有时信息冗余，先提取相关片段再喂给 LLM：

```
原始检索结果（500字/块 × 5块 = 2500字）
         ↓ LLM 压缩提取（或 Extractive 模型）
压缩上下文（~500字，只保留与问题相关的句子）
         ↓
      输入 LLM 生成回答
```

#### 5.2 Lost in the Middle 问题

研究（Liu et al., 2023）表明：LLM 对上下文的"头部"和"尾部"更敏感，**中间的内容容易被忽略**。

解决方案：把最相关的文档放在**首位和末位**，次相关的放中间：

```typescript
function optimizeContextOrder(docs: Doc[]): Doc[] {
  // [最相关, 次相关..., 第二相关] 而非 [最相关, 第二相关, ...]
  const sorted = [...docs].sort((a, b) => b.score - a.score);
  const result = [];
  let left = 0, right = sorted.length - 1;
  let turn = 'left';
  while (left <= right) {
    if (turn === 'left') result.unshift(sorted[left++]);
    else result.push(sorted[right--]);
    turn = turn === 'left' ? 'right' : 'left';
  }
  return result;
}
```

---

## 三、完整优化后的架构图

```
┌─────────────────────────────────────────────────────┐
│                    用户提问                           │
└─────────────────────┬───────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              【查询层】Query Optimization             │
│  • 查询改写（口语 → 书面语）                          │
│  • HyDE（生成假设答案再检索）                         │
│  • 多查询扩展（生成多个变体）                         │
└─────────────────────┬───────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              【检索层】Hybrid Retrieval               │
│  向量检索（pgvector HNSW）  +  BM25 全文检索          │
│                    ↓ RRF 融合                        │
│                  Top-20 候选                         │
└─────────────────────┬───────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              【重排层】Reranking                      │
│  Cross-Encoder 精排 + 规则后处理（类型/关键词权重）    │
│                  Top-5 结果                          │
└─────────────────────┬───────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              【上下文层】Context Optimization         │
│  • 上下文压缩（去除冗余）                             │
│  • Lost in the Middle 排列优化                       │
└─────────────────────┬───────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              【生成层】LLM Generation                 │
│  结构化 Prompt + 引用来源 + 置信度说明                │
└─────────────────────────────────────────────────────┘
```

---

## 四、针对本项目的落地优先级

| 优先级 | 优化项 | 预期收益 | 实现成本 | 状态 |
|---|---|---|---|---|
| 🔴 P0 | 接入 pgvector，数据库内向量检索 | 性能质变（O(n)→O(logn)） | 改 schema + rag.ts | 待实现 |
| 🔴 P0 | 混合检索（向量 + BM25 + RRF） | 召回率大幅提升 | 中等 | 待实现 |
| 🟡 P1 | 父子分块重建索引 | 上下文质量明显提升 | 重建索引 | 待实现 |
| 🟡 P1 | Cross-Encoder Reranker | 排序精度提升 | 加本地模型 | 待实现 |
| 🟡 P1 | Metadata 增强（关键词/摘要） | 过滤和重排更精准 | 低 | 待实现 |
| 🟢 P2 | HyDE 查询扩展 | 语义匹配提升 | 多一次 LLM 调用 | 待实现 |
| 🟢 P2 | 上下文压缩 | 减少噪声，提升回答质量 | 多一次 LLM 调用 | 待实现 |
| ✅ 已完成 | Metadata type 字段 + 降权 | 附录内容不再干扰正文检索 | 低 | 已实现 |
| ✅ 已完成 | Top-K 从 3 提升到 5 | 增加召回多样性 | 极低 | 已实现 |

---

## 五、面试常见考点

### Q1：RAG 和 Fine-tuning 怎么选？

| 维度 | RAG | Fine-tuning |
|---|---|---|
| 知识更新 | 实时，改向量库即可 | 需重新训练 |
| 幻觉问题 | 有依据，可引用来源 | 仍然存在 |
| 成本 | 低（推理时检索） | 高（训练成本） |
| 适用场景 | 知识密集型问答 | 特定风格/任务适配 |

**结论**：知识库问答优先 RAG，风格/能力适配考虑 Fine-tuning，最优是 RAG + Fine-tuning 结合。

### Q2：向量检索为什么不准？

1. **Embedding 模型能力不足**：小模型语义理解有限
2. **查询和文档分布不对齐**：问题短，文档长，向量空间不同
3. **分块不合理**：关键信息被切断，或块太小信息量不足
4. **没有重排序**：Top-K 排序不等于真正相关度排序

### Q3：为什么要用混合检索？

向量检索的弱点：
- 对专有名词、人名、地名等不敏感（"李飞飞"可能被映射到与"张伟"相近的向量）
- 依赖 Embedding 模型的训练分布

BM25 的弱点：
- 无法理解同义词和语义关系
- "移民美国" 无法匹配 "前往美利坚"

混合检索互补，RRF 融合不依赖分数绝对值，只看排名，稳定性更好。

### Q4：Chunk Size 怎么选？

- 太小：信息不完整，上下文丢失
- 太大：引入噪声，超出 LLM 上下文窗口

工程经验：
- 中文叙事类：512-1000 字/块，overlap 50-100 字
- 技术文档：200-500 字/块
- 最优方案：父子分块，检索用小块（200字），生成用大块（1000-2000字）

### Q5：如何评估 RAG 系统质量？

**三个核心指标**（RAGAS 框架）：

| 指标 | 含义 | 评估方法 |
|---|---|---|
| **Faithfulness（忠实度）** | 回答是否有检索内容支撑（无幻觉） | LLM 判断每句话是否可从上下文推导 |
| **Answer Relevancy（答案相关性）** | 回答是否切题 | 对回答反向生成问题，与原问题比相似度 |
| **Context Recall（上下文召回率）** | 检索结果是否覆盖了正确答案所需信息 | 需要 Ground Truth 标注 |

---

*最后更新：2026-03-31*
