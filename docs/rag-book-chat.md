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
