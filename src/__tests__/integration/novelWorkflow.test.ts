/**
 * 小说创作工坊 - 完整流程集成测试
 *
 * 测试流程：
 * 1. 创建新项目 → 存入 IndexedDB（localStorage 降级）
 * 2. 完成 5 步向导配置（大纲、世界观、人物、情节、风格）
 * 3. 构建 Story Bible 上下文
 * 4. 生成章节摘要（模拟）
 * 5. 验证上下文随章节增长的演变
 * 6. 验证跨会话记忆：保存后重新加载项目，上下文一致
 *
 * 属性：
 * Property 6: 跨会话记忆一致性 —— 保存后重新加载的上下文与保存前相同
 * Property 7: 故事圣经完整性 —— 完成向导配置的项目包含所有必要的上下文字段
 */

import { createEmptyProject } from '@/types/novel';
import type { NovelProject, CharacterProfile, PlotAct, Foreshadow, Chapter } from '@/types/novel';
import { buildStoryBibleContext, buildSystemPrompt } from '@/lib/novelContext';
import { saveProject, getProject, listProjects, deleteProject } from '@/lib/novelDB';

// ── Mock LocalStorage ─────────────────────────────────────────────────────────

class MockLocalStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, value: string): void { this.store.set(key, value); }
  removeItem(key: string): void { this.store.delete(key); }
  get length(): number { return this.store.size; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  clear(): void { this.store.clear(); }
}

let mockLS: MockLocalStorage;

beforeEach(() => {
  mockLS = new MockLocalStorage();
  Object.defineProperty(global, 'localStorage', { value: mockLS, writable: true, configurable: true });
  Object.defineProperty(global, 'window', { value: { localStorage: mockLS }, writable: true, configurable: true });
});

afterEach(() => {
  mockLS.clear();
});

// ── 测试数据工厂 ─────────────────────────────────────────────────────────────

function buildFullProject(): NovelProject {
  const project = createEmptyProject('integration-project-001');

  // 步骤1：填写大纲
  project.title = '苍穹之上';
  project.outline = {
    idea: '一个生活在穷苦山村的少年，意外获得上古神兵，踏上征战天下的修炼之路',
    genre: '玄幻',
    theme: '热血奋斗，保护弱者',
    logline: '山村少年林枫意外获得上古神兵，踏上修炼之路，为保护家园而战',
    setting: '东玄大陆，灵气稀薄的凡人界与灵气充盈的修炼界并存',
    conflict: '林枫与魔道势力的抗争，以及自身血脉秘密的探索',
    arc: '起：获得神兵，踏入修炼；承：加入宗门，艰难成长；转：发现血脉，揭开阴谋；合：大战魔头，守护家园',
    estimatedChapters: 200,
  };

  // 步骤2：世界观
  project.world = {
    worldType: '东方玄幻',
    powerSystem: '炼气（1-9层）→ 筑基 → 金丹 → 元婴 → 化神 → 合体 → 大乘',
    geography: '东玄大陆分五大区域：中域（帝国林立）、北荒（危机四伏）、南海（妖族聚集）、西漠（魔道盛行）、东海（仙岛飘渺）',
    history: '三千年前大劫，魔族入侵，人族与仙族联合驱逐，但魔族秘密潜伏至今',
    factions: '正道：天剑宗（剑修）、灵虚门（丹修）、玄武院（体修）；魔道：血魔教、幽冥宫；中立：商盟',
    customs: '以修为高低论尊卑，凡人地位低下，境界突破需灵丹辅助，灵石为通货',
    misc: '上古神器蕴含意志，与主人精神相连；血脉天赋决定修炼上限',
  };

  // 步骤3：人物
  const protagonist: CharacterProfile = {
    id: 'char-protagonist',
    name: '林枫',
    avatar: '林',
    role: 'protagonist',
    appearance: '身形挺拔，眉宇间有股英气，常穿青衣',
    personality: '热血坚韧，重情重义，表面粗糙实则细腻',
    backstory: '出身山村，父母早亡，由爷爷抚养长大，对修炼一窍不通却从未放弃',
    motivation: '保护村民，为父母复仇，探索血脉之谜',
    arc: '从懵懂少年成长为纵横天下的强者，经历失去与收获，最终领悟道义真谛',
    relationships: '师父：上古神兵意志；好友：王强、李思思；宿敌：血魔教圣子',
    bio: '林枫是苍穹之上的核心人物，性格热血坚韧…',
  };

  const antagonist: CharacterProfile = {
    id: 'char-antagonist',
    name: '血魔教圣子·虚无',
    avatar: '虚',
    role: 'antagonist',
    appearance: '面色苍白，眼神阴冷，着血红法袍',
    personality: '城府极深，手段毒辣，视人命如草芥',
    backstory: '曾是正道弟子，因遭背叛而投奔魔道，誓要颠覆人族秩序',
    motivation: '推翻现有秩序，成就魔道至尊',
    arc: '从被遗弃者到魔道权贵，内心扭曲但偶尔显现人性',
    relationships: '血魔教教主：主子；林枫：宿命之敌',
    bio: '血魔教圣子虚无是本书主要反派…',
  };

  project.characters = [protagonist, antagonist];

  // 步骤4：情节幕
  const act1: PlotAct = {
    id: 'act-1',
    name: '天降神兵',
    coreEvent: '林枫在祖地遗迹中发现上古神兵，触发意志觉醒，同时引来魔道势力觊觎',
    characterIds: ['char-protagonist'],
    emotionCurve: 'rising',
    chapterRange: [1, 20],
    notes: '本幕重点建立世界观和主角性格，以及引入核心冲突',
  };

  const foreshadow1: Foreshadow = {
    id: 'fs-1',
    description: '林枫手中的神兵偶尔发出神秘声音，暗示内有意志残留',
    plantedChapter: 3,
    resolvedChapter: 50,
    status: 'planned',
    notes: '',
  };

  const foreshadow2: Foreshadow = {
    id: 'fs-2',
    description: '爷爷在临终前低语了一个地名，暗示林家秘密',
    plantedChapter: 5,
    resolvedChapter: 30,
    status: 'planned',
    notes: '',
  };

  project.plotActs = [act1];
  project.foreshadows = [foreshadow1, foreshadow2];

  // 步骤5：风格
  project.style = {
    voice: 'third_limited',
    style: 'elaborate',
    pacing: 'medium',
    targetAudience: '18-35岁玄幻读者',
    notes: '注重人物内心刻画，打斗场景简洁有力，情感戏细腻真实',
  };

  project.currentStep = 'writing';

  return project;
}

function addChapters(project: NovelProject, count: number): NovelProject {
  const chapters: Chapter[] = Array.from({ length: count }, (_, i) => ({
    id: `ch-${i + 1}`,
    number: i + 1,
    title: `第${i + 1}章 ${i === 0 ? '天降神兵' : `修炼进展${i}`}`,
    plotActId: 'act-1',
    status: 'done' as const,
    content: `第${i + 1}章完整正文内容（约2500字）……林枫在这一章中经历了重要考验，实力有所提升。`,
    summary: `第${i + 1}章：林枫完成了本章的关键挑战，与友人的羁绊加深，并发现了新的线索。修为从炼气${i + 1}层晋升。`,
    wordCount: 2500,
    foreshadowIds: i < 2 ? [`fs-${i + 1}`] : [],
    notes: '',
    createdAt: Date.now() - (count - i) * 86400000,
    updatedAt: Date.now() - (count - i) * 86400000,
  }));

  return { ...project, chapters };
}

// ── 测试套件 ─────────────────────────────────────────────────────────────────

describe('完整工作流：项目创建与配置', () => {
  test('创建新项目并保存，然后能成功读取', async () => {
    const project = buildFullProject();
    await saveProject(project);

    const loaded = await getProject(project.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe('苍穹之上');
    expect(loaded?.outline.genre).toBe('玄幻');
    expect(loaded?.characters.length).toBe(2);
    expect(loaded?.plotActs.length).toBe(1);
    expect(loaded?.foreshadows.length).toBe(2);
  });

  test('完整项目能生成非空的系统提示词', () => {
    const project = buildFullProject();
    const ctx = buildStoryBibleContext(project, 1);
    const prompt = buildSystemPrompt(ctx);

    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('苍穹之上'); // 通过 logline 或 setting 存在
    expect(prompt).toContain('林枫');
    expect(prompt).toContain('东玄大陆');
    expect(prompt).toContain('玄幻');
  });
});

describe('Property 6: 跨会话记忆一致性', () => {
  test('保存项目后重新加载，Story Bible 上下文与保存前相同', async () => {
    const project = addChapters(buildFullProject(), 5);

    // 构建保存前的上下文
    const ctxBeforeSave = buildStoryBibleContext(project, 6);
    const promptBeforeSave = buildSystemPrompt(ctxBeforeSave);

    // 保存
    await saveProject(project);

    // 模拟"跨会话"：重新从存储加载
    const loadedProject = await getProject(project.id);
    expect(loadedProject).not.toBeNull();

    // 构建加载后的上下文
    const ctxAfterLoad = buildStoryBibleContext(loadedProject!, 6);
    const promptAfterLoad = buildSystemPrompt(ctxAfterLoad);

    // 上下文应该相同（除了 updatedAt 可能不同）
    expect(ctxAfterLoad.worldSummary).toBe(ctxBeforeSave.worldSummary);
    expect(ctxAfterLoad.styleSummary).toBe(ctxBeforeSave.styleSummary);
    expect(ctxAfterLoad.charactersSummary).toBe(ctxBeforeSave.charactersSummary);
    expect(ctxAfterLoad.recentChapterSummaries).toBe(ctxBeforeSave.recentChapterSummaries);
    expect(ctxAfterLoad.currentChapterGoal).toBe(ctxBeforeSave.currentChapterGoal);
    expect(promptAfterLoad).toBe(promptBeforeSave);
  });

  test.each([1, 5, 10, 20])('有 %i 章历史记录时，跨会话记忆保持一致', async (chapterCount) => {
    const project = addChapters(buildFullProject(), chapterCount);
    const targetChapter = chapterCount + 1;

    const ctxBefore = buildStoryBibleContext(project, targetChapter);
    await saveProject(project);

    const loaded = await getProject(project.id);
    const ctxAfter = buildStoryBibleContext(loaded!, targetChapter);

    expect(ctxAfter.recentChapterSummaries).toBe(ctxBefore.recentChapterSummaries);
    expect(ctxAfter.charactersSummary).toBe(ctxBefore.charactersSummary);
    expect(ctxAfter.worldSummary).toBe(ctxBefore.worldSummary);
  });
});

describe('Property 7: 故事圣经完整性', () => {
  test('完成向导后的项目，系统提示词包含所有关键信息', () => {
    const project = buildFullProject();
    const ctx = buildStoryBibleContext(project, 1);

    // 世界观字段
    expect(ctx.worldSummary).toContain('玄幻');
    expect(ctx.worldSummary).toContain('东玄大陆');
    expect(ctx.worldSummary).toContain('炼气');

    // 风格字段
    expect(ctx.styleSummary).toContain('第三人称有限视角');
    expect(ctx.styleSummary).toContain('华丽细腻');

    // 人物字段
    expect(ctx.charactersSummary).toContain('林枫');
    expect(ctx.charactersSummary).toContain('主角');
    expect(ctx.charactersSummary).toContain('虚无');
    expect(ctx.charactersSummary).toContain('反派');

    // 情节幕目标
    expect(ctx.currentChapterGoal).toContain('天降神兵');
  });

  test('伏笔系统：计划在第3章埋设的伏笔在第3章生成时出现', () => {
    const project = buildFullProject();
    const ctx = buildStoryBibleContext(project, 3);

    expect(ctx.foreshadowHints).toContain('神兵偶尔发出神秘声音');
    expect(ctx.foreshadowHints).toContain('需要埋设伏笔');
  });

  test('伏笔系统：非当前章节的伏笔不出现在 foreshadowHints 中', () => {
    const project = buildFullProject();
    // 当前是第1章，只有第3章和第5章的伏笔
    const ctx = buildStoryBibleContext(project, 1);

    // 第1章没有要处理的伏笔
    expect(ctx.foreshadowHints).toBe('');
  });
});

describe('上下文随章节增长的演变', () => {
  test('章节增加时，近期摘要数量增加', () => {
    const project5 = addChapters(buildFullProject(), 5);
    const project10 = addChapters(buildFullProject(), 10);

    const ctx5 = buildStoryBibleContext(project5, 6);
    const ctx10 = buildStoryBibleContext(project10, 11);

    // 10章的近期摘要应该比5章的更长
    expect(ctx10.recentChapterSummaries.length).toBeGreaterThan(ctx5.recentChapterSummaries.length);
  });

  test('超过10章时，近期摘要只包含最新的10章', () => {
    const project15 = addChapters(buildFullProject(), 15);
    const ctx = buildStoryBibleContext(project15, 16);

    // 第1-5章不在近期窗口（16-10=6，所以窗口是6-15章）
    for (let i = 1; i <= 5; i++) {
      expect(ctx.recentChapterSummaries).not.toContain(`ch-${i}`);
    }

    // 第6-15章应在近期窗口中
    for (let i = 6; i <= 15; i++) {
      expect(ctx.recentChapterSummaries).toContain(`第${i}章`);
    }
  });

  test('每章的系统提示词字符串随章节进展而增长（知识累积）', () => {
    const project3 = addChapters(buildFullProject(), 3);
    const project8 = addChapters(buildFullProject(), 8);

    const prompt3 = buildSystemPrompt(buildStoryBibleContext(project3, 4));
    const prompt8 = buildSystemPrompt(buildStoryBibleContext(project8, 9));

    expect(prompt8.length).toBeGreaterThan(prompt3.length);
  });
});

describe('多项目管理', () => {
  test('多个项目互相独立，互不干扰', async () => {
    const project1 = { ...buildFullProject(), id: 'multi-p1', title: '项目一' };
    const project2 = { ...buildFullProject(), id: 'multi-p2', title: '项目二' };

    await saveProject(project1);
    await saveProject(project2);

    const loaded1 = await getProject('multi-p1');
    const loaded2 = await getProject('multi-p2');

    expect(loaded1?.title).toBe('项目一');
    expect(loaded2?.title).toBe('项目二');
  });

  test('删除一个项目不影响其他项目', async () => {
    const p1 = { ...buildFullProject(), id: 'del-test-p1', title: '要删除的项目' };
    const p2 = { ...buildFullProject(), id: 'del-test-p2', title: '保留的项目' };

    await saveProject(p1);
    await saveProject(p2);
    await deleteProject('del-test-p1');

    const deleted = await getProject('del-test-p1');
    const kept = await getProject('del-test-p2');

    expect(deleted).toBeNull();
    expect(kept?.title).toBe('保留的项目');
  });

  test('项目列表按更新时间排序', async () => {
    // 通过 localStorage 直接写入不同时间戳的项目
    const ls = global.localStorage as MockLocalStorage;
    const p1 = { ...buildFullProject(), id: 'sort-1', title: '最旧的项目', updatedAt: 1000 };
    const p2 = { ...buildFullProject(), id: 'sort-2', title: '最新的项目', updatedAt: 3000 };
    const p3 = { ...buildFullProject(), id: 'sort-3', title: '中间的项目', updatedAt: 2000 };

    ls.setItem('novel_creator_sort-1', JSON.stringify(p1));
    ls.setItem('novel_creator_sort-2', JSON.stringify(p2));
    ls.setItem('novel_creator_sort-3', JSON.stringify(p3));

    const list = await listProjects();
    const titles = list.map(p => p.title);

    expect(titles[0]).toBe('最新的项目');
    expect(titles[2]).toBe('最旧的项目');
  });
});

describe('数据完整性验证', () => {
  test('保存包含特殊字符的项目（引号、换行、emoji）', async () => {
    const project = buildFullProject();
    project.title = '「苍穹之上」——命运的抉择 🌟';
    project.outline.idea = '包含"双引号"和\'单引号\'，以及\n换行符的故事灵感';

    await saveProject(project);
    const loaded = await getProject(project.id);

    expect(loaded?.title).toBe('「苍穹之上」——命运的抉择 🌟');
    expect(loaded?.outline.idea).toBe('包含"双引号"和\'单引号\'，以及\n换行符的故事灵感');
  });

  test('保存包含大量章节的项目（性能边界）', async () => {
    const project = addChapters(buildFullProject(), 50);
    const startTime = Date.now();

    await saveProject(project);
    const loaded = await getProject(project.id);

    const elapsed = Date.now() - startTime;
    expect(loaded?.chapters.length).toBe(50);
    expect(elapsed).toBeLessThan(1000); // 应该在1秒内完成
  });

  test('上下文构建不修改原始项目数据（不可变性）', () => {
    const project = addChapters(buildFullProject(), 5);
    const originalChapters = JSON.stringify(project.chapters);
    const originalCharacters = JSON.stringify(project.characters);

    // 构建上下文
    buildStoryBibleContext(project, 6);
    buildSystemPrompt(buildStoryBibleContext(project, 6));

    // 原始数据不应被修改
    expect(JSON.stringify(project.chapters)).toBe(originalChapters);
    expect(JSON.stringify(project.characters)).toBe(originalCharacters);
  });
});
