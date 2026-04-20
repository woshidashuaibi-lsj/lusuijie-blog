import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { NovelProject } from '@/types/novel';
import { listProjects, deleteProject, saveProject } from '@/lib/novelDB';
import { fetchProjectsByDeviceId, getDeviceId } from '@/lib/novelSync';
import NovelCreator from '@/components/NovelCreator';
import styles from './create.module.css';

/**
 * 创作工坊入口页面
 * - 有存档：显示项目列表，选择继续创作或新建
 * - 无存档：直接进入新建流程
 */
export default function CreatePage() {
  const router = useRouter();
  const { project: projectIdParam } = router.query;

  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showProjectList, setShowProjectList] = useState(false);
  // 换设备恢复
  const [showRestore, setShowRestore] = useState(false);
  const [restoreDeviceId, setRestoreDeviceId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');

  useEffect(() => {
    listProjects().then(list => {
      setProjects(list);
      setLoading(false);
      if (projectIdParam && typeof projectIdParam === 'string') {
        // URL 带了 project ID，直接进入
        setSelectedProjectId(projectIdParam);
      } else if (list.length === 0) {
        // 没有任何项目，直接新建
        setSelectedProjectId('new');
      } else {
        // 有项目，显示选择列表
        setShowProjectList(true);
      }
    });
  }, [projectIdParam]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setShowProjectList(false);
  };

  const handleNewProject = () => {
    setSelectedProjectId('new');
    setShowProjectList(false);
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除此项目？此操作不可撤销。')) return;
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  // 从另一台设备恢复数据
  const handleRestore = async () => {
    if (!restoreDeviceId.trim()) {
      setRestoreMsg('请输入设备码');
      return;
    }
    setRestoring(true);
    setRestoreMsg('正在从云端拉取…');
    try {
      const cloudProjects = await fetchProjectsByDeviceId(restoreDeviceId.trim());
      if (cloudProjects.length === 0) {
        setRestoreMsg('未找到该设备码对应的数据，请检查设备码是否正确');
        setRestoring(false);
        return;
      }
      // 逐个保存到本地
      for (const p of cloudProjects) {
        await saveProject(p);
      }
      const updated = await listProjects();
      setProjects(updated);
      setRestoreMsg(`✓ 已恢复 ${cloudProjects.length} 个项目！`);
      setTimeout(() => {
        setShowRestore(false);
        setRestoreMsg('');
        setRestoreDeviceId('');
      }, 1500);
    } catch {
      setRestoreMsg('恢复失败，请稍后重试');
    }
    setRestoring(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#060c1a', color: 'rgba(255,255,255,0.4)', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(167,139,250,0.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span>正在唤醒创造力…</span>
      </div>
    );
  }

  // 进入具体项目
  if (selectedProjectId && !showProjectList) {
    const actualId = selectedProjectId === 'new' ? undefined : selectedProjectId;
    return (
      <>
        <Head>
          <title>创造世界 - 卢穗杰的博客</title>
          <meta name="description" content="AI 辅助小说创作工坊" />
        </Head>
        <NovelCreator projectId={actualId} />
      </>
    );
  }

  // 项目选择列表
  return (
    <>
      <Head>
        <title>创造世界 - 选择项目</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <button className={styles.backLink} onClick={() => router.push('/book')}>
              ← 返回书单
            </button>
            <div className={styles.logo}>✦ 创造世界</div>
            <p className={styles.subtitle}>你的 AI 小说创作工坊</p>
          </div>

          {/* 设备码 & 换设备恢复 */}
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(167,139,250,0.06)', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.15)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <span>
              我的设备码：<code style={{ color: '#a78bfa', letterSpacing: '0.1em', userSelect: 'all' }}>{getDeviceId()}</code>
              <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>（换设备时输入此码恢复数据）</span>
            </span>
            <button
              onClick={() => setShowRestore(v => !v)}
              style={{ background: 'none', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', color: '#a78bfa', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            >
              从其他设备恢复
            </button>
          </div>

          {/* 恢复弹窗 */}
          {showRestore && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(167,139,250,0.08)', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem' }}>输入另一台设备的设备码：</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={restoreDeviceId}
                  onChange={e => setRestoreDeviceId(e.target.value.toUpperCase())}
                  placeholder="例如：AB12CD34"
                  maxLength={8}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', color: '#fff', padding: '0.5rem 0.75rem', fontSize: '0.9rem', letterSpacing: '0.15em', outline: 'none' }}
                />
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  style={{ background: '#a78bfa', border: 'none', borderRadius: '6px', color: '#fff', padding: '0.5rem 1rem', cursor: restoring ? 'wait' : 'pointer', fontSize: '0.85rem', opacity: restoring ? 0.6 : 1 }}
                >
                  {restoring ? '恢复中…' : '恢复'}
                </button>
              </div>
              {restoreMsg && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: restoreMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>
                  {restoreMsg}
                </div>
              )}
            </div>
          )}

          <div className={styles.projectList}>
            {/* 新建项目卡片 */}
            <button className={styles.newProjectCard} onClick={handleNewProject}>
              <div className={styles.newIcon}>+</div>
              <div className={styles.newLabel}>开启新创作</div>
              <div className={styles.newDesc}>从一个故事灵感开始</div>
            </button>

            {/* 现有项目 */}
            {projects.map(p => {
              const totalWords = p.chapters.reduce((s, c) => s + c.wordCount, 0);
              const doneChaps = p.chapters.filter(c => c.status === 'done').length;
              const stepLabels: Record<string, string> = {
                outline: '大纲阶段', world: '世界观', characters: '人物塑造',
                plot: '情节规划', style: '风格设定', writing: '写作中',
              };

              return (
                <button
                  key={p.id}
                  className={styles.projectCard}
                  onClick={() => handleSelectProject(p.id)}
                >
                  <div className={styles.projectTitle}>{p.title}</div>
                  <div className={styles.projectMeta}>
                    <span className={styles.metaTag}>{stepLabels[p.currentStep] || p.currentStep}</span>
                    {doneChaps > 0 && <span className={styles.metaTag}>{doneChaps}章</span>}
                    {totalWords > 0 && <span className={styles.metaTag}>{totalWords.toLocaleString()}字</span>}
                  </div>
                  <div className={styles.projectGenre}>{p.outline.genre || '未设定类型'}</div>
                  <div className={styles.projectLogline}>{p.outline.logline || p.outline.idea || '暂无概述'}</div>
                  <div className={styles.projectTime}>
                    上次编辑：{new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={e => handleDeleteProject(p.id, e)}
                    title="删除项目"
                  >
                    ✕
                  </button>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
