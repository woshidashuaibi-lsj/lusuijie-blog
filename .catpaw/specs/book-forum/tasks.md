# 实现计划：书中角色论坛

## 概述

按照「数据层 → 后端接口 → 前端组件 → 页面接入」的顺序增量实现，确保每一步都有可验证的产出。

---

## 任务列表

- [x] 1. 数据层：Supabase 表结构与类型定义
  - [x] 1.1 创建 Supabase SQL 迁移文件 `supabase/forum.sql`
    - 建 `forum_posts` 表（id, book_slug, author_type, author_id, author_name, author_avatar, title, content, reply_count, created_at, last_reply_at）
    - 建 `forum_replies` 表（id, post_id, book_slug, author_type, author_id, author_name, author_avatar, content, created_at）
    - 启用 RLS；任何人可读，只有登录用户可写自己的数据；service_role 可写所有（供 fc-api 写角色数据）
    - 建 `increment_reply_count(post_id)` RPC，原子更新 reply_count 和 last_reply_at
    - _需求：1.1, 3.1, 4.1_
  - [x] 1.2 创建 `src/types/forum.ts` 类型文件
    - 定义 `ForumPost`、`ForumReply` TypeScript 接口
    - _需求：全部_
  - [x] 1.3 创建 `src/lib/forumDB.ts` 数据访问层
    - `getPosts(bookSlug)` — 获取帖子列表，按 last_reply_at 倒序
    - `getPost(postId)` — 获取单帖
    - `getReplies(postId)` — 获取回复列表，按 created_at 正序
    - `createPost(bookSlug, title, content, user)` — 用户发帖
    - `createReply(postId, bookSlug, content, user)` — 用户回复
    - _需求：1.1, 2.1, 3.1, 4.1_

- [~] 2. 后端：fc-api 角色回复与发帖接口
  - [~] 2.1 实现 `POST /api/forum/character-reply`
    - 接收 bookSlug、postId、triggerContent、characterId（可选）
    - 随机选角色（若不传 characterId）
    - 用角色 persona 调用 callLLM 生成回复内容
    - 将回复写入 Supabase（用 service_role key）
    - 调用 increment_reply_count RPC
    - 静默处理 LLM 错误，不抛出 500
    - _需求：5.1, 5.2, 5.3, 5.4_
  - [~] 2.2 实现 `POST /api/forum/character-post`
    - 接收 bookSlug、characterId（可选）
    - 随机选角色，用角色 persona 让 LLM 生成帖子标题和正文
    - 将帖子写入 Supabase
    - 返回生成的帖子数据
    - _需求：6.1, 6.2, 6.3_
  - [~]* 2.3 用 TestAgent 为后端接口生成单元测试
    - 测试角色选择逻辑（characterId 必须在角色列表中）
    - 测试空内容拒绝逻辑
    - _需求：3.2, 5.1_

- [~] 3. 前端核心组件
  - [~] 3.1 实现 `src/components/BookForum/PostCard.tsx`
    - 展示头像、作者名（角色/用户）、标题、时间、回复数
    - 角色发帖头像用 emoji，用户发帖用 GitHub 头像或首字母
    - _需求：1.2_
  - [~] 3.2 实现 `src/components/BookForum/PostList.tsx`
    - 帖子列表，骨架屏 loading 状态，空状态提示
    - 支持点击帖子打开详情
    - _需求：1.1, 1.3, 1.4_
  - [~] 3.3 实现 `src/components/BookForum/ReplyItem.tsx` 和 `ReplyList.tsx`
    - 回复列表，按时间正序
    - 角色回复样式与用户回复视觉区分（角色用主题色边框）
    - _需求：2.1, 2.2_
  - [~] 3.4 实现 `src/components/BookForum/ReplyInput.tsx`
    - 登录后显示输入框，未登录显示引导
    - 空内容校验，提交后清空
    - 提交后触发角色回复（50% 概率）
    - 角色回复生成中显示 TypingIndicator（「角色输入中…」动画）
    - _需求：2.3, 2.4, 4.1, 4.2, 4.3, 5.5_
  - [~] 3.5 实现 `src/components/BookForum/PostDetail.tsx`
    - 帖子正文 + ReplyList + ReplyInput 的组合面板（弹层或右侧栏）
    - _需求：2.1_
  - [~] 3.6 实现 `src/components/BookForum/NewPostForm.tsx`
    - 标题 + 正文输入框，提交发帖
    - 空内容校验
    - 发帖后触发一次角色自动回复
    - _需求：3.1, 3.2, 3.3_
  - [~] 3.7 实现 `src/components/BookForum/index.tsx`（BookForum 主组件）
    - 组合 ForumHeader + PostList + PostDetail
    - 「让角色发帖」按钮，调用 /api/forum/character-post
    - _需求：1.1, 6.1_

- [~] 4. 页面接入
  - [~] 4.1 创建 `src/pages/book/[slug]/forum.tsx` 页面
    - 用 BookAccessGate 包裹 BookForum
    - 从 characters JSON 文件读取角色列表传入组件
    - _需求：7.1, 7.2, 7.3_
  - [ ] 4.2 在书籍详情页 `/book/[slug]/index.tsx` 导航栏中添加「论坛」tab 入口
    - _需求：1.1_
  - [~] 4.3 创建 `src/components/BookForum/BookForum.module.css` 样式文件
    - 与现有书籍页面风格一致（暗色主题，主题色高亮）

---

## 备注

- 任务标 `*` 为可选，可跳过以快速 MVP
- fc-api 需要配置 Supabase `SERVICE_ROLE_KEY` 环境变量（用于服务端写入角色数据）
- Supabase SQL 文件需要在 Supabase 控制台手动执行
- 角色 AI 回复超时设置为 10s，超时后静默放弃

