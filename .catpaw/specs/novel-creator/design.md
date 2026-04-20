# 设计文档：创造世界 —— AI 辅助小说创作工坊

## 概述

在现有书单页面（`/book`）中新增"创造世界"入口，导航至独立的创作工坊页面（`/book/create`）。工坊以向导式（Wizard）多步骤流程引导用户完成前期准备，然后进入逐章创作模式。

**最核心的设计约束**：AI 不持有任何对话历史。每次生成请求必须从本地 IndexedDB 读取完整的 Story Bible 并注入提示词，通过**摘要压缩策略**将百万字小说的上下文控制在 token 限制内，从而实现跨会话"无失忆"记忆。

---

## 架构

```mermaid
graph TD
    A[书单首页 /book] -->|点击创造世界| B[创作工坊 /book/create]
    B --> C{IndexedDB 有存档?}
    C -->|否 - 新建| D[Wizard 向导: 5步准备]
    C -->|是 - 恢复| E[Chapter Writer 主界面]
    D -->|Step1 大纲| D1[IdeaInput]
    D -->|Step2 世界观| D2[WorldBuilder]
    D -->|Step3 人物| D3[CharacterForge]
    D -->|Step4 情节&伏笔| D4[PlotPlanner]
    D -->|Step5 风格| D5[StyleConfig]
    D5 --> E
    E --> F[Memory_System\nIndexedDB]
    E -->|生成章节| G[/api/novel/generate\nSSE 流式]
    G -->|注入 Story Bible| H[MiniMax API]
    H -->|流式文本| E
    F -->|每次修改自动保存| F
    F -->|版本快照| F
```

---

## 页面与组件结构

```
src/
  pages/
    book/
      create/
        index.tsx              ← 创作工坊主页面（Wizard 控制器）
      index.tsx                ← 书单首页（新增创造世界入口）
  components/
    NovelCreator/
      index.tsx                ← 顶层容器（全局状态 + IndexedDB）
      WizardNav.tsx            ← 向导步骤导航条
      steps/
        IdeaInput.tsx          ← Step 1：灵感输入 & 大纲生成
        WorldBuilder.tsx       ← Step 2：世界观构建
        CharacterForge.tsx     ← Step 3：人物塑造
        PlotPlanner.tsx        ← Step 4：情节细化 & 伏笔
        StyleConfig.tsx        ← Step 5：写作风格设定
      ChapterWriter.tsx        ← 主创作界面（章节列表 + 富文本编辑器）
      ForeshadowPanel.tsx      ← 侧边伏笔追踪面板
      StoryBibleDrawer.tsx     ← 故事圣经查看/导出抽屉
      MemoryStatus.tsx         ← 右下角记忆状态指示器
  lib/
    novelDB.ts                 ← IndexedDB 封装（idb 库）
    novelContext.ts            ← Story Bible → AI 提示词构建器
  pages/api/novel/
    generate.ts                ← 章节生成 API（SSE）
    outline.ts                 ← 大纲生成 API
    suggest.ts                 ← AI 修改建议 API
    summarize.ts               ← 章节摘要生成 API
```

---

## 核心数据模型

```typescript
// ── Story Bible（故事圣经）── 这是跨会话记忆的核心数据结构
interface NovelProject {
  id: string;                    // uuid，每个创作项目唯一
  title: string;
  createdAt: number;
  updatedAt: number;
  currentStep: WizardStep;       // 'outline' | 'world' | 'characters' | 'plot' | 'style' | 'writing'
  
  // ── 前期准备（Wizard 5步）──
  outline: OutlineData;
  world: WorldData;
  characters: CharacterProfile[];
  plotActs: PlotAct[];
  foreshadows: Foreshadow[];
  style: StyleConfig;
  
  // ── 章节系统 ──
  chapters: Chapter[];
  
  // ── 记忆系统 ──
  glossary: GlossaryEntry[];     // 命名一致性词典
  actSummaries: ActSummary[];    // 阶段摘要（每10章合并）
  
  // ── 元数据 ──
  stats: NovelStats;
  snapshots: StoryBibleSnapshot[]; // 版本快照，最多保留5个
}

// ── 大纲 ─────────────────────────────────────────────────
interface OutlineData {
  idea: string;                  // 原始灵感
  genre: string;                 // 类型：玄幻/仙侠/都市/科幻等
  theme: string;                 // 核心主题
  logline: string;               // 一句话故事概述
  setting: string;               // 故事背景
  conflict: string;              // 核心冲突
  arc: string;                   // 起承转合
  estimatedChapters: number;
}

// ── 世界观 ────────────────────────────────────────────────
interface WorldData {
  worldType: string;
  powerSystem: string;           // 力量体系（魔法/修炼/科技）
  geography: string;
  history: string;
  factions: string;              // 主要势力
  customs: string;               // 风俗文化
  misc: string;
}

// ── 人物档案 ─────────────────────────────────────────────
interface CharacterProfile {
  id: string;
  name: string;
  avatar: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  appearance: string;
  personality: string;
  backstory: string;
  motivation: string;
  arc: string;                   // 成长弧
  relationships: string;
  bio: string;                   // AI 生成的完整小传
}

// ── 情节幕 ────────────────────────────────────────────────
interface PlotAct {
  id: string;
  name: string;
  coreEvent: string;
  characters: string[];          // 涉及人物 id
  emotionCurve: 'rising' | 'falling' | 'twist' | 'climax' | 'resolution';
  chapterRange: [number, number]; // 预计起止章节
  notes: string;
}

// ── 伏笔 ─────────────────────────────────────────────────
interface Foreshadow {
  id: string;
  description: string;
  plantedChapter: number | null; // 埋设章节
  resolvedChapter: number | null;// 回收章节
  status: 'planned' | 'planted' | 'resolved';
  notes: string;
}

// ── 章节 ─────────────────────────────────────────────────
interface Chapter {
  id: string;
  number: number;
  title: string;
  plotActId: string;             // 属于哪一幕
  status: 'pending' | 'generating' | 'draft' | 'done';
  content: string;               // 完整章节文本（2000-4000字）
  summary: string;               // AI 压缩摘要（≤300字）← 记忆核心
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  foreshadowIds: string[];       // 本章涉及的伏笔
}

// ── 词汇表（命名一致性）────────────────────────────────────
interface GlossaryEntry {
  term: string;                  // 人名/地名/专有名词
  definition: string;            // 简短说明
  firstAppeared: number;         // 首次出现章节号
  type: 'person' | 'place' | 'concept' | 'item';
}

// ── 阶段摘要（超过20章时自动归档）────────────────────────
interface ActSummary {
  chapterRange: [number, number];
  summary: string;               // ≤500字，由10章摘要合并生成
}

// ── 版本快照 ─────────────────────────────────────────────
interface StoryBibleSnapshot {
  timestamp: number;
  label: string;                 // 例如"第5章完成后"
  data: Omit<NovelProject, 'snapshots'>; // 不含快照自身，防止递归
}
```

---

## 跨会话记忆系统设计（Memory System）

这是整个功能最关键的设计，解决"明天打开 AI 忘记剧情"问题。

### 设计原则

AI 本身没有跨会话记忆。我们通过**每次请求都重建完整上下文**来模拟记忆：
- 所有数据存储在浏览器 IndexedDB（比 localStorage 容量大得多，支持存储几十MB数据）
- 每次调用 AI 生成章节时，从 IndexedDB 读取 Story Bible，构建一个包含完整历史的系统提示词
- 用摘要压缩解决 token 限制问题

### 记忆分层策略

```
AI 接收到的上下文（每次生成新章节时注入）
├── 层1：固定设定（始终注入，~800 tokens）
│   ├── 世界观核心设定
│   ├── 写作风格要求
│   └── 词汇表（命名一致性）
│
├── 层2：人物档案（始终注入，~600 tokens）
│   └── 所有主要角色的简版档案
│
├── 层3：远期历史（阶段摘要，~500 tokens）
│   └── 第1-N章的合并摘要（每10章≤500字）
│   └── 仅在章节数>20时启用
│
├── 层4：近期章节摘要（始终注入，~1200 tokens）
│   └── 最近10章的 Chapter_Summary（每章≤300字）
│
├── 层5：当前任务（始终注入，~400 tokens）
│   ├── 当前幕情节节点
│   ├── 本章需要埋/收的伏笔
│   └── 本章写作目标
│
└── 层6：当前章节正文（生成中，目标2000-4000字）
```

### IndexedDB 存储方案

使用 `idb` 库（IndexedDB 的 Promise 封装）：

```typescript
// src/lib/novelDB.ts
const DB_NAME = 'novel-creator';
const DB_VERSION = 1;

// Object Stores:
// - projects: { key: projectId, value: NovelProject }
// - snapshots: { key: [projectId, timestamp], value: StoryBibleSnapshot }
```

### 自动保存机制

- 用户停止编辑 800ms 后自动触发保存（debounce）
- 保存时在 UI 右下角显示"记忆更新中…" → "已保存"状态
- 每完成一章自动创建版本快照，保留最近 5 个

### token 估算

| 层级 | 内容 | 估算 tokens |
|------|------|------------|
| 固定设定 | 世界观+风格+词汇表 | ~800 |
| 人物档案 | 5个主要角色 | ~600 |
| 阶段摘要 | 每10章500字 | ~750/组 |
| 近期10章摘要 | 每章300字×10 | ~1500 |
| 当前任务 | 情节节点+伏笔 | ~400 |
| **总计** | | **~3500-4500 tokens** |

MiniMax 模型支持 128k context，远超需求，保障了几百章的长篇创作。

---

## 向导流程设计（Wizard）

```
Step 1: 灵感 & 大纲
  用户输入：一段话的故事想法（可以很粗糙）
  AI 输出：结构化大纲（类型/主题/背景/冲突/走向）
  用户操作：修改大纲 → 确认

Step 2: 世界观
  AI 根据大纲建议世界观框架
  用户填写：世界规则/地理/历史/势力
  AI 补全：丰富世界观细节

Step 3: 人物塑造
  AI 根据大纲建议主要角色列表
  用户编辑每个角色的六维档案
  AI 生成：每个角色的完整小传

Step 4: 情节 & 伏笔
  AI 将大纲拆解为分幕情节图
  用户调整情节节点
  用户规划伏笔（埋设/回收章节）

Step 5: 写作风格
  叙事视角 / 语言风格 / 节奏 / 目标读者
  → 进入创作主界面
```

---

## API 设计

### POST /api/novel/outline （大纲生成）
- Input: `{ idea: string }`
- Output: `OutlineData`（JSON）

### POST /api/novel/generate （章节生成，SSE 流式）
- Input: `{ projectId: string, chapterNumber: number, storyBible: StoryBibleContext }`
- Output: SSE 流，event: `delta` | `done` | `error`
- `StoryBibleContext` 由前端从 IndexedDB 读取并构建，不依赖服务端存储

### POST /api/novel/summarize （章节摘要）
- Input: `{ content: string, chapterNumber: number, title: string }`
- Output: `{ summary: string }`（≤300字）

### POST /api/novel/suggest （修改建议）
- Input: `{ chapterContent: string, storyBible: StoryBibleContext }`
- Output: `{ suggestions: string[] }`（分维度建议）

---

## 用户界面设计

### 书单首页入口
在星球宇宙界面的**右上角或底部书单区域**新增"✦ 创造世界"按钮，使用发光的金色/琥珀色，与现有蓝紫色星球形成区分，暗示"这是创造，而非阅读"。

### 创作工坊主界面（Chapter Writer）
三栏布局：
```
┌─────────────────────────────────────────────────────┐
│  [故事圣经] [统计] [导出]        MemoryStatus: ✓已保存│
├──────────┬──────────────────────────┬───────────────┤
│ 章节列表  │    富文本编辑器           │  伏笔面板      │
│ Ch1 ✓   │    [第X章 章节标题]       │ ○ 伏笔A 已埋  │
│ Ch2 ✓   │                          │ ○ 伏笔B 待埋  │
│ Ch3 ✍   │    章节正文...            │               │
│ Ch4 ○   │                          │               │
│ + 新章节  │    [AI生成] [AI建议]      │               │
└──────────┴──────────────────────────┴───────────────┘
```

### 记忆状态指示器（MemoryStatus）
右下角常驻小组件，显示：
- `✓ 记忆已保存`（绿色）— 最后保存时间
- `↻ 保存中…`（动画）— 正在写入 IndexedDB
- `⚠ 未保存`（橙色）— 有未保存变更，提醒用户

---

## 正确性属性

*属性是在系统所有合法执行状态下都应成立的特征——对"系统应该做什么"的形式化陈述，是可机器验证的正确性保证。*

### 属性 1：Story Bible 持久化圆形属性（Round Trip）

*对于任意 NovelProject 对象 p，将 p 写入 IndexedDB 后再读取，所有字段应与 p 完全相等。*

**Validates: 需求 11.1, 11.2**

### 属性 2：章节摘要长度不变量（Invariant）

*对于任意已完成章节，其 `summary` 字段的汉字字数应始终不超过 300 字。*

**Validates: 需求 11.3, 8.4**

### 属性 3：上下文注入完整性（Property）

*对于任意创作状态（任意章节数 N），生成第 N+1 章的 API 请求体中，storyBibleContext 必须包含：世界观数据、所有角色档案、前 N 章的摘要或阶段摘要、当前幕情节节点。*

**Validates: 需求 11.2, 11.3, 11.4, 9.2**

### 属性 4：词汇表命名一致性（Invariant）

*对于任意章节生成请求，AI 系统提示中注入的词汇表，必须包含 glossary 中所有 `firstAppeared <= currentChapterNumber` 的词条，保证 AI 不重复定义已出现的名词。*

**Validates: 需求 11.5**

### 属性 5：版本快照上限不变量（Invariant）

*对于任意 NovelProject，其 snapshots 数组长度应始终 ≤ 5，超出时自动删除最旧的快照。*

**Validates: 需求 11.7**

### 属性 6：阶段摘要触发条件（Metamorphic）

*对于章节数量 N，当 N > 20 时，actSummaries 的总覆盖章节数应等于 N - 10（最近10章不归档）。*

**Validates: 需求 11.4**

---

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| IndexedDB 不可用（隐私模式） | 降级到 localStorage，显示"记忆功能受限"警告 |
| AI 生成超时（>30s） | 显示重试按钮，保留已生成的部分内容 |
| MiniMax API 限流 | 展示友好提示，建议等待后重试 |
| 章节生成内容为空 | 不覆盖已有内容，提示重新生成 |
| Story Bible 读取失败 | 阻塞 AI 生成，提示用户检查存储，防止"失忆"的章节 |

---

## 测试策略

### 单元测试（通过 TestAgent 生成）
- `novelDB.ts`：读写操作、版本控制
- `novelContext.ts`：提示词构建器，验证各层注入顺序
- 摘要长度验证函数

### 属性测试
- 使用 `fast-check` 库对上述 6 个正确性属性编写 PBT 用例
- 每个属性最少 100 次随机输入迭代
- 标签格式：`Feature: novel-creator, Property N: {描述}`

### 集成测试
- E2E：完整走完 Wizard 5 步 → 生成第一章 → 关闭页面 → 重新打开 → 验证数据完整恢复
- Mock MiniMax API 验证 Story Bible 注入内容的正确性

