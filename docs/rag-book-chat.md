# 书单 AI 问答模块 —— 完整技术文档（面试用）

> 这份文档记录了个人博客「书单」模块从 0 到 1 的完整实现过程，包括技术选型决策、架构设计、核心实现细节，以及开发过程中踩过的所有坑。适合面试时系统性讲解。

---

## 一、这个功能是什么

在博客书单页，每本书都有一个「与 TA 对话」入口，进入后可以：

1. **向书中角色提问**：比如《道诡异仙》里的李火旺会以第一人称、用他独特的口吻回答
2. **基于原著内容回答**：不是 AI 瞎编，回答来自书中真实段落（并展示引用来源）
3. **流式逐字输出**：像 ChatGPT 一样边生成边显示，有思考过程可折叠查看

这个功能的技术核心是 **RAG（检索增强生成）+ 角色扮演 + SSE 流式输出**。

---

## 二、为什么要做这个，有什么挑战

**核心挑战**：大语言模型不知道你买的这本书的内容。直接问 GPT「李火旺是谁」，它不知道，或者会瞎编。

**解决思路**：

- 把书的内容切成小段落，转成向量存到数据库（预处理，一次性）
- 用户提问时，先把问题也转成向量，在数据库里找最相关的 5 个段落
- 把这 5 个段落 + 用户问题 + 角色人设一起喂给 AI，让 AI 基于真实内容回答

这就是 RAG 的核心思路。

---

## 三、技术架构

### 3.1 整体架构图

```
用户浏览器（lusuijie.com.cn/book/dao-gui-yi-xian/chat）
    │
    │ POST /api/rag/stream
    ▼
阿里云 ECS（47.94.103.221:3001）
Node.js + Express（fc-api）
    │
    ├─① embedQuery(问题) ──────────────────────→ 阿里云 DashScope
    │                                            text-embedding-v3
    │                                            返回 1024 维向量
    │
    ├─② 全量拉取 rag_documents WHERE collection = bookSlug
    │   Node.js 内存中计算余弦相似度，取 Top-5 段落
    │                    ↑
    │              Supabase PostgreSQL
    │              (embedding 存为 REAL[])
    │
    ├─③ 读取 data/personas/{bookSlug}.txt（AI 提取的角色人设）
    │
    ├─④ 组装 System Prompt = 人设 + Top-5 段落 + 回答要求
    │
    └─⑤ callLLMStream(messages) ───────────────→ MiniMax API
                                                 MiniMax-M2.7
                                                 stream: true
                                                 返回 SSE 流
         ↓（转发 SSE）
    前端 BookChat 组件
    逐字渲染 + 思考过程可折叠 + 引用来源展示
```

### 3.2 项目结构

```
my-blog/
├── src/
│   ├── components/BookChat/      # 前端对话组件（SSE 消费）
│   ├── components/BookReader/    # 书籍阅读器
│   └── pages/book/{slug}/chat.tsx  # 各书籍对话页面
│
└── fc-api/                       # 独立后端服务
    ├── src/
    │   ├── index.ts              # Express 路由 + SSE 转发逻辑
    │   └── lib/
    │       ├── rag.ts            # RAG 核心：检索 + 人设 + Prompt 构建
    │       ├── llm.ts            # MiniMax API 封装
    │       └── embeddings.ts     # DashScope Embedding 封装
    └── data/
        ├── {slug}.json           # 书籍章节数据
        └── personas/{slug}.txt  # AI 提取的角色人设
```

---

## 四、关键技术选型与决策

### 4.1 为什么不用 Serverless（函数计算 FC），而用云服务器 ECS

**背景**：最初考虑过阿里云函数计算（FC），按调用次数计费，零运维。

**放弃原因**：

**🚫 根本原因：部署包体积超限，FC 根本装不了**

最初使用了 HuggingFace 的本地 Embedding 模型（`@langchain/community` + `HuggingFaceTransformersEmbeddings`），这导致 `node_modules` 体积膨胀到 **559MB**，而 FC 单个函数代码包解压后上限是 **500MB**，直接超标。

更糟糕的是，就算想在 FC 构建环境里跑 `npm install`，也会因为 `@huggingface/transformers` 编译/下载大量文件，触发 FC 构建环境的内存限制，报 `npm ERR! code ENOMEM`（Out of Memory）。这条路直接死了。

```
du -sh fc-api/node_modules
559M    fc-api/node_modules   ← FC 500MB 限制，直接超标
```

**FC 和 ECS 的区别**

FC（函数计算）—— 按需拉起，用完即销毁
你的请求来了
│
▼ 阿里云：有没有空闲容器？
│
├── 有 → 直接用（热启动，< 100ms）
│
└── 没有 → 重新拉起一个容器（冷启动，2-5 秒）
下载你的代码包
运行 npm install（或解压你打包的 node_modules）
启动 Node.js 进程
执行你的函数
│
执行完毕 → 容器闲置一段时间后销毁

ECS（云服务器）—— 持续运行的真实服务器
你的 ECS 服务器（2核2G，24小时运行）
│
PM2 守护进程（一直在运行）
│
Node.js 服务（一直在监听 3001 端口）
│
你的请求来了 → 直接处理，没有冷启动
│
请求结束 → 进程继续运行，等待下一个请求

**其他连带问题**：

| 问题                 | 说明                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| **冷启动延迟**       | FC 有几秒钟冷启动，RAG 链路本身已经需要 8-10s（向量检索 + LLM），再加冷启动用户体验太差 |
| **流式输出不友好**   | FC 早期对 SSE 长连接支持不稳定，函数执行时间有上限                                      |
| **持久化文件不支持** | 角色人设文件（`personas/*.txt`）需要持久存储，FC 无本地文件系统                         |
| **调试成本高**       | 本地 → FC 的部署调试循环慢，ECS 直接 SSH 改文件重启更快                                 |

**最终选择**：阿里云 ECS 2核2G，PM2 守护进程，成本每月约 50 元。换用 DashScope API 做 Embedding 后，`node_modules` 体积大幅缩小，部署完全不是问题。

---

### 4.2 为什么不用 HuggingFace 本地模型，而用 DashScope API

**背景**：最初用 `@langchain/community` 的 `HuggingFaceTransformersEmbeddings`，模型 `Xenova/bge-small-zh-v1.5`，在本地完全正常。

**部署到国内服务器后彻底失败**，放弃原因：

npm 包本身不包含模型权重文件，只包含运行时代码。模型权重是第一次运行时才下载的：

| 问题                 | 说明                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------- |
| **HuggingFace 被墙** | 国内阿里云 ECS 无法访问 `huggingface.co`，模型文件无法下载，报 `fetch failed`（见踩坑记录） |
| **内存压力大**       | ONNX 模型需要加载到内存，`bge-small-zh-v1.5` 约 90MB，2G 内存的 ECS 承受不住                |
| **CPU 推理极慢**     | 没有 GPU，CPU 推理单次 Embedding 需要数秒，6000+ 个 chunk 的构建根本不可行                  |
| **模型管理麻烦**     | 需要自己下载、上传、管理版本，而 API 方式零维护                                             |

**最终选择**：阿里云 DashScope `text-embedding-v3`

- 国内直连，延迟约 200-500ms
- 1024 维向量，中文效果好
- 按量计费，新用户有免费额度
- 单次最多 25 条文本批处理

---

### 4.3 为什么用 MiniMax，不用 OpenAI / Claude

**额外发现**：MiniMax-M2.7 是推理模型，会同时返回 `reasoning_content`（思考过程）和 `content`（正式回答），我们专门做了区分展示（详见踩坑记录坑 3）。

---

### 4.4 为什么向量相似度在 Node.js 内存里算，不用数据库侧

先理解问题：你有 6108 个向量，用户问了一个问题，怎么找出最相关的 5 个？
唯一的办法：把用户问题也转成向量，然后和这 6108 个向量逐一比较相似度，取最高的 5 个。
问题在于：这个"比较"的计算量在哪里发生？

**当前方案**：全量拉取所有向量到 Node.js，手动计算余弦相似度。

**为什么不用 pgvector 的 `<=>` 操作符**：

- Supabase 建表时 `embedding` 字段是 `REAL[]`（普通数组），没有安装 pgvector 扩展
- 尝试改用 `<=>` 操作符时报错 `type "vector" does not exist`（见踩坑记录坑 2）
- 当前数据量：《道诡异仙》6108 条，《我看见的世界》约 500 条，全量拉取约耗时 8-9 秒，可以接受

**未来优化方向**：数据量超过 10 万条时，在 Supabase 开启 pgvector 扩展，迁移字段类型，改用 SQL 侧向量检索，将耗时压到 < 1 秒。

暴力遍历：
问题向量 → 和第1个比 → 和第2个比 → ... → 和第6108个比 → 排序

HNSW：
问题向量 → 从最顶层图找大概方向 → 逐层收敛 → 跳转到"附近"的向量
只访问几十个节点就找到最近邻，不需要看全部 6108 个

---

### 4.5 为什么用 SSE，不用 WebSocket 或普通 HTTP

| 方案                          | 分析                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **普通 HTTP**                 | 要等 AI 全部生成完才返回，用户等待 10+ 秒白屏，体验极差                                               |
| **WebSocket**                 | 双向通信，对这个场景过重；需要额外处理连接管理                                                        |
| **SSE（Server-Sent Events）** | 单向服务端推送，天然适合 AI 逐字输出；HTTP 协议，零额外依赖；前端用 `fetch + ReadableStream` 消费即可 |

---

## 五、核心实现细节

### 5.1 书籍预处理流程（新增一本书时执行一次）

```
1. epub → JSON
   python3 scripts/extract_epub.py "书名.epub" "fc-api/data/{slug}.json"
   提取所有 HTML 章节，清理标签，保留纯文本
   输出：{ chapters: [{ title, content }] }

2. 文本切块
   RecursiveCharacterTextSplitter
   chunkSize: 500 字
   chunkOverlap: 50 字（前后重叠防止语义截断）
   separators: ['\n\n', '\n', '。', '！', '？', '；', ' ']
   《道诡异仙》1043 章 → 6108 个 chunk

3. 向量化 + 入库
   每批 5 个 chunk → DashScope embedQuery → 1024 维向量
   写入 Supabase rag_documents 表
   ID 格式：{bookSlug}-doc-{n}（避免不同书冲突）
   有 ON CONFLICT DO UPDATE，重复构建不报错

4. 提取角色人设（自动化）
   取前 30 章，每章前 800 字 → 发给 MiniMax
   让 AI 总结：角色身份、性格特征、说话风格、口头禅
   结果存入 fc-api/data/personas/{slug}.txt
   后续每次对话自动读取，无需重新生成

   优化，RAG 反向检索（最聪明的方式）
    用向量库本身来找最有代表性的段落：
    // 用描述性问题去检索，找角色最典型的表现
    const queries = [
      `${主角名}说话的方式和口头禅`,
      `${主角名}的性格特点和内心独白`,
      `${主角名}面对危险时的反应`,
      `${主角名}和其他人的对话`,
    ]


    第一步：用几个描述性问题去检索向量库
    ─────────────────────────────────────
    query1: "李火旺说话的方式和口头禅"     → Top5 最相关片段
    query2: "李火旺的性格特点和内心独白"   → Top5 最相关片段
    query3: "李火旺面对危险时的反应"       → Top5 最相关片段
    query4: "李火旺和别人的对话"           → Top5 最相关片段

    合并去重 → 得到约 15-20 个最有代表性的原文段落

    第二步：把这些片段喂给 LLM，让它提炼人设
    ─────────────────────────────────────────
    "以下是书中最能体现李火旺特征的片段，请总结他的说话风格和性格"
    → LLM 输出人设文本
    → 存入 personas/dao-gui-yi-xian.txt

    第三步：后续每次对话，读取这个人设文件
    ─────────────────────────────────────────
    System Prompt = 人设 + 检索到的相关原文 + 用户问题
    → LLM 模仿李火旺的口吻回答
```

### 5.2 每次问答的完整链路

```typescript
// rag.ts - queryStream()

// Step 1: 问题向量化
const questionVector = await embeddings.embedQuery(question);
// → 1024 维浮点数组，约 200ms

// Step 2: 全量检索 + 余弦相似度排序
const result = await pool.query(
  "SELECT content, metadata, embedding FROM rag_documents WHERE collection = $1",
  [bookSlug],
);
const topDocs = result.rows
  .map((row) => ({
    ...row,
    score:
      cosineSimilarity(questionVector, row.embedding) *
      (row.metadata.type === "appendix" ? 0.8 : 1.0), // 附录降权
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);
// → 约 8s（6000+ 条全量计算）

// Step 3: 组装 System Prompt
const persona = loadPersona(bookSlug); // 读取人设文件
const context = topDocs
  .map((doc, i) => `[来源 ${i + 1}] 章节：${doc.chapterTitle}\n${doc.content}`)
  .join("\n\n---\n\n");

const systemPrompt = `${persona}

以下是你（${characterName}）在书中相关经历的片段：
${context}

请以${characterName}的口吻和语气，用第一人称回答。`;

// Step 4: 流式调用 LLM
const stream = await callLLMStream([
  { role: "system", content: systemPrompt },
  { role: "user", content: question },
]);
```

```js
  // 计算余弦相似度
  function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;  // 累积点积
    let normA = 0;       // 累积 |A|² （先算平方和，最后再开根号）
    let normB = 0;       // 累积 |B|²

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];  // 每一维：对应元素相乘，累加
      normA += a[i] * a[i];       // 每一维：a 的平方，累加
      normB += b[i] * b[i];       // 每一维：b 的平方，累加
    }
    //         ↑ 三个累加在同一个循环里完成，只遍历一次，时间复杂度 O(n)

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    //                   ↑ 最后才开根号，而不是每次循环都开，性能更好
  }
```

### 5.3 SSE 流转发（后端 → 前端）

后端把 MiniMax 的原始 SSE 流解析后，转换成我们自定义的事件格式：

```
MiniMax 原始格式：
data: {"choices":[{"delta":{"content":"你好","reasoning_content":"用户在问..."}}]}

我们向前端推送的格式（区分思考过程和正式回答）：
event: sources
data: [{"chapterTitle":"第9章","excerpt":"...","score":0.82}, ...]

event: delta
data: {"text":"用户在问...", "type":"thinking"}

event: delta
data: {"text":"你好，我是李火旺...", "type":"answer"}

event: done
data: {}
```

### 5.4 前端 SSE 消费状态机

```
收到 sources  → 暂存 pendingSources（等流结束后附加到消息）
收到第一个 delta → 才插入空 assistant 消息（防止等待期出现双气泡）
delta type=thinking → 追加到 msg.thinking（折叠展示）
delta type=answer   → 追加到 msg.content（正常展示）
收到 done    → 将 pendingSources 写入最后一条 assistant 消息
收到 error   → 用变量收集，流结束后统一抛出（防止被内层 catch 吞掉）
```

#### 为什么不用原生 `EventSource`，而用 `fetch + ReadableStream` 手动解析

原生 `EventSource` API 有一个致命限制：**只支持 GET 请求，无法自定义请求体**。而本项目需要 POST 发送 `{ question, bookSlug }`，所以必须用 `fetch` 手动消费流。

#### `fetch + ReadableStream` 完整实现逻辑

**第一层：为什么需要 `buffer`**

网络数据是字节流，不是按"一条消息一次"送达的。服务端发出的一条 SSE 消息：

```
event: delta\ndata: {"type":"answer","text":"你好"}\n\n
```

到前端可能被拆成两次 `read()` 收到：

```
第一次 read() → "event: delta\ndata: {\"type\""
第二次 read() → ":\"answer\",\"text\":\"你好\"}\n\n"
```

如果每次 `read()` 就直接解析，第一次 JSON 不完整会报错。`buffer` 的作用是**攒够完整的行再解析**。

**第二层：按 `\n` 切割而非 `\n\n`**

实际代码按单个 `\n` 切割（而非 `\n\n`），逐行处理：

```typescript
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = "";
let serverError: string | null = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // decode(value, { stream: true })：告诉解码器"这不是最后一块，别 flush"
  // 防止多字节字符（中文）被截断
  buf += decoder.decode(value, { stream: true });

  // 按换行符切割
  const lines = buf.split("\n");

  // 最后一行可能是半截，pop() 取出来留到下次 read() 拼接
  buf = lines.pop() ?? "";

  // 剩下的都是完整的行，安全解析
  let eventName = "";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      // 记录事件类型，等下一行 data: 来了一起处理
      eventName = line.slice(6).trim(); // "delta" / "done" / "error"
    } else if (line.startsWith("data:")) {
      const raw = line.slice(5).trim();
      const data = JSON.parse(raw);

      if (eventName === "delta") {
        // 收到第一个 delta 才插入 assistant 占位消息（防止双气泡）
        if (!assistantMsgAdded) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "", thinking: "" },
          ]);
          assistantMsgAdded = true;
        }
        // 根据 type 分流追加
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (data.type === "thinking") {
            next[next.length - 1] = {
              ...last,
              thinking: (last.thinking ?? "") + data.text,
            };
          } else {
            next[next.length - 1] = {
              ...last,
              content: last.content + data.text,
            };
          }
          return next;
        });
      } else if (eventName === "done") {
        setStreaming(false);
        // 把之前暂存的来源信息附加到最后一条消息
        if (pendingSources) {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              sources: pendingSources,
            };
            return next;
          });
        }
      } else if (eventName === "error") {
        // ⚠️ 不在这里 throw！for 循环内部有 try/catch 处理 JSON 解析失败
        // 直接 throw 会被内层 catch 吞掉，改为先存起来
        serverError = data.message;
      }
      eventName = ""; // data 行处理完，重置，等待下一条消息的 event 行
    }
  }
}

// 流结束后统一抛出，此时已在 try/catch 外层，能被正确捕获
if (serverError) {
  throw new Error(serverError);
}
```

**用一个具体例子走一遍 buffer 拼接过程：**

```
第一次 read() → value = "event: delta\ndata: {\"text\":\"你"
buf = "event: delta\ndata: {\"text\":\"你"
split('\n') → ["event: delta", "data: {\"text\":\"你"]
pop() → buf = "data: {\"text\":\"你"   ← 不完整，留着
lines 处理 → ["event: delta"] → 记下 eventName = "delta"，但还没有 data 行

第二次 read() → value = "好\"}\n\nevent: done\ndata: {}\n\n"
buf = "data: {\"text\":\"你好\"}\n\nevent: done\ndata: {}\n\n"
      ↑ 拼上上次留下的前缀
split('\n') → ["data: {\"text\":\"你好\"}", "", "event: done", "data: {}", "", ""]
pop() → buf = ""
lines 逐行处理：
  "data: {\"text\":\"你好\"}" → eventName="delta"，追加"你好"到 content ✅
  ""                         → 空行跳过
  "event: done"              → eventName = "done"
  "data: {}"                 → 处理 done 事件，setStreaming(false) ✅
```

**关键细节总结：**

| 细节                                   | 原因                                                                |
| -------------------------------------- | ------------------------------------------------------------------- |
| `decode(value, { stream: true })`      | 防止中文等多字节字符在字节边界被截断                                |
| `lines.pop()` 留尾巴                   | 最后一行可能是半截，留到下次 read() 拼接                            |
| `eventName` 在 data 行处理后重置       | 每条 SSE 消息由 event + data 两行组成，处理完 data 才算一条完整消息 |
| `error` 事件先存变量，流结束后 throw   | 防止被循环内 JSON.parse 的 try/catch 吞掉                           |
| 收到第一个 delta 才插入 assistant 消息 | 防止等待阶段出现空内容气泡（双气泡问题）                            |

### 5.5 角色扮演人设系统（三级优先级）

```
fc-api/data/personas/{bookSlug}.txt   ← AI 从原著自动提取（优先使用）
         ↓ 文件不存在时
BOOK_CONFIGS[bookSlug].fallbackPersona ← 手写兜底人设
         ↓ roleplay 未开启时
普通 AI 助手模式（不扮演角色）
```

人设提取核心 prompt：

> 请根据以上章节内容，为主角「李火旺」生成一段详细的角色扮演人设描述，要求：
>
> 1. 用"你现在是..."开头，直接描述角色身份
> 2. 总结角色的核心性格特征（3-6 条）
> 3. 描述说话风格、习惯用语、口头禅
> 4. 说明面对"不知道"时的处理方式
> 5. 控制在 400 字以内

---

## 六、API 接口一览

| 方法 | 路径                       | 参数                      | 说明                    |
| ---- | -------------------------- | ------------------------- | ----------------------- |
| POST | `/api/rag/stream`          | `{question, bookSlug}`    | 流式问答（SSE，主接口） |
| POST | `/api/rag`                 | `{question, bookSlug}`    | 普通问答（非流式）      |
| POST | `/api/rag/build`           | `{bookSlug}`              | 构建/重建向量库         |
| POST | `/api/rag/extract-persona` | `{bookSlug, sampleCount}` | 自动提取角色人设        |
| GET  | `/api/rag/persona-status`  | `?bookSlug=`              | 查询当前人设来源        |
| GET  | `/health`                  | —                         | 健康检查                |

---

## 七、数据库结构

```sql
-- Supabase PostgreSQL
CREATE TABLE rag_documents (
  id          TEXT PRIMARY KEY,   -- "{bookSlug}-doc-{n}"，多书隔离
  collection  TEXT NOT NULL,      -- bookSlug，用于 WHERE 过滤
  content     TEXT NOT NULL,      -- 切割后的文本 chunk（约 500 字）
  metadata    JSONB,              -- { chapterTitle: "第9章", type: "main" }
  embedding   REAL[],             -- 1024 维浮点向量（DashScope 输出）
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rag_documents_collection ON rag_documents(collection);
```

---

## 八、环境变量

| 变量名                 | 位置            | 说明                       |
| ---------------------- | --------------- | -------------------------- |
| `MINIMAX_API_KEY`      | fc-api/.env     | MiniMax LLM，用于生成回答  |
| `MINIMAX_GROUP_ID`     | fc-api/.env     | MiniMax 账号 Group ID      |
| `DASHSCOPE_API_KEY`    | fc-api/.env     | 阿里云百炼，用于 Embedding |
| `SUPABASE_DB_URL`      | fc-api/.env     | Supabase PostgreSQL 连接串 |
| `NEXT_PUBLIC_API_BASE` | .env.production | 前端指向 ECS 地址          |

---

## 九、踩坑记录（面试重点）

### 坑 1：`fetch failed` —— 极具迷惑性的错误

**时间**：2026-04-02

**现象**：

- 请求返回 200，但 EventStream 里没有任何事件，前端显示 `⚠️ fetch failed`
- 手动用 `curl` / Node `fetch` 单独调 MiniMax 接口完全正常
- 日志只有一行 `RAG 流式查询第 1 次失败: fetch failed`，没有堆栈

**误判过程**：

1. 以为是 MiniMax 限流 → 检查 base_resp，不是
2. 以为是网络问题 → curl 测试 200，排除
3. 以为是 pg 查询太久、undici socket 被关闭 → 改用 pgvector SQL → 报 `type "vector" does not exist`

**真正原因**：

服务器上 `dist/lib/embeddings.js` 是**历史旧版本**（上次部署时这个文件没有被同步到服务器），里面是：

```js
new HuggingFaceTransformersEmbeddings({ model: "Xenova/bge-small-zh-v1.5" });
```

这个模型**首次运行时需要从 HuggingFace 下载**，国内 ECS 访问不了 HuggingFace，TCP 连接超时，Node.js 的 undici 把它包装成 `TypeError: fetch failed`（`cause: UND_ERR_CONNECT_TIMEOUT`）。

**关键迷惑点**：错误发生在 **embedding 阶段**，但报错消息 `fetch failed` 和调 MiniMax 失败的错误消息完全一样，极难区分。

**如何定位**：打印完整堆栈而不是只看 message：

```bash
node -e "require('./dist/lib/rag').queryStream('test','dao-gui-yi-xian')
  .catch(e => console.log(e.stack))"
```

输出：

```
TypeError: fetch failed
    at ...
    at async getModelFile (@huggingface/transformers/...)  ← 这里！
    at async getModelText
```

**修复**：将本地 DashScope 版的 `embeddings.ts` 上传服务器重新编译。

**教训**：

- `scp` 单文件部署容易漏传，要一次性同步所有 `src/` 再编译
- 遇到 `fetch failed` 必须打印 `e.stack` 看完整调用链

---

### 坑 2：pgvector `<=>` 操作符不可用

**时间**：排查坑 1 时产生的副作用

**现象**：为了优化查询，把 `retrieveTopK` 改为：

```sql
SELECT content, metadata, 1 - (embedding <=> $1::vector) AS score
FROM rag_documents WHERE collection = $2
ORDER BY embedding <=> $1::vector LIMIT 10
```

立刻报错：`type "vector" does not exist`

**原因**：Supabase 建表时 `embedding` 是 `REAL[]`（普通 PostgreSQL 数组），没有安装 `pgvector` 扩展，`vector` 类型不存在，`<=>` 操作符也不可用。

**修复**：回退为 Node.js 内存余弦计算。

**备注**：当前 6108 条数据全量计算约 8-9 秒，是整个链路最慢的环节。未来优化路径：在 Supabase 开启 pgvector → 迁移字段为 `vector(1024)` → 改用 SQL 侧 ANN 检索。

---

### 坑 3：MiniMax M2.7 思考过程与正式回答混在一起

**时间**：2026-04-02

**现象**：AI 回答里混进了大段分析推理文字，用户看到的是"用户问你嫂妇是谁，这是在问……根据背景信息……我应该……"。

**原因**：MiniMax-M2.7 是推理模型，SSE 流里同时返回两个字段：

- `delta.reasoning_content`：模型内部思考过程
- `delta.content`：最终输出给用户的内容

旧代码用 `||` 把两者合并：

```typescript
// 旧：两者合并，前端无法区分
const delta = choice?.delta?.content || choice?.delta?.reasoning_content || "";
send("delta", { text: delta });
```

**修复**：后端加 `type` 字段分开推送，前端 `Message` 类型新增 `thinking` 字段单独存储：

```typescript
// 新：分开推送
if (thinkingDelta) send("delta", { text: thinkingDelta, type: "thinking" });
if (answerDelta) send("delta", { text: answerDelta, type: "answer" });
```

前端渲染：正式回答正常展示，思考过程显示为可折叠的 💭 胶囊按钮。

---

### 坑 4：Next.js 静态导出后 API Routes 失效

**现象**：本地开发正常，部署后接口 404。

**原因**：博客是 `output: 'export'` 纯静态站点，部署到 OSS（对象存储）。OSS 只能托管静态文件，无法运行 Node.js，`/pages/api/` 下的 API Routes 在静态导出后根本不会生成。

**解决**：RAG 逻辑单独抽成 `fc-api` 独立服务，部署到 ECS，前端通过 `NEXT_PUBLIC_API_BASE` 环境变量指向它。

---

### 坑 5：服务端 error 事件被内层 catch 吞掉

**现象**：后端发了 `event: error`，前端没有任何错误提示，沉默失败。

**原因**：SSE 解析循环里有嵌套 `try/catch`（用于 JSON.parse），在 `error` 事件里直接 `throw` 会被内层 catch 吃掉。

**修复**：用变量收集，流结束后统一抛出：

```typescript
let serverError: string | null = null;
// SSE 循环内只收集
if (eventName === "error") serverError = data.message;
// 流结束后统一处理
if (serverError) throw new Error(serverError);
```

---

### 坑 6：等待期出现两个 AI 气泡

**现象**：发送问题后，等待回答时界面同时出现「三点动画」和「空内容气泡」两个气泡。

**原因**：代码在发请求时就预先 push 了一条空 assistant 消息占位，同时打字动画的条件渲染也满足，两者共存。

**修复**：不预先插入占位，等收到第一个 `delta` 时才插入 assistant 消息：

```typescript
if (!assistantMsgAdded) {
  setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
  assistantMsgAdded = true;
}
```

打字动画只在「loading 且未开始 streaming 且最后一条不是 assistant」时显示：

```tsx
{
  loading &&
    !streaming &&
    messages[messages.length - 1]?.role !== "assistant" && (
      <div className={styles.typing}>...</div>
    );
}
```

---

### 坑 7：MiniMax 限流（status_code: 2064）

**现象**：偶发性完全没有输出，查日志发现 MiniMax 返回：

```json
{
  "choices": null,
  "base_resp": { "status_code": 2064, "status_msg": "触发限流" }
}
```

**修复**：检测非零 `status_code` 主动抛出，外层加最多 3 次重试，每次等 1 秒，只有限流错误才重试：

```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
  try {
    if (statusCode !== 0) throw new Error(`MiniMax 限流: ${statusCode}`);
    return; // 成功退出
  } catch (err) {
    if (!err.message.startsWith("MiniMax 限流")) break; // 非限流不重试
  }
}
```

---

### 坑 8：CORS 跨域（http vs https 是不同 Origin）

**现象**：本地正常，线上浏览器报 CORS 错误。

**原因**：博客是 `http://lusuijie.com.cn`，CORS 白名单只配了 `https://`，一字之差被拒绝。

**修复**：白名单同时加 http 和 https 两个版本。

---

### 坑 9：PM2 重启后环境变量不更新

**现象**：修改 `.env` 后 `pm2 restart all`，新变量不生效。

**原因**：PM2 `restart` 只重启进程，不重新读取环境变量，用 `--update-env` 才会更新。

**修复**：`pm2 restart all --update-env`

---

## 十、新增书籍完整 Checklist

```
□ 1. epub 放到项目根目录
□ 2. python3 scripts/extract_epub.py "xxx.epub" "fc-api/data/{slug}.json"
□ 3. node scripts/format-book-content.js（格式化段落换行）
□ 4. 将书籍信息添加到 src/data/books.json
□ 5. 在 fc-api/src/lib/rag.ts 的 BOOK_CONFIGS 里添加书籍配置
□ 6. 在 src/components/BookChat/index.tsx 添加前端角色扮演配置
□ 7. 新建 src/pages/book/{slug}/chat.tsx 对话页面
□ 8. git push → GitHub Actions 自动部署静态前端到 OSS
□ 9. scp 上传 JSON 到服务器：scp fc-api/data/{slug}.json root@server:~/fc-api/data/
□ 10. scp 上传新代码并重新编译（注意同步所有修改过的 src/ 文件）
□ 11. pm2 restart blog-api
□ 12. POST /api/rag/build 构建向量库（等待完成，道诡异仙约需 30 分钟）
□ 13. POST /api/rag/extract-persona 提取角色人设（约 2 分钟）
□ 14. 验证：GET /api/rag/persona-status?bookSlug={slug}
```

---

## 十一、关键文件索引

| 文件                                  | 作用                                             |
| ------------------------------------- | ------------------------------------------------ |
| `fc-api/src/lib/rag.ts`               | RAG 核心：向量检索、人设管理、System Prompt 构建 |
| `fc-api/src/lib/llm.ts`               | MiniMax API 封装（普通 + 流式，含 30s 超时保护） |
| `fc-api/src/lib/embeddings.ts`        | DashScope text-embedding-v3 封装                 |
| `fc-api/src/index.ts`                 | Express 路由 + SSE 转发 + 重试机制               |
| `src/components/BookChat/index.tsx`   | 前端对话组件：SSE 消费、思考/回答分流渲染        |
| `src/components/BookReader/index.tsx` | 书籍阅读器（章节导航、进度跳转）                 |
| `fc-api/data/{slug}.json`             | 书籍章节数据（RAG 构建原料）                     |
| `fc-api/data/personas/{slug}.txt`     | AI 提取的角色人设（运行时自动生成）              |
| `src/data/books.json`                 | 书单数据（阅读器 + 书单首页共用）                |
| `scripts/extract_epub.py`             | epub → JSON 提取脚本                             |
| `supabase-schema.sql`                 | 数据库建表 SQL                                   |

---

## 十二、RAG 基础原理（面试问答）

### 12.1 什么是 RAG，解决什么问题

**RAG = Retrieval-Augmented Generation（检索增强生成）**

| LLM 的固有局限                       | RAG 的解法                                  |
| ------------------------------------ | ------------------------------------------- |
| 训练数据有截止日期，不知道最新信息   | 把最新文档向量化存入数据库，实时检索        |
| 无法记住私有文档（你的书、公司文件） | 把私有内容变成可检索的知识库                |
| 回答时容易"幻觉"（自信地编造内容）   | 把真实原文段落塞进 Prompt，要求基于原文回答 |
| 上下文窗口有限，无法塞入整本书       | 只把最相关的 Top-K 段落塞入，节省 token     |

**核心思路**：不是让 LLM"记住"所有文档，而是每次问答时**临时检索出相关内容**，让 LLM 基于这些内容生成回答。LLM 负责"理解和表达"，数据库负责"记忆和检索"。

---

### 12.2 RAG 的三个核心阶段

#### 阶段一：索引（Indexing）—— 离线执行，只做一次

```
原始文档（PDF、epub、txt）
    │
    ▼ 文档加载（Document Loader）
解析出纯文本
    │
    ▼ 文本切块（Text Splitter）
切成若干小段落（Chunk），每段约 500 字
    │
    ▼ 向量化（Embedding Model）
每个 Chunk → 高维浮点向量（如 1024 维）
    │
    ▼ 存储（Vector Store）
向量 + 原文 + 元数据 写入向量数据库
```

#### 阶段二：检索（Retrieval）—— 每次问答时执行

```
用户问题
    │
    ▼ 问题向量化（同一个 Embedding 模型）
问题向量
    │
    ▼ 相似度检索（ANN 或全量余弦计算）
Top-K 最相关的 Chunk
```

#### 阶段三：生成（Generation）—— 每次问答时执行

```
Top-K Chunk + 用户问题 + System Prompt
    │
    ▼ 组装为完整 Prompt
    │
    ▼ 送入 LLM
最终回答（基于真实原文）
```

---

### 12.3 向量（Embedding）是什么

**直觉解释**：把文字的"语义"映射到高维空间里的一个点。语义相近的文本，对应的点在空间里也相近。

```
"李飞飞的童年经历" → [0.23, -0.51, 0.88, 0.12, ...]  （1024 个数字）
"她小时候的故事"   → [0.21, -0.49, 0.90, 0.11, ...]  （非常接近）
"量子力学公式"     → [-0.73, 0.82, -0.33, 0.65, ...]  （差距很大）
```

**余弦相似度**：衡量两个向量的夹角，值域 [-1, 1]，越接近 1 越相似：

```
cos_sim(a, b) = (a · b) / (|a| × |b|)
```

不关心向量的长度，只关心方向——这正是语义相似度需要的特性。

---

### 12.4 Text Splitter 的核心参数

```
RecursiveCharacterTextSplitter({
  chunkSize: 500,       // 每个 Chunk 的最大字符数
  chunkOverlap: 50,     // 相邻 Chunk 的重叠字符数（防止语义在边界截断）
  separators: ['\n\n', '\n', '。', '！', '？']  // 优先在这些边界切割
})
```

**为什么需要 overlap？**

假设一段话"李火旺在第9章学会了控制幻觉，第10章开始..."被从中间切断，Chunk A 结尾和 Chunk B 开头各拿不到完整语义。加了 50 字 overlap 后，两个 Chunk 都包含中间那段文字，确保语义完整性。

**chunkSize 怎么选？**

- 太小（< 100）：每个 Chunk 信息量不足，检索到的内容片段化
- 太大（> 1000）：一个 Chunk 包含多个话题，向量"被平均"，相似度计算不准；同时占用更多 token
- **常用范围：300~800 字**，中文书籍用 500 比较合适

---

### 12.5 向量数据库选型对比

| 数据库                | 类型            | 特点                                 | 适合场景           |
| --------------------- | --------------- | ------------------------------------ | ------------------ |
| **Faiss**             | 本地库          | 纯内存，极快，无持久化               | 本地原型验证       |
| **Pinecone**          | 云托管          | 全托管，有 ANN 索引，免费额度小      | 快速上线，小数据量 |
| **Weaviate**          | 自托管/云       | 功能丰富，有 GraphQL API             | 复杂场景           |
| **Qdrant**            | 自托管/云       | Rust 写的，性能好，支持 payload 过滤 | 中大规模           |
| **Supabase pgvector** | PostgreSQL 扩展 | 复用已有 PG 实例，SQL 接口           | 已有 PG 的项目     |
| **Chroma**            | 本地/自托管     | 极易上手，Python 生态好              | 快速原型           |

**本项目的选择**：Supabase PostgreSQL + `REAL[]` 普通数组列，原因：免费托管，已有 PG，数据量小（< 10K），用代码算余弦相似度完全够用，不引入额外依赖。

---

### 12.6 ANN vs 全量检索

| 方式                  | 原理                                              | 优点                                 | 缺点                                 |
| --------------------- | ------------------------------------------------- | ------------------------------------ | ------------------------------------ |
| **全量暴力搜索**      | 把问题向量和所有向量逐一计算余弦相似度            | 结果100%精确                         | 随数据量线性增长，10万条会很慢       |
| **ANN（近似最近邻）** | 提前建索引（IVFFlat、HNSW），检索时只看"附近的桶" | 速度快（毫秒级，不随数据量线性增长） | 结果是"近似"的，有极小概率漏掉最优解 |

**常见 ANN 算法**：

- **IVFFlat**：把向量空间分成若干"桶"，检索时只在最近的几个桶里搜索
- **HNSW**（Hierarchical Navigable Small World）：图结构，层层收敛，pgvector 默认支持

**本项目**：数据量 6108 条，全量计算耗时 8-9 秒，是性能瓶颈所在，未来迁移 pgvector + HNSW 索引可降到 < 100ms。

---

### 12.7 RAG 的常见优化方向

#### 检索侧优化

| 方法                          | 说明                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| **混合检索（Hybrid Search）** | 向量检索 + 关键词检索（BM25）结果融合，弥补纯向量的关键词缺失问题     |
| **重排序（Reranking）**       | 检索出 Top-20，再用更精细的模型（如 Cross-Encoder）重排序，取 Top-5   |
| **HyDE（假设文档扩展）**      | 先让 LLM 生成一个"假设答案"，用假设答案的向量去检索，而不是用原始问题 |
| **多查询（Multi-Query）**     | 用 LLM 把原始问题改写成多个角度的问题，分别检索，结果取并集           |
| **父文档检索**                | 存储小 Chunk 用于精确匹配，检索到后返回包含它的大 Chunk 给 LLM        |

#### 生成侧优化

| 方法         | 说明                                                           |
| ------------ | -------------------------------------------------------------- |
| **温度控制** | `temperature=0.3` 偏确定性，减少幻觉；创意场景用 0.7+          |
| **引用约束** | System Prompt 明确要求"只基于提供的段落回答，不知道就说不知道" |
| **结果验证** | 回答生成后，再用一个 LLM 验证答案是否与原文一致（Self-RAG）    |

---

### 12.8 LangChain 核心概念

> 本项目只用了 LangChain 的 `RecursiveCharacterTextSplitter`，其余部分自己实现。但 LangChain 是 RAG 最常见的框架，面试会问。

#### LangChain 是什么

LangChain 是一个用于构建 LLM 应用的框架，把常用组件（文档加载、切块、向量存储、LLM 调用、链式组合）封装好，减少重复代码。

#### 核心模块

| 模块                 | 作用                                         | 对应本项目                            |
| -------------------- | -------------------------------------------- | ------------------------------------- |
| **Document Loaders** | 加载各种格式文档（PDF、epub、URL、CSV）      | 自己写了 Python 脚本解析 epub         |
| **Text Splitters**   | 按语义边界切割文本                           | 用了 `RecursiveCharacterTextSplitter` |
| **Embeddings**       | 文本向量化接口，统一各家 API                 | 自己封装了 DashScope                  |
| **Vector Stores**    | 向量数据库接口（Pinecone、Chroma、pgvector） | 自己直连 Supabase pg                  |
| **Retrievers**       | 封装检索逻辑，包括 MMR、相似度阈值过滤等     | 自己实现了余弦相似度排序              |
| **Chains**           | 把多个步骤串联（检索 → 生成）                | 自己在 `rag.ts` 里串联                |
| **Agents**           | 让 LLM 自主决定调用哪些工具                  | 未使用                                |
| **Memory**           | 多轮对话历史管理                             | 未使用（当前是单轮问答）              |

#### LCEL（LangChain Expression Language）

LangChain 的链式声明语法，用 `|` 管道符组合组件：

```python
# 传统写法
chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)

# LCEL 写法
chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)
```

**面试要点**：LCEL 的核心是 `Runnable` 接口，所有组件都实现 `invoke / stream / batch` 三个方法，可以任意组合。

#### RAG Chain 标准写法（LangChain）

```python
from langchain.chains import RetrievalQA
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI

# 构建向量库
vectorstore = Chroma.from_documents(
    documents=splits,          # 切好的 Document 列表
    embedding=OpenAIEmbeddings()
)

# 构建 RAG Chain
qa_chain = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="gpt-3.5-turbo"),
    retriever=vectorstore.as_retriever(search_kwargs={"k": 5}),
    return_source_documents=True  # 返回引用来源
)

result = qa_chain.invoke({"query": "李飞飞的童年经历是怎样的？"})
print(result["result"])        # 回答
print(result["source_documents"])  # 来源段落
```

---

### 12.9 面试常见问题 & 回答思路

**Q1：RAG 和 Fine-tuning 有什么区别，什么时候用哪个？**

|          | RAG                      | Fine-tuning                        |
| -------- | ------------------------ | ---------------------------------- |
| **原理** | 检索外部知识 + 生成      | 用新数据重新训练模型权重           |
| **成本** | 低，只需存储向量         | 高，需要大量标注数据 + GPU 算力    |
| **更新** | 实时，改数据库即可       | 慢，需要重新训练                   |
| **适合** | 私有文档问答、知识库     | 改变模型语气风格、特定领域术语理解 |
| **局限** | 检索质量上限决定回答质量 | 容易遗忘旧知识（灾难性遗忘）       |

**→ 本项目选 RAG**：书的内容会增加（新书），实时更新，Fine-tuning 太贵。

---

**Q2：如何评估 RAG 系统的质量？**

- **检索侧**：Recall@K（前 K 个结果里有没有真正相关的）、MRR（Mean Reciprocal Rank）
- **生成侧**：忠实度（回答是否基于检索内容）、相关性（回答是否回答了问题）
- **端到端**：RAGAS 框架，自动化评估 Faithfulness、Answer Relevancy、Context Precision

---

**Q3：RAG 的"幻觉"问题怎么处理？**

1. **Prompt 约束**：明确要求"只基于以下内容回答，如果无法回答请直接说不知道"
2. **温度调低**：`temperature=0.1~0.3`，减少随机性
3. **引用强制**：要求回答必须引用具体章节（本项目有引用来源展示）
4. **自我验证**：生成后再让 LLM 检查答案是否和原文一致

---

**Q4：Chunk 大小怎么选，有什么考量？**

- 太小：语义碎片化，LLM 拿到的上下文不足
- 太大：向量被平均，相似度计算不准；占用更多 token
- **中文书籍经验**：500 字 chunk + 50 字 overlap，平衡语义完整性和检索精度
- **实际应该做的**：针对具体数据做 ablation（对比实验），找到最优值

---

**Q5：向量数据库的索引算法了解哪些？**

- **Flat（暴力）**：100% 精确，数据量大时慢
- **IVFFlat**：分桶检索，速度提升 10~100 倍，精度损失 < 5%
- **HNSW**：图结构，速度最快，内存占用较大，是目前主流
- **PQ（Product Quantization）**：向量压缩，节省内存，精度略降

---

**Q6：你的项目没有用 LangChain 全套，为什么？**

> 这是面试的好加分点，说明自己理解原理而不是只会调包。

LangChain 封装很重，对于明确的 RAG 场景，自己实现核心链路更轻量：

- Embedding：直接调 DashScope API，20 行代码搞定
- 向量存储：直接用 Supabase pg + 原生 SQL
- 检索：手写余弦相似度排序，完全可控
- 唯一用到的是 `RecursiveCharacterTextSplitter`，因为文本切割的边界逻辑比较繁琐，用现成的省事

**结论**：LangChain 适合快速原型，生产环境如果链路固定、对性能和可控性有要求，自己实现更清晰。

---

_最后更新：2026-04-03_
