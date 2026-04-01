# 日报推送接入指南（OpenClaw 专用）

本文档说明博客日报模块的数据格式规范、文件命名规则、推送流程以及自动部署机制，供 OpenClaw 爬虫接入使用。

---

## 一、整体流程

```
OpenClaw 爬取并整理当日 AI 资讯
        │
        ▼
按本文档格式生成 Markdown 文件
文件名：YYYY-MM-DD.md（如 2026-04-02.md）
        │
        ▼
将文件写入仓库路径：posts/daily/YYYY-MM-DD.md
        │
        ▼
git commit + git push → main 分支
        │
        ▼
GitHub Actions 自动触发：构建 → 上传 OSS
（约 2~3 分钟后线上生效）
```

---

## 二、文件命名规则

- **路径**：`posts/daily/`
- **文件名**：`YYYY-MM-DD.md`，严格按日期命名，例如：
  - `posts/daily/2026-04-02.md`
  - `posts/daily/2026-04-03.md`
- **一天一个文件**，如当天有更新直接覆盖同名文件即可

---

## 三、文件格式规范

每个 Markdown 文件由两部分组成：**frontmatter（元数据）** + **正文内容**。

### 3.1 Frontmatter（必填）

文件开头必须有以下三个字段，用 `---` 包裹：

```markdown
---
title: "YYYY-MM-DD AI 日报"
date: "YYYY-MM-DD"
summary: "条目1，条目2，条目3，条目4，条目5"
---
```

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `title` | 字符串 | 日报标题，固定格式 | `"2026-04-02 AI 日报"` |
| `date` | 字符串 | 日期，格式 YYYY-MM-DD | `"2026-04-02"` |
| `summary` | 字符串 | 今日最重要的 3~5 条新闻，**用中文逗号「，」分隔** | 见下方说明 |

**summary 字段说明**：
- 显示在列表页顶部的速览卡片，用户无需点开正文即可快速了解今日要点
- 每条控制在 20 字以内，精炼
- 用中文逗号 `，` 分隔（不是英文逗号 `,`）
- 推荐 3~5 条

```
summary: "OpenAI 完成史上最大融资，Claude 源码遭泄露，白宫发布 AI 治理框架，智谱开源 OCR 小模型"
```

---

### 3.2 正文结构（推荐）

正文使用标准 Markdown，推荐按以下章节组织，可根据当天内容灵活增减：

```markdown
## 今日摘要

- 条目1
- 条目2
- 条目3
（与 summary 保持一致，这里可以略详细一点）

## 产品与功能更新

### 1. 新闻标题

正文内容，2~4 句话，简明扼要。

### 2. 新闻标题

正文内容。

## 前沿研究

### 1. 论文 / 技术突破标题

正文内容。

## 行业展望与社会影响

### 标题

正文内容。

## 开源 TOP 项目

| 项目 | Stars | 简介 |
|------|-------|------|
| `项目名` | 12.4k | 一句话描述 |

## 社媒分享

> "引用内容"
> —— 来源
```

**章节说明**：

| 章节 | 是否必填 | 说明 |
|------|---------|------|
| `## 今日摘要` | 推荐 | 以列表形式列出当天全部要点 |
| `## 产品与功能更新` | 当天有相关新闻时填写 | AI 产品发布、功能更新 |
| `## 前沿研究` | 当天有相关新闻时填写 | 论文、模型、技术突破 |
| `## 行业展望与社会影响` | 当天有相关新闻时填写 | 监管、投资、社会讨论 |
| `## 开源 TOP 项目` | 推荐 | 当天 GitHub 热门 AI 项目 |
| `## 社媒分享` | 可选 | 值得关注的推特/微博/论坛观点 |

---

## 四、完整示例文件

以下是一个符合规范的完整日报文件示例：

```markdown
---
title: "2026-04-02 AI 日报"
date: "2026-04-02"
summary: "GPT-5 正式发布，Anthropic 融资 30 亿，Meta 开源视频生成模型，苹果 AI 功能登陆中国"
---

## 今日摘要

- GPT-5 正式发布，多模态推理能力显著提升
- Anthropic 完成 30 亿美元新一轮融资，估值 600 亿
- Meta 开源 Movie Gen 视频生成模型
- 苹果 Apple Intelligence 功能正式登陆中国市场

## 产品与功能更新

### 1. GPT-5 正式发布

OpenAI 发布 GPT-5，支持实时语音、图像、文件多模态输入。推理能力在 MMLU 基准测试上得分 92.3%，超越此前所有公开模型。ChatGPT Plus 用户即日起可用。

### 2. 苹果 Apple Intelligence 登陆中国

苹果宣布与百度合作，Apple Intelligence 功能正式在中国大陆 iOS 18.4 设备上线，支持中文 Siri 增强、写作辅助、照片智能整理。

## 前沿研究

### 1. Meta 开源 Movie Gen 视频生成模型

Meta 开源其视频生成模型 Movie Gen，支持文本生成 16 秒 1080P 视频，推理速度比 Sora 快 4 倍。模型权重已在 Hugging Face 公开。

## 开源 TOP 项目

| 项目 | Stars | 简介 |
|------|-------|------|
| `movie-gen` | 31.2k | Meta 开源视频生成模型 |
| `gpt5-tools` | 8.4k | GPT-5 API 工具集 |

## 社媒分享

> "GPT-5 的推理能力让我第一次感觉到 AGI 不再是科幻，而是工程问题。"
> —— Sam Altman，OpenAI CEO
```

---

## 五、图片处理规范

**图片不直接提交到 git 仓库**，防止仓库体积膨胀。

- 图片上传到阿里云 OSS，路径前缀：`media/`
- 在 Markdown 中使用完整 URL 引用：

```markdown
![图片描述](https://lusuijie.com.cn/media/图片文件名.png)
```

---

## 六、推送方式

### 方式一：直接操作 git（推荐）

```bash
# 1. 进入博客仓库目录
cd /path/to/my-blog

# 2. 拉取最新代码
git pull origin main

# 3. 写入日报文件（用当天日期命名）
# 文件内容按本文档第三节格式生成

# 4. 提交并推送
git add posts/daily/2026-04-02.md
git commit -m "daily: 2026-04-02 AI 日报"
git push origin main
```

推送到 main 分支后，GitHub Actions 自动触发构建，约 **2~3 分钟**后线上生效。

### 方式二：通过 GitHub API 推送（无需本地 clone）

适合 OpenClaw 在云端运行时使用，通过 GitHub REST API 直接创建/更新文件：

```
PUT https://api.github.com/repos/{owner}/{repo}/contents/posts/daily/YYYY-MM-DD.md
```

请求 Header：
```
Authorization: Bearer {GITHUB_TOKEN}
Content-Type: application/json
```

请求 Body（JSON）：
```json
{
  "message": "daily: 2026-04-02 AI 日报",
  "content": "<Base64 编码的文件内容>",
  "sha": "<如果是更新已有文件，需提供当前文件的 sha；新建文件可省略>"
}
```

`content` 字段是文件内容的 Base64 编码，Python 示例：

```python
import base64

md_content = """---
title: "2026-04-02 AI 日报"
date: "2026-04-02"
summary: "条目1，条目2，条目3"
---

## 今日摘要
..."""

encoded = base64.b64encode(md_content.encode('utf-8')).decode('utf-8')
```

---

## 七、自动部署说明

仓库配置了 GitHub Actions（`.github/workflows/deploy.yml`），规则如下：

- **触发条件**：任意 commit push 到 `main` 分支
- **执行步骤**：① 安装依赖 → ② `npm run build`（生成静态文件）→ ③ 上传全部文件到阿里云 OSS
- **生效时间**：push 后约 2~3 分钟

OpenClaw 无需关心构建细节，只需成功 push 到 main 分支即可。

---

## 八、注意事项

1. **文件名必须是 `YYYY-MM-DD.md` 格式**，日报列表页通过文件名解析日期
2. **frontmatter 三个字段都必须填写**，缺少 `date` 会导致排序异常
3. **summary 用中文逗号 `，` 分隔**，英文逗号会导致分割错误
4. **不要修改已有历史日报**，每天只新增当天文件
5. **不要在 `posts/daily/` 目录放其他文件**（如 `.DS_Store`、`README` 等）
