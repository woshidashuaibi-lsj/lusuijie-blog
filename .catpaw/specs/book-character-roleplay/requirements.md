# 需求文档：书中人物沉浸式角色扮演系统

## 简介

在现有书单页面（书世界入口 `/book/[slug]/world`）的基础上，新增「人物图鉴」功能入口，允许读者查看书中全部人物的详细个性资料。同时升级现有对话功能，支持两种沉浸模式：
1. **读者模式**：以读者身份与某个书中人物对话（现有功能增强）
2. **人物扮演模式**：用户"穿上"某个书中人物的马甲，以该人物的身份与另一个书中人物展开对话，增强参与感与沉浸感

## 词汇表

- **Character（人物）**：书中有明确人设描述的角色
- **Persona（人设）**：用于指导 AI 扮演某角色的提示词文本
- **Reader Mode（读者模式）**：用户以普通读者身份与 AI 扮演的书中人物对话
- **Player Mode（玩家扮演模式）**：用户选择一个人物马甲，以该人物的口吻与 AI 扮演的另一个人物对话
- **CharacterGallery（人物图鉴）**：展示书中全部人物卡片、人设摘要的页面
- **ChatSession（对话会话）**：一次完整的对话上下文，包含对话双方身份信息与消息历史
- **BookChatPage（对话页）**：现有的 `/book/[slug]/chat` 对话页面

## 需求

### 需求 1：人物图鉴入口

**用户故事：** 作为读者，我希望能在书世界页面看到「人物图鉴」入口，以便快速了解书中所有人物的个性资料。

#### 验收标准

1. THE WorldPage（书世界页 `/book/[slug]/world`）SHALL 展示一个「探索人物图鉴」入口按钮，风格与现有「阅读原著」「与人物对话」按钮一致
2. WHEN 用户点击「人物图鉴」按钮，THE System SHALL 导航至 `/book/[slug]/characters` 页面
3. IF 某本书尚未配置任何人物数据，THEN THE CharacterGallery SHALL 显示「暂无人物数据」占位提示

### 需求 2：人物图鉴页面展示

**用户故事：** 作为读者，我希望在人物图鉴页面能看到书中各人物的卡片，包含头像（emoji/图标）、姓名、身份标签、性格特点摘要，以便快速认识每个角色。

#### 验收标准

1. THE CharacterGallery SHALL 以卡片网格形式展示该书所有已配置的人物
2. WHEN 用户点击某个人物卡片，THE CharacterGallery SHALL 展开显示该人物的完整人设详情（性格特征列表、说话风格等）
3. THE CharacterGallery SHALL 为每个人物提供「与 TA 对话」按钮，点击后进入以该人物为对话目标的对话页
4. THE CharacterGallery SHALL 为每个人物提供「扮演 TA」按钮，点击后进入以该人物为玩家马甲的对话页
5. WHILE 人物详情已展开，THE CharacterGallery SHALL 保持该卡片的高亮边框与展开状态，直到用户点击关闭或切换另一人物

### 需求 3：人物数据管理

**用户故事：** 作为系统，我希望能以结构化的 JSON 格式管理书中各人物的完整数据，以便前后端统一读取。

#### 验收标准

1. THE System SHALL 在 `src/data/characters/[bookSlug].json` 路径下存储每本书的人物数据文件
2. THE Character 数据对象 SHALL 包含以下字段：`id`（唯一标识）、`name`（姓名）、`avatar`（头像 emoji 或图片路径）、`role`（身份/职位标签）、`traits`（性格特征数组，每条字符串）、`speechStyle`（说话风格描述）、`persona`（完整角色扮演提示词）、`relations`（与其他人物关系数组，可为空）
3. IF 某本书的 `data/personas/[bookSlug].txt` 文件已存在（由 extractPersona 生成），THEN THE System SHALL 优先以该文件内容填充主角的 `persona` 字段

### 需求 4：读者模式对话（现有功能增强）

**用户故事：** 作为读者，我希望在对话页可以选择与哪个书中人物对话，而不仅限于主角，以便探索更多人物视角。

#### 验收标准

1. THE BookChatPage SHALL 在顶部展示当前对话目标人物的头像与姓名
2. WHEN URL 参数中包含 `character=[characterId]`，THE BookChatPage SHALL 加载对应人物的 persona 作为 AI 的角色设定
3. IF URL 中未指定 `character` 参数，THEN THE BookChatPage SHALL 默认使用主角人设（向下兼容现有行为）
4. THE BookChatPage SHALL 展示一个「切换人物」按钮，点击后弹出人物选择列表，选择后刷新对话并加载新人物人设

### 需求 5：玩家扮演模式（新功能）

**用户故事：** 作为读者，我希望能选择一个书中人物作为我的马甲，以该人物身份与 AI 扮演的另一个人物展开对话，增强沉浸感和参与感。

#### 验收标准

1. WHEN URL 参数中包含 `playerCharacter=[characterId]` 与 `aiCharacter=[characterId]`，THE BookChatPage SHALL 进入玩家扮演模式
2. WHILE 处于玩家扮演模式，THE BookChatPage SHALL 在输入框上方显示「你正在扮演：[角色名]」的提示标签
3. WHILE 处于玩家扮演模式，THE BookChatPage SHALL 在 AI 回复区域显示「[AI角色名] 对你说：」的发言标签
4. WHILE 处于玩家扮演模式，THE System SHALL 在 system prompt 中同时注入「AI 角色人设」与「玩家角色背景信息」，告知 AI 对方是谁
5. WHEN 玩家输入消息，THE System SHALL 以玩家所扮演人物的视角发送消息，并由 AI 以 AI 角色的身份回复
6. IF `playerCharacter` 与 `aiCharacter` 为同一人物 ID，THEN THE System SHALL 拒绝进入扮演模式并提示用户重新选择

### 需求 6：后端接口扩展

**用户故事：** 作为系统，我希望对话接口支持传入玩家人物参数，以便在流式回答中正确注入双角色 System Prompt。

#### 验收标准

1. THE RAG 流式接口（`/api/rag/stream`）SHALL 接受可选参数 `playerCharacterId`（玩家扮演人物 ID）
2. WHEN `playerCharacterId` 参数存在，THE System SHALL 构建包含双角色信息的 System Prompt：先声明 AI 角色人设，再说明玩家角色身份背景
3. THE `/api/characters/[bookSlug]` GET 接口 SHALL 返回该书所有人物数据列表（用于前端展示）
4. IF 请求的 `bookSlug` 不存在对应数据文件，THEN THE Characters API SHALL 返回空数组而非报错

