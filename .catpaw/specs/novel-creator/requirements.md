# 需求文档：创造世界 —— AI 辅助小说创作工坊

## 介绍

在书单首页（多维世界图书馆）新增"创造世界"入口，进入后是一个 AI 辅助写作的完整工作台。用户提供小说灵感，AI 协助完成从世界构建到逐章创作的全流程，模拟真实小说家的写作过程。

## 术语表

- **Novel_Creator**：AI 小说创作工坊系统
- **World_Builder**：世界观构建模块
- **Outline_Editor**：大纲编辑器模块
- **Character_Forge**：人物塑造模块
- **Chapter_Writer**：章节生成与编辑模块
- **Context_Manager**：上下文管理器，维护已生成内容作为后续创作的参考
- **Memory_System**：跨会话记忆系统，确保用户下次打开页面时 AI 仍然完整记得整部小说的所有设定和已写内容
- **Story_Bible**：故事圣经，所有世界观/人物/章节摘要的结构化快照，是 Memory_System 的核心数据载体
- **Chapter_Summary**：章节摘要，每章完成后自动生成的 300 字以内内容压缩，用于节省 token 同时保留上下文
- **用户**：使用该功能进行小说创作的人
- **章节**：小说的一个独立章节单元，每次 AI 生成一章

---

## 需求

### 需求 1：书单首页入口

**用户故事：** 作为读者/创作者，我想在书单首页看到"创造世界"入口，以便进入 AI 写小说界面。

#### 验收标准

1. THE Novel_Creator SHALL 在书单首页（/book）展示一个"创造世界"按钮/入口，视觉风格与宇宙星球主题一致。
2. WHEN 用户点击"创造世界"入口，THE Novel_Creator SHALL 跳转到小说创作工坊页面（/book/create）。

---

### 需求 2：小说灵感输入与 AI 辅助大纲生成

**用户故事：** 作为创作者，我想输入一段小说的初步想法，让 AI 帮我扩展并生成完整的创作大纲，以便快速搭建故事框架。

#### 验收标准

1. WHEN 用户输入小说灵感文字并提交，THE Outline_Editor SHALL 调用 AI 生成包含以下结构的大纲：故事类型、核心主题、故事背景、主要冲突、故事走向（起承转合）、预估章节数。
2. WHEN AI 返回大纲，THE Outline_Editor SHALL 以可编辑的结构化表单形式展示大纲内容。
3. WHEN 用户修改大纲内容，THE Outline_Editor SHALL 实时保存用户修改。
4. WHEN 用户请求重新生成，THE Outline_Editor SHALL 基于用户当前的修改内容重新调用 AI 优化大纲。

---

### 需求 3：世界观构建

**用户故事：** 作为创作者，我想构建小说的世界观设定，让 AI 帮助我完善世界规则、历史背景和地理设定，以便创作时保持一致性。

#### 验收标准

1. WHEN 大纲确认后，THE World_Builder SHALL 提示用户进入世界观构建阶段，包含：世界类型（现实/玄幻/科幻/历史等）、核心世界规则（如魔法体系/修炼体系/科技水平）、主要地点与地理、历史背景与时代背景。
2. WHEN 用户填写世界观信息，THE World_Builder SHALL 调用 AI 根据已有大纲补全和丰富世界观细节。
3. THE World_Builder SHALL 以卡片形式展示世界观各维度设定，支持用户逐项编辑。

---

### 需求 4：人物塑造

**用户故事：** 作为创作者，我想设计小说中的人物，让 AI 帮我塑造有深度的角色，包括性格、背景和成长弧，以便创作出立体的人物。

#### 验收标准

1. WHEN 用户进入人物塑造阶段，THE Character_Forge SHALL 根据大纲中的人物线索，AI 自动建议主要角色列表。
2. WHEN 用户选择或添加角色，THE Character_Forge SHALL 提供以下角色维度：姓名/外貌、性格特征、人物背景与经历、核心动机与目标、人物成长弧、与其他角色的关系。
3. WHEN 用户提交角色基本信息，THE Character_Forge SHALL 调用 AI 生成完整的角色小传（500字以内）。
4. THE Character_Forge SHALL 支持用户添加、编辑、删除角色。

---

### 需求 5：情节塑造（分幕结构）

**用户故事：** 作为创作者，我想把大纲细化成详细的情节结构，AI 帮我拆解每个情节节点，以便写作时有清晰的路线图。

#### 验收标准

1. WHEN 用户进入情节塑造阶段，THE Outline_Editor SHALL 基于已有大纲，AI 生成分幕情节图，每幕包含：幕名、核心事件、涉及人物、情绪弧线（高潮/低谷/转折）、预估章节范围。
2. WHEN 用户修改情节节点，THE Outline_Editor SHALL 自动调整后续情节的连贯性提示。
3. THE Outline_Editor SHALL 支持拖拽调整情节节点顺序。

---

### 需求 6：伏笔与彩蛋管理

**用户故事：** 作为创作者，我想系统地管理小说中的伏笔，AI 帮我追踪伏笔的埋设和回收，以便保证长篇小说的逻辑一致性。

#### 验收标准

1. THE Novel_Creator SHALL 提供伏笔管理面板，记录每个伏笔的：伏笔描述、埋设章节、预计回收章节、当前状态（未埋/已埋/已回收）。
2. WHEN AI 生成章节内容，THE Chapter_Writer SHALL 根据伏笔管理面板中的计划，提示在合适位置埋设或回收伏笔。
3. WHEN 用户手动标记伏笔状态，THE Novel_Creator SHALL 更新伏笔面板并在相关章节中标注。

---

### 需求 7：主题与写作风格设定

**用户故事：** 作为创作者，我想设定小说的核心主题和写作风格，AI 在生成内容时严格遵循，以便保持全书风格统一。

#### 验收标准

1. THE Novel_Creator SHALL 提供写作风格配置项，包含：叙事视角（第一/第三人称）、写作风格（白描/华丽/悬疑/幽默等）、语言节奏（快节奏/慢节奏）、目标读者群。
2. WHEN AI 生成任何内容，THE Chapter_Writer SHALL 遵循用户设定的风格配置。

---

### 需求 8：逐章 AI 生成与编辑

**用户故事：** 作为创作者，我想按章节推进小说创作，AI 每次生成一章内容，我来审阅和修改，以便像真正的小说家一样逐步完成作品。

#### 验收标准

1. WHEN 用户进入章节创作阶段，THE Chapter_Writer SHALL 展示章节列表（已完成/进行中/待写）。
2. WHEN 用户点击"生成本章"，THE Chapter_Writer SHALL 调用 AI，传入：完整世界观、所有角色档案、前置章节摘要、当前章节情节节点、伏笔计划，生成约 2000-4000 字的章节内容。
3. WHEN 章节内容生成完毕，THE Chapter_Writer SHALL 以富文本编辑器展示，支持用户直接编辑修改。
4. WHEN 用户完成一章修改，THE Context_Manager SHALL 自动提取该章节摘要（300字以内），作为后续章节生成的上下文。
5. WHEN 用户要求 AI 对当前章节提出修改建议，THE Chapter_Writer SHALL 返回具体的修改意见（节奏、逻辑、人物一致性等维度）。
6. THE Chapter_Writer SHALL 支持对已完成章节的重新生成或局部修改。

---

### 需求 9：上下文与一致性管理

**用户故事：** 作为创作者，我想确保长篇小说的上下文一致，AI 在生成新章节时不会与已写内容矛盾，以便维护故事的完整性。

#### 验收标准

1. THE Context_Manager SHALL 维护"故事圣经"（Story Bible），包含所有已确认的世界观、角色档案、大纲和章节摘要。
2. WHEN 生成新章节，THE Context_Manager SHALL 自动将相关故事圣经内容注入 AI 提示词。
3. IF 生成内容与已有设定存在明显矛盾，THEN THE Context_Manager SHALL 在编辑器中以警告形式提示用户。

---

### 需求 10：创作进度与项目管理

**用户故事：** 作为创作者，我想追踪我的小说创作进度，随时保存和恢复创作状态，以便长期持续地完成一部长篇小说。

#### 验收标准

1. THE Novel_Creator SHALL 将所有创作数据（大纲、人物、章节内容）持久化存储到本地（IndexedDB）。
2. WHEN 用户重新进入创作页面，THE Novel_Creator SHALL 自动恢复上次的创作状态。
3. THE Novel_Creator SHALL 展示创作统计面板，包含：总字数、已完成章节数、创作时长。
4. THE Novel_Creator SHALL 支持导出小说内容为 Markdown 或 TXT 格式。

---

### 需求 11：跨会话 AI 记忆系统（核心）

**用户故事：** 作为创作者，我今天写了三章，关掉页面，明天再打开，AI 必须完整记得这部小说的所有设定和已写内容，绝不能"失忆"，以便无缝延续创作。

#### 验收标准

1. THE Memory_System SHALL 在每次用户修改任何创作数据后，将完整的 Story_Bible 快照写入 IndexedDB，写入延迟不超过 1 秒。
2. WHEN 用户重新打开创作页面，THE Memory_System SHALL 从 IndexedDB 加载 Story_Bible，并在生成首个 AI 请求前完成恢复，使 AI 感知到完整的历史上下文。
3. THE Memory_System SHALL 为每个已完成章节维护 Chapter_Summary（300字以内压缩版），AI 生成新章节时注入所有前置章节的 Chapter_Summary 而非原文，以节省 token 同时保留记忆。
4. WHEN 章节数量超过 20 章，THE Memory_System SHALL 将早期章节（超出最近 10 章的部分）的 Chapter_Summary 进一步压缩为"阶段摘要"（每 10 章合并为一段 500 字），保证 AI 上下文始终可控。
5. THE Memory_System SHALL 在 Story_Bible 中记录所有已出现的人名、地名、专有名词及其首次出现章节，防止 AI 在后续章节中对同一事物使用不同名称（命名一致性）。
6. IF 用户在不同设备或浏览器使用，THE Memory_System SHALL 支持手动导出/导入 Story_Bible JSON 文件，以便在不同环境间迁移创作进度。
7. THE Memory_System SHALL 对 Story_Bible 进行版本控制，保留最近 5 个快照，支持用户回滚到任意历史版本。

