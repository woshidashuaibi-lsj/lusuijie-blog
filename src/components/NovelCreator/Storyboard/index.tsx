'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Chapter, NovelProject } from '@/types/novel';
import type { StoryboardScene, StoryboardPanel } from '@/types/storyboard';
import StoryboardCanvas from './StoryboardCanvas';
import styles from './index.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

/** 判断是否为可直接传给 MiniMax 的远程 URL（排除 base64 data: URL） */
function isRemoteUrl(url?: string): url is string {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'));
}

/**
 * 根据小说大纲自动生成世界视觉风格词（英文）
 * 优先使用用户手动设置的 project.worldStylePrompt，否则根据 genre+setting 自动映射
 */
function deriveWorldStylePrompt(project: NovelProject): string {
  if (project.worldStylePrompt?.trim()) return project.worldStylePrompt.trim();

  const genre = (project.outline.genre || '').toLowerCase();
  const setting = (project.outline.setting || '').toLowerCase();

  const keywords: string[] = [];

  // 题材映射
  if (/玄幻|仙侠|修仙|修真|仙/.test(genre + setting)) {
    keywords.push('ancient Chinese xianxia fantasy', 'traditional architecture', 'mountains and mist', 'flowing robes');
  } else if (/古代|历史|古风|武侠/.test(genre + setting)) {
    keywords.push('ancient China setting', 'traditional architecture', 'historical costumes', 'classical landscape');
  } else if (/科幻|未来|赛博/.test(genre + setting)) {
    keywords.push('sci-fi futuristic setting', 'high-tech environment', 'neon lights', 'cyberpunk cityscape');
  } else if (/都市|现代|当代/.test(genre + setting)) {
    keywords.push('modern urban setting', 'contemporary city', 'everyday life environment');
  } else if (/奇幻|魔法|龙|精灵/.test(genre + setting)) {
    keywords.push('western fantasy setting', 'magical environment', 'medieval architecture');
  } else if (/恐怖|悬疑|灵异/.test(genre + setting)) {
    keywords.push('dark atmospheric setting', 'eerie environment', 'mysterious shadows');
  } else if (/星际|宇宙|太空/.test(genre + setting)) {
    keywords.push('space sci-fi setting', 'space stations and starfields', 'futuristic spacecraft');
  } else {
    keywords.push('detailed manga background');
  }

  return keywords.join(', ');
}

interface Props {
  chapter: Chapter;
  project: NovelProject;
  onStoryboardUpdate: (scene: StoryboardScene) => void;
}

export default function StoryboardPanel({ chapter, project, onStoryboardUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<StoryboardPanel | null>(null);

  const worldStylePrompt = useMemo(() => deriveWorldStylePrompt(project), [project]);

  const generate = useCallback(async () => {
    if (!chapter.content || generating) return;
    setGenerating(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/novel/storyboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: chapter.content,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          worldStylePrompt,
          // 只传远程 URL（data: base64 体积太大且 MiniMax subject_reference 不支持）
          characters: project.characters.map((c) => ({
            name: c.name,
            appearance: c.appearance || '',
            portraitUrl: isRemoteUrl(c.portraitUrl) ? c.portraitUrl : '',
            sidePortraitUrl: isRemoteUrl(c.sidePortraitUrl) ? c.sidePortraitUrl : '',
            promptKeywords: c.promptKeywords || '',
          })),
          sceneAssets: (project.sceneAssets || []).map((s) => ({
            id: s.id,
            name: s.name,
            referenceImageUrl: isRemoteUrl(s.referenceImageUrl) ? s.referenceImageUrl : '',
            promptKeywords: s.promptKeywords || '',
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '生成失败');

      const scene: StoryboardScene = {
        chapterId: chapter.id,
        panels: data.panels,
        generatedAt: Date.now(),
      };
      onStoryboardUpdate(scene);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  }, [chapter, project, generating, onStoryboardUpdate, worldStylePrompt]);

  // 删除单格分镜
  const deletePanel = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发放大
    if (!chapter.storyboard) return;
    const newPanels = chapter.storyboard.panels.filter((p) => p.index !== index);
    onStoryboardUpdate({
      ...chapter.storyboard,
      panels: newPanels,
    });
    // 如果正在放大查看的格被删了，关闭 modal
    if (expanded?.index === index) setExpanded(null);
  }, [chapter.storyboard, expanded, onStoryboardUpdate]);

  if (!chapter.content) {
    return (
      <div className={styles.empty}>
        <p>请先编写章节内容，再生成分镜</p>
      </div>
    );
  }

  if (!chapter.storyboard) {
    return (
      <div className={styles.empty}>
        <button className={styles.generateBtn} onClick={generate} disabled={generating}>
          {generating ? '✦ 分析场景中…' : '✦ 生成本章分镜'}
        </button>
        {error && <div className={styles.error}>{error}</div>}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>分镜 · {chapter.storyboard.panels.length} 格</span>
        <button className={styles.regenBtn} onClick={generate} disabled={generating}>
          {generating ? '生成中…' : '重新生成'}
        </button>
      </div>

      <div className={styles.grid}>
        {chapter.storyboard.panels.map((panel) => (
          <div
            key={panel.index}
            className={styles.canvasWrapper}
            onClick={() => setExpanded(panel)}
          >
            <StoryboardCanvas
              panel={panel}
              width={220}
              height={165}
            />
            {/* 删除按钮：hover 时浮现，点击删除单格 */}
            <button
              className={styles.deleteBtn}
              onClick={(e) => deletePanel(panel.index, e)}
              title="删除此格"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {expanded && (
        <div className={styles.modal} onClick={() => setExpanded(null)}>
          <StoryboardCanvas
            panel={expanded}
            width={440}
            height={330}
          />
        </div>
      )}
    </div>
  );
}
