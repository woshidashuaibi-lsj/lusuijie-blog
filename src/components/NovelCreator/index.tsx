'use client';
/**
 * NovelCreator - 小说创作工坊主容器
 * 管理全局状态、IndexedDB 自动保存、向导步骤路由
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { NovelProject, WizardStep } from '@/types/novel';
import { createEmptyProject, calcTotalWords } from '@/types/novel';
import { saveProject, getProject } from '@/lib/novelDB';
import WizardNav from './WizardNav';
import IdeaInput from './steps/IdeaInput';
import WorldBuilder from './steps/WorldBuilder';
import CharacterForge from './steps/CharacterForge';
import PlotPlanner from './steps/PlotPlanner';
import StyleConfig from './steps/StyleConfig';
import ChapterWriter from './ChapterWriter';
import MemoryStatus from './MemoryStatus';
import styles from './index.module.css';

interface NovelCreatorProps {
  /** 如果传入 projectId，直接加载该项目；否则创建新项目 */
  projectId?: string;
}

const AUTOSAVE_DELAY = 800; // 800ms debounce

export default function NovelCreator({ projectId: initialProjectId }: NovelCreatorProps) {
  const [project, setProject] = useState<NovelProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<number>(Date.now());

  // ── 加载项目 ──
  useEffect(() => {
    async function loadOrCreate() {
      setLoading(true);
      try {
        if (initialProjectId) {
          const existing = await getProject(initialProjectId);
          if (existing) {
            setProject(existing);
            setLoading(false);
            return;
          }
        }
        // 没有找到项目，创建新项目
        const id = initialProjectId || uuidv4();
        const newProject = createEmptyProject(id);
        await saveProject(newProject);
        setProject(newProject);
      } catch (err) {
        console.error('[NovelCreator] 加载项目失败:', err);
        // 降级：创建内存项目
        const id = initialProjectId || uuidv4();
        setProject(createEmptyProject(id));
      } finally {
        setLoading(false);
      }
    }
    loadOrCreate();
  }, [initialProjectId]);

  // ── 自动保存（debounce）──
  const triggerAutosave = useCallback((updatedProject: NovelProject) => {
    setSaveStatus('unsaved');

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        // 更新统计
        const withStats = {
          ...updatedProject,
          stats: {
            ...updatedProject.stats,
            totalWords: calcTotalWords(updatedProject),
            completedChapters: updatedProject.chapters.filter(c => c.status === 'done').length,
            lastOpenedAt: Date.now(),
          },
        };
        await saveProject(withStats);
        lastSavedRef.current = Date.now();
        setSaveStatus('saved');
      } catch (err) {
        console.error('[NovelCreator] 自动保存失败:', err);
        setSaveStatus('unsaved');
      }
    }, AUTOSAVE_DELAY);
  }, []);

  // 更新项目并触发自动保存
  const updateProject = useCallback((updater: (prev: NovelProject) => NovelProject) => {
    setProject(prev => {
      if (!prev) return prev;
      const updated = updater(prev);
      triggerAutosave(updated);
      return updated;
    });
  }, [triggerAutosave]);

  // ── 步骤导航 ──
  const goToStep = useCallback((step: WizardStep) => {
    updateProject(p => ({ ...p, currentStep: step }));
  }, [updateProject]);

  // ── 步骤渲染 ──
  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingText}>从记忆深处唤醒你的世界…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.error}>
        <p>创作工坊加载失败，请刷新页面重试</p>
      </div>
    );
  }

  const WIZARD_STEPS: WizardStep[] = ['outline', 'world', 'characters', 'plot', 'style'];
  const isInWizard = WIZARD_STEPS.includes(project.currentStep);

  return (
    <div className={styles.container}>
      {/* 向导导航（仅在准备阶段显示） */}
      {isInWizard && (
        <WizardNav currentStep={project.currentStep} onNavigate={goToStep} />
      )}

      {/* 主内容区 */}
      <div className={styles.content}>
        {project.currentStep === 'outline' && (
          <IdeaInput project={project} onUpdate={updateProject} onNext={() => goToStep('world')} />
        )}
        {project.currentStep === 'world' && (
          <WorldBuilder project={project} onUpdate={updateProject} onNext={() => goToStep('characters')} onBack={() => goToStep('outline')} />
        )}
        {project.currentStep === 'characters' && (
          <CharacterForge project={project} onUpdate={updateProject} onNext={() => goToStep('plot')} onBack={() => goToStep('world')} />
        )}
        {project.currentStep === 'plot' && (
          <PlotPlanner project={project} onUpdate={updateProject} onNext={() => goToStep('style')} onBack={() => goToStep('characters')} />
        )}
        {project.currentStep === 'style' && (
          <StyleConfig project={project} onUpdate={updateProject} onNext={() => goToStep('writing')} onBack={() => goToStep('plot')} />
        )}
        {project.currentStep === 'writing' && (
          <ChapterWriter project={project} onUpdate={updateProject} onBackToWizard={() => goToStep('style')} />
        )}
      </div>

      {/* 记忆状态指示器（始终显示） */}
      <MemoryStatus
        status={saveStatus}
        lastSavedAt={lastSavedRef.current}
        totalWords={project.stats.totalWords}
      />
    </div>
  );
}
