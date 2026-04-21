# 创造世界 —— AI 辅助小说创作工坊 架构文档

## 一、整体架构概览

```
用户浏览器
    │
    ├─ 前端（Next.js 静态导出 → 阿里云 OSS）
    │       /book          ← 书单首页，含"创造世界"入口
    │       /book/create   ← 创作工坊页面（项目列表 + 跨设备恢复）
    │
    │       IndexedDB      ← 本地持久化（跨会话记忆核心）
    │       localStorage   ← 隐私模式降级方案 + deviceId 存储
    │       Supabase       ← 云端备份（双写，跨设备同步）
    │
    └─ 后端（Express → 阿里云 ECS 47.94.103.221:3001）
            /api/novel/chat       ← 通用 AI 对话（向导步骤）
            /api/novel/outline    ← 大纲生成
            /api/novel/summarize  ← 章节摘要压缩
            /api/novel/suggest    ← AI 修改建议
            /api/novel/generate   ← 章节流式生成（SSE）
                    │
                    └─ MiniMax API（MiniMax-M2.7 推理模型）
```

**核心设计约束**：AI 本身没有跨会话记忆。系统通过将完整的"故事圣经"（Story Bible）存储在浏览器 IndexedDB 并同步到 Supabase，每次调用 AI 时重新注入，实现"不失忆"的长篇创作体验。数据同时本地存储和云端备份，支持跨设备无缝切换。

---

## 二、目录结构

```
my-blog/
├── src/
│   ├── pages/
│   │   ├── book/
│   │   │   ├── index.tsx              # 书单首页（含创造世界入口按钮）
│   │   │   └── create/
│   │   │       └── index.tsx          # 创作工坊主页（项目列表 + 跨设备恢复）
│   │   └── api/
│   │       └── novel/                 # Next.js API Routes（本地开发用，线上不生效）
│   │           ├── chat.ts
│   │           ├── outline.ts
│   │           ├── generate.ts
│   │           ├── summarize.ts
│   │           └── suggest.ts
│   │
│   ├── components/
│   │   └── NovelCreator/
│   │       ├── index.tsx              # 顶层容器（全局状态 + 自动保存）
│   │       ├── WizardNav.tsx          # 向导步骤导航条
│   │       ├── ChapterWriter.tsx      # 章节创作主界面（三栏布局）
│   │       ├── ForeshadowPanel.tsx    # 伏笔追踪侧边栏
│   │       ├── StoryBibleDrawer.tsx   # 故事圣经查看/导出抽屉
│   │       ├── MemoryStatus.tsx       # 右下角记忆状态指示器
│   │       └── steps/
│   │           ├── IdeaInput.tsx      # Step 1: 灵感输入 & 大纲生成
│   │           ├── WorldBuilder.tsx   # Step 2: 世界观构建
│   │           ├── CharacterForge.tsx # Step 3: 人物塑造
│   │           ├── PlotPlanner.tsx    # Step 4: 情节 & 伏笔规划
│   │           ├── StyleConfig.tsx    # Step 5: 写作风格设定
│   │           └── utils.ts           # 公共工具（callLLM、extractJSON）
│   │
│   ├── lib/
│   │   ├── novelDB.ts                 # IndexedDB 封装层（idb 库）+ 云端双写触发
│   │   ├── novelSync.ts               # Supabase 云端同步层（新增）
│   │   └── novelContext.ts            # Story Bible → AI 提示词构建器
│   │
│   └── types/
│       └── novel.ts                   # 所有 TypeScript 类型定义
│
└── fc-api/
    └── src/
        ├── index.ts                   # Express 服务入口（含所有 /api/novel/* 路由）
        └── lib/
            └── llm.ts                 # MiniMax API 封装（callLLM / callLLMStream）
```

---

## 三、用户流程

```
书单首页 /book
    │
    │  点击「✦ 创造世界」
    ▼
创作工坊 /book/create
    │
    ├── IndexedDB 有存档？
    │       │
    │   Yes │                           No
    │       ▼                           ▼
    │  项目列表（选择恢复）         新建项目
    │       │
    │       ├── 显示当前设备码（8位）
    │       ├── 「从其他设备恢复」按钮
    │       │       └── 输入另一台设备码 → 从 Supabase 拉取 → 写入本地
    │       │
    │       └──────────┬────────────────────┘
    │                  ▼
    │          Wizard 5步向导
    │          ├── Step 1: 灵感 & 大纲
    │          ├── Step 2: 世界观
    │          ├── Step 3: 人物塑造
    │          ├── Step 4: 情节 & 伏笔
    │          └── Step 5: 写作风格
    │                  │
    │                  ▼
    └──────── ChapterWriter 创作主界面
                       │
                       ├── 点击「AI 生成」→ SSE 流式生成章节内容
                       ├── 手动编辑内容
                       ├── 点击「AI 建议」→ 获取修改意见
                       ├── 章节完成后自动生成摘要（压缩进记忆）
                       └── 停止编辑 800ms 后自动保存到 IndexedDB + 异步同步 Supabase
```

---

## 四、跨会话记忆系统（核心）

### 设计原理

AI 模型本身没有跨 API 调用的记忆。每次生成章节时，系统从 IndexedDB 读取完整的故事圣经，构建一个结构化的系统提示词注入给 AI，让 AI"看到"所有历史，从而实现"记忆"。

### 记忆分层策略（每次生成章节时注入）

```
系统提示词（System Prompt）结构
├── 层1：固定设定（~800 tokens，始终注入）
│   ├── 世界观：类型、力量体系、地理、历史、势力
│   ├── 写作风格：叙事视角、语言风格、节奏
│   └── 词汇表：所有已出现的专有名词（防止 AI 自造名词）
│
├── 层2：人物档案（~600 tokens，始终注入）
│   └── 所有角色的简版档案（姓名/性格/动机/成长弧）
│
├── 层3：远期历史（~500 tokens，章节数>20时启用）
│   └── 阶段摘要：每10章合并为一份≤500字摘要
│
├── 层4：近期章节摘要（~1200 tokens，始终注入）
│   └── 最近10章的章节摘要（每章≤300汉字）
│
└── 层5：当前任务（~400 tokens，始终注入）
    ├── 当前所在的情节幕
    ├── 本章需要埋设/回收的伏笔
    └── 本章写作目标

总计约 3500-4500 tokens（MiniMax 支持 128k context，完全充裕）
```

### 摘要压缩机制

每完成一章，立即调用 `/api/novel/summarize` 将 2000-4000 字的章节内容压缩为 ≤300 汉字的摘要，存入 `chapter.summary`。当章节数超过 20 时，前面的章节摘要进一步合并为阶段摘要（10章 → 1份≤500字），从而确保无论写多少章，注入 AI 的 token 数始终可控。

### 数据存储方案

#### 本地层：IndexedDB（`idb` 库封装）

| Object Store | Key | 存储内容 |
|---|---|---|
| `projects` | projectId | 完整的 NovelProject（包含所有章节、人物、设定） |
| `snapshots` | autoIncrement + byProject 索引 | 版本快照（最多保留5个/项目） |

**降级策略**：隐私模式下 IndexedDB 不可用时，自动降级到 `localStorage` 并显示警告。

#### 云端层：Supabase（PostgreSQL）

表结构：

```sql
create table if not exists novel_projects (
  id text primary key,
  device_id text not null,
  title text,
  data jsonb not null,            -- 完整 NovelProject JSON
  updated_at timestamptz default now()
);
create index if not exists novel_projects_device_id_idx on novel_projects(device_id);
```

**双写机制**：每次 `saveProject()` 本地写入成功后，异步调用 `syncProjectToCloud()` 进行 upsert，失败时静默降级（不影响本地体验）。

**RLS 策略**：Supabase 已开启 Row Level Security，允许 anon 用户对 `novel_projects` 表进行 select/insert/update/delete 操作（通过设备码区分数据归属）。

---

## 五、跨设备同步（novelSync.ts）

### 设备标识

每台设备首次访问时，在 `localStorage` 生成一个 8 位随机大写设备码（如 `AB12CD34`），作为该设备在 Supabase 中的身份标识。用户可以在创作工坊项目列表页看到自己的设备码。

### 同步接口

| 函数 | 功能 |
|---|---|
| `getDeviceId()` | 获取/生成本设备唯一标识 |
| `syncProjectToCloud(project)` | 将项目 upsert 到 Supabase（saveProject 内部自动调用） |
| `fetchProjectsFromCloud()` | 拉取本设备的所有云端项目 |
| `fetchProjectsByDeviceId(deviceId)` | 根据指定设备码拉取项目（换设备恢复用） |
| `deleteProjectFromCloud(projectId)` | 从云端删除指定项目 |

### 跨设备恢复流程

1. 在旧设备上，复制创作工坊页面展示的设备码
2. 在新设备上，点击「从其他设备恢复」，输入旧设备码
3. 系统调用 `fetchProjectsByDeviceId()` 从 Supabase 拉取该设备所有项目
4. 逐个调用 `saveProject()` 写入本地 IndexedDB，同时以新设备码上传到 Supabase

---

## 六、核心数据模型

```typescript
interface NovelProject {
  id: string;                    // 项目唯一 ID
  title: string;
  currentStep: WizardStep;       // 'outline'|'world'|'characters'|'plot'|'style'|'writing'

  // Wizard 5步产出的设定
  outline: OutlineData;          // 大纲（类型/主题/背景/冲突/走向）
  world: WorldData;              // 世界观（力量体系/地理/历史/势力）
  characters: CharacterProfile[];// 人物档案（六维：外貌/性格/背景/动机/成长/关系）
  plotActs: PlotAct[];           // 情节幕（核心事件/情绪曲线/章节范围）
  foreshadows: Foreshadow[];     // 伏笔（描述/埋设章节/回收章节/状态）
  style: StyleConfig;            // 写作风格（视角/语言/节奏/目标读者）

  // 章节系统
  chapters: Chapter[];           // 每章含：正文(2000-4000字) + 摘要(≤300字)

  // 记忆辅助
  glossary: GlossaryEntry[];     // 命名一致性词典（专有名词 + 首次出现章节）
  actSummaries: ActSummary[];    // 阶段摘要（章节数>20时自动归档）

  snapshots: StoryBibleSnapshot[]; // 版本快照（最多5个）
  stats: NovelStats;
  updatedAt: number;             // 最后更新时间戳（毫秒）
}
```

---

## 七、API 接口

所有 API 部署在 ECS 服务器 `http://47.94.103.221:3001`，由 `fc-api/src/index.ts` 的 Express 服务提供。

| 接口 | 方法 | 功能 | 输入 | 输出 |
|---|---|---|---|---|
| `/api/novel/chat` | POST | 向导步骤通用 AI 对话 | `{ systemPrompt, userPrompt }` | `{ content }` |
| `/api/novel/outline` | POST | 根据灵感生成结构化大纲 | `{ idea }` | `OutlineData` |
| `/api/novel/generate` | POST | 流式生成章节内容（SSE） | `{ systemPrompt, chapterNumber, chapterTitle }` | SSE: `delta` / `done` / `error` |
| `/api/novel/summarize` | POST | 将章节内容压缩为≤300字摘要 | `{ content, chapterNumber, title }` | `{ summary }` |
| `/api/novel/suggest` | POST | 对章节草稿提供分维度修改建议 | `{ content, worldContext, chapterNumber }` | `{ suggestions[] }` |

**注意**：
- `/api/novel/generate` 是唯一的流式接口（SSE），其余为普通 JSON 接口
- 前端通过 `NEXT_PUBLIC_API_BASE` 环境变量指向服务器地址
- `fc-api/src/lib/llm.ts` 中的 `callLLMStream` 默认 `max_tokens: 8192, temperature: 0.75`；`callLLM` 默认 `max_tokens: 4096, temperature: 0.3`

---

## 八、前端关键组件

### NovelCreator/index.tsx（顶层容器）
- 从 IndexedDB 加载项目数据
- 全局状态管理（`NovelProject` 对象）
- 自动保存：用户停止编辑 800ms 后触发（debounce），保存到 IndexedDB 并异步同步 Supabase
- 根据 `currentStep` 决定渲染 Wizard 还是 ChapterWriter

### /book/create/index.tsx（创作工坊入口页）
- 从 IndexedDB 加载项目列表，支持选择继续或新建
- 展示当前设备码，支持「从其他设备恢复」功能
- 恢复流程：输入旧设备码 → 调用 `fetchProjectsByDeviceId` → 批量 `saveProject` 到本地

### ChapterWriter.tsx（创作主界面）
三栏布局：左侧章节列表 + 中间编辑器 + 右侧伏笔面板

核心流程：
1. 用户点击「AI 生成」→ 调用 `novelContext.ts` 构建 Story Bible → 发送 SSE 请求 → 流式渲染文字
2. 章节完成后 → 自动调用摘要接口 → 将摘要存回 IndexedDB
3. 用户点击「AI 建议」→ 调用建议接口 → 展示分维度修改意见

### novelContext.ts（提示词构建器）
唯一负责将 IndexedDB 中的结构化数据转换为 AI 系统提示词的模块，按分层策略拼接各层内容，并控制 token 数量（近期章节超过10章时只保留最近10章）。

---

## 九、部署架构

```
代码提交 git push
    │
    ├── GitHub Actions 触发
    │       ├── npm ci --legacy-peer-deps
    │       ├── npm run export（STATIC_EXPORT=true next build）
    │       │       注入环境变量：
    │       │         NEXT_PUBLIC_API_BASE（→ fc-api ECS 地址）
    │       │         NEXT_PUBLIC_SUPABASE_URL
    │       │         NEXT_PUBLIC_SUPABASE_ANON_KEY
    │       │       生成 out/ 静态文件
    │       └── node scripts/upload-oss.js
    │               上传到阿里云 OSS（静态托管）
    │
    └── fc-api 手动部署（API 服务有改动时）
            ├── 本地：cd fc-api && npm run build
            ├── scp -r dist root@47.94.103.221:/root/fc-api/
            └── ssh root@47.94.103.221 "pm2 restart blog-api"
```

| 模块 | 托管方式 | 地址 |
|---|---|---|
| 前端（Next.js 静态） | 阿里云 OSS | lusuijie.com.cn |
| API 服务（Express） | 阿里云 ECS + PM2 | 47.94.103.221:3001 |
| 云端数据同步 | Supabase（PostgreSQL） | `novel_projects` 表 |
| 向量数据库（RAG） | Supabase | PostgreSQL + pgvector |
| AI 模型 | MiniMax API | MiniMax-M2.7 |

---

## 十、本地开发

```bash
# 启动前端（Next.js dev server，API Routes 可用）
npm run dev

# 环境变量（.env.local）
NEXT_PUBLIC_API_BASE=http://47.94.103.221:3001   # 直接复用线上 fc-api
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
MINIMAX_API_KEY=sk-xxx
```

本地开发时：
- 小说 API 请求直接发到线上的 `47.94.103.221:3001`，不依赖本地 Express（`src/pages/api/novel/` 目录仅作为备用）
- Supabase 同步也指向同一个云端数据库，本地和线上共享数据

---

## 十一、关键设计决策

| 决策 | 方案 | 原因 |
|---|---|---|
| 持久化主存储 | IndexedDB | 容量大（无限制），适合存储完整小说数据 |
| 云端备份 | Supabase anon key | 无需用户注册，以设备码区分数据，简单可靠 |
| AI 记忆方案 | 每次注入全量 Story Bible | AI 无原生记忆，注入上下文是唯一可靠方案 |
| API 服务部署 | 独立 Express（fc-api） | Next.js 静态导出不支持 API Routes |
| 跨设备同步 | 双写 + 设备码恢复 | 无用户体系，设备码方案最简化 |
| 流式生成 | SSE（Server-Sent Events） | 章节生成耗时长，流式输出提升用户体验 |
