# 面试手册：个人博客 Book 模块

> 覆盖项目「书单 AI 问答 + 角色扮演 + 小说创作工坊」的全部高频面试考点。  
> 结构：先给**简洁回答**，再给**追问展开**，最后标注**踩过的坑**（最有说服力的部分）。

---

## 一、项目整体介绍（30秒版）

> **面试官问**：介绍一下这个项目

个人博客的书单模块，做了三个核心功能：
1. **RAG 问答**：把书的内容向量化存库，用户提问时检索最相关段落 + LLM 生成回答，解决 LLM 不了解私有书籍的问题
2. **角色扮演**：AI 用第一人称扮演书中角色，支持读者提问模式和玩家扮演模式（两个角色互动）
3. **小说创作工坊**：五步向导（构思→世界观→人物→情节→风格）+ 章节生成，集成伏笔追踪和 Story Bible 记忆系统

技术栈：Next.js 静态导出前端（OSS 托管）+ Express 独立后端（ECS）+ Supabase PostgreSQL + MiniMax LLM + 阿里云 DashScope Embedding。

---

## 二、RAG 核心原理

### Q: 什么是 RAG？解决什么问题？

**RAG = Retrieval-Augmented Generation（检索增强生成）**

LLM 的三个固有问题和对应解法：

| 问题 | RAG 的解法 |
|------|-----------|
| 不知道私有书籍内容 | 把书向量化存入数据库，变成可检索知识库 |
| 容易幻觉（自信地编造） | 把真实原文段落塞进 Prompt，要求基于原文回答 |
| 上下文窗口装不下整本书 | 只检索最相关的 Top-5 段落，节省 token |

**核心思路**：LLM 负责"理解和表达"，数据库负责"记忆和检索"。不是让 LLM 记住所有内容，而是每次问答时临时检索。

---

### Q: RAG 的三个阶段分别是什么？

**阶段一：索引（离线，只做一次）**
```
epub → Python 脚本解析纯文本
    → LangChain RecursiveCharacterTextSplitter 分块（500字/块，50字重叠）
    → DashScope text-embedding-v3 向量化（1024维）
    → 写入 Supabase PostgreSQL（rag_documents 表）
《道诡异仙》1043章 → 6108 个 chunk，构建约 30 分钟
```

**阶段二：检索（每次问答时）**
```
用户问题 → embedQuery → 1024维向量（约200ms）
→ 全量拉取 rag_documents WHERE collection = bookSlug
→ Node.js 内存中手动计算余弦相似度
→ 取 Top-5 最相关段落（约 8-9 秒，当前瓶颈）
```

**阶段三：生成（每次问答时）**
```
人设文件 + Top-5段落 + 用户问题 → 组装 System Prompt
→ MiniMax M2.7 流式生成回答
→ SSE 推送到前端逐字渲染
```

---

### Q: 文本切块为什么要有 overlap？参数怎么选的？

**为什么要 overlap**：如果一段话在边界被切断，Chunk A 末尾和 Chunk B 开头各自语义不完整。加 50 字重叠后，相邻两个 chunk 都包含中间那段文字，确保语义连续性。

**chunkSize 的选择逻辑**：
- 太小（< 100）：信息量不足，检索到的内容过于碎片
- 太大（> 1000）：一个 chunk 包含多个话题，向量被"平均"，相似度计算变准；占用更多 token
- **中文书籍 500 字**：大约一段完整情节描写，语义单元合适

**RecursiveCharacterTextSplitter 的切割优先级**：先在 `\n\n` 切，再 `\n`，再 `。！？`，尽量在语义边界切，而不是硬截字符。

---

### Q: 向量相似度为什么用余弦相似度，不用欧氏距离？

**余弦相似度**只关心向量的方向（语义），不关心长度（词数）。一句话和一段话如果语义相同，欧氏距离会因为长度不同而被拉大，但余弦相似度仍然接近 1。对于语义检索，方向比长度更重要。

```typescript
// 单次遍历计算，O(n) 时间复杂度
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
// 最后才开根号，而不是每次循环都开，性能更好
```

---

### Q: 为什么不用 pgvector 的 <=> 操作符做向量检索？

Supabase 建表时 `embedding` 字段是 `REAL[]`（普通 PostgreSQL 数组），没有安装 `pgvector` 扩展，`vector` 类型不存在，`<=>` 操作符也不可用。当时为了快速上线选择了全量拉取到 Node.js 内存计算。

**当前状态**：6108 条数据，全量计算约 8-9 秒，是整条链路最慢的环节。

**未来优化路径**：Supabase 开启 pgvector → 字段从 `REAL[]` 迁移为 `vector(1024)` → 改用 SQL 侧 HNSW 索引检索，耗时可降到 < 100ms。

---

## 三、SSE 流式输出

### Q: 为什么用 SSE，不用 WebSocket 或普通 HTTP？

| 方案 | 分析 |
|------|------|
| 普通 HTTP | 要等 AI 全部生成完才返回，用户等待 10+ 秒白屏，体验极差 |
| WebSocket | 双向通信，对单向推流过重；需要额外管理连接状态 |
| SSE | 单向服务端推送，天然适合 AI 逐字输出；HTTP 协议，零额外依赖 |

---

### Q: 前端为什么不用原生 EventSource，而用 fetch + ReadableStream？

**原生 EventSource 的致命限制**：只支持 GET 请求，无法自定义请求体。本项目需要 POST 发送 `{ question, bookSlug, characterId }`，所以必须手动实现。

---

### Q: SSE 的 buffer 拼接为什么必要？怎么实现的？

**问题根源**：网络传输是字节流，一条 SSE 消息可能被拆成多次 `read()` 到达，不能对每次结果直接解析。

```
第一次 read() → 'event: delta\ndata: {"text":"你'   ← JSON 不完整
第二次 read() → '好"}\n\n'
```

**实现**：
```typescript
const decoder = new TextDecoder();
let buf = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // stream: true → 告诉解码器"这不是最后一块"，防止中文多字节截断
  buf += decoder.decode(value, { stream: true });

  const lines = buf.split('\n');
  buf = lines.pop() ?? '';  // 最后一行可能是半截，留到下次拼接

  let eventName = '';
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const data = JSON.parse(line.slice(5).trim());
      // ... 处理 delta / done / error
      eventName = '';  // 处理完 data 行，重置 eventName
    }
  }
}
```

**关键细节**：
- `decode(value, { stream: true })` → 防止中文多字节字符在字节边界被截断
- `lines.pop()` 留尾巴 → 不完整的最后一行等下次拼接
- `eventName` 在 `data` 行处理后重置 → 每条 SSE 消息由 event + data 两行组成

---

### Q: 为什么思考过程和正式回答要分开处理？

**MiniMax M2.7 是推理模型**，SSE 流里同时返回两个字段：
- `delta.reasoning_content`：内部思考过程
- `delta.content`：最终输出给用户的内容

旧代码用 `||` 合并，思考过程直接混入对话，用户看到的是"用户问你嫂妇是谁，这是在问……根据背景信息……"。

**修复**：后端推送时加 `type` 字段区分，前端 `Message` 新增 `thinking` 字段单独存储，渲染为可折叠的 💭 胶囊，不污染正式回答。

```typescript
// 后端分开推送
if (thinkingDelta) send('delta', { text: thinkingDelta, type: 'thinking' });
if (answerDelta)   send('delta', { text: answerDelta,   type: 'answer' });
```

---

## 四、架构与选型决策

### Q: 为什么用 ECS，不用 Serverless（函数计算 FC）？

原本考虑 FC（按调用计费，零运维），放弃的根本原因：

1. **包体积超限**：最初用 HuggingFace 本地 Embedding 模型，`node_modules` 达到 559MB，FC 单包上限 500MB，直接超标
2. **冷启动体验差**：RAG 链路本身就需要 8-10 秒（向量检索 + LLM），再加 FC 冷启动 2-5 秒，用户体验不可接受
3. **SSE 长连接不稳定**：FC 早期对 SSE 长连接支持不稳定，函数执行时间有上限
4. **持久化文件不支持**：角色人设文件需要持久存储，FC 没有本地文件系统

**最终方案**：阿里云 ECS 2核2G，PM2 守护进程，约 50 元/月。

---

### Q: Embedding 为什么从 HuggingFace 本地模型换成 DashScope API？

| 问题 | 说明 |
|------|------|
| HuggingFace 被墙 | 国内 ECS 无法访问 huggingface.co，模型文件无法下载，报 `fetch failed` |
| 内存压力大 | ONNX 模型需加载到内存，bge-small-zh-v1.5 约 90MB，2G 内存 ECS 压力大 |
| CPU 推理极慢 | 没有 GPU，6000+ chunk 的构建完全不可行 |
| 包体积膨胀 | 导致整体 node_modules 559MB，超出 FC 部署限制 |

**DashScope text-embedding-v3**：国内直连，1024维，中文效果好，按量计费。

---

### Q: 静态导出后 API Routes 为什么失效？怎么解决的？

Next.js `output: 'export'` 是纯静态站点，部署到 OSS（对象存储）只能托管静态文件，无法运行 Node.js，`/pages/api/` 目录在构建时根本不会生成。

**解决**：把 RAG 逻辑抽成独立的 `fc-api` Express 服务，部署到 ECS，前端通过 `NEXT_PUBLIC_API_BASE` 环境变量指向它。这也是最终形成"前端 OSS + 后端 ECS"架构的原因。

---

## 五、角色扮演系统

### Q: 角色人设是怎么自动提取的？

**流程（只需执行一次，结果持久化到文件）**：

1. 取书的前 30 章，每章截取前 800 字避免 token 过多
2. 用更聪明的方式：**RAG 反向检索**——先用几个描述性问题（"李火旺说话的方式""他面对危险时的反应"）检索向量库，找出最具代表性的 15-20 个原文段落
3. 把这些片段喂给 LLM，让它总结角色的身份、性格特征、说话风格、口头禅
4. 结果存入 `fc-api/data/personas/{slug}.txt`，后续每次对话自动读取

**三级优先级**：
```
已保存的 persona 文件（AI 自动提取）
  ↓ 不存在
BOOK_CONFIGS 里的 fallbackPersona（手写兜底）
  ↓ roleplay 未开启
普通 AI 助手模式
```

---

### Q: 玩家扮演模式和读者模式有什么区别？

| 维度 | 读者模式 | 玩家扮演模式 |
|------|---------|------------|
| 玩家身份 | 普通读者（"你"） | 扮演书中某个角色 |
| AI 身份 | 扮演书中某角色 | 扮演另一个角色 |
| System Prompt | 单角色人设 + 上下文 | 双角色人设（AI 角色知道玩家是谁）|
| 典型用法 | 问李火旺书中情节 | 扮演丹阳子和李火旺对话 |

**双角色 Prompt 关键设计**：AI 人设里明确告知"对方（玩家）是谁"，以及对方的性格特征，让 AI 的回应符合两个角色的关系背景。

---

## 六、踩坑记录（面试最有价值的部分）

### 坑 1：`fetch failed` —— 极具迷惑性的错误

**现象**：请求返回 200，EventStream 里没有任何事件，前端显示 `⚠️ fetch failed`。用 curl 直接调 MiniMax 完全正常。

**误判过程**：以为是 MiniMax 限流 → 不是；以为是网络问题 → curl 正常；以为是 pg 查询超时导致 socket 被关闭。

**真正原因**：服务器上的 `embeddings.js` 是历史旧版本（手动 scp 漏传了），里面还在用 HuggingFace 模型，国内 ECS 访问不了 huggingface.co，TCP 连接超时，undici 把它包装成 `TypeError: fetch failed`。错误消息和调 MiniMax 失败完全一样，极难区分。

**定位方法**：打印完整 `e.stack` 而不是只看 `e.message`，堆栈里能看到调用链经过了 `@huggingface/transformers`。

**教训**：`scp` 单文件部署容易漏传，要一次性同步整个 `src/` 再编译。遇到 `fetch failed` 必须看完整调用链。

---

### 坑 2：pgvector `<=>` 操作符不可用

**现象**：尝试用 SQL 侧向量检索优化性能，立刻报 `type "vector" does not exist`。

**原因**：建表时用的是 `REAL[]`（普通数组），没有安装 pgvector 扩展，`vector` 类型不存在。

**处置**：回退为 Node.js 内存余弦计算，记录为技术债，待数据量超过 10 万条时再迁移。

---

### 坑 3：思考过程混入对话

**现象**：AI 回答开头出现大段"根据用户的问题，我应该……"的分析推理。

**原因**：MiniMax M2.7 是推理模型，`reasoning_content`（思考）和 `content`（回答）同时在流里返回，旧代码用 `||` 合并了两者。

**修复**：后端区分推送 `type: thinking / answer`，前端分开渲染，思考过程作为可折叠区块展示。

---

### 坑 4：SSE error 事件被内层 catch 吞掉

**现象**：后端发了 `event: error`，前端没有任何错误提示，沉默失败。

**原因**：SSE 解析循环里有嵌套 `try/catch`（处理 JSON.parse 失败），在 `error` 事件里直接 `throw` 被内层 catch 吃掉了。

**修复**：用变量收集错误，流结束后在 try/catch 外层统一抛出：
```typescript
let serverError: string | null = null;
// 循环内只收集，不 throw
if (eventName === 'error') serverError = data.message;
// 流结束后统一抛出
if (serverError) throw new Error(serverError);
```

---

### 坑 5：等待期出现两个 AI 气泡

**现象**：发送问题后，界面同时显示「三点打字动画」和「空内容气泡」。

**原因**：发请求时预先 push 了空 assistant 消息占位，同时打字动画的条件渲染也满足，两者共存。

**修复**：不预先插入，等收到第一个 `delta` 时才插入 assistant 消息，打字动画只在 `loading && !streaming && 最后一条非assistant` 时显示。

---

### 坑 6：PM2 重启后环境变量不更新

**现象**：修改 `.env` 后 `pm2 restart all`，新变量不生效。

**原因**：`restart` 只重启进程，不重新读取环境变量。

**修复**：`pm2 restart all --update-env`

---

### 坑 7：CORS 跨域（http vs https 是不同 Origin）

**现象**：本地正常，线上浏览器报 CORS 错误。

**原因**：博客有 `http://` 和 `https://` 两个版本，CORS 白名单只加了 `https://`，一字之差被拒绝。

**修复**：白名单同时加两个版本。

---

## 七、可深入展开的加分点

### ANN vs 全量检索

| 方式 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 全量暴力搜索（当前） | 逐一计算余弦相似度 | 结果100%精确 | 随数据量线性增长 |
| ANN（近似最近邻） | HNSW/IVFFlat 索引，只看"附近的桶" | 毫秒级，不随量增长 | 结果是近似值 |

本项目 6108 条耗时 8-9 秒，可接受。超过 10 万条应迁移 pgvector + HNSW。

---

### RAG 优化方向（能体现技术视野）

**检索侧**：
- **混合检索（Hybrid Search）**：向量检索 + BM25 关键词检索结果融合，弥补纯向量对专有名词的检索弱点
- **重排序（Reranking）**：先检索 Top-20，再用 Cross-Encoder 模型重排序取 Top-5，精度更高
- **HyDE**：先让 LLM 生成"假设答案"，用假设答案的向量去检索，比用原始问题检索更准
- **父文档检索**：小 chunk 用于精确匹配，命中后返回包含它的大 chunk 给 LLM，平衡精度和信息量

**附录降权**：当前代码里附录类 chunk 乘以 0.8 惩罚系数，防止目录、注释类内容干扰检索结果，是一个简单有效的工程优化。

---

### 小说创作工坊的技术亮点

- **Story Bible 记忆系统**：每次生成章节前，把人物档案、伏笔列表、已发生情节的摘要压缩成结构化上下文注入 System Prompt，解决 LLM 上下文窗口有限、长篇创作前后矛盾的问题
- **IndexedDB 自动保存**：800ms debounce，防止页面刷新或 crash 丢失创作数据，对比 localStorage 支持更大存储量
- **伏笔追踪系统**：每个伏笔有状态（planted/hinted/revealed），章节写作时可勾选关联伏笔，生成提示词中自动注入伏笔待解决状态
- **SSE 章节生成**：和 RAG 问答复用同一套前端 ReadableStream 解析机制，流式逐字展示生成过程，用户可中途停止

---

## 八、数据库结构（备查）

```sql
CREATE TABLE rag_documents (
  id         TEXT PRIMARY KEY,   -- "{bookSlug}-doc-{n}"，多书隔离
  collection TEXT NOT NULL,      -- bookSlug，用于 WHERE 过滤
  content    TEXT NOT NULL,      -- 切割后的文本 chunk（约 500 字）
  metadata   JSONB,              -- { chapterTitle: "第9章", type: "main" }
  embedding  REAL[],             -- 1024 维浮点向量
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rag_documents_collection ON rag_documents(collection);
```

---

## 九、一句话总结各技术决策

| 决策 | 一句话理由 |
|------|-----------|
| ECS 而非 FC | 包体积超限 + SSE 长连接 + 冷启动不可接受 |
| DashScope 而非本地模型 | 国内 ECS 访问 HuggingFace 被墙，CPU 推理太慢 |
| fetch+ReadableStream 而非 EventSource | EventSource 不支持 POST 请求 |
| Node.js 余弦计算而非 pgvector | 建表时未开 pgvector 扩展，数据量可接受 |
| SSE 而非 WebSocket | 单向推流不需要双向通信，HTTP 协议零依赖 |
| 人设文件持久化而非每次生成 | 提取一次约 2 分钟，持久化复用，避免重复消耗 token |
