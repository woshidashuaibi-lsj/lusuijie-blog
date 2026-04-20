/**
 * Novel Creator - Story Bible 上下文构建器
 * 
 * 核心功能：将 NovelProject 转换为 AI 可理解的上下文提示词
 * 这是跨会话记忆系统的关键：每次生成章节时重建完整上下文
 * 
 * 分层策略（控制 token 用量）：
 *   层1: 固定设定（世界观 + 风格 + 词汇表）  ~800 tokens
 *   层2: 人物档案摘要                        ~600 tokens
 *   层3: 远期历史（阶段摘要，>20章时启用）    ~750 tokens/组
 *   层4: 近期章节摘要（最近10章）             ~1500 tokens
 *   层5: 当前任务（情节节点 + 伏笔）          ~400 tokens
 */

import type {
  NovelProject,
  StoryBibleContext,
  CharacterProfile,
  GlossaryEntry,
  Foreshadow,
  Chapter,
} from '@/types/novel';

// 最近多少章节使用原始摘要（超出部分用阶段摘要替代）
const RECENT_CHAPTERS_WINDOW = 10;
// 超过多少章节触发阶段摘要归档
const ACT_SUMMARY_THRESHOLD = 20;

// ── 层1：世界观构建 ───────────────────────────────────────────────────────────

function buildWorldSummary(project: NovelProject): string {
  const { world, outline } = project;
  const parts: string[] = [];

  parts.push(`【小说基本信息】`);
  parts.push(`类型：${outline.genre || '未设定'}`);
  parts.push(`核心主题：${outline.theme || '未设定'}`);
  parts.push(`故事概述：${outline.logline || outline.idea || '未设定'}`);
  parts.push(`背景：${outline.setting || '未设定'}`);
  parts.push(`核心冲突：${outline.conflict || '未设定'}`);
  parts.push(`故事走向：${outline.arc || '未设定'}`);

  parts.push(`\n【世界观设定】`);
  if (world.worldType) parts.push(`世界类型：${world.worldType}`);
  if (world.powerSystem) parts.push(`力量体系：${world.powerSystem}`);
  if (world.geography) parts.push(`地理设定：${world.geography}`);
  if (world.history) parts.push(`历史背景：${world.history}`);
  if (world.factions) parts.push(`主要势力：${world.factions}`);
  if (world.customs) parts.push(`风俗文化：${world.customs}`);
  if (world.misc) parts.push(`其他设定：${world.misc}`);

  return parts.join('\n');
}

// ── 层1：写作风格 ─────────────────────────────────────────────────────────────

const VOICE_MAP: Record<string, string> = {
  first: '第一人称（我）',
  third_limited: '第三人称有限视角',
  third_omniscient: '第三人称全知视角',
};

const STYLE_MAP: Record<string, string> = {
  concise: '简洁白描',
  elaborate: '华丽细腻',
  suspense: '悬疑紧张',
  humorous: '幽默风趣',
  lyrical: '抒情诗意',
  gritty: '写实硬核',
};

const PACING_MAP: Record<string, string> = {
  fast: '快节奏（动作驱动，短句多）',
  medium: '中等节奏',
  slow: '慢节奏（细腻描写，情绪充分展开）',
};

function buildStyleSummary(project: NovelProject): string {
  const { style } = project;
  return [
    `【写作要求】`,
    `叙事视角：${VOICE_MAP[style.voice] || style.voice}`,
    `写作风格：${STYLE_MAP[style.style] || style.style}`,
    `语言节奏：${PACING_MAP[style.pacing] || style.pacing}`,
    style.targetAudience ? `目标读者：${style.targetAudience}` : '',
    style.notes ? `风格备注：${style.notes}` : '',
  ].filter(Boolean).join('\n');
}

// ── 层1：词汇表（命名一致性）─────────────────────────────────────────────────

/**
 * 只注入 firstAppeared <= targetChapterNum 的词条
 * 保证 AI 不知道"未来"才出现的名词
 */
export function buildGlossaryPrompt(glossary: GlossaryEntry[], upToChapter: number): string {
  const relevant = glossary.filter(e => e.firstAppeared <= upToChapter);
  if (relevant.length === 0) return '';

  const lines = relevant.map(e => {
    const typeLabel = { person: '人物', place: '地点', concept: '概念', item: '物品', organization: '组织' }[e.type] || e.type;
    return `- [${typeLabel}] ${e.term}：${e.definition}（首见第${e.firstAppeared}章）`;
  });

  return [`【专有名词表（必须保持命名一致性）】`, ...lines].join('\n');
}

// ── 层2：人物档案 ─────────────────────────────────────────────────────────────

function buildCharactersSummary(characters: CharacterProfile[]): string {
  if (characters.length === 0) return '';

  const roleOrder: Record<string, number> = { protagonist: 0, antagonist: 1, supporting: 2, minor: 3 };
  const sorted = [...characters].sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3));

  const lines = sorted.map(c => {
    const roleLabel = { protagonist: '主角', antagonist: '反派', supporting: '配角', minor: '路人' }[c.role] || c.role;
    const parts = [`[${roleLabel}] ${c.name}`];
    if (c.personality) parts.push(`性格：${c.personality}`);
    if (c.motivation) parts.push(`动机：${c.motivation}`);
    if (c.arc) parts.push(`成长弧：${c.arc}`);
    if (c.bio && c.bio.length > 0) {
      // 如果有小传，取前100字
      const shortBio = c.bio.length > 100 ? c.bio.slice(0, 100) + '…' : c.bio;
      parts.push(`背景：${shortBio}`);
    } else if (c.backstory) {
      const shortBs = c.backstory.length > 100 ? c.backstory.slice(0, 100) + '…' : c.backstory;
      parts.push(`背景：${shortBs}`);
    }
    return parts.join('；');
  });

  return [`【人物档案】`, ...lines].join('\n');
}

// ── 层3：远期历史（阶段摘要）────────────────────────────────────────────────

function buildDistantHistory(project: NovelProject, targetChapterNum: number): string {
  if (project.chapters.length <= ACT_SUMMARY_THRESHOLD) return '';

  const relevantActSummaries = project.actSummaries.filter(
    as => as.chapterRange[1] <= targetChapterNum - RECENT_CHAPTERS_WINDOW
  );

  if (relevantActSummaries.length === 0) return '';

  const lines = relevantActSummaries
    .sort((a, b) => a.chapterRange[0] - b.chapterRange[0])
    .map(as => `第${as.chapterRange[0]}-${as.chapterRange[1]}章：${as.summary}`);

  return [`【早期故事回顾（阶段摘要）】`, ...lines].join('\n');
}

// ── 层4：近期章节摘要 ─────────────────────────────────────────────────────────

function buildRecentChapterSummaries(chapters: Chapter[], targetChapterNum: number): string {
  // 取最近 RECENT_CHAPTERS_WINDOW 章中已完成的章节
  const recentStart = Math.max(1, targetChapterNum - RECENT_CHAPTERS_WINDOW);
  const recent = chapters
    .filter(c => c.number >= recentStart && c.number < targetChapterNum && c.status === 'done')
    .sort((a, b) => a.number - b.number);

  if (recent.length === 0) return '';

  const lines = recent.map(c =>
    `第${c.number}章《${c.title || `第${c.number}章`}》：${c.summary || '（暂无摘要）'}`
  );

  return [`【近期章节回顾】`, ...lines].join('\n');
}

// ── 层5：当前任务 ─────────────────────────────────────────────────────────────

function buildCurrentChapterGoal(project: NovelProject, chapterNumber: number): string {
  // 找当前章节对应的情节幕
  const act = project.plotActs.find(
    a => chapterNumber >= a.chapterRange[0] && chapterNumber <= a.chapterRange[1]
  );

  const parts = [`【本章创作目标】`, `当前章节：第${chapterNumber}章`];

  if (act) {
    parts.push(`所属情节幕：${act.name}`);
    parts.push(`情节核心：${act.coreEvent}`);
    if (act.notes) parts.push(`创作备注：${act.notes}`);
  }

  return parts.join('\n');
}

function buildForeshadowHints(
  foreshadows: Foreshadow[],
  chapterNumber: number
): string {
  const relevant: string[] = [];

  foreshadows.forEach(f => {
    if (f.status === 'planned' && f.plantedChapter === chapterNumber) {
      relevant.push(`【需要埋设伏笔】${f.description}（计划在本章埋设）`);
    } else if (f.status === 'planted' && f.resolvedChapter === chapterNumber) {
      relevant.push(`【需要回收伏笔】${f.description}（计划在本章揭晓）`);
    } else if (f.status === 'planted' && f.resolvedChapter && f.resolvedChapter > chapterNumber && f.resolvedChapter <= chapterNumber + 3) {
      relevant.push(`【伏笔提示】${f.description}（即将在第${f.resolvedChapter}章回收，可在本章做铺垫）`);
    }
  });

  if (relevant.length === 0) return '';
  return [`【伏笔任务】`, ...relevant].join('\n');
}

// ── 主函数：构建完整 Story Bible 上下文 ────────────────────────────────────────

/**
 * 将 NovelProject 构建为传给 AI 的 StoryBibleContext
 * @param project 完整项目数据
 * @param targetChapterNum 即将生成的章节号
 */
export function buildStoryBibleContext(
  project: NovelProject,
  targetChapterNum: number
): StoryBibleContext {
  return {
    worldSummary: buildWorldSummary(project),
    styleSummary: buildStyleSummary(project),
    glossarySummary: buildGlossaryPrompt(project.glossary, targetChapterNum - 1),
    charactersSummary: buildCharactersSummary(project.characters),
    distantHistory: buildDistantHistory(project, targetChapterNum),
    recentChapterSummaries: buildRecentChapterSummaries(project.chapters, targetChapterNum),
    currentChapterGoal: buildCurrentChapterGoal(project, targetChapterNum),
    foreshadowHints: buildForeshadowHints(project.foreshadows, targetChapterNum),
  };
}

/**
 * 将 StoryBibleContext 拼合成完整的系统提示词字符串
 * 供 API 路由直接使用
 */
export function buildSystemPrompt(ctx: StoryBibleContext): string {
  const sections = [
    ctx.worldSummary,
    ctx.styleSummary,
    ctx.glossarySummary,
    ctx.charactersSummary,
    ctx.distantHistory,
    ctx.recentChapterSummaries,
    ctx.currentChapterGoal,
    ctx.foreshadowHints,
  ].filter(Boolean);

  return sections.join('\n\n');
}

// ── 辅助：从章节正文自动提取新增词汇 ─────────────────────────────────────────

/**
 * 简单的专有名词提取辅助函数
 * 用于章节生成后提示用户更新词汇表
 * 实际提取由 AI 完成，这里只是提供格式
 */
export function formatGlossaryUpdatePrompt(chapterContent: string, chapterNumber: number): string {
  return `请分析以下第${chapterNumber}章内容，提取本章新出现的专有名词（人名/地名/功法/宝物/组织等），
以JSON数组格式返回，每项包含字段：term（名词）、type（person/place/concept/item/organization）、definition（一句话说明）。
只返回本章首次出现的新名词，已知名词不需要重复。

章节内容：
${chapterContent.slice(0, 2000)}...`;
}

// ── 辅助：构建阶段摘要生成提示词 ─────────────────────────────────────────────

/**
 * 将多章摘要合并为阶段摘要的提示词
 */
export function buildActSummaryPrompt(chapterSummaries: Array<{ number: number; title: string; summary: string }>): string {
  const summariesText = chapterSummaries
    .sort((a, b) => a.number - b.number)
    .map(c => `第${c.number}章《${c.title}》：${c.summary}`)
    .join('\n');

  return `请将以下${chapterSummaries.length}个章节摘要合并成一段不超过500字的阶段故事摘要，
保留关键剧情节点、人物关系变化、已埋伏笔，删除重复和次要信息。
直接输出摘要，不需要任何前缀说明。

${summariesText}`;
}
