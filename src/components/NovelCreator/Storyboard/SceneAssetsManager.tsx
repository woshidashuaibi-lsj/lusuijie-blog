'use client';

/**
 * 场景资产库管理器（抽屉弹层模式）
 * 用于预生成小说核心场景的参考图，分镜生图时垫图保证背景一致
 */
import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { NovelProject, SceneAsset } from '@/types/novel';
import styles from './SceneAssetsManager.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  project: NovelProject;
  onUpdate: (updater: (p: NovelProject) => NovelProject) => void;
}

export default function SceneAssetsManager({ open, onClose, project, onUpdate }: Props) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [error, setError] = useState('');

  const sceneAssets = project.sceneAssets || [];

  // Esc 关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  const addScene = () => {
    if (!newName.trim()) return;
    const scene: SceneAsset = {
      id: uuidv4(),
      name: newName.trim(),
      description: newDesc.trim(),
      createdAt: Date.now(),
    };
    onUpdate(p => ({ ...p, sceneAssets: [...(p.sceneAssets || []), scene] }));
    setNewName('');
    setNewDesc('');
    setAddingNew(false);
  };

  const deleteScene = (id: string) => {
    onUpdate(p => ({ ...p, sceneAssets: (p.sceneAssets || []).filter(s => s.id !== id) }));
  };

  const genSceneImage = async (scene: SceneAsset) => {
    setGeneratingId(scene.id);
    setError('');
    try {
      const res = await fetch('/api/novel/scene-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scene.name,
          description: scene.description,
          worldStylePrompt: project.worldStylePrompt || '',
          genre: project.outline.genre || '',
          projectId: project.id,
        }),
      });
      const data = await res.json() as {
        // 新格式：API 内部上传 Storage 后直接返回 URL
        referenceImageUrl?: string;
        promptKeywords?: string;
        generatedPrompt?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.message || '生成失败');
      if (!data.referenceImageUrl) throw new Error('返回数据异常');

      onUpdate(p => ({
        ...p,
        sceneAssets: (p.sceneAssets || []).map(s =>
          s.id === scene.id
            ? {
                ...s,
                referenceImageUrl: data.referenceImageUrl!,
                ...(data.promptKeywords ? { promptKeywords: data.promptKeywords } : {}),
              }
            : s
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成场景参考图失败');
    } finally {
      setGeneratingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        {/* 抽屉头部 */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleRow}>
            <span className={styles.drawerTitle}>🏙 场景资产库</span>
            <span className={styles.drawerBadge}>{sceneAssets.length} 个场景</span>
          </div>
          <p className={styles.drawerHint}>
            预先为小说核心场景生成参考图，分镜生图时自动匹配并垫图，保证背景风格一致
          </p>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">✕</button>
        </div>

        {/* 抽屉内容 */}
        <div className={styles.drawerBody}>
          {error && <div className={styles.error}>{error}</div>}

          {/* 场景网格 */}
          {sceneAssets.length > 0 ? (
            <div className={styles.sceneGrid}>
              {sceneAssets.map(scene => (
                <div key={scene.id} className={styles.sceneCard}>
                  {/* 缩略图区 */}
                  <div className={styles.thumbWrapper}>
                    {scene.referenceImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={scene.referenceImageUrl}
                        alt={scene.name}
                        className={styles.sceneThumb}
                      />
                    ) : (
                      <div className={styles.scenePlaceholder}>🏞</div>
                    )}
                    {/* 悬浮删除 */}
                    <button
                      className={styles.deleteOverlay}
                      onClick={() => deleteScene(scene.id)}
                      disabled={generatingId === scene.id}
                      title="删除场景"
                    >✕</button>
                  </div>

                  {/* 信息区 */}
                  <div className={styles.sceneInfo}>
                    <div className={styles.sceneName}>{scene.name}</div>
                    {scene.description && (
                      <div className={styles.sceneDesc}>{scene.description}</div>
                    )}
                    {scene.promptKeywords && (
                      <div className={styles.sceneKeywords} title={scene.promptKeywords}>
                        🔑 {scene.promptKeywords.slice(0, 80)}{scene.promptKeywords.length > 80 ? '…' : ''}
                      </div>
                    )}
                    <button
                      className={styles.genBtn}
                      onClick={() => genSceneImage(scene)}
                      disabled={generatingId === scene.id}
                    >
                      {generatingId === scene.id
                        ? '生成中…'
                        : scene.referenceImageUrl ? '重新生成' : '生成参考图'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyHint}>
              <span>🏞</span>
              <p>还没有场景<br />点击下方添加小说中的核心场景</p>
            </div>
          )}

          {/* 新增场景表单 */}
          {addingNew ? (
            <div className={styles.addForm}>
              <input
                className={styles.input}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="场景名称，如：皇宫大殿"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addScene()}
              />
              <textarea
                className={styles.textarea}
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="场景描述（可选）：金碧辉煌的大殿，龙柱高耸，烛光摇曳…"
                rows={2}
              />
              <div className={styles.addFormActions}>
                <button className={styles.confirmBtn} onClick={addScene} disabled={!newName.trim()}>
                  添加
                </button>
                <button className={styles.cancelBtn} onClick={() => { setAddingNew(false); setNewName(''); setNewDesc(''); }}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button className={styles.addSceneBtn} onClick={() => setAddingNew(true)}>
              + 添加场景
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
