'use client';
/**
 * Step 4：情节规划 & 伏笔管理
 * 将大纲细化为分幕情节图，规划伏笔的埋设与回收
 */
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { NovelProject, PlotAct, Foreshadow, EmotionCurve } from '@/types/novel';
import { callLLM, extractJSON } from './utils';
import styles from './step.module.css';
import plotStyles from './PlotPlanner.module.css';

interface Props {
  project: NovelProject;
  onUpdate: (updater: (p: NovelProject) => NovelProject) => void;
  onNext: () => void;
  onBack: () => void;
}

const EMOTION_OPTIONS: Array<{ value: EmotionCurve; label: string; emoji: string }> = [
  { value: 'rising', label: '上升', emoji: '📈' },
  { value: 'falling', label: '下降', emoji: '📉' },
  { value: 'twist', label: '反转', emoji: '🔄' },
  { value: 'climax', label: '高潮', emoji: '🔥' },
  { value: 'resolution', label: '收束', emoji: '🌊' },
];

export default function PlotPlanner({ project, onUpdate, onNext, onBack }: Props) {
  const [generatingPlot, setGeneratingPlot] = useState(false);
  const [error, setError] = useState('');

  const acts = project.plotActs;
  const foreshadows = project.foreshadows;

  // ── 情节幕 ──
  const generatePlotActs = async () => {
    setGeneratingPlot(true);
    setError('');
    try {
      const charNames = project.characters.map(c => c.name).join('、');
      const prompt = `根据以下小说大纲，将故事划分为5-8个情节幕（Act），每幕对应若干章节。

大纲信息：
- 类型：${project.outline.genre}
- 概述：${project.outline.logline}
- 冲突：${project.outline.conflict}
- 走向：${project.outline.arc}
- 主要人物：${charNames || '未设定'}
- 预计总章节：${project.outline.estimatedChapters}

请以JSON数组格式返回情节幕列表，每幕包含：
- name（幕名，简短有力）
- coreEvent（核心事件，50字以内）
- characterIds（涉及人物名字数组）
- emotionCurve（情绪弧线：rising/falling/twist/climax/resolution）
- chapterRange（预计章节范围 [起, 止]，整数）
- notes（创作备注，可为空字符串）

只返回JSON数组。`;

      const result = await callLLM(prompt);
      const jsonStr = extractJSON(result, 'array');
      const rawActs = JSON.parse(jsonStr) as Array<Partial<PlotAct>>;
      const newActs: PlotAct[] = rawActs.map(a => ({
        id: uuidv4(),
        name: a.name || '未命名情节幕',
        coreEvent: a.coreEvent || '',
        characterIds: (a.characterIds as string[] || []),
        emotionCurve: (a.emotionCurve as EmotionCurve) || 'rising',
        chapterRange: (a.chapterRange as [number, number]) || [1, 10],
        notes: a.notes || '',
      }));
      onUpdate(p => ({ ...p, plotActs: newActs }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
    } finally {
      setGeneratingPlot(false);
    }
  };

  const updateAct = (id: string, field: keyof PlotAct, value: string | number | string[] | [number, number]) => {
    onUpdate(p => ({
      ...p,
      plotActs: p.plotActs.map(a => a.id === id ? { ...a, [field]: value } : a),
    }));
  };

  const addAct = () => {
    const lastAct = acts[acts.length - 1];
    const startChap = lastAct ? lastAct.chapterRange[1] + 1 : 1;
    onUpdate(p => ({
      ...p,
      plotActs: [...p.plotActs, {
        id: uuidv4(),
        name: '',
        coreEvent: '',
        characterIds: [],
        emotionCurve: 'rising' as EmotionCurve,
        chapterRange: [startChap, startChap + 9],
        notes: '',
      }],
    }));
  };

  const deleteAct = (id: string) => {
    onUpdate(p => ({ ...p, plotActs: p.plotActs.filter(a => a.id !== id) }));
  };

  // ── 伏笔 ──
  const addForeshadow = () => {
    onUpdate(p => ({
      ...p,
      foreshadows: [...p.foreshadows, {
        id: uuidv4(),
        description: '',
        plantedChapter: null,
        resolvedChapter: null,
        status: 'planned',
        notes: '',
      }],
    }));
  };

  const updateForeshadow = (id: string, field: keyof Foreshadow, value: string | number | null) => {
    onUpdate(p => ({
      ...p,
      foreshadows: p.foreshadows.map(f => f.id === id ? { ...f, [field]: value } : f),
    }));
  };

  const deleteForeshadow = (id: string) => {
    onUpdate(p => ({ ...p, foreshadows: p.foreshadows.filter(f => f.id !== id) }));
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>情节 & 伏笔</h1>
        <p className={styles.subtitle}>
          将大纲细化成每一幕的具体情节<br />
          提前规划伏笔，让百万字小说的逻辑无懈可击
        </p>
      </div>

      {/* 情节幕 */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>🗺️</span>
          分幕情节图
        </div>

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem' }}>
          <button className={styles.aiBtn} onClick={generatePlotActs} disabled={generatingPlot || !project.outline.arc}>
            <span className={styles.aiIcon}>✦</span>
            {generatingPlot ? <span>AI 拆解情节 <span className={styles.loadingDots}><span /><span /><span /></span></span> : 'AI 生成分幕情节图'}
          </button>
          <button
            onClick={addAct}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: 'rgba(255,255,255,0.6)', fontSize: '0.83rem', cursor: 'pointer' }}
          >
            + 手动添加幕
          </button>
        </div>

        {acts.length === 0 && (
          <div className={styles.hint}>还没有情节幕。建议先让 AI 生成初稿，再逐一调整。</div>
        )}

        {acts.map((act, idx) => {
          const emotionConf = EMOTION_OPTIONS.find(e => e.value === act.emotionCurve) || EMOTION_OPTIONS[0];
          return (
            <div key={act.id} className={plotStyles.actRow}>
              <div className={plotStyles.actIndex}>{idx + 1}</div>
              <div className={plotStyles.actContent}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.6rem', marginBottom: '0.6rem' }}>
                  <input
                    className={styles.input}
                    value={act.name}
                    onChange={e => updateAct(act.id, 'name', e.target.value)}
                    placeholder="幕名"
                    style={{ fontSize: '0.88rem', fontWeight: '600' }}
                  />
                  <select
                    className={styles.select}
                    value={act.emotionCurve}
                    onChange={e => updateAct(act.id, 'emotionCurve', e.target.value)}
                    style={{ fontSize: '0.83rem' }}
                  >
                    {EMOTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <input type="number" className={styles.input} value={act.chapterRange[0]} min={1} onChange={e => updateAct(act.id, 'chapterRange', [parseInt(e.target.value) || 1, act.chapterRange[1]])} style={{ width: '55px', textAlign: 'center' }} />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>~</span>
                    <input type="number" className={styles.input} value={act.chapterRange[1]} min={1} onChange={e => updateAct(act.id, 'chapterRange', [act.chapterRange[0], parseInt(e.target.value) || 1])} style={{ width: '55px', textAlign: 'center' }} />
                  </div>
                </div>
                <textarea
                  className={styles.textarea}
                  value={act.coreEvent}
                  onChange={e => updateAct(act.id, 'coreEvent', e.target.value)}
                  placeholder="这一幕的核心事件是什么？"
                  style={{ minHeight: '65px', marginBottom: '0.4rem' }}
                />
              </div>
              <button onClick={() => deleteAct(act.id)} className={plotStyles.deleteBtn} title="删除">✕</button>
            </div>
          );
        })}
      </div>

      {/* 伏笔管理 */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>🧵</span>
          伏笔规划
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={addForeshadow}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: 'rgba(255,255,255,0.6)', fontSize: '0.83rem', cursor: 'pointer' }}
          >
            + 添加伏笔
          </button>
        </div>

        {foreshadows.length === 0 && (
          <div className={styles.hint}>暂无伏笔规划。好的伏笔能让读者回味无穷，建议提前规划。</div>
        )}

        {foreshadows.map(f => (
          <div key={f.id} className={plotStyles.foreshadowRow}>
            <div className={plotStyles.foreshadowContent}>
              <input
                className={styles.input}
                value={f.description}
                onChange={e => updateForeshadow(f.id, 'description', e.target.value)}
                placeholder="伏笔内容描述，例如：主角无意中见到的一块玉佩…"
                style={{ marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className={styles.label}>埋设章节</label>
                  <input type="number" className={styles.input} value={f.plantedChapter ?? ''} min={1} onChange={e => updateForeshadow(f.id, 'plantedChapter', e.target.value ? parseInt(e.target.value) : null)} placeholder="第几章" />
                </div>
                <div>
                  <label className={styles.label}>回收章节</label>
                  <input type="number" className={styles.input} value={f.resolvedChapter ?? ''} min={1} onChange={e => updateForeshadow(f.id, 'resolvedChapter', e.target.value ? parseInt(e.target.value) : null)} placeholder="第几章" />
                </div>
                <div>
                  <label className={styles.label}>状态</label>
                  <select className={styles.select} value={f.status} onChange={e => updateForeshadow(f.id, 'status', e.target.value)}>
                    <option value="planned">计划中</option>
                    <option value="planted">已埋设</option>
                    <option value="resolved">已回收</option>
                  </select>
                </div>
              </div>
            </div>
            <button onClick={() => deleteForeshadow(f.id)} className={plotStyles.deleteBtn} title="删除">✕</button>
          </div>
        ))}
      </div>

      {error && <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}

      <div className={styles.footer}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <button className={styles.nextBtn} onClick={onNext}>
          下一步：写作风格 →
        </button>
      </div>
    </div>
  );
}
