/**
 * Story Bible 上下文构建器 - 属性测试 & 单元测试
 *
 * 测试策略：
 * - 属性测试：验证跨所有有效输入的普遍属性（不变量、幂等性、边界行为）
 * - 单元测试：验证具体示例和边界条件
 *
 * 关键属性：
 * Property 1: 输出确定性 —— 相同输入始终产生相同输出
 * Property 2: 上下文完整性 —— 所有非空字段都出现在最终系统提示词中
 * Property 3: 时间窗口约束 —— 只有 firstAppeared <= targetChapterNum-1 的词汇才会被包含
 * Property 4: 分层摘要隔离 —— 远期历史只在章节数超过阈值时出现
 * Property 5: 近期章节窗口 —— 只包含最近 10 章的摘要
 */

import {
  buildStoryBibleContext,
  buildSystemPrompt,
  buildGlossaryPrompt,
  buildActSummaryPrompt,
  formatGlossaryUpdatePrompt,
} from '@/lib/novelContext';
import { createEmptyProject } from '@/types/novel';
import type { NovelProject, CharacterProfile, Chapter, Foreshadow, GlossaryEntry, PlotAct } from '@/types/novel';

// ── 测试工具函数 ────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<NovelProject> = {}): NovelProject {
  const base = createEmptyProject('test-id-001');
  return {
    ...base,
    title: '测试小说',
    outline: {
      idea: '一个少年踏上修炼之路',
      genre: '玄幻',
      theme: '成长与牺牲',
      logline: '普通少年发现自身隐藏的天赋，为保护家人踏上充满危险的修炼之旅',
      setting: '东玄大陆，灵气充盈的修炼世界',
      conflict: '少年与魔族的生死较量',
      arc: '起：偶遇机缘 → 承：艰难修炼 → 转：发现秘密 → 合：大战魔族',
      estimatedChapters: 100,
    },
    world: {
      worldType: '东方玄幻',
      powerSystem: '炼气→筑基→金丹→元婴',
      geography: '东玄大陆，三大帝国，无数修炼宗门',
      history: '三千年前曾发生大劫，魔族入侵险些覆灭人族',
      factions: '正道：天剑宗、灵虚门；魔道：血魔教、幽冥宫',
      customs: '修炼者以实力为尊，宗门弟子地位高于散修',
      misc: '灵石是通用货币，丹药可辅助修炼',
    },
    style: {
      voice: 'third_limited',
      style: 'elaborate',
      pacing: 'medium',
      targetAudience: '18-35岁玄幻爱好者',
      notes: '注重人物内心刻画，适当融入东方哲学',
    },
    ...overrides,
  };
}

function makeCharacter(id: string, name: string, role: CharacterProfile['role'] = 'supporting'): CharacterProfile {
  return {
    id,
    name,
    avatar: name[0],
    role,
    appearance: `${name}，身形挺拔`,
    personality: '坚毅果断',
    backstory: `${name}自幼孤苦，凭借努力踏上修炼之路`,
    motivation: '保护家人，探索天道',
    arc: '从普通到卓越的蜕变',
    relationships: '',
    bio: `${name}是本书核心人物，性格坚毅，胸怀天下。`,
  };
}

function makeChapter(number: number, status: Chapter['status'] = 'done'): Chapter {
  return {
    id: `chapter-${number}`,
    number,
    title: `第${number}章 修炼初悟`,
    plotActId: 'act-1',
    status,
    content: `第${number}章正文内容，描述主角修炼的过程……（省略约2000字）`,
    summary: `第${number}章：主角经历了一场考验，实力提升，获得新的感悟。`,
    wordCount: 2000 + number * 100,
    foreshadowIds: [],
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeGlossaryEntry(id: string, term: string, firstAppeared: number): GlossaryEntry {
  return {
    id,
    term,
    definition: `${term}是本小说中的重要概念`,
    firstAppeared,
    type: 'concept',
  };
}

// ── 属性测试 ────────────────────────────────────────────────────────────────────

describe('Property 1: 输出确定性 —— 相同输入始终产生相同输出', () => {
  test('buildStoryBibleContext 对同一项目和章节号产生相同结果', () => {
    const project = makeProject({
      characters: [makeCharacter('c1', '林枫', 'protagonist')],
    });

    const ctx1 = buildStoryBibleContext(project, 5);
    const ctx2 = buildStoryBibleContext(project, 5);

    expect(ctx1).toEqual(ctx2);
  });

  test('buildSystemPrompt 对相同上下文产生相同字符串', () => {
    const project = makeProject();
    const ctx = buildStoryBibleContext(project, 3);
    const prompt1 = buildSystemPrompt(ctx);
    const prompt2 = buildSystemPrompt(ctx);

    expect(prompt1).toBe(prompt2);
  });

  // 模拟多个随机输入进行属性测试
  test.each([1, 5, 10, 20, 50])('对章节号 %i，输出保持确定性', (chapterNum) => {
    const project = makeProject({
      chapters: Array.from({ length: chapterNum - 1 }, (_, i) => makeChapter(i + 1)),
    });

    const ctx1 = buildStoryBibleContext(project, chapterNum);
    const ctx2 = buildStoryBibleContext(project, chapterNum);

    expect(ctx1.worldSummary).toBe(ctx2.worldSummary);
    expect(ctx1.styleSummary).toBe(ctx2.styleSummary);
    expect(ctx1.charactersSummary).toBe(ctx2.charactersSummary);
    expect(ctx1.recentChapterSummaries).toBe(ctx2.recentChapterSummaries);
  });
});

describe('Property 2: 上下文完整性 —— 核心设定字段出现在系统提示词中', () => {
  test('世界观字段出现在 worldSummary 中', () => {
    const project = makeProject();
    const ctx = buildStoryBibleContext(project, 1);

    expect(ctx.worldSummary).toContain(project.outline.genre);
    expect(ctx.worldSummary).toContain(project.outline.theme);
    expect(ctx.worldSummary).toContain(project.world.worldType);
    expect(ctx.worldSummary).toContain(project.world.powerSystem);
  });

  test('写作风格字段出现在 styleSummary 中', () => {
    const project = makeProject();
    const ctx = buildStoryBibleContext(project, 1);

    // 第三人称有限视角
    expect(ctx.styleSummary).toContain('第三人称有限视角');
    // 华丽细腻
    expect(ctx.styleSummary).toContain('华丽细腻');
    // 中等节奏
    expect(ctx.styleSummary).toContain('中等节奏');
  });

  test('人物信息出现在 charactersSummary 中', () => {
    const project = makeProject({
      characters: [
        makeCharacter('c1', '林枫', 'protagonist'),
        makeCharacter('c2', '叶清', 'antagonist'),
      ],
    });
    const ctx = buildStoryBibleContext(project, 1);

    expect(ctx.charactersSummary).toContain('林枫');
    expect(ctx.charactersSummary).toContain('叶清');
    expect(ctx.charactersSummary).toContain('主角');
    expect(ctx.charactersSummary).toContain('反派');
  });

  test('buildSystemPrompt 包含所有非空上下文部分', () => {
    const project = makeProject({
      characters: [makeCharacter('c1', '林枫', 'protagonist')],
      chapters: [makeChapter(1)],
    });
    const ctx = buildStoryBibleContext(project, 2);
    const prompt = buildSystemPrompt(ctx);

    // 所有非空字段都应该出现在系统提示词中
    if (ctx.worldSummary) expect(prompt).toContain(ctx.worldSummary);
    if (ctx.styleSummary) expect(prompt).toContain(ctx.styleSummary);
    if (ctx.charactersSummary) expect(prompt).toContain(ctx.charactersSummary);
    if (ctx.recentChapterSummaries) expect(prompt).toContain(ctx.recentChapterSummaries);
  });
});

describe('Property 3: 时间窗口约束 —— 词汇表只包含已出现的词汇', () => {
  test('firstAppeared <= targetChapterNum-1 的词汇才被包含', () => {
    const glossary: GlossaryEntry[] = [
      makeGlossaryEntry('g1', '玄天诀', 1),     // 第1章出现，查第5章时应包含
      makeGlossaryEntry('g2', '灵虚剑', 3),     // 第3章出现，查第5章时应包含
      makeGlossaryEntry('g3', '天魂珠', 5),     // 第5章出现，查第5章时不应包含（upToChapter=4）
      makeGlossaryEntry('g4', '魔焰印', 10),    // 第10章出现，查第5章时不应包含
    ];

    const prompt = buildGlossaryPrompt(glossary, 4); // upToChapter=4，即查第5章前

    expect(prompt).toContain('玄天诀');
    expect(prompt).toContain('灵虚剑');
    expect(prompt).not.toContain('天魂珠');
    expect(prompt).not.toContain('魔焰印');
  });

  test.each([1, 5, 10, 25, 50])('章节 %i：词汇表只含 firstAppeared <= upToChapter 的词条', (upToChapter) => {
    const entries: GlossaryEntry[] = Array.from({ length: 20 }, (_, i) =>
      makeGlossaryEntry(`g${i}`, `名词${i}`, i + 1)
    );

    const prompt = buildGlossaryPrompt(entries, upToChapter);

    // 验证所有应包含的词条都在里面
    entries.filter(e => e.firstAppeared <= upToChapter).forEach(e => {
      expect(prompt).toContain(e.term);
    });

    // 验证不应包含的词条不在里面
    entries.filter(e => e.firstAppeared > upToChapter).forEach(e => {
      expect(prompt).not.toContain(e.term);
    });
  });

  test('词汇表为空时返回空字符串', () => {
    const prompt = buildGlossaryPrompt([], 10);
    expect(prompt).toBe('');
  });

  test('没有符合条件的词汇时返回空字符串', () => {
    const entries: GlossaryEntry[] = [
      makeGlossaryEntry('g1', '未来名词A', 100),
      makeGlossaryEntry('g2', '未来名词B', 200),
    ];
    const prompt = buildGlossaryPrompt(entries, 5);
    expect(prompt).toBe('');
  });
});

describe('Property 4: 分层摘要隔离 —— 远期历史只在章节数超过20时出现', () => {
  test('章节数 <= 20 时，distantHistory 为空', () => {
    const project = makeProject({
      chapters: Array.from({ length: 15 }, (_, i) => makeChapter(i + 1)),
      actSummaries: [
        {
          chapterRange: [1, 5],
          summary: '前五章阶段摘要',
          createdAt: Date.now(),
        },
      ],
    });

    const ctx = buildStoryBibleContext(project, 16);
    expect(ctx.distantHistory).toBe('');
  });

  test('章节数 > 20 时，distantHistory 包含早期阶段摘要', () => {
    const chapters = Array.from({ length: 25 }, (_, i) => makeChapter(i + 1));
    const project = makeProject({
      chapters,
      actSummaries: [
        {
          chapterRange: [1, 10],
          summary: '前十章故事摘要：主角成长，获得初步修炼成就',
          createdAt: Date.now(),
        },
      ],
    });

    // 生成第26章时，前10章已经是"远期历史"
    const ctx = buildStoryBibleContext(project, 26);
    expect(ctx.distantHistory).toContain('前十章故事摘要');
  });

  test('阶段摘要不包含在近期章节窗口内的章节', () => {
    const chapters = Array.from({ length: 25 }, (_, i) => makeChapter(i + 1));
    const project = makeProject({
      chapters,
      actSummaries: [
        { chapterRange: [1, 10], summary: '早期摘要', createdAt: Date.now() },
        { chapterRange: [16, 20], summary: '近期阶段摘要', createdAt: Date.now() },
      ],
    });

    // 生成第26章，近期窗口是16-25章
    const ctx = buildStoryBibleContext(project, 26);

    // 早期摘要（结束于第10章，远在窗口之外）应该出现
    expect(ctx.distantHistory).toContain('早期摘要');
    // 近期阶段摘要（第16-20章）在近期窗口内，不应该出现在 distantHistory
    expect(ctx.distantHistory).not.toContain('近期阶段摘要');
  });
});

describe('Property 5: 近期章节窗口 —— 只包含最近 10 章的摘要', () => {
  test('只有状态为 done 的章节摘要被包含', () => {
    const chapters: Chapter[] = [
      { ...makeChapter(1, 'done'), summary: '第1章摘要' },
      { ...makeChapter(2, 'draft'), summary: '第2章草稿摘要' }, // draft 不应包含
      { ...makeChapter(3, 'done'), summary: '第3章摘要' },
    ];
    const project = makeProject({ chapters });
    const ctx = buildStoryBibleContext(project, 4);

    expect(ctx.recentChapterSummaries).toContain('第1章摘要');
    expect(ctx.recentChapterSummaries).not.toContain('第2章草稿摘要');
    expect(ctx.recentChapterSummaries).toContain('第3章摘要');
  });

  test('超过10章时只包含最近10章', () => {
    const chapters = Array.from({ length: 20 }, (_, i) => ({
      ...makeChapter(i + 1, 'done'),
      summary: `第${i + 1}章摘要内容`,
    }));
    const project = makeProject({ chapters });

    // 生成第21章，近期窗口应为第11-20章
    const ctx = buildStoryBibleContext(project, 21);

    // 第11-20章应包含
    for (let i = 11; i <= 20; i++) {
      expect(ctx.recentChapterSummaries).toContain(`第${i}章摘要内容`);
    }

    // 第1-10章不应在近期摘要中（但可能在阶段摘要中）
    for (let i = 1; i <= 10; i++) {
      expect(ctx.recentChapterSummaries).not.toContain(`第${i}章摘要内容`);
    }
  });

  test('无完成章节时 recentChapterSummaries 为空', () => {
    const project = makeProject({ chapters: [] });
    const ctx = buildStoryBibleContext(project, 1);
    expect(ctx.recentChapterSummaries).toBe('');
  });
});

// ── 单元测试：具体场景验证 ─────────────────────────────────────────────────────

describe('buildStoryBibleContext - 具体场景', () => {
  test('第1章：无历史章节，上下文只包含世界观、人物、写作风格', () => {
    const project = makeProject({
      characters: [makeCharacter('c1', '主角A', 'protagonist')],
    });
    const ctx = buildStoryBibleContext(project, 1);

    expect(ctx.worldSummary).not.toBe('');
    expect(ctx.styleSummary).not.toBe('');
    expect(ctx.charactersSummary).not.toBe('');
    expect(ctx.recentChapterSummaries).toBe('');  // 没有历史章节
    expect(ctx.distantHistory).toBe('');           // 没有阶段摘要
  });

  test('伏笔任务：计划埋设的伏笔出现在 foreshadowHints 中', () => {
    const foreshadows: Foreshadow[] = [
      {
        id: 'f1',
        description: '主角手中的玉佩是古老宝物的关键',
        plantedChapter: 3,     // 计划在第3章埋设
        resolvedChapter: 20,
        status: 'planned',
        notes: '',
      },
    ];
    const project = makeProject({ foreshadows });
    const ctx = buildStoryBibleContext(project, 3); // 当前第3章

    expect(ctx.foreshadowHints).toContain('主角手中的玉佩是古老宝物的关键');
    expect(ctx.foreshadowHints).toContain('需要埋设伏笔');
  });

  test('伏笔任务：计划回收的伏笔出现在 foreshadowHints 中', () => {
    const foreshadows: Foreshadow[] = [
      {
        id: 'f1',
        description: '失踪的师父其实是大反派',
        plantedChapter: 5,
        resolvedChapter: 30,   // 计划在第30章回收
        status: 'planted',
        notes: '',
      },
    ];
    const project = makeProject({ foreshadows });
    const ctx = buildStoryBibleContext(project, 30); // 当前第30章

    expect(ctx.foreshadowHints).toContain('失踪的师父其实是大反派');
    expect(ctx.foreshadowHints).toContain('需要回收伏笔');
  });

  test('情节幕目标：当前章节所属情节幕信息出现在 currentChapterGoal 中', () => {
    const plotActs: PlotAct[] = [
      {
        id: 'act-1',
        name: '初遇机缘',
        coreEvent: '主角发现天才根骨，被天剑宗收录',
        characterIds: ['c1'],
        emotionCurve: 'rising',
        chapterRange: [1, 10],
        notes: '此幕需要建立主角的热血性格',
      },
    ];
    const project = makeProject({ plotActs });
    const ctx = buildStoryBibleContext(project, 5);

    expect(ctx.currentChapterGoal).toContain('初遇机缘');
    expect(ctx.currentChapterGoal).toContain('主角发现天才根骨，被天剑宗收录');
  });

  test('人物按角色重要性排序：主角在前，路人在后', () => {
    const project = makeProject({
      characters: [
        makeCharacter('c4', '路人甲', 'minor'),
        makeCharacter('c3', '配角乙', 'supporting'),
        makeCharacter('c1', '主角林枫', 'protagonist'),
        makeCharacter('c2', '反派叶清', 'antagonist'),
      ],
    });
    const ctx = buildStoryBibleContext(project, 1);

    const mainIdx = ctx.charactersSummary.indexOf('主角林枫');
    const antagonistIdx = ctx.charactersSummary.indexOf('反派叶清');
    const supportingIdx = ctx.charactersSummary.indexOf('配角乙');
    const minorIdx = ctx.charactersSummary.indexOf('路人甲');

    // 主角 < 反派 < 配角 < 路人（按出现顺序）
    expect(mainIdx).toBeLessThan(antagonistIdx);
    expect(antagonistIdx).toBeLessThan(supportingIdx);
    expect(supportingIdx).toBeLessThan(minorIdx);
  });
});

describe('buildGlossaryPrompt - 边界条件', () => {
  test('upToChapter = 0 时返回空字符串', () => {
    const entries: GlossaryEntry[] = [
      makeGlossaryEntry('g1', '某名词', 1),
    ];
    const result = buildGlossaryPrompt(entries, 0);
    expect(result).toBe('');
  });

  test('所有词汇 firstAppeared = 1 且 upToChapter >= 1 时全部包含', () => {
    const entries: GlossaryEntry[] = Array.from({ length: 5 }, (_, i) =>
      makeGlossaryEntry(`g${i}`, `名词${i}`, 1)
    );
    const result = buildGlossaryPrompt(entries, 1);
    entries.forEach(e => {
      expect(result).toContain(e.term);
    });
  });

  test('词汇表标题只出现一次', () => {
    const entries: GlossaryEntry[] = [
      makeGlossaryEntry('g1', '词汇A', 1),
      makeGlossaryEntry('g2', '词汇B', 2),
    ];
    const result = buildGlossaryPrompt(entries, 5);
    const titleCount = (result.match(/【专有名词表/g) || []).length;
    expect(titleCount).toBe(1);
  });
});

describe('buildActSummaryPrompt - 格式验证', () => {
  test('包含所有章节摘要', () => {
    const summaries = [
      { number: 1, title: '第一章', summary: '主角出生在穷苦人家' },
      { number: 2, title: '第二章', summary: '偶遇老仙人，传授秘法' },
      { number: 3, title: '第三章', summary: '拜入天剑宗，开始修炼' },
    ];
    const prompt = buildActSummaryPrompt(summaries);

    expect(prompt).toContain('第一章');
    expect(prompt).toContain('主角出生在穷苦人家');
    expect(prompt).toContain('第二章');
    expect(prompt).toContain('偶遇老仙人，传授秘法');
    expect(prompt).toContain('第三章');
    expect(prompt).toContain('拜入天剑宗，开始修炼');
  });

  test('提示词包含字数限制说明', () => {
    const summaries = [
      { number: 1, title: '第一章', summary: '测试内容' },
    ];
    const prompt = buildActSummaryPrompt(summaries);
    expect(prompt).toContain('500字');
  });

  test('章节数量出现在提示词中', () => {
    const summaries = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      title: `第${i + 1}章`,
      summary: `第${i + 1}章摘要`,
    }));
    const prompt = buildActSummaryPrompt(summaries);
    expect(prompt).toContain('5');
  });

  test('章节按编号排序输出', () => {
    const summaries = [
      { number: 3, title: '第三章', summary: '摘要C' },
      { number: 1, title: '第一章', summary: '摘要A' },
      { number: 2, title: '第二章', summary: '摘要B' },
    ];
    const prompt = buildActSummaryPrompt(summaries);

    const posA = prompt.indexOf('摘要A');
    const posB = prompt.indexOf('摘要B');
    const posC = prompt.indexOf('摘要C');

    expect(posA).toBeLessThan(posB);
    expect(posB).toBeLessThan(posC);
  });
});

describe('formatGlossaryUpdatePrompt - 格式验证', () => {
  test('包含章节号', () => {
    const prompt = formatGlossaryUpdatePrompt('章节内容', 5);
    expect(prompt).toContain('5');
  });

  test('包含 JSON 格式要求', () => {
    const prompt = formatGlossaryUpdatePrompt('章节内容', 1);
    expect(prompt).toContain('JSON');
  });

  test('长内容被截断至2000字', () => {
    const longContent = 'A'.repeat(5000);
    const prompt = formatGlossaryUpdatePrompt(longContent, 1);
    // 提示词不应该包含超过2000个A
    const aCount = (prompt.match(/A/g) || []).length;
    expect(aCount).toBeLessThanOrEqual(2000);
  });
});

describe('buildSystemPrompt - 空值处理', () => {
  test('所有字段为空时返回空字符串', () => {
    const ctx = {
      worldSummary: '',
      styleSummary: '',
      glossarySummary: '',
      charactersSummary: '',
      distantHistory: '',
      recentChapterSummaries: '',
      currentChapterGoal: '',
      foreshadowHints: '',
    };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toBe('');
  });

  test('各部分用双换行符分隔', () => {
    const ctx = {
      worldSummary: '世界观内容',
      styleSummary: '风格内容',
      glossarySummary: '',
      charactersSummary: '',
      distantHistory: '',
      recentChapterSummaries: '',
      currentChapterGoal: '',
      foreshadowHints: '',
    };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toBe('世界观内容\n\n风格内容');
  });
});
