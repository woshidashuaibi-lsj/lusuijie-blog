/**
 * 小说创作工坊 - 核心数据类型定义
 * Story Bible（故事圣经）是跨会话记忆的核心数据结构
 */

// ── 向导步骤 ──────────────────────────────────────────────────────────────────
export type WizardStep =
  | 'outline'
  | 'world'
  | 'characters'
  | 'plot'
  | 'style'
  | 'writing';

// ── 大纲 ─────────────────────────────────────────────────────────────────────
export interface OutlineData {
  /** 用户原始灵感输入 */
  idea: string;
  /** 小说类型：玄幻/仙侠/都市/科幻/历史/悬疑等 */
  genre: string;
  /** 核心主题 */
  theme: string;
  /** 一句话故事概述（logline） */
  logline: string;
  /** 故事背景 */
  setting: string;
  /** 核心冲突 */
  conflict: string;
  /** 故事走向（起承转合） */
  arc: string;
  /** 预估章节数 */
  estimatedChapters: number;
}

// ── 世界观 ────────────────────────────────────────────────────────────────────
export interface WorldData {
  /** 世界类型：现实/玄幻/科幻/历史 */
  worldType: string;
  /** 力量体系（魔法/修炼/科技体系等） */
  powerSystem: string;
  /** 主要地点与地理 */
  geography: string;
  /** 历史背景与时代背景 */
  history: string;
  /** 主要势力/阵营/组织 */
  factions: string;
  /** 风俗习惯与文化 */
  customs: string;
  /** 其他补充设定 */
  misc: string;
}

// ── 人物档案 ──────────────────────────────────────────────────────────────────
export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor';

export interface CharacterProfile {
  id: string;
  /** 人物名字 */
  name: string;
  /** 头像（emoji 或首字符） */
  avatar: string;
  /** 角色类型 */
  role: CharacterRole;
  /** 外貌描述 */
  appearance: string;
  /** 性格特征 */
  personality: string;
  /** 人物背景与经历 */
  backstory: string;
  /** 核心动机与目标 */
  motivation: string;
  /** 成长弧 */
  arc: string;
  /** 与其他人物的关系 */
  relationships: string;
  /** AI 生成的完整人物小传（≤500字） */
  bio: string;
}

// ── 情节幕 ────────────────────────────────────────────────────────────────────
export type EmotionCurve = 'rising' | 'falling' | 'twist' | 'climax' | 'resolution';

export interface PlotAct {
  id: string;
  /** 幕名 */
  name: string;
  /** 核心事件描述 */
  coreEvent: string;
  /** 涉及人物 id 列表 */
  characterIds: string[];
  /** 情绪弧线 */
  emotionCurve: EmotionCurve;
  /** 预计起止章节 [start, end] */
  chapterRange: [number, number];
  /** 备注 */
  notes: string;
}

// ── 伏笔 ─────────────────────────────────────────────────────────────────────
export type ForeshadowStatus = 'planned' | 'planted' | 'resolved';

export interface Foreshadow {
  id: string;
  /** 伏笔描述 */
  description: string;
  /** 计划埋设章节号（null=尚未指定） */
  plantedChapter: number | null;
  /** 计划回收章节号（null=尚未指定） */
  resolvedChapter: number | null;
  /** 当前状态 */
  status: ForeshadowStatus;
  /** 备注 */
  notes: string;
}

// ── 写作风格 ──────────────────────────────────────────────────────────────────
export type NarrativeVoice = 'first' | 'third_limited' | 'third_omniscient';
export type WritingStyle = 'concise' | 'elaborate' | 'suspense' | 'humorous' | 'lyrical' | 'gritty';
export type Pacing = 'fast' | 'medium' | 'slow';

export interface StyleConfig {
  /** 叙事视角 */
  voice: NarrativeVoice;
  /** 写作风格 */
  style: WritingStyle;
  /** 语言节奏 */
  pacing: Pacing;
  /** 目标读者群 */
  targetAudience: string;
  /** 其他风格备注 */
  notes: string;
}

// ── 章节 ─────────────────────────────────────────────────────────────────────
export type ChapterStatus = 'pending' | 'generating' | 'draft' | 'done';

export interface Chapter {
  id: string;
  /** 章节编号（从1开始） */
  number: number;
  /** 章节标题 */
  title: string;
  /** 所属情节幕 id */
  plotActId: string;
  /** 章节状态 */
  status: ChapterStatus;
  /** 完整章节正文（2000-4000字） */
  content: string;
  /** AI 压缩摘要（≤300字）—— 跨会话记忆的核心 */
  summary: string;
  /** 字数统计 */
  wordCount: number;
  /** 本章涉及的伏笔 id */
  foreshadowIds: string[];
  /** 本章笔记/创作备忘 */
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// ── 词汇表条目（命名一致性）────────────────────────────────────────────────────
export type GlossaryType = 'person' | 'place' | 'concept' | 'item' | 'organization';

export interface GlossaryEntry {
  id: string;
  /** 专有名词 */
  term: string;
  /** 简短说明 */
  definition: string;
  /** 首次出现章节号 */
  firstAppeared: number;
  /** 词条类型 */
  type: GlossaryType;
}

// ── 阶段摘要（每10章合并，用于超长小说压缩上下文）─────────────────────────────
export interface ActSummary {
  /** 覆盖的章节范围 [start, end]，闭区间 */
  chapterRange: [number, number];
  /** 合并后的摘要（≤500字） */
  summary: string;
  /** 生成时间 */
  createdAt: number;
}

// ── 版本快照 ──────────────────────────────────────────────────────────────────
export interface StoryBibleSnapshot {
  /** 快照时间戳 */
  timestamp: number;
  /** 快照标签，例如"第5章完成后" */
  label: string;
  /** 快照数据（不含 snapshots 自身，防止递归） */
  data: Omit<NovelProject, 'snapshots'>;
}

// ── 创作统计 ──────────────────────────────────────────────────────────────────
export interface NovelStats {
  /** 总字数 */
  totalWords: number;
  /** 已完成章节数 */
  completedChapters: number;
  /** 累计创作时长（毫秒） */
  totalTime: number;
  /** 上次打开时间 */
  lastOpenedAt: number;
}

// ── 完整 Novel Project（Story Bible 根节点）────────────────────────────────────
export interface NovelProject {
  /** 项目唯一 ID（UUID） */
  id: string;
  /** 小说标题 */
  title: string;
  createdAt: number;
  updatedAt: number;
  /** 当前向导步骤 */
  currentStep: WizardStep;

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
  /** 专有名词词典（命名一致性保证） */
  glossary: GlossaryEntry[];
  /** 阶段摘要（超过20章时由早期摘要合并生成） */
  actSummaries: ActSummary[];

  // ── 元数据 ──
  stats: NovelStats;
  /** 版本快照（最多保留5个） */
  snapshots: StoryBibleSnapshot[];
}

// ── 工具类型 ──────────────────────────────────────────────────────────────────

/** Story Bible 上下文（传给 API 的精简版本，用于 AI 生成） */
export interface StoryBibleContext {
  /** 世界观核心设定 */
  worldSummary: string;
  /** 写作风格要求 */
  styleSummary: string;
  /** 词汇表（命名一致性） */
  glossarySummary: string;
  /** 人物档案摘要 */
  charactersSummary: string;
  /** 远期历史（阶段摘要，早期章节合并）  */
  distantHistory: string;
  /** 近期章节摘要（最近10章） */
  recentChapterSummaries: string;
  /** 当前章节写作目标 */
  currentChapterGoal: string;
  /** 本章需要处理的伏笔提示 */
  foreshadowHints: string;
}

/** 创建新项目的默认值工厂 */
export function createEmptyProject(id: string): NovelProject {
  const now = Date.now();
  return {
    id,
    title: '未命名小说',
    createdAt: now,
    updatedAt: now,
    currentStep: 'outline',
    outline: {
      idea: '',
      genre: '',
      theme: '',
      logline: '',
      setting: '',
      conflict: '',
      arc: '',
      estimatedChapters: 30,
    },
    world: {
      worldType: '',
      powerSystem: '',
      geography: '',
      history: '',
      factions: '',
      customs: '',
      misc: '',
    },
    characters: [],
    plotActs: [],
    foreshadows: [],
    style: {
      voice: 'third_limited',
      style: 'elaborate',
      pacing: 'medium',
      targetAudience: '',
      notes: '',
    },
    chapters: [],
    glossary: [],
    actSummaries: [],
    stats: {
      totalWords: 0,
      completedChapters: 0,
      totalTime: 0,
      lastOpenedAt: now,
    },
    snapshots: [],
  };
}

/** 统计项目总字数 */
export function calcTotalWords(project: NovelProject): number {
  return project.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
}
