# 书籍 AI 问答系统（RAG + 角色扮演）

> 记录博客书单模块的 AI 问答实现原理，包括 RAG 架构、流式输出、角色扮演人设自动提取的完整设计。

---

## 一、整体架构

```
用户提问
    │
    ▼
前端 BookChat 组件（SSE 流式接收）
    │
    ▼
后端 Express API（47.94.103.221:3001）
    │
    ├─① Embedding：DashScope 将问题向量化
    ├─② 检索：Supabase pgvector 余弦相似度匹配 Top-5 段落
    ├─③ 人设：读取 data/personas/{bookSlug}.txt
    ├─④ 组装 System Prompt（角色扮演 or 普通助手）
    └─⑤ 流式调用 MiniMax-M2.7 生成回答（SSE）
            │
            ▼
    前端逐字渲染 + 引用来源展示
```

---

## 二、数据预处理流程（一次性）

新增一本书时，按顺序执行以下步骤：

### 1. 提取 epub 内容

```bash
python3 scripts/extract_epub.py "书名.epub" "src/data/{slug}.json"
```

- 提取所有 HTML 章节，清理标签，保留纯文本
- 输出格式：`{ chapters: [{ title, content }] }`

### 2. 格式化段落

```bash
node scripts/format-book-content.js
```

- 将 `。 ` / `！ ` / `？ ` 后跟中文的位置替换为 `\n\n`
- 确保 BookReader 阅读器能正确分段展示
- 同时处理 `src/data/` 和 `fc-api/data/` 两处文件

### 3. 添加到书单

运行 `scripts/add-{slug}.js`（或手动更新 `src/data/books.json`），填写：

```json
{
  "slug": "dao-gui-yi-xian",
  "title": "道诡异仙",
  "author": "狐尾的笔",
  "cover": "https://...",
  "rating": 9.3,
  "myComment": "...",
  "chapters": [...]
}
```

### 4. 构建向量库

```bash
curl -X POST http://47.94.103.221:3001/api/rag/build \
  -H "Content-Type: application/json" \
  -d '{"bookSlug":"dao-gui-yi-xian"}'
```

- 使用 `RecursiveCharacterTextSplitter`（chunkSize=500, overlap=50）切割章节
- 每个 chunk 调用 DashScope Embedding API 转为 1536 维向量
- 批量（5个一批）写入 Supabase `rag_documents` 表
- ID 格式：`{bookSlug}-doc-{序号}`，避免不同书之间冲突
- 进度日志：`[dao-gui-yi-xian] 构建进度: 460/6108`

### 5. 提取角色人设

```bash
curl -X POST http://47.94.103.221:3001/api/rag/extract-persona \
  -H "Content-Type: application/json" \
  -d '{"bookSlug":"dao-gui-yi-xian","sampleCount":30}'
```

- 取前 N 章（每章前 800 字）发给 MiniMax
- AI 总结角色性格、说话风格、口头禅、面对不知道时的处理方式
- 结果存入 `fc-api/data/personas/{bookSlug}.txt`
- 之后每次问答自动读取，无需重新生成

---

## 三、RAG 查询流程（每次提问）

```
问题："你师傅丹阳子是什么人？"
    │
    ▼
① embedQuery(question) → [0.23, -0.51, 0.88, ...]
    │
    ▼
② SELECT * FROM rag_documents WHERE collection = 'dao-gui-yi-xian'
   对每条记录计算余弦相似度，取 Top-5
    │
    ▼
③ 组装 context：
   [来源 1] 章节：第9章黑太岁
   丹阳子那冷冰冰的声音响起...
   ---
   [来源 2] 章节：第1章师傅
   癞子头师傅当着我的面...
    │
    ▼
④ 读取 personas/dao-gui-yi-xian.txt（AI 提取的人设）
    │
    ▼
⑤ 组装 System Prompt：
   {persona}
   以下是你（李火旺）在书中相关经历的片段：
   {context}
   请以李火旺的口吻，用第一人称回答。
    │
    ▼
⑥ callLLMStream(messages) → MiniMax SSE 流
```

---

## 四、流式输出（SSE）设计

### 后端推送事件（`index.ts`）

| 事件名 | 数据格式 | 说明 |
|--------|----------|------|
| `sources` | `[{chapterTitle, excerpt, score}]` | 检索到的引用来源，先于 delta 发出 |
| `delta` | `{text: "..."}` | AI 生成的文字片段，逐块推送 |
| `done` | `{}` | 流式完成信号 |
| `error` | `{message: "..."}` | 错误信息（限流、网络等） |

### 前端消费逻辑（`BookChat/index.tsx`）

```
收到 sources → 暂存 pendingSources
收到第一个 delta → 插入空 assistant 消息（消除等待期双气泡）
每个 delta → 追加到最后一条 assistant 消息的 content
收到 done → 将 pendingSources 附加到最后一条消息
收到 error → 替换或新增错误气泡（⚠️ 提示）
```

### 重试机制

后端对 MiniMax 限流错误（`status_code: 2064`）最多重试 3 次，每次间隔 1 秒：

```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  try { ... } catch (err) {
    if (err.message.startsWith('MiniMax 限流')) continue; // 重试
    break; // 其他错误直接退出
  }
}
```

---

## 五、角色扮演人设系统

### 人设优先级

```
fc-api/data/personas/{bookSlug}.txt  ← AI 自动提取（优先使用）
         ↓ 不存在时
BOOK_CONFIGS[bookSlug].roleplay.fallbackPersona  ← 手写兜底
         ↓ 未开启角色扮演时
普通 AI 助手模式
```

### 人设文件示例（`personas/dao-gui-yi-xian.txt`）

```
你现在是李火旺，一个游走于现实与幻觉之间的精神病患者，同时也是一个心怀仇恨、隐忍待发的复仇者。

- 你患有严重的幻觉感知综合障碍，会在精神病房与古代道观之间不断穿梭...
- 你的性格坚韧隐忍，懂得在强者面前隐藏锋芒...
- 你重情重义，对青梅竹马杨娜有着纯粹的爱情...
...
口头禅：「我没病」「冷静冷静」「癞子头」
```

### 查询当前人设来源

```bash
curl "http://47.94.103.221:3001/api/rag/persona-status?bookSlug=dao-gui-yi-xian"
# 返回：{ hasSaved: true, source: "extracted", persona: "..." }
```

---

## 六、API 接口一览

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| POST | `/api/rag` | `{question, bookSlug}` | 普通问答（非流式） |
| POST | `/api/rag/stream` | `{question, bookSlug}` | 流式问答（SSE） |
| POST | `/api/rag/build` | `{bookSlug}` | 构建/重建向量库 |
| POST | `/api/rag/extract-persona` | `{bookSlug, sampleCount}` | 从书中自动提取人设 |
| GET  | `/api/rag/persona-status` | `?bookSlug=` | 查询当前人设来源 |
| GET  | `/health` | — | 健康检查 |

---

## 七、数据库结构（Supabase）

```sql
CREATE TABLE rag_documents (
  id         TEXT PRIMARY KEY,        -- "{bookSlug}-doc-{n}"
  collection TEXT NOT NULL,           -- bookSlug，用于多书隔离
  content    TEXT NOT NULL,           -- 切割后的文本 chunk
  metadata   JSONB,                   -- { chapterTitle, type }
  embedding  vector(1536)             -- DashScope text-embedding-v3
);
CREATE INDEX ON rag_documents USING ivfflat (embedding vector_cosine_ops);
```

---

## 八、新增书籍 Checklist

```
□ 1. epub 放到项目根目录
□ 2. python3 scripts/extract_epub.py "xxx.epub" "src/data/{slug}.json"
□ 3. node scripts/format-book-content.js（更新脚本后运行）
□ 4. 将书籍信息添加到 src/data/books.json
□ 5. 复制 JSON 到 fc-api/data/{slug}.json
□ 6. 在 fc-api/src/lib/rag.ts 的 BOOK_CONFIGS 里添加配置
□ 7. 在 src/components/BookChat/index.tsx 添加前端角色扮演配置
□ 8. 新建 src/pages/book/{slug}/chat.tsx 问答页面
□ 9. git push → GitHub Actions 自动部署静态前端
□ 10. scp 上传 JSON 到服务器，pm2 restart blog-api
□ 11. POST /api/rag/build 构建向量库（等待完成）
□ 12. POST /api/rag/extract-persona 提取角色人设
```

---

## 九、关键文件索引

| 文件 | 作用 |
|------|------|
| `fc-api/src/lib/rag.ts` | RAG 核心：检索、人设、System Prompt 构建 |
| `fc-api/src/lib/llm.ts` | MiniMax API 封装（普通 + 流式） |
| `fc-api/src/lib/embeddings.ts` | DashScope Embedding 封装 |
| `fc-api/src/index.ts` | Express 服务，所有 API 路由 |
| `src/components/BookChat/index.tsx` | 前端问答组件，SSE 消费逻辑 |
| `fc-api/data/{slug}.json` | 书籍章节数据（RAG 构建用） |
| `fc-api/data/personas/{slug}.txt` | AI 提取的角色人设（运行时生成） |
| `src/data/books.json` | 书单数据（阅读器 + 书单首页用） |
| `scripts/extract_epub.py` | epub → JSON 提取脚本 |
| `scripts/format-book-content.js` | 段落格式化脚本 |

---

## 十、踩坑记录

### 坑 1：`fetch failed` —— 极具迷惑性的错误

**时间**：2026-04-02

**现象**：
- 前端发请求，服务器返回 200，但 EventStream 里没有任何事件，直接显示 `⚠️ fetch failed`
- 手动用 `curl` / Node `fetch` 调 MiniMax 接口完全正常
- 日志只有一行 `RAG 流式查询第 1 次失败: fetch failed`，没有更多信息

**误判过程**：
1. 以为是 MiniMax 限流 → 查了不是
2. 以为是网络问题 → curl 测试通，排除
3. 以为是 pg 查询太慢导致 undici socket 被关 → 改成 pgvector SQL → 报 `type "vector" does not exist`（数据库没装 pgvector 扩展）

**真正原因**：

服务器上 `dist/lib/embeddings.js` 是**历史旧版本**，用的是：

```js
new HuggingFaceTransformersEmbeddings({ model: 'Xenova/bge-small-zh-v1.5' })
```

这个模型需要在**首次调用时从 HuggingFace 下载**，而国内阿里云服务器访问 HuggingFace 被墙，于是 `fetch` 连接超时，Node 把它包装成 `TypeError: fetch failed`（`cause: UND_ERR_CONNECT_TIMEOUT`）。

`fetch failed` 这个消息本身出现在 **embedding 阶段**，但错误被冒泡到上层后，表现得像是调 MiniMax 失败，极具迷惑性。

**如何发现**：

```bash
node -e "require('./dist/lib/rag').queryStream('test','dao-gui-yi-xian').catch(e=>console.log(e.stack))"
```

查看完整堆栈，发现错误来自 `@huggingface/transformers`，而不是 MiniMax 的 `fetch`。

**修复**：
将本地已更新的 `src/lib/embeddings.ts`（DashScope 版）上传服务器并重新编译：

```bash
scp fc-api/src/lib/embeddings.ts root@server:/root/fc-api/src/lib/embeddings.ts
ssh root@server 'cd /root/fc-api && npm run build && pm2 restart blog-api'
```

**教训**：
- 每次部署只用 `scp` 传单个文件，容易漏传，导致 `dist/` 是新旧文件混搭
- 应当建立完整的同步脚本，一次性同步所有 `src/` 文件再编译
- 遇到 `fetch failed` 不要只看错误消息，要打印 `e.stack` 看完整调用链

---

### 坑 2：pgvector `<=>` 操作符不可用

**时间**：2026-04-02（排查坑 1 时产生的副作用）

**现象**：将 `retrieveTopK` 改为 pgvector SQL 后报错 `type "vector" does not exist`

**原因**：Supabase 建表时 `embedding` 字段是 `REAL[]`（普通数组），没有安装 `pgvector` 扩展，不支持 `vector` 类型和 `<=>` 运算符

**修复**：回退 `retrieveTopK` 为 Node.js 内存余弦计算，不需要 pgvector

**备注**：如果未来数据量继续增长（当前 6108 条），全表拉取计算会越来越慢（目前约 8-9 秒），届时可以考虑在 Supabase 开启 pgvector 并迁移字段类型

---

### 坑 3：思考过程与正式回答混在一起展示

**时间**：2026-04-02

**现象**：AI 的分析推理内容（`reasoning_content`）和最终角色扮演回答（`content`）被拼在同一个气泡里展示，用户看到的是大段"用户问……根据背景信息……我应该……"

**原因**：MiniMax M2.7 是推理模型，SSE 流里会同时返回两个字段：
- `delta.reasoning_content`：模型的思考过程
- `delta.content`：最终输出内容

之前后端把两者用 `||` 合并成一个 `text` 字段推给前端：

```ts
// 旧代码：两者合并，前端无法区分
const delta = choice?.delta?.content || choice?.delta?.reasoning_content || '';
send('delta', { text: delta });
```

**修复**：
- 后端：`delta` 事件加 `type` 字段（`"thinking"` / `"answer"`）分别推送
- 前端：`Message` 类型新增 `thinking` 字段单独存储，渲染时显示为可折叠的 💭 胶囊

```ts
// 新代码：分开推送
if (thinkingDelta) send('delta', { text: thinkingDelta, type: 'thinking' });
if (answerDelta)   send('delta', { text: answerDelta,   type: 'answer'   });
```
