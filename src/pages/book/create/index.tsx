import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { NovelProject } from '@/types/novel';
import { listProjects, deleteProject, saveProject } from '@/lib/novelDB';
import {
  fetchProjectsByDeviceId,
  getDeviceId,
  getCurrentUser,
  onAuthStateChange,
  signInWithGitHub,
  signOut,
} from '@/lib/novelSync';
import NovelCreator from '@/components/NovelCreator';
import BookAccessGate from '@/components/BookAccessGate';
import styles from './create.module.css';

/**
 * 创作工坊入口页面
 *
 * 路由规则：
 *   /book/create              → 项目列表（选择/新建）
 *   /book/create?project=<id> → 直接进入指定项目编辑
 *   /book/create?project=new  → 新建项目
 *
 * 优势：浏览器 Tab 回来、刷新、复制链接均可恢复到对应页面
 */
export default function CreatePage() {
  const router = useRouter();

  // URL 中的 project 参数决定显示哪个视图
  // router.isReady 为 false 时 query 为空对象，需等待
  const projectIdParam = router.isReady
    ? (router.query.project as string | undefined)
    : undefined;

  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // 换设备恢复（未登录时使用）
  const [showRestore, setShowRestore] = useState(false);
  const [restoreDeviceId, setRestoreDeviceId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');

  // 初始化：获取登录状态
  useEffect(() => {
    getCurrentUser().then(u => setUser(u));
    const unsubPromise = onAuthStateChange(u => setUser(u));
    return () => { unsubPromise.then(unsub => unsub()); };
  }, []);

  // 登录状态确定后加载项目列表（仅在列表页才需要加载）
  useEffect(() => {
    if (user === 'loading') return;
    // 有 project 参数时无需加载列表
    if (projectIdParam !== undefined) {
      setLoading(false);
      return;
    }
    listProjects().then(list => {
      setProjects(list);
      setLoading(false);
    });
  }, [user, projectIdParam]);

  // ── 导航方法（通过 URL 切换视图）──────────────────────────────────────────

  const goToProject = (id: string) => {
    router.push(`/book/create?project=${id}`, undefined, { shallow: true });
  };

  const goToNewProject = () => {
    router.push('/book/create?project=new', undefined, { shallow: true });
  };

  const goToList = () => {
    router.push('/book/create', undefined, { shallow: true });
  };

  // ── 项目操作 ──────────────────────────────────────────────────────────────

  const handleSelectProject = (id: string) => goToProject(id);
  const handleNewProject = () => goToNewProject();

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除此项目？此操作不可撤销。')) return;
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    await signInWithGitHub();
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  // 从另一台设备恢复数据（未登录时使用）
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

  // ── 渲染：等待路由就绪 ────────────────────────────────────────────────────

  if (!router.isReady || user === 'loading' || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#060c1a', color: 'rgba(255,255,255,0.4)', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(167,139,250,0.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span>正在唤醒创造力…</span>
      </div>
    );
  }

  // ── 渲染：进入具体项目（URL 有 project 参数）──────────────────────────────

  if (projectIdParam !== undefined) {
    const actualId = projectIdParam === 'new' ? undefined : projectIdParam;
    return (
      <>
        <Head>
          <title>创造世界 - 卢穗杰的博客</title>
          <meta name="description" content="AI 辅助小说创作工坊" />
        </Head>
        <NovelCreator
          projectId={actualId}
          onBackToList={goToList}
          // 项目创建成功后把 URL 更新为真实 ID，避免刷新再创建一个新项目
          onProjectCreated={(id: string) => {
            router.replace(`/book/create?project=${id}`, undefined, { shallow: true });
          }}
        />
      </>
    );
  }

  // ── 渲染：项目选择列表（无 project 参数）──────────────────────────────────
  return (
    <BookAccessGate>
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

            {/* 登录状态栏 */}
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(167,139,250,0.06)', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.15)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              {user ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {(user as User).user_metadata?.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(user as User).user_metadata.avatar_url}
                        alt="avatar"
                        style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(167,139,250,0.4)' }}
                      />
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {(user as User).user_metadata?.user_name || (user as User).email}
                    </span>
                    <span style={{ color: '#4ade80', fontSize: '0.72rem' }}>● 已登录</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.4)', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    退出登录
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <span>登录后数据自动跨设备同步</span>
                    <span style={{ marginLeft: '1rem', opacity: 0.5 }}>
                      （未登录：设备码 <code style={{ color: '#a78bfa', userSelect: 'all' }}>{getDeviceId()}</code>）
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={handleSignIn}
                      disabled={signingIn}
                      style={{ background: '#a78bfa', border: 'none', borderRadius: '6px', color: '#fff', padding: '0.35rem 0.9rem', cursor: signingIn ? 'wait' : 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: signingIn ? 0.7 : 1 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      {signingIn ? '跳转中…' : 'GitHub 登录'}
                    </button>
                    <button
                      onClick={() => setShowRestore(v => !v)}
                      style={{ background: 'none', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', color: '#a78bfa', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      设备码恢复
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 设备码恢复弹窗（未登录时） */}
            {!user && showRestore && (
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
    </BookAccessGate>
  );
}
