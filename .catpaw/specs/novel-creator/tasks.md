# 实现计划：创造世界 —— AI 辅助小说创作工坊

## 概述

使用 Next.js + TypeScript + MiniMax API 实现 AI 辅助小说创作工坊。核心是基于 IndexedDB 的跨会话记忆系统，通过分层摘要压缩策略保证百章长篇不失忆。

## 任务

- [-] 1. 基础设施：数据模型 + IndexedDB 层
  - [-] 1.1 定义完整 TypeScript 数据类型（`src/types/novel.ts`）
    - 定义 `NovelProject`, `OutlineData`, `WorldData`, `CharacterProfile`, `PlotAct`, `Foreshadow`, `Chapter`, `GlossaryEntry`, `ActSummary`, `StoryBibleSnapshot` 等全部接口
    - _需求: 11.1, 8, 9_

  - [ ] 1.2 实现 IndexedDB 封装层（`src/lib/novelDB.ts`）
    - 使用 `idb` 库创建 `novel-creator` 数据库
    - 实现 `getProject`, `saveProject`, `listProjects`, `deleteProject` 函数
    - 实现版本快照：`createSnapshot`, `listSnapshots`, `restoreSnapshot`（保留最新5个）
    - 实现 IndexedDB 不可用时降级到 localStorage 的 fallback
    - _需求: 11.1, 11.7, 10.1_

  - [x]* 1.3 为 IndexedDB 层生成单元测试（TestAgent）
    - 测试读写 round-trip 正确性
    - 测试版本快照数量上限（≤5）
    - _需求: 11.1, 11.7_

- [ ] 2. 记忆系统：Story Bible 上下文构建器
  - [ ] 2.1 实现 Story Bible 上下文构建器（`src/lib/novelContext.ts`）
    - 实现 `buildStoryBibleContext(project, targetChapterNum)` 函数
    - 按分层策略注入：固定设定层 → 人物档案层 → 阶段摘要层 → 近期章节摘要层 → 当前任务层
    - 当 chapter 数 > 20 时自动使用 actSummaries 替换早期章节摘要
    - 实现 `buildGlossaryPrompt(glossary, upToChapter)` 词汇表注入
    - _需求: 11.2, 11.3, 11.4, 11.5, 9.2_

  - [x]* 2.2 为上下文构建器编写属性测试
    - **属性 3：上下文注入完整性** — 对任意 N 章状态，验证生成第 N+1 章请求包含全部必需字段
    - **属性 4：词汇表命名一致性** — 验证只注入 firstAppeared ≤ targetChapterNum 的词条
    - **属性 6：阶段摘要触发条件** — N>20 时验证覆盖章节数 = N-10
    - **Validates: 需求 11.2, 11.3, 11.4, 11.5**

- [ ] 3. 后端 API 层
  - [ ] 3.1 实现大纲生成 API（`src/pages/api/novel/outline.ts`）
    - `POST /api/novel/outline`，接收 `{ idea: string }`
    - 调用 MiniMax API，返回结构化 `OutlineData` JSON
    - 提示词要求 AI 以 JSON 格式输出大纲各字段
    - _需求: 2.1_

  - [ ] 3.2 实现章节生成 API（`src/pages/api/novel/generate.ts`，SSE 流式）
    - `POST /api/novel/generate`，接收 `{ storyBibleContext: string, chapterNumber: number, chapterGoal: string }`
    - 复用现有 `callLLM` 基础设施，改为 SSE 流式输出
    - 生成目标 2000-4000 字
    - _需求: 8.2_

  - [ ] 3.3 实现章节摘要生成 API（`src/pages/api/novel/summarize.ts`）
    - `POST /api/novel/summarize`，接收章节全文
    - 要求 AI 压缩为 ≤ 300 汉字摘要，保留关键事件/人物变化/伏笔状态
    - _需求: 11.3, 8.4_

  - [ ] 3.4 实现 AI 修改建议 API（`src/pages/api/novel/suggest.ts`）
    - `POST /api/novel/suggest`，接收章节内容 + 精简 Story Bible
    - 返回节奏/逻辑/人物一致性三维度建议
    - _需求: 8.5_

  - [x]* 3.5 为 API 层生成单元测试（TestAgent）
    - Mock MiniMax API，验证提示词结构
    - 验证摘要长度约束（≤300字）
    - _需求: 11.3_

- [ ] 4. Wizard 向导组件
  - [ ] 4.1 实现向导主容器（`src/components/NovelCreator/index.tsx`）
    - 管理 `currentStep` 状态和 `NovelProject` 全局状态
    - 实现 debounce 自动保存（800ms），调用 `novelDB.saveProject`
    - 渲染 `WizardNav` + 当前步骤组件
    - _需求: 10.1, 11.1_

  - [ ] 4.2 实现 Step 1：灵感输入与大纲（`steps/IdeaInput.tsx`）
    - 文本域输入灵感，"AI 生成大纲"按钮调用 `/api/novel/outline`
    - 结构化表单展示大纲各字段，支持逐项编辑
    - "重新生成"按钮传入当前修改内容
    - _需求: 2.1, 2.2, 2.3, 2.4_

  - [ ] 4.3 实现 Step 2：世界观构建（`steps/WorldBuilder.tsx`）
    - 卡片布局展示世界观六个维度
    - "AI 补全"按钮根据大纲丰富世界观
    - _需求: 3.1, 3.2, 3.3_

  - [ ] 4.4 实现 Step 3：人物塑造（`steps/CharacterForge.tsx`）
    - AI 根据大纲建议初始角色列表
    - 角色卡片：六维信息表单 + "AI 生成小传"按钮
    - 支持增删角色
    - _需求: 4.1, 4.2, 4.3, 4.4_

  - [ ] 4.5 实现 Step 4：情节 & 伏笔（`steps/PlotPlanner.tsx`）
    - 分幕情节卡片列表，AI 根据大纲生成初稿
    - 伏笔列表：描述/埋设章节/回收章节/状态
    - _需求: 5.1, 5.2, 6.1_

  - [ ] 4.6 实现 Step 5：写作风格（`steps/StyleConfig.tsx`）
    - 叙事视角/风格/节奏/读者群的选项卡配置
    - "开始创作"按钮，跳转到 ChapterWriter
    - _需求: 7.1_

- [ ] 5. 章节创作主界面
  - [ ] 5.1 实现 ChapterWriter 主界面（`src/components/NovelCreator/ChapterWriter.tsx`）
    - 三栏布局：章节列表 + 富文本编辑器（textarea）+ 伏笔面板
    - 顶部栏：故事圣经入口 + 记忆状态指示器 + 统计数据
    - 章节列表：显示状态（pending/generating/draft/done）+ 点击切换
    - _需求: 8.1, 8.3_

  - [ ] 5.2 实现章节生成逻辑
    - "生成本章"点击 → 调用 `buildStoryBibleContext` → 发 SSE 请求到 `/api/novel/generate`
    - 流式内容实时渲染到编辑器
    - 生成完成 → 自动调用 `/api/novel/summarize` 生成摘要并存入 IndexedDB
    - 更新词汇表：提取新出现的人名/地名加入 glossary
    - _需求: 8.2, 8.4, 11.2, 11.3, 11.5_

  - [ ] 5.3 实现 ForeshadowPanel（`src/components/NovelCreator/ForeshadowPanel.tsx`）
    - 显示所有伏笔及当前状态
    - 支持点击切换状态（未埋→已埋→已回收）
    - 当前章节相关伏笔高亮显示
    - _需求: 6.1, 6.2, 6.3_

  - [ ] 5.4 实现 StoryBibleDrawer（`src/components/NovelCreator/StoryBibleDrawer.tsx`）
    - 抽屉面板展示完整 Story Bible
    - 导出为 Markdown / TXT 功能
    - 导出/导入 Story Bible JSON（跨设备迁移）
    - 版本快照列表 + 回滚功能
    - _需求: 10.4, 11.6, 11.7_

  - [ ] 5.5 实现 MemoryStatus 记忆状态指示器（`src/components/NovelCreator/MemoryStatus.tsx`）
    - 右下角常驻，显示"已保存/保存中/未保存"
    - 显示最后保存时间
    - _需求: 11.1_

- [x] 6. 创作工坊页面 + 书单首页入口
  - [ ] 6.1 创建创作工坊页面（`src/pages/book/create/index.tsx`）
    - 从 IndexedDB 读取存档，有存档则直接进 ChapterWriter，无则进 Wizard
    - 全屏宇宙风格布局，与书单页一致
    - _需求: 10.2_

  - [x] 6.2 在书单首页添加"创造世界"入口（`src/pages/book/index.tsx`）
    - 在底部书单 Hints 区域或右上角新增"✦ 创造世界"按钮
    - 金色/琥珀色发光风格，点击跳转 `/book/create`
    - _需求: 1.1, 1.2_

  - [x]* 6.3 为完整流程生成集成测试（TestAgent）
    - 模拟：新建项目 → 完成 Wizard → 生成章节 → 关闭重开 → 验证数据恢复
    - _需求: 11.2_

## 备注

- 标有 `*` 的任务为可选测试任务，可以跳过以加快 MVP 完成
- IndexedDB 建议使用 `idb` 库（`npm install idb`）
- 流式 SSE 复用现有 `/api/rag/stream` 的实现模式
- 属性测试使用 `fast-check` 库（`npm install fast-check --save-dev`）
- TestAgent 会确保测试用例可执行并通过，无需手动维护测试文件

