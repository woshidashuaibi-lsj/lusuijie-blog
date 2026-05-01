'use client';
/**
 * Step 3：人物塑造
 * 创建和编辑角色档案，AI 辅助生成人物小传
 */
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { NovelProject, CharacterProfile, CharacterRole } from '@/types/novel';
import { callLLM, extractJSON } from './utils';
import styles from './step.module.css';
import charStyles from './CharacterForge.module.css';

interface Props {
  project: NovelProject;
  onUpdate: (updater: (p: NovelProject) => NovelProject) => void;
  onNext: () => void;
  onBack: () => void;
}

const ROLE_OPTIONS: Array<{ value: CharacterRole; label: string; color: string }> = [
  { value: 'protagonist', label: '主角', color: '#a78bfa' },
  { value: 'antagonist', label: '反派', color: '#f87171' },
  { value: 'supporting', label: '配角', color: '#38bdf8' },
  { value: 'minor', label: '路人', color: '#6b7280' },
];

function CharacterCard({
  char,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onGenBio,
  onGenPortrait,
  generating,
  generatingPortrait,
}: {
  char: CharacterProfile;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (field: keyof CharacterProfile, value: string) => void;
  onDelete: () => void;
  onGenBio: () => void;
  onGenPortrait: () => void;
  generating: boolean;
  generatingPortrait: boolean;
}) {
  const roleConfig = ROLE_OPTIONS.find(r => r.value === char.role) || ROLE_OPTIONS[2];

  return (
    <div className={charStyles.charCard} style={{ borderColor: `${roleConfig.color}30` }}>
      <div className={charStyles.charHeader} onClick={onToggle}>
        <div className={charStyles.charAvatar} style={{ background: `${roleConfig.color}20`, color: roleConfig.color }}>
          {char.avatar || char.name?.[0] || '?'}
        </div>
        <div className={charStyles.charInfo}>
          <div className={charStyles.charName}>{char.name || '未命名角色'}</div>
          <div className={charStyles.charRole} style={{ color: roleConfig.color }}>{roleConfig.label}</div>
        </div>
        <div className={charStyles.charToggle}>{isExpanded ? '▴' : '▾'}</div>
      </div>

      {isExpanded && (
        <div className={charStyles.charBody}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
            <div className={styles.field}>
              <label className={styles.label}>姓名</label>
              <input className={styles.input} value={char.name} onChange={e => onUpdate('name', e.target.value)} placeholder="人物姓名" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>头像/标识</label>
              <input className={styles.input} value={char.avatar} onChange={e => onUpdate('avatar', e.target.value)} placeholder="一个 emoji 或首字符" maxLength={2} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>角色类型</label>
              <select className={styles.select} value={char.role} onChange={e => onUpdate('role', e.target.value)}>
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>外貌特征</label>
              <input className={styles.input} value={char.appearance} onChange={e => onUpdate('appearance', e.target.value)} placeholder="外形特征" />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>性格特征</label>
            <textarea className={styles.textarea} value={char.personality} onChange={e => onUpdate('personality', e.target.value)} placeholder="性格、习惯、口头禅…" style={{ minHeight: '70px' }} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>人物背景</label>
            <textarea className={styles.textarea} value={char.backstory} onChange={e => onUpdate('backstory', e.target.value)} placeholder="出身、经历、重要事件…" style={{ minHeight: '70px' }} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>核心动机</label>
            <input className={styles.input} value={char.motivation} onChange={e => onUpdate('motivation', e.target.value)} placeholder="ta 最想要的是什么？" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>成长弧</label>
            <input className={styles.input} value={char.arc} onChange={e => onUpdate('arc', e.target.value)} placeholder="从什么到什么的转变？" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>与其他人物的关系</label>
            <textarea className={styles.textarea} value={char.relationships} onChange={e => onUpdate('relationships', e.target.value)} placeholder="与主角/其他人物的关系网" style={{ minHeight: '60px' }} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>人物小传（AI 生成）</label>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '100px', fontSize: '0.85rem', lineHeight: '1.75' }}
              value={char.bio}
              onChange={e => onUpdate('bio', e.target.value)}
              placeholder="点击下方按钮，AI 生成完整人物小传"
            />
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button className={styles.aiBtn} onClick={onGenBio} disabled={generating || !char.name}>
                <span className={styles.aiIcon}>✦</span>
                {generating ? <span>生成中 <span className={styles.loadingDots}><span /><span /><span /></span></span> : 'AI 生成小传'}
              </button>
              <button
                onClick={onDelete}
                style={{ background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                删除角色
              </button>
            </div>
          </div>

          {/* 分镜标准像资产 */}
          <div className={styles.field}>
            <label className={styles.label}>分镜标准像资产</label>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 0.6rem' }}>
              正面 + 侧面双视角，用于分镜生图时保持外貌一致，点击生成后自动锁定外貌关键词
            </p>

            {/* 正面 + 侧面预览 */}
            {(char.portraitUrl || char.sidePortraitUrl) && (
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem' }}>
                {char.portraitUrl && (
                  <div style={{ textAlign: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={char.portraitUrl}
                      alt={`${char.name} 正面`}
                      style={{ width: '90px', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)' }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.2rem' }}>正面</div>
                  </div>
                )}
                {char.sidePortraitUrl && (
                  <div style={{ textAlign: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={char.sidePortraitUrl}
                      alt={`${char.name} 侧面`}
                      style={{ width: '90px', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)' }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.2rem' }}>侧面</div>
                  </div>
                )}
              </div>
            )}

            {/* 固化关键词展示 */}
            {char.promptKeywords && (
              <div style={{ fontSize: '0.72rem', color: 'rgba(167,139,250,0.7)', background: 'rgba(167,139,250,0.08)', borderRadius: '6px', padding: '0.4rem 0.6rem', marginBottom: '0.6rem', lineHeight: 1.6 }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: '0.3rem' }}>🔒 锁定关键词：</span>
                {char.promptKeywords}
              </div>
            )}

            <button
              className={styles.aiBtn}
              onClick={onGenPortrait}
              disabled={generatingPortrait || !char.name || !char.appearance}
              title={!char.appearance ? '请先填写外貌特征' : ''}
            >
              <span className={styles.aiIcon}>🎨</span>
              {generatingPortrait
                ? <span>生成中（正面+侧面+关键词）<span className={styles.loadingDots}><span /><span /><span /></span></span>
                : char.portraitUrl ? '重新生成标准像' : '生成分镜标准像（正面+侧面）'}
            </button>
            {!char.appearance && char.name && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>（需先填写外貌特征）</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CharacterForge({ project, onUpdate, onNext, onBack }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingBioFor, setGeneratingBioFor] = useState<string | null>(null);
  const [generatingPortraitFor, setGeneratingPortraitFor] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState('');

  const characters = project.characters;

  const addCharacter = () => {
    const newChar: CharacterProfile = {
      id: uuidv4(),
      name: '',
      avatar: '',
      role: 'supporting',
      appearance: '',
      personality: '',
      backstory: '',
      motivation: '',
      arc: '',
      relationships: '',
      bio: '',
    };
    onUpdate(p => ({ ...p, characters: [...p.characters, newChar] }));
    setExpandedId(newChar.id);
  };

  const updateChar = (id: string, field: keyof CharacterProfile, value: string) => {
    onUpdate(p => ({
      ...p,
      characters: p.characters.map(c => c.id === id ? { ...c, [field]: value } : c),
    }));
  };

  const deleteChar = (id: string) => {
    onUpdate(p => ({ ...p, characters: p.characters.filter(c => c.id !== id) }));
    if (expandedId === id) setExpandedId(null);
  };

  const genBio = async (char: CharacterProfile) => {
    setGeneratingBioFor(char.id);
    setError('');
    try {
      const prompt = `请根据以下角色信息，为小说《${project.title}》中的人物"${char.name}"生成一篇完整的人物小传，500字以内，展示人物的立体感和独特魅力。

角色信息：
- 类型：${ROLE_OPTIONS.find(r => r.value === char.role)?.label || char.role}
- 外貌：${char.appearance || '未设定'}
- 性格：${char.personality || '未设定'}
- 背景：${char.backstory || '未设定'}
- 动机：${char.motivation || '未设定'}
- 成长弧：${char.arc || '未设定'}
- 故事背景：${project.outline.setting || '未设定'}

请直接输出小传内容，语言富有感染力，不需要标题前缀。`;

      const bio = await callLLM(prompt);
      updateChar(char.id, 'bio', bio.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成小传失败');
    } finally {
      setGeneratingBioFor(null);
    }
  };

  const genPortrait = async (char: CharacterProfile) => {
    setGeneratingPortraitFor(char.id);
    setError('');
    try {
      const res = await fetch('/api/novel/character-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: char.name,
          appearance: char.appearance,
          role: char.role,
          setting: project.outline.setting || '',
          projectId: project.id,
        }),
      });
      const data = await res.json() as {
        // 新格式：API 内部上传 Storage 后直接返回 URL
        portraitUrl?: string;
        sidePortraitUrl?: string;
        promptKeywords?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.message || '生成标准像失败');
      if (!data.portraitUrl) throw new Error('返回数据异常');

      onUpdate(p => ({
        ...p,
        characters: p.characters.map(c =>
          c.id === char.id
            ? {
                ...c,
                portraitUrl: data.portraitUrl!,
                ...(data.sidePortraitUrl ? { sidePortraitUrl: data.sidePortraitUrl } : {}),
                ...(data.promptKeywords ? { promptKeywords: data.promptKeywords } : {}),
              }
            : c
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成标准像失败');
    } finally {
      setGeneratingPortraitFor(null);
    }
  };

  const suggestCharacters = async () => {
    setSuggesting(true);
    setError('');
    try {
      const prompt = `根据以下小说大纲，建议3-5个核心人物（包括主角和关键配角）。
      
大纲：
- 类型：${project.outline.genre}
- 概述：${project.outline.logline}
- 背景：${project.outline.setting}
- 冲突：${project.outline.conflict}

请以JSON数组格式返回，每个人物包含：name（姓名）、role（protagonist/antagonist/supporting）、avatar（一个emoji）、personality（性格，50字）、motivation（动机，30字）、arc（成长弧，30字）。
只返回JSON数组。`;

      const result = await callLLM(prompt);
      const jsonStr = extractJSON(result, 'array');
      const suggestions = JSON.parse(jsonStr) as Partial<CharacterProfile>[];
      const newChars: CharacterProfile[] = suggestions.map(s => ({
        id: uuidv4(),
        name: s.name || '',
        avatar: s.avatar || s.name?.[0] || '?',
        role: (s.role as CharacterRole) || 'supporting',
        appearance: s.appearance || '',
        personality: s.personality || '',
        backstory: s.backstory || '',
        motivation: s.motivation || '',
        arc: s.arc || '',
        relationships: s.relationships || '',
        bio: '',
      }));

      onUpdate(p => ({ ...p, characters: [...p.characters, ...newChars] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 建议失败，请重试');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>人物塑造</h1>
        <p className={styles.subtitle}>
          有深度的人物是小说的灵魂<br />
          每个角色都需要真实的动机和独特的弧线
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button className={styles.aiBtn} onClick={suggestCharacters} disabled={suggesting || !project.outline.logline}>
          <span className={styles.aiIcon}>✦</span>
          {suggesting ? <span>AI 建议人物 <span className={styles.loadingDots}><span /><span /><span /></span></span> : 'AI 根据大纲建议人物'}
        </button>
        <button
          onClick={addCharacter}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '0.83rem', cursor: 'pointer' }}
        >
          + 手动添加角色
        </button>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}

      {characters.length === 0 && (
        <div className={styles.hint}>
          还没有添加任何角色。点击上方按钮，让 AI 根据你的大纲建议人物，或者手动添加。
        </div>
      )}

      {characters.map(char => (
        <CharacterCard
          key={char.id}
          char={char}
          isExpanded={expandedId === char.id}
          onToggle={() => setExpandedId(expandedId === char.id ? null : char.id)}
          onUpdate={(field, value) => updateChar(char.id, field, value)}
          onDelete={() => deleteChar(char.id)}
          onGenBio={() => genBio(char)}
          onGenPortrait={() => genPortrait(char)}
          generating={generatingBioFor === char.id}
          generatingPortrait={generatingPortraitFor === char.id}
        />
      ))}

      <div className={styles.footer}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <button className={styles.nextBtn} onClick={onNext} disabled={characters.length === 0}>
          下一步：情节规划 →
        </button>
      </div>
    </div>
  );
}
