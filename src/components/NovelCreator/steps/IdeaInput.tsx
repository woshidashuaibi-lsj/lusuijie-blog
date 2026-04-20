'use client';
/**
 * Step 1：灵感输入 & 大纲生成
 * 用户输入故事想法，AI 生成结构化大纲，用户可编辑后确认
 */
import { useState } from 'react';
import type { NovelProject, OutlineData } from '@/types/novel';
import styles from './step.module.css';

// 小说创作 API 已迁移到 fc-api 云服务，线上走 NEXT_PUBLIC_API_BASE，本地开发走相对路径
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface Props {
  project: NovelProject;
  onUpdate: (updater: (p: NovelProject) => NovelProject) => void;
  onNext: () => void;
}

const GENRE_OPTIONS = [
  '玄幻', '仙侠', '修真', '都市异能', '都市现实',
  '科幻', '历史', '武侠', '悬疑', '言情', '奇幻', '其他',
];

export default function IdeaInput({ project, onUpdate, onNext }: Props) {
  const [idea, setIdea] = useState(project.outline.idea || '');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const outline = project.outline;

  const handleIdeaChange = (val: string) => {
    setIdea(val);
    onUpdate(p => ({ ...p, outline: { ...p.outline, idea: val } }));
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError('请先输入你的故事灵感');
      return;
    }
    setError('');
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/novel/outline/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '生成失败');
      onUpdate(p => ({ ...p, outline: data as OutlineData, title: data.logline?.slice(0, 20) || '我的小说' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleFieldChange = (field: keyof OutlineData, value: string | number) => {
    onUpdate(p => ({ ...p, outline: { ...p.outline, [field]: value } }));
  };

  const hasOutline = !!(outline.genre && outline.logline);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>故事灵感</h1>
        <p className={styles.subtitle}>
          把你的故事想法告诉 AI，哪怕只是一句话<br />
          AI 会帮你扩展成完整的创作大纲
        </p>
      </div>

      {/* 灵感输入区 */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>💡</span>
          你的故事灵感
        </div>
        <div className={styles.field}>
          <textarea
            className={styles.textarea}
            style={{ minHeight: '130px' }}
            placeholder={`随便写，越自然越好，比如：\n"一个普通程序员发现自己可以看见别人的命运线，但每次改变命运都要付出代价…"\n"修仙界最弱的废材，被扫地长老收为关门弟子，却发现那把扫帚里藏着上古大能的魂魄…"`}
            value={idea}
            onChange={e => handleIdeaChange(e.target.value)}
            maxLength={2000}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={styles.aiBtn} onClick={handleGenerate} disabled={generating || !idea.trim()}>
            <span className={styles.aiIcon}>✦</span>
            {generating ? (
              <span>AI 正在构建大纲 <span className={styles.loadingDots}><span /><span /><span /></span></span>
            ) : hasOutline ? '重新生成大纲' : 'AI 生成大纲'}
          </button>
          {hasOutline && (
            <span style={{ fontSize: '0.8rem', color: 'rgba(52, 211, 153, 0.8)' }}>
              ✓ 大纲已生成，可以修改后继续
            </span>
          )}
        </div>
        {error && (
          <p style={{ color: '#f87171', fontSize: '0.82rem', marginTop: '0.6rem' }}>{error}</p>
        )}
      </div>

      {/* 大纲编辑区（生成后显示） */}
      {hasOutline && (
        <>
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>📋</span>
              故事大纲（可编辑）
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.field}>
                <label className={styles.label}>小说类型</label>
                <select
                  className={styles.select}
                  value={outline.genre}
                  onChange={e => handleFieldChange('genre', e.target.value)}
                >
                  {GENRE_OPTIONS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>预计章节数</label>
                <input
                  type="number"
                  className={styles.input}
                  value={outline.estimatedChapters}
                  min={10}
                  max={500}
                  onChange={e => handleFieldChange('estimatedChapters', parseInt(e.target.value) || 30)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>小说标题</label>
              <input
                className={styles.input}
                value={project.title}
                onChange={e => onUpdate(p => ({ ...p, title: e.target.value }))}
                placeholder="给你的小说起个名字"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>核心主题</label>
              <input
                className={styles.input}
                value={outline.theme}
                onChange={e => handleFieldChange('theme', e.target.value)}
                placeholder="一句话描述小说的主题思想"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>故事概述（一句话）</label>
              <input
                className={styles.input}
                value={outline.logline}
                onChange={e => handleFieldChange('logline', e.target.value)}
                placeholder="主角是谁，面临什么，追求什么"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>故事背景</label>
              <textarea
                className={styles.textarea}
                value={outline.setting}
                onChange={e => handleFieldChange('setting', e.target.value)}
                placeholder="故事发生的时代、地点、世界概况"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>核心冲突</label>
              <textarea
                className={styles.textarea}
                value={outline.conflict}
                onChange={e => handleFieldChange('conflict', e.target.value)}
                placeholder="主角与什么对抗？内部冲突 vs 外部冲突"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>故事走向（起承转合）</label>
              <textarea
                className={styles.textarea}
                style={{ minHeight: '120px' }}
                value={outline.arc}
                onChange={e => handleFieldChange('arc', e.target.value)}
                placeholder="分4个阶段描述故事发展"
              />
            </div>
          </div>

          <div className={styles.hint}>
            💡 大纲是创作的地图，不必太完美。后面还可以在情节步骤中细化每一幕的内容。
          </div>
        </>
      )}

      <div className={styles.footer}>
        <div />
        <button
          className={styles.nextBtn}
          onClick={onNext}
          disabled={!hasOutline}
        >
          下一步：构建世界观 →
        </button>
      </div>
    </div>
  );
}
