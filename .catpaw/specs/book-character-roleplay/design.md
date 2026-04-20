# 设计文档：书中人物沉浸式角色扮演系统

## 概述

本文档描述在现有书单页面（`/book/[slug]/world`）基础上，新增「人物图鉴」（CharacterGallery）功能与「玩家扮演模式」（Player Mode）对话功能的技术设计方案。

系统整体沿用现有 Next.js + RAG 架构，在以下层面扩展：
1. **数据层**：新增结构化人物数据 JSON 文件（`src/data/characters/`）
2. **路由层**：新增 `/book/[slug]/characters` 页面 与 `/api/characters/[bookSlug]` 接口
3. **组件层**：新增 `CharacterGallery`、`CharacterCard` 组件，扩展 `BookChat` 组件
4. **服务层**：扩展 `fc-api/src/lib/rag.ts` 支持双角色 System Prompt 构建

---

## 架构

```mermaid
graph TD
    A[书世界页 /book/slug/world] -->|新增入口| B[人物图鉴页 /book/slug/characters]
    B -->|与TA对话| C[对话页 /book/slug/chat?character=id]
    B -->|扮演TA| D[对话页 /book/slug/chat?playerCharacter=id&aiCharacter=id]
    
    C --> E[BookChat 组件 - 读者模式]
    D --> F[BookChat 组件 - 玩家扮演模式]
    
    E --> G[/api/rag/stream - 单角色 system prompt]
    F --> H[/api/rag/stream - 双角色 system prompt]
    
    I[src/data/characters/bookSlug.json] --> B
    I --> E
    I --> F
    
    J[/api/characters/bookSlug] --> B
```

---

## 组件与接口

### 新增页面

#### `/book/[slug]/characters`（人物图鉴页）
- 文件位置：`src/pages/book/[slug]/characters.tsx`
- 通过 `getStaticProps` 读取 `src/data/characters/[slug].json`
- 渲染 `CharacterGallery` 组件

#### 扩展 `WorldPage`（`/book/[slug]/world`）
- 在现有两个入口按钮后新增第三个按钮：「探索人物图鉴」，导航至 `/book/[slug]/characters`

### 新增组件

#### `CharacterGallery`（`src/components/CharacterGallery/`）
```
Props:
  bookSlug: string
  characters: Character[]
  bookColor: string  // 书的主题色，用于统一视觉风格
```
功能：
- 以 CSS Grid 网格渲染所有 `CharacterCard`
- 管理当前展开的人物详情卡片状态（`expandedId: string | null`）

#### `CharacterCard`（内嵌在 CharacterGallery）
```
Props:
  character: Character
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  bookSlug: string
  bookColor: string
```
功能：
- 折叠状态：展示头像 emoji、姓名、身份标签、前 2 条性格特征
- 展开状态：展示完整 traits 列表、说话风格、关系说明，以及两个行动按钮

#### 扩展 `BookChat` 组件
新增 Props：
```typescript
interface BookChatProps {
  bookSlug: string;
  bookTitle: string;
  // 新增：
  initialCharacterId?: string;      // 读者模式：目标角色 ID
  playerCharacterId?: string;       // 扮演模式：玩家马甲角色 ID
  aiCharacterId?: string;           // 扮演模式：AI 扮演角色 ID
}
```
- 根据 props 自动确定对话模式（Reader / Player）
- 在 header 展示当前对话双方信息
- 在输入区上方（扮演模式下）展示玩家马甲标签
- 提供「切换人物」抽屉/弹窗，重置对话

### 新增 API 路由

#### `GET /api/characters/[bookSlug]`
- 文件位置：`src/pages/api/characters/[bookSlug].ts`
- 读取 `src/data/characters/[bookSlug].json` 并返回
- 若文件不存在，返回 `{ characters: [] }`

#### 扩展 `POST /api/rag/stream`（fc-api）
新增请求体字段：
```typescript
{
  question: string;
  bookSlug: string;
  characterId?: string;         // 读者模式目标角色
  playerCharacterId?: string;   // 玩家扮演模式：玩家角色
}
```

---

## 数据模型

### Character 数据结构

```typescript
interface CharacterRelation {
  characterId: string;   // 关联人物 ID
  description: string;   // 关系描述，如「师徒关系，李火旺的师傅」
}

interface Character {
  id: string;              // 唯一标识，如 "li-huowang"
  name: string;            // 姓名，如 "李火旺"
  avatar: string;          // 头像 emoji，如 "🔥"
  role: string;            // 身份标签，如 "精神病患者 / 修仙者"
  traits: string[];        // 性格特征数组，每条一句话
  speechStyle: string;     // 说话风格描述
  persona: string;         // 完整角色扮演提示词（用于 system prompt）
  relations: CharacterRelation[];   // 与其他人物的关系
}
```

### 数据文件位置

```
src/data/characters/
  dao-gui-yi-xian.json     // 包含 dao-gui-yi-xian 所有人物
  wo-kanjian-de-shijie.json
```

**示例（`dao-gui-yi-xian.json`）**：
```json
{
  "characters": [
    {
      "id": "li-huowang",
      "name": "李火旺",
      "avatar": "🔥",
      "role": "精神病患者 / 修仙者",
      "traits": [
        "坚韧隐忍：面对绝境先压制情绪，再用行动反击",
        "心狠手辣：对待仇人冷静缜密，不留后患",
        "心存善念：会偷偷保护弱小，为无力拯救而自责",
        "理性冷静：擅长权衡利弊，不冲动行事"
      ],
      "speechStyle": "说话直接干脆，急了会骂脏话，口头禅有「冷静冷静」「我绝对会弄死他」",
      "persona": "你现在是李火旺，一个穿梭于现代精神病院与诡异修仙世界的年轻人...",
      "relations": [
        { "characterId": "dan-yang-zi", "description": "师徒关系，丹阳子是李火旺的师傅" }
      ]
    },
    {
      "id": "dan-yang-zi",
      "name": "丹阳子",
      "avatar": "🌙",
      "role": "道士 / 师傅",
      "traits": [...],
      "speechStyle": "...",
      "persona": "...",
      "relations": [...]
    }
  ]
}
```

---

## System Prompt 构建策略

### 读者模式（`characterId` 指定目标角色）

```
[角色人设 persona]

以下是你（[characterName]）在书中相关经历的片段：
[RAG 检索到的上下文]

请以 [characterName] 的口吻和语气，用第一人称回答读者的问题。
```

### 玩家扮演模式（`playerCharacterId` + `aiCharacter`）

```
你现在是 [AI角色名]。[AI角色 persona 内容]

重要背景：你正在与书中的另一位角色 [玩家角色名] 对话。
[玩家角色名] 的身份：[玩家角色 role]
[玩家角色名] 的性格：[玩家角色 traits 摘要]

以下是与当前对话相关的书中片段：
[RAG 检索到的上下文]

请保持 [AI角色名] 的口吻与人物性格，以第一人称回应对方。
```

---

## 正确性属性

*属性是在系统所有有效执行中应当成立的特征或行为——本质上是对系统应该做什么的形式化陈述。属性是连接人类可读规范与机器可验证正确性保证的桥梁。*

### 测试前置分析（Prework）

**3.2 任意通过接口返回的人物数据必须包含所有必填字段**
Thoughts: 这不依赖特定人物，任意人物对象都应有相同的字段结构，适合用 property 验证
Testable: yes - property

**4.2 URL 参数加载 persona 的正确性**
Thoughts: 对任意有效的 characterId，构建的 system prompt 应包含对应人物的 persona 内容
Testable: yes - property

**5.4 双角色 System Prompt 包含两者信息**
Thoughts: 对任意 (playerChar, aiChar) 组合，system prompt 应同时含有两者关键信息
Testable: yes - property

**5.6 同一 characterId 拒绝扮演**
Thoughts: 这是一个具体的边界条件
Testable: yes - example (edge-case)

**6.2 playerCharacterId 对 system prompt 的影响**
Thoughts: 与 4.2 和 5.4 有重叠，合并为属性 2

### 属性

**Property 1：人物数据结构完整性**
*对任意* 通过 `/api/characters/[bookSlug]` 返回的人物对象，该对象必须包含 `id`、`name`、`avatar`、`role`、`traits`、`speechStyle`、`persona`、`relations` 所有必填字段，且类型符合预期（`traits` 为非空数组，`relations` 为数组）
**Validates: Requirements 3.2**

**Property 2：单角色 System Prompt 包含对应 persona**
*对任意* 有效的 `characterId`，`buildSystemPrompt(bookSlug, context, characterId)` 构建的结果字符串必须包含该角色 `persona` 字段的核心内容（非空字符串，且不为通用兜底文本）
**Validates: Requirements 4.2, 6.2**

**Property 3：双角色 System Prompt 同时包含两者信息**
*对任意* 有效的 `(aiCharacterId, playerCharacterId)` 组合（且两者不同），`buildDualRoleSystemPrompt(bookSlug, context, aiCharacterId, playerCharacterId)` 的结果字符串必须同时包含 AI 角色姓名与玩家角色姓名
**Validates: Requirements 5.4, 6.2**

---

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| `bookSlug` 不存在对应人物数据文件 | API 返回 `{ characters: [] }`，前端展示「暂无人物数据」 |
| `characterId` 无效/不存在 | 降级使用 `bookSlug` 对应的默认主角人设 |
| `playerCharacterId === aiCharacterId` | 前端拦截，提示「请选择不同的角色」，不发起请求 |
| 人物 JSON 文件格式错误 | API 返回 500，前端展示错误提示 |

---

## 测试策略

### 单元测试（通过 TestAgent 工具生成）
- `buildSystemPrompt` 函数的各种输入组合
- `Character` 数据对象字段验证函数
- `CharacterGallery` 组件折叠/展开状态切换

### 属性测试（使用 `fast-check` 库）
- **Property 1**：生成随机 character 对象，验证必填字段校验函数
- **Property 2**：对 `dao-gui-yi-xian` 和 `wo-kanjian-de-shijie` 各人物，验证 system prompt 包含 persona
- **Property 3**：对所有有效的双角色组合（排列组合），验证 system prompt 包含双方姓名

每个属性测试至少运行 100 次迭代。测试注释格式：
```typescript
// Feature: book-character-roleplay, Property 1: 人物数据结构完整性
// Feature: book-character-roleplay, Property 2: 单角色 System Prompt 包含对应 persona
// Feature: book-character-roleplay, Property 3: 双角色 System Prompt 同时包含两者信息
```

### 双测试方法
- 单元测试：验证具体示例、边界条件（如同一人物 ID 拒绝扮演）
- 属性测试：验证通用行为在所有合法输入上的正确性
- 两者互补，共同保证系统正确性

