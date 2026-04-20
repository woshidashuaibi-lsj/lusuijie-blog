'use client';
/**
 * Step 2：世界观构建
 * 根据大纲构建世界规则、地理、历史、势力等核心设定
 */
import { useState } from 'react';
import type { NovelProject, WorldData } from '@/types/novel';
import { callLLM } from './utils';
import styles from './step.module.css';

interface Props {
  project: NovelProject;
  onUpdate: (updater: (p: NovelProject) => NovelProject) => void;
  onNext: () => void;
  onBack: () => void;
}

const WORLD_TYPE_OPTIONS = ['现实世界', '东方玄幻', '东方仙侠', '西方奇幻', '都市异能', '赛博朋克', '星际科幻', '历史架空', '末世', '其他'];

export default function WorldBuilder({ project, onUpdate, onNext, onBack }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const world = project.world;

  const handleChange = (field: keyof WorldData, value: string) => {
    onUpdate(p => ({ ...p, world: { ...p.world, [field]: value } }));
  };

  const handleAIExpand = async () => {
    setError('');
    setGenerating(true);
    try {
      // 改用分字段输出格式，避免 JSON 解析问题（长文本中的单引号/截断会导致 JSON.parse 失败）
      const prompt = `你是一位世界观设计师。请根据以下小说大纲，扩展世界观的各个维度。
      
大纲信息：
- 类型：${project.outline.genre}
- 背景：${project.outline.setting}
- 概述：${project.outline.logline}

当前世界观（部分已填写）：
- 力量体系：${world.powerSystem || '未填写'}
- 地理：${world.geography || '未填写'}
- 历史：${world.history || '未填写'}
- 势力：${world.factions || '未填写'}
- 习俗：${world.customs || '未填写'}

请按以下固定格式输出，每个字段100-200字，不要输出多余内容：

[powerSystem]
（力量体系内容）

[geography]
（地理内容）

[history]
（历史内容）

[factions]
（势力内容）

[customs]
（习俗内容）

[misc]
（其他补充设定内容）`;

      const result = await callLLM(prompt);

      // 按 [字段名] 标签解析，比 JSON 解析更健壮
      const parseField = (text: string, field: string): string => {
        const regex = new RegExp(`\\[${field}\\]\\s*([\\s\\S]*?)(?=\\[[a-zA-Z]+\\]|$)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
      };

      const fields = ['powerSystem', 'geography', 'history', 'factions', 'customs', 'misc'];
      const expanded: Partial<WorldData> = {};
      for (const field of fields) {
        const val = parseField(result, field);
        if (val) (expanded as Record<string, string>)[field] = val;
      }

      onUpdate(p => ({
        ...p,
        world: {
          ...p.world,
          powerSystem: expanded.powerSystem || p.world.powerSystem,
          geography: expanded.geography || p.world.geography,
          history: expanded.history || p.world.history,
          factions: expanded.factions || p.world.factions,
          customs: expanded.customs || p.world.customs,
          misc: expanded.misc || p.world.misc,
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 扩展失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const hasSomeContent = !!(world.worldType || world.powerSystem || world.geography);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>世界观构建</h1>
        <p className={styles.subtitle}>
          一个好的世界观是百万字小说的基石<br />
          先填写你已有的想法，AI 来帮你丰富细节
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>🌐</span>
          世界基础
        </div>

        <div className={styles.field}>
          <label className={styles.label}>世界类型</label>
          <select
            className={styles.select}
            value={world.worldType}
            onChange={e => handleChange('worldType', e.target.value)}
          >
            <option value="">选择世界类型…</option>
            {WORLD_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>力量体系（修炼/魔法/科技等）</label>
          <textarea
            className={styles.textarea}
            value={world.powerSystem}
            onChange={e => handleChange('powerSystem', e.target.value)}
            placeholder="例如：修炼境界分为：炼体→炼气→凝脉→金丹→元婴→化神。修炼需要灵根，灵根分五行，五灵根的人最弱，单灵根最强…"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <button className={styles.aiBtn} onClick={handleAIExpand} disabled={generating || !project.outline.setting}>
            <span className={styles.aiIcon}>✦</span>
            {generating ? (
              <span>AI 补全世界观 <span className={styles.loadingDots}><span /><span /><span /></span></span>
            ) : 'AI 根据大纲补全'}
          </button>
        </div>
        {error && <p style={{ color: '#f87171', fontSize: '0.82rem' }}>{error}</p>}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>🗺️</span>
          地理与历史
        </div>

        <div className={styles.field}>
          <label className={styles.label}>主要地点与地理</label>
          <textarea
            className={styles.textarea}
            value={world.geography}
            onChange={e => handleChange('geography', e.target.value)}
            placeholder="例如：故事发生在天南大陆，分东西南北四大洲。主角家乡在偏僻的凌云山脉东麓，最近的城市是青石城…"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>历史背景</label>
          <textarea
            className={styles.textarea}
            value={world.history}
            onChange={e => handleChange('history', e.target.value)}
            placeholder={'例如：三千年前上古大战，仙道凋零，古老秘技失传。百年前魔教崛起，与正道进行了一场惨烈的「百年之战」…'}
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>⚔️</span>
          势力与文化
        </div>

        <div className={styles.field}>
          <label className={styles.label}>主要势力/阵营</label>
          <textarea
            className={styles.textarea}
            value={world.factions}
            onChange={e => handleChange('factions', e.target.value)}
            placeholder={'例如：三大宗门（清风宗/天剑派/玄冰宫）、两大散修联盟、一个隐藏在暗处的魔道组织「血月殿」…'}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>风俗习惯与文化（可选）</label>
          <textarea
            className={styles.textarea}
            value={world.customs}
            onChange={e => handleChange('customs', e.target.value)}
            placeholder="修仙界的礼仪、禁忌、节日、货币体系等…"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>其他补充设定（可选）</label>
          <textarea
            className={styles.textarea}
            value={world.misc}
            onChange={e => handleChange('misc', e.target.value)}
            placeholder="任何不在以上类别里但重要的世界设定…"
          />
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <button className={styles.nextBtn} onClick={onNext} disabled={!hasSomeContent}>
          下一步：塑造人物 →
        </button>
      </div>
    </div>
  );
}
