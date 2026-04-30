'use client';

import { useState, useCallback } from 'react';
import type { Chapter, NovelProject } from '@/types/novel';
import type { StoryboardScene, StoryboardPanel } from '@/types/storyboard';
import StoryboardCanvas from './StoryboardCanvas';
import styles from './index.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface Props {
  chapter: Chapter;
  project: NovelProject;
  onStoryboardUpdate: (scene: StoryboardScene) => void;
}

export default function StoryboardPanel({ chapter, project, onStoryboardUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<StoryboardPanel | null>(null);

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
          characters: project.characters.map((c) => ({
            name: c.name,
            appearance: c.appearance || '',
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
  }, [chapter, project, generating, onStoryboardUpdate]);

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
