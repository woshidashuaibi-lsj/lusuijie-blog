# 书单问答流式输出实现文档

> 记录书单 RAG 问答模块从 0 到 1 的流式输出实现过程，以及踩过的所有坑。

---

## 一、整体架构

```
用户输入问题
     │
     ▼
[前端 BookChat 组件]
  - 发送 POST /api/rag/stream
  - 读取 SSE 流，逐字渲染
     │
     ▼（HTTP Long Connection / SSE）
[后端 FC API - Express]
  - 接收问题
  - 调用 queryStream() 做 RAG 检索
  - 将 MiniMax 原始流转发给前端
     │
     ▼
[RAG 核心 - rag.ts]
  - 将问题向量化（DashScope Embedding）
  - 在 Supabase PostgreSQL 中做余弦相似度检索
  - 取 Top-5 相关段落构建 Prompt
  - 调用 callLLMStream() 获取流
     │
     ▼
[LLM 封装 - llm.ts]
  - 调用 MiniMax API（MiniMax-M2.7）
  - stream: true 开启流式输出
  - 返回 ReadableStream<Uint8Array>（原始 SSE 字节流）
     │
     ▼（MiniMax SSE）
[MiniMax API]
  - 分块返回 data: {...choices[0].delta.content...}
  - 最后发 data: [DONE]
```

---

## 二、后端流式实现

### 2.1 LLM 层（`fc-api/src/lib/llm.ts`）

普通调用和流式调用是两个独立函数：

```typescript
/** 流式调用，返回 Response 的 body（SSE 原始流），由调用方负责管道转发 */
export async function callLLMStream(messages: LLMMessage[]): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages,
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,      // ← 关键：开启流式
    }),
  });

  if (!res.body) throw new Error('MiniMax API 未返回流');
  return res.body;       // 返回原始字节流，不在这里解析
}
```

**设计选择**：`llm.ts` 只负责拿到原始流并返回，不做任何 SSE 解析。解析工作交给上层，职责分离。

---

### 2.2 RAG 层（`fc-api/src/lib/rag.ts`）

`queryStream` 函数负责 RAG 检索部分，完成后把 LLM 流和 sources 一起往上传：

```typescript
export async function queryStream(question: string): Promise<{
  sources: RagSource[];
  stream: ReadableStream<Uint8Array>;
}> {
  // 1. 将问题向量化
  const questionVector = await embeddings.embedQuery(question);

  // 2. 从 Supabase PostgreSQL 检索所有向量，手动计算余弦相似度
  const result = await pool.query(
    'SELECT id, content, metadata, embedding FROM rag_documents WHERE collection = $1',
    [COLLECTION_NAME]
  );

  // 3. 排序取 Top-5，附加章节类型惩罚（appendix × 0.8）
  const scoredDocs = result.rows
    .map(row => ({ ...row, score: cosineSimilarity(questionVector, row.embedding) * penalty }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  // 4. 构建 Prompt（注入相关段落）
  const messages = [
    { role: 'system', content: `你是...相关段落：\n${context}` },
    { role: 'user', content: question },
  ];

  // 5. 调用流式 LLM，直接返回原始流（不在这里解析）
  const stream = await callLLMStream(messages);
  return { sources, stream };
}
```

---

### 2.3 接口层（`fc-api/src/index.ts`）

`/api/rag/stream` 是核心接口，设置 SSE 响应头后，对 MiniMax 流进行逐行解析，并转换为我们自定义的 SSE 事件格式推给前端：

```
MiniMax 格式（标准 OpenAI SSE）：
  data: {"choices":[{"delta":{"content":"你好"}}]}
  data: [DONE]

我们向前端推送的格式：
  event: sources\ndata: [...]\n\n
  event: delta\ndata: {"text":"你好"}\n\n
  event: done\ndata: {}\n\n
  event: error\ndata: {"message":"..."}\n\n
```

**完整流程**：

1. 设置 SSE 响应头（`Content-Type: text/event-stream`）
2. 调用 `queryStream()` 拿到 `sources` + `stream`
3. 立刻推送 `sources` 事件给前端
4. 逐行读取 MiniMax SSE 流，解析 `choices[0].delta.content`
5. 每解析到一段文字，推送 `delta` 事件
6. 流结束后推送 `done` 事件
7. 任何错误推送 `error` 事件

---

## 三、前端流式消费

前端 `BookChat` 组件（`src/components/BookChat/index.tsx`）通过 `fetch` + `ReadableStream` 消费 SSE：

```typescript
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buf += decoder.decode(value, { stream: true });
  const lines = buf.split('\n');
  buf = lines.pop() ?? ''; // 保留未完整的最后一行

  let eventName = '';
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const data = JSON.parse(line.slice(5).trim());
      // 根据 eventName 分发处理
    }
  }
}
```

**状态机**：

| 事件名 | 处理逻辑 |
|--------|---------|
| `sources` | 暂存到 `pendingSources`，等流结束后追加到最后一条消息 |
| `delta` | 第一次收到时插入空 assistant 消息占位；之后每次追加文字 |
| `done` | 将 `pendingSources` 写入最后一条 assistant 消息 |
| `error` | 存入 `serverError` 变量，流结束后统一抛出 |

---

## 四、踩过的坑

### 坑 1：MiniMax-M2.7 推理模型 `content` 为空

**现象**：流式输出有时没有任何文字，只有 `sources` 和 `done` 事件，但接口显示是通的。

**原因**：MiniMax-M2.7 是推理模型，它在思考阶段会把内容放在 `delta.reasoning_content` 而不是 `delta.content`，有时 `content` 字段是空字符串。

**解决**：取值时做 fallback：

```typescript
const delta = choice?.delta?.content || choice?.delta?.reasoning_content || '';
```

非流式调用的 `callLLM` 同样处理：

```typescript
const content = msg?.content || msg?.reasoning_content;
```

---

### 坑 2：MiniMax API 限流（status_code: 2064）

**现象**：偶发性完全没有输出，调试发现 MiniMax API 返回了：

```json
{
  "choices": null,
  "base_resp": { "status_code": 2064, "status_msg": "触发限流" }
}
```

此时 `choices` 为 `null`，导致 `choice` 取不到任何内容。

**解决**：
1. 检测非零 `status_code` 时主动抛出错误
2. 外层加最多 3 次重试，每次等待 1 秒
3. 只有限流错误才重试，其他错误直接退出

```typescript
const MAX_RETRY = 3;
for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
  if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
  try {
    // ... 执行流式请求 ...
    const statusCode = json.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      throw new Error(`MiniMax 限流: ${statusCode} ${json.base_resp?.status_msg}`);
    }
    return; // 成功，退出
  } catch (err) {
    if (!err.message.startsWith('MiniMax 限流')) break; // 非限流错误不重试
  }
}
```

---

### 坑 3：流有内容但整个流没有 delta（兜底逻辑）

**现象**：某些情况下 MiniMax 不以 `delta` 方式推送，而是在 `finish_reason` 时的 `message.content` 里一次性给出所有内容。

**解决**：在 `finish_reason` 事件处理时加兜底：

```typescript
if (choice?.finish_reason && choice?.message && deltaCount === 0) {
  const msgContent = choice.message.content || choice.message.reasoning_content || '';
  if (msgContent) {
    send('delta', { text: msgContent }); // 一次性发给前端
  }
}
```

---

### 坑 4：等待时出现两个气泡

**现象**：用户发送问题后，等待回答期间界面会同时显示"打字动画气泡"和"空内容气泡"，造成视觉上两个 AI 气泡。

**原因**：早期代码在 `setLoading(true)` 后立即 push 了一条空的 `assistant` 消息作为占位，同时也有打字动画的条件渲染，两者都满足条件就同时显示了。

**解决**：**不提前插入占位消息**，等收到第一个 `delta` 时再插入：

```typescript
// handleSubmit 里：
setLoading(true);
setStreaming(false);
// ❌ 不再预先插入：setMessages(prev => [...prev, { role: 'assistant', content: '' }])

// 收到第一个 delta 时才插入：
if (!assistantMsgAdded) {
  setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
  assistantMsgAdded = true;
}
```

同时修正打字动画的显示条件，只在"loading 且还未开始 streaming 且最后一条不是 assistant"时显示：

```tsx
{loading && !streaming && messages[messages.length - 1]?.role !== 'assistant' && (
  <div className={styles.typing}>...</div>
)}
```

---

### 坑 5：服务端 error 事件被内层 catch 吞掉

**现象**：后端发送了 `event: error` 事件，前端没有显示任何错误提示，沉默失败。

**原因**：SSE 读取循环在一个 `try/catch` 内部，原本在 `error` 事件处直接 `throw new Error(msg)`，但这个 throw 会被 `while` 循环外层的 `catch` 捕获处理，然而还有更内层的 `try/catch`（用于 JSON.parse），导致错误被吞掉。

**解决**：改用变量收集，不在 SSE 解析循环内 throw：

```typescript
let serverError: string | null = null;

// SSE 解析中：
} else if (eventName === 'error') {
  serverError = data.message || '服务器错误'; // 只收集，不 throw
}

// 流结束后：
if (serverError) {
  throw new Error(serverError); // 统一抛出，被外层 catch 处理
}
```

外层 catch 会将错误显示为带 ⚠️ 的 assistant 消息：

```typescript
catch (error) {
  const msg = error instanceof Error ? error.message : '未知错误';
  setMessages(prev => {
    const last = prev[prev.length - 1];
    if (last?.role === 'assistant' && last.content === '') {
      // 有空占位就替换
      return [...prev.slice(0, -1), { role: 'assistant', content: `⚠️ ${msg}` }];
    } else {
      return [...prev, { role: 'assistant', content: `⚠️ ${msg}` }];
    }
  });
}
```

---

### 坑 6：out/ 目录未更新导致线上内容陈旧

**现象**：本地删到只剩一本书，部署后线上还是显示三本书。

**原因**：`next.config.js` 里 `output: 'export'` 被注释掉了，`npm run build` 不再生成 `out/` 静态目录，OSS 部署脚本读的还是旧的 `out/`。

**解决**：恢复 `output: 'export'` 配置。

---

### 坑 7：本地环境无法连接后端

**现象**：本地 `npm run dev` 启动后，书单问答报错，无法访问 FC API。

**原因**：FC API 部署在阿里云函数计算（云服务器），本地没有这些环境变量，也无法直连 Supabase。

**解决**：在 `.env.local` 里配置 `NEXT_PUBLIC_API_BASE` 指向线上 FC API 地址，本地前端直接代理到线上后端：

```
NEXT_PUBLIC_API_BASE=http://47.94.103.221:3001
```

---

### 坑 8：流式光标与普通消息共存的样式问题

**现象**：流式输出时光标 `▋` 应该只出现在当前正在输出的那条消息末尾，但早期实现会在所有 assistant 消息上都显示。

**解决**：通过 `streaming` 状态 + 消息下标双重判断：

```tsx
<p className={`${styles.bubbleText} ${
  msg.role === 'assistant' && streaming && i === messages.length - 1
    ? styles.streamingCursor : ''
}`}>
```

CSS 通过 `::after` 伪元素 + `animation: blink` 实现：

```css
.streamingCursor::after {
  content: '▋';
  display: inline-block;
  color: #6366f1;
  animation: blink 0.7s step-end infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

---

## 五、当前技术选型说明

| 组件 | 技术 | 原因 |
|------|------|------|
| Embedding 模型 | 阿里云 DashScope `text-embedding-v2` | HuggingFace 模型需要自己部署，资源消耗大；DashScope 有 API，开箱即用 |
| 向量存储 | Supabase PostgreSQL + `pgvector` | 有托管方案，SQL 接口友好，余弦相似度计算稳定 |
| LLM | MiniMax-M2.7 | 国内可访问，有流式 API，价格合理 |
| 后端 | 阿里云函数计算（FC）+ Express | 按量付费，冷启动可接受，与 OSS 同生态 |
| 前端流式消费 | `fetch` + `ReadableStream` | 原生 API，无需额外依赖，兼容性好 |
| 协议 | SSE（Server-Sent Events） | 单向推送，天然适合 AI 逐字输出场景；比 WebSocket 轻量 |

---

## 六、数据流时序图

```
前端                    后端 FC API              MiniMax API
 │                          │                        │
 │  POST /api/rag/stream     │                        │
 │ ─────────────────────────>                        │
 │                          │  向量化问题              │
 │                          │  Supabase 检索           │
 │                          │                        │
 │                          │  POST /v1/chatcompletion_v2 (stream:true)
 │                          │ ──────────────────────────>
 │                          │                        │
 │  event: sources           │  data: {...delta...}   │
 │ <─────────────────────────  <──────────────────────│
 │                          │                        │
 │  event: delta (逐字)      │  data: {...delta...}   │
 │ <─────────────────────────  <──────────────────────│
 │  event: delta ...         │  ...                   │
 │ <─────────────────────────  <──────────────────────│
 │                          │  data: [DONE]           │
 │  event: done              │ <──────────────────────│
 │ <─────────────────────────                        │
 │                          │                        │
```

---

*文档生成日期：2026-04-01*
