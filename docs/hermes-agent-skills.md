# Hermes Agent Skills 系统 — 面试速记

> 原文：《一文搞懂Hermes：新顶流Agent如何从经验中自我进化》- 腾讯云开发者

---

## 一句话概括

Hermes 实现了一个 AI Agent 的**自学习闭环**：把成功的任务经验自动提炼成 SOP（Skills），下次遇到类似任务直接加载复用，用完后还能自动修正过时内容。

---

## 完整闭环流程

```
经验提取 → 知识存储 → 智能检索 → 上下文注入 → 执行验证 → 自动改进
```

与认知科学中**程序性记忆（Procedural Memory）**完整对应：
- **编码**：从成功任务执行中提取关键步骤和陷阱
- **存储**：结构化的 YAML + Markdown 格式，支持层级组织
- **检索**：条件激活 + 渐进式披露，最小化 token 负担
- **巩固**：每次使用中的自动 patch，越用越精准
- **迁移**：Skills Hub 社区分享，知识可跨个体传播

---

## 核心技术点（面试重点展开）

### 1. Skill 何时创建？——Agent 自主决策

触发条件硬编码进 System Prompt：

```python
SKILLS_GUIDANCE = (
    "After completing a complex task (5+ tool calls), fixing a tricky error, "
    "or discovering a non-trivial workflow, save the approach as a skill..."
    "don't wait to be asked."
    "Skills that aren't maintained become liabilities."
)
```

关键设计哲学：
- **5+ tool calls**：只有复杂流程才值得建 Skill，简单任务不值
- **fixing a tricky error**：踩过的坑是最有价值的知识
- **don't wait to be asked**：Agent 自主判断，无需用户主动要求
- **过时的 Skill 比没有 Skill 更危险**

---

### 2. 文件写入可靠性——原子写入

不用普通的 `file.write()`，而是 `tempfile + os.replace()`：

```python
def atomic_write_text(file_path, content):
    fd, temp_path = tempfile.mkstemp(dir=str(file_path.parent), prefix=".tmp.")
    with os.fdopen(fd, "w") as f:
        f.write(content)
    os.replace(temp_path, file_path)  # 原子替换
```

**效果**：进程崩溃也不会出现"写了一半"的损坏文件。目标文件要么是旧内容，要么是新内容，绝无中间状态。

> 这是分布式系统的常见模式，在 AI Agent 工具实现中极为罕见。

---

### 3. 两层缓存设计——性能优化

每次对话启动都要扫描所有 Skill 文件，开销不可忽视，Hermes 用两层缓存解决：

| 层级 | 实现方式 | 耗时 | 适用场景 |
|------|---------|------|---------|
| L1 内存 | 线程安全 LRU `OrderedDict`，最多 8 条 | ~0.001ms | 同一对话内多次访问 |
| L2 磁盘 | JSON 快照 + mtime/size 校验 | ~1ms | 进程重启后冷启动 |
| 全量扫描 | 递归扫描文件系统 | 50-500ms | Skill 文件变更后首次访问 |

**缓存键设计**（五元组）：
```python
cache_key = (
    str(skills_dir.resolve()),       # Skill 目录路径
    tuple(external_dirs),            # 外部 Skill 目录
    tuple(sorted(available_tools)),  # 当前可用工具集
    tuple(sorted(available_toolsets)),
    platform_hint,                   # 当前平台
)
```

**磁盘快照失效策略**：不比对文件内容（太慢），只比对每个文件的 **mtime + size**，任何文件变化都会使快照失效。

**mtime + size 对比原理：**

两个东西存在两个地方：

| 东西 | 存在哪里 | 是什么 |
|------|---------|--------|
| Skill 文件本身 | 磁盘 `~/.hermes/skills/` | 真实的 `.md` 文件 |
| 快照（JSON） | 磁盘另一个路径 | 上次扫描时记录的 mtime+size |

启动时流程：
```
进程启动
  ↓
读取快照 JSON（上次记录的 mtime+size）
  ↓
去文件系统实时读取每个 Skill 文件"现在"的 mtime+size
  ↓
两者对比 → 一致则命中缓存，不一致则触发全量扫描
```

- **"现在的 mtime+size"** 是从操作系统文件系统**实时读取**的，不是从快照里读的
- mtime 是操作系统自动维护的元数据，文件一改动系统就自动更新，不需要手动记录
- 不直接对比文件内容的原因：100 个文件就是 100 次 I/O 逐字符对比，开销太大；而 mtime+size 是文件系统元数据，读取几乎没有额外开销

---

### 4. User Message 注入而非 System Prompt——关键架构决策

Skill 内容加载后，**不追加到 System Prompt**，而是作为 **User Message** 注入：

```python
activation_note = (
    f'[SYSTEM: The user has invoked the "{skill_name}" skill, '
    '"indicating they want you to follow its instructions...]"
)
```

**原因：保护 Prompt Cache**

- Anthropic 的 Prompt Cache 允许将 System Prompt 的处理结果缓存起来，节省 90%+ token 成本
- 前提是：System Prompt 在整个对话中**不能变化**
- 如果每次加载 Skill 就修改 System Prompt，缓存失效，30 轮工具调用意味着数十倍成本增加

**为什么要这么做——逐步理解：**

**第一步：Prompt Cache 是什么？**

每次调用 Claude API，都要传入 System Prompt（可能几千 token），Claude 要把它"处理"一遍才能理解。Prompt Cache 的作用是：如果 System Prompt 和上次一模一样，Claude 不重新处理，直接复用上次结果，**省掉 90% 的 token 费用**。

**第二步：把 Skill 加进 System Prompt 会怎样？**

```
第1轮：System Prompt = "基础指令"                → 处理一次，缓存 ✅
第2轮：System Prompt = "基础指令 + Skill A内容"  → 变了！缓存失效，重新处理 ❌
第3轮：System Prompt = "基础指令 + Skill A内容"  → 没变，命中缓存 ✅
第4轮：System Prompt = "基础指令 + Skill A+B内容"→ 又变了！缓存再次失效 ❌
```

每次加载新 Skill 就会打破缓存，30 轮调用可能有 10 次缓存失效，**成本暴增**。

**第三步：User Message 注入如何解决？**

```
System Prompt = "基础指令"（整个对话始终不变 → 缓存永远命中 ✅）

第1轮 User: "帮我部署"
第2轮 User: "[SYSTEM: 以下是 deploy-nextjs Skill 内容...] 按此执行"
第3轮 User: "继续"
```

System Prompt 自始至终不动，缓存一直有效，30 轮调用全部命中缓存，省 90% 费用。

**为什么加 `[SYSTEM: ...]` 前缀？**

User Message 里的内容，Claude 默认当作"用户说的话"，权重比 System Prompt 低。加上 `[SYSTEM: ...]` 前缀，是让 Claude 把这段内容当作系统级指令来对待，提高被遵循的概率。

**代价**：User Message 指令权重略低于 System Prompt，用 `[SYSTEM: ...]` 前缀模拟权威性

> **本质是成本与效果的权衡**：牺牲一点点指令跟随可靠性，换取 90%+ 的 API 成本节约。
> 
> 一句话：System Prompt 不变 = 缓存永远有效 = 省钱。Skill 内容用 User Message 传进去 = 不破坏缓存 = 鱼和熊掌都要。

---

### 5. 渐进式披露——按需加载

System Prompt 中只放索引（每个 Skill 约 20 tokens），Agent 判断需要时再调用 `skill_view()` 加载完整内容：

- **索引层**：`名称 + 描述`，约 20 tokens/个
- **完整内容层**：调用 `skill_view(name)` 后加载
- **支撑文件层**：API 文档、模板等，按需再加载

**效果**：100 个 Skill 的用户，System Prompt 只增加 ~2000 tokens，而非 500K tokens。

---

### 6. 条件激活——智能可见性控制

Skill 的 frontmatter 中可声明激活条件：

```yaml
metadata:
  hermes:
    requires_toolsets: [terminal]      # 依赖工具不可用时自动隐藏
    fallback_for_toolsets: [web]       # 主工具可用时自动隐藏（fallback 才出现）
platforms: [macos]                     # 仅在 macOS 上显示
```

**解决的问题**：防止索引膨胀，减少无关 Skill 的 token 消耗。

---

### 7. 自改进——Fuzzy Match 打 Patch

Agent 用完 Skill 发现问题后，调用 `skill_manage(action='patch')` 自动修正：

```python
from tools.fuzzy_match import fuzzy_find_and_replace

new_content, match_count, strategy, match_error = fuzzy_find_and_replace(
    content, old_string, new_string, replace_all
)
```

**为什么需要 Fuzzy Match？**

LLM 回忆 Skill 内容时常有微小格式差异（多个空格、缩进不同），精确匹配会导致大量合理的 patch 操作失败。Fuzzy Match 处理：空白规范化、缩进差异、转义序列等。

**Patch 后的级联效应**：
- 清除 L1 内存缓存 + L2 磁盘快照
- 当前对话：继续使用旧版（Prompt Cache 保护，不能中途修改）
- 下一个对话：加载改进后的版本
- **最终一致性**，优雅降级

---

## 安全体系

### 90+ 威胁正则模式（静态扫描）

覆盖类别：
- **数据泄露**：检测 curl 泄漏环境变量密钥
- **越狱攻击**：DAN 模式、"ignore previous instructions" 等
- **路径穿越**：`../` 攻击
- **符号链接逃逸**：软链接指向 Skill 目录外
- **隐形 Unicode**：零宽字符、从右到左覆盖符等（18 种）

### 写入后扫描（避免 TOCTOU）

```
先写入 → 再扫描 → 失败则整个目录回滚删除
```

先扫描后写入存在竞态条件：扫描通过后、写入前内容可能被篡改。

### 信任分级策略

| 来源 | safe | caution | dangerous |
|------|------|---------|-----------|
| 内置（随 Hermes 发布） | ✅ | ✅ | ✅ |
| 官方受信任 | ✅ | ✅ | ❌ 阻止 |
| 社区 | ✅ | ❌ 阻止 | ❌ 阻止 |
| Agent 自创建 | ✅ | ✅ | ❓ 询问 |

### 结构性检查

```python
MAX_FILE_COUNT = 50       # Skill 不应有 50+ 个文件
MAX_TOTAL_SIZE_KB = 1024  # 总大小 1MB 上限
MAX_SINGLE_FILE_KB = 256  # 单文件 256KB 上限

# 可疑二进制文件直接拦截
SUSPICIOUS_BINARY_EXTENSIONS = {'.exe', '.dll', '.so', '.dylib', ...}
```

---

## Memory vs Skill 分工

| 维度 | Memory（记忆） | Skill（技能） |
|------|--------------|-------------|
| 回答 | 是什么 | 怎么做 |
| 内容 | 用户偏好、环境细节、工具 quirks | 可复用的任务流程、SOP |
| 持久性 | 稳定事实 | 可执行的方法论 |
| 示例 | "用户喜欢用中文交流" | "部署 Next.js 到 Vercel 的步骤" |

---

## 与现有框架对比

| 对比维度 | LangChain / AutoGen / CrewAI | Hermes |
|---------|------------------------------|--------|
| 跨会话记忆 | ❌ 每次从零开始 | ✅ Skills 持久化 |
| 自学习 | ❌ 无 | ✅ 自动 patch |
| 成本优化 | 一般 | ✅ Prompt Cache 保护 |
| 安全扫描 | 无 | ✅ 90+ 威胁模式 |
| 知识分享 | 无 | ✅ Skills Hub 社区 |

与学术前沿对比（NVIDIA Voyager 论文，2023）：

| 维度 | Voyager | Hermes |
|------|---------|--------|
| 环境 | Minecraft（受控） | 真实世界（复杂） |
| 技能存储 | 代码函数 | YAML + Markdown |
| 技能发现 | 预定义 | 条件激活 + 渐进式披露 |
| 安全性 | 无 | 90+ 威胁模式 |
| 成本控制 | 无 | Prompt Cache 友好 |

---

## 设计不足（体现批判性思维）

1. **没有版本控制**：patch 后旧版本丢失，无法回滚。改进方向：patch 前备份到 `.backup/` 子目录
2. **正则扫描可绕过**：Base64 编码、变量间接引用、Unicode 同形字替换等可绕过检测，需引入 LLM 语义审查（代码中有预留位但未启用）
3. **索引匹配依赖 LLM 判断**：描述不精准时可能漏掉相关 Skill，可引入 embedding 语义匹配预过滤
4. **单机存储**：多设备无法自动同步，需手动通过 Skills Hub 发布再安装

---

## 面试金句

> "Hermes 的 Skills 系统本质上是**程序性记忆的工程化模拟**。它回答了一个根本问题：**Agent 的知识，应该以什么形式存在、以什么方式演化？** 这决定了下一代 AI Agent 是'每次从零开始的聪明工具'，还是'在经验中持续成长的智能伙伴'。"

> "最关键的架构决策是把 Skill 内容注入到 User Message 而非 System Prompt，这是为了保护 Anthropic 的 Prompt Cache 机制，牺牲一点点指令跟随可靠性，换取 90%+ 的 API 成本节约。这种成本与效果的权衡在工程上非常有价值。"
