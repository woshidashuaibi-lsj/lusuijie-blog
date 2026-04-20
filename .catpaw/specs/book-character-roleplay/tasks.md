# 实现计划：书中人物沉浸式角色扮演系统

## 概述

按照「数据层 → 后端接口 → 前端组件 → 页面集成 → 测试」的顺序逐步实现，每步都构建在前一步的基础上，确保无悬空代码。

## 任务

- [-] 1. 建立人物数据层
  - [-] 1.1 定义 Character TypeScript 类型接口
    - 在 `src/types/character.ts` 中创建 `Character`、`CharacterRelation` 接口
    - 导出类型供各组件使用
    - _Requirements: 3.1, 3.2_

  - [ ] 1.2 创建道诡异仙人物数据文件
    - 创建 `src/data/characters/dao-gui-yi-xian.json`
    - 包含「李火旺」「丹阳子」至少 2 个人物完整数据
    - persona 字段复用 `fc-api/data/personas/dao-gui-yi-xian.txt` 内容
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 1.3 创建我看见的世界人物数据文件
    - 创建 `src/data/characters/wo-kanjian-de-shijie.json`
    - 包含「李飞飞」至少 1 个人物完整数据
    - persona 字段复用 `fc-api/data/personas/wo-kanjian-de-shijie.txt` 内容
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 2. 实现后端接口
  - [ ] 2.1 新增 GET `/api/characters/[bookSlug]` 接口
    - 创建 `src/pages/api/characters/[bookSlug].ts`
    - 读取对应 `src/data/characters/[bookSlug].json` 文件
    - 若文件不存在返回 `{ characters: [] }`
    - _Requirements: 6.3, 6.4_

  - [ ]* 2.2 用 TestAgent 工具为 characters API 生成单元测试
    - 测试正常返回、bookSlug 不存在时返回空数组
    - _Requirements: 6.3, 6.4_

  - [ ] 2.3 扩展 RAG stream 接口支持角色参数
    - 修改 `fc-api/src/lib/rag.ts` 中的 `buildSystemPrompt`
    - 新增 `buildDualRoleSystemPrompt` 函数，接受 aiCharacterId + playerCharacterId
    - `queryStream` 函数接受可选 `characterId` 和 `playerCharacterId` 参数
    - _Requirements: 6.1, 6.2_

  - [ ]* 2.4 为 buildSystemPrompt 系列函数编写属性测试
    - **Property 2: 单角色 System Prompt 包含对应 persona**
    - **Validates: Requirements 4.2, 6.2**
    - **Property 3: 双角色 System Prompt 同时包含两者信息**
    - **Validates: Requirements 5.4, 6.2**
    - 使用 `fast-check` 库，每个属性至少运行 100 次迭代

  - [ ] 2.5 更新 Next.js 的 `/api/rag/stream` 代理接口
    - 修改 `src/pages/api/rag/` 下的流式接口代理
    - 将 `characterId`、`playerCharacterId` 参数透传到 fc-api
    - _Requirements: 6.1_

- [ ] 3. 实现 CharacterGallery 组件
  - [ ] 3.1 实现 CharacterCard 子组件
    - 在 `src/components/CharacterGallery/CharacterCard.tsx` 实现卡片组件
    - 折叠态：头像 emoji + 姓名 + 身份标签 + 前 2 条性格特征
    - 展开态：完整 traits、说话风格、关系列表 + 两个行动按钮
    - 实现展开/折叠动画
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.2 实现 CharacterGallery 容器组件
    - 在 `src/components/CharacterGallery/index.tsx` 实现网格容器
    - 管理 `expandedId` 状态，同一时刻只允许一张卡片展开
    - 空数据时展示「暂无人物数据」占位
    - _Requirements: 2.1, 1.3_

  - [ ]* 3.3 用 TestAgent 工具为 CharacterGallery 生成单元测试
    - 测试折叠/展开行为、空数据占位、导航按钮点击
    - _Requirements: 2.2, 2.3, 2.4_

- [ ] 4. 新增人物图鉴页面
  - [ ] 4.1 创建 `/book/[slug]/characters` 页面
    - 创建 `src/pages/book/[slug]/characters.tsx`
    - 通过 `getStaticProps` 读取人物数据并传入 `CharacterGallery`
    - 与 WorldPage 视觉风格保持一致（dark theme + 书的主题色）
    - 添加返回按钮导航至 `/book/[slug]/world`
    - _Requirements: 1.2, 2.1_

  - [ ]* 4.2 添加属性测试：人物数据完整性验证
    - **Property 1: 人物数据结构完整性**
    - **Validates: Requirements 3.2**
    - 验证 `src/data/characters/` 下所有 JSON 文件中每个人物对象包含所有必填字段

- [ ] 5. 扩展书世界页面入口
  - [ ] 5.1 在 WorldPage 新增「探索人物图鉴」按钮
    - 修改 `src/pages/book/[slug]/world.tsx`
    - 在现有两个入口按钮后新增第三个按钮，风格与其余按钮一致
    - 按钮图标：`👥`，导航至 `/book/[slug]/characters`
    - _Requirements: 1.1, 1.2_

- [ ] 6. 升级 BookChat 组件支持双模式
  - [ ] 6.1 扩展 BookChat Props 与模式判断逻辑
    - 修改 `src/components/BookChat/index.tsx`
    - 新增 `initialCharacterId`、`playerCharacterId`、`aiCharacterId` 三个 props
    - 根据 props 确定对话模式：`reader` | `player`
    - 在 header 显示当前对话双方信息（头像 + 姓名）
    - _Requirements: 4.1, 5.1, 5.2, 5.3_

  - [ ] 6.2 实现扮演模式 UI 元素
    - 在输入区上方（`player` 模式）展示「你正在扮演：[角色名]」标签
    - 在 AI 回复区域显示「[AI角色名] 对你说：」前缀标签
    - 实现「切换人物」按钮，弹出人物选择列表并重置对话
    - _Requirements: 5.2, 5.3, 4.4_

  - [ ] 6.3 在 handleSubmit 中传递角色参数到 API
    - 读者模式：将 `characterId` 传入 `/api/rag/stream`
    - 玩家模式：将 `playerCharacterId` 传入 `/api/rag/stream`
    - 前端拦截同一人物 ID 的扮演请求，显示错误提示
    - _Requirements: 5.1, 5.5, 5.6_

  - [ ]* 6.4 用 TestAgent 工具为扩展后的 BookChat 生成单元测试
    - 测试模式判断逻辑
    - 测试同一角色 ID 拒绝扮演的边界条件
    - _Requirements: 5.1, 5.6_

- [ ] 7. 更新对话页入口路由
  - [ ] 7.1 修改现有 chat 页面支持 URL 参数
    - 修改 `src/pages/book/dao-gui-yi-xian/chat.tsx` 和 `wo-kanjian-de-shijie/chat.tsx`
    - 或新建动态路由 `src/pages/book/[slug]/chat.tsx` 统一处理
    - 从 URL query 参数中读取 `character`、`playerCharacter`、`aiCharacter`
    - 传递给 `BookChat` 组件
    - _Requirements: 4.2, 4.3, 5.1_

## 注意事项

- 带 `*` 的子任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了对应的需求编号，便于追溯
- 单元测试必须通过 `generate_unit_test` 工具生成，禁止手动编写测试文件
- TestAgent 会确保测试可执行并通过，无需额外验证
- 属性测试使用 `fast-check` 库，配置最小 100 次迭代
- 任务 6 完成后，系统即可端到端运行全部功能

