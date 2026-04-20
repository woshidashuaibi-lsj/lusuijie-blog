'use client';
/**
 * StoryBibleDrawer - 故事圣经查看/导出抽屉
 * 导出 Markdown / TXT / JSON，版本快照管理，跨设备迁移
 */
import { useState, useEffect } from 'react';
import type { NovelProject, StoryBibleSnapshot } from '@/types/novel';
import { listSnapshots, restoreSnapshot, exportProjectJSON, importProjectJSON } from '@/lib/novelDB';
import styles from './StoryBibleDrawer.module.css';

interface Props {
  project: NovelProject;
  onClose: () => void;
  onImport: (project: NovelProject) => void;
}

function exportAsMarkdown(project: NovelProject): string {
  const lines: string[] = [
    `# ${project.title} - 故事圣经`,
    `\n生成时间：${new Date().toLocaleString()}`,
    `\n---\n`,
    `## 大纲`,
    `**类型**：${project.outline.genre}`,
    `**主题**：${project.outline.theme}`,
    `**概述**：${project.outline.logline}`,
    `**背景**：${project.outline.setting}`,
    `**冲突**：${project.outline.conflict}`,
    `**走向**：${project.outline.arc}`,
    `\n---\n`,
    `## 世界观`,
    `**类型**：${project.world.worldType}`,
    `**力量体系**：${project.world.powerSystem}`,
    `**地理**：${project.world.geography}`,
    `**历史**：${project.world.history}`,
    `\n---\n`,
    `## 人物`,
    ...project.characters.map(c => [
      `### ${c.name}（${c.role}）`,
      c.bio ? c.bio : `性格：${c.personality}；动机：${c.motivation}`,
    ].join('\n')),
    `\n---\n`,
    `## 章节摘要`,
    ...project.chapters
      .filter(c => c.status === 'done' && c.summary)
      .map(c => `**第${c.number}章《${c.title}》**：${c.summary}`),
  ];
  return lines.join('\n');
}

function exportAsTxt(project: NovelProject): string {
  return project.chapters
    .filter(c => c.content)
    .sort((a, b) => a.number - b.number)
    .map(c => `\n\n${c.title}\n\n${c.content}`)
    .join('');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StoryBibleDrawer({ project, onClose, onImport }: Props) {
  const [tab, setTab] = useState<'overview' | 'chapters' | 'snapshots'>('overview');
  const [snapshots, setSnapshots] = useState<StoryBibleSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (tab === 'snapshots') {
      setLoadingSnapshots(true);
      listSnapshots(project.id)
        .then(setSnapshots)
        .finally(() => setLoadingSnapshots(false));
    }
  }, [tab, project.id]);

  const handleExportMd = () => {
    downloadFile(exportAsMarkdown(project), `${project.title}-故事圣经.md`, 'text/markdown');
  };

  const handleExportTxt = () => {
    downloadFile(exportAsTxt(project), `${project.title}.txt`, 'text/plain');
  };

  const handleExportJSON = () => {
    downloadFile(exportProjectJSON(project), `${project.title}-存档.json`, 'application/json');
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = await importProjectJSON(text);
    if (imported) {
      onImport(imported);
      onClose();
    } else {
      alert('导入失败：文件格式不正确');
    }
  };

  const handleRestore = async (timestamp: number) => {
    if (!confirm('确定要回滚到此快照吗？当前未保存的修改将丢失。')) return;
    setRestoring(true);
    try {
      const restored = await restoreSnapshot(project.id, timestamp);
      if (restored) {
        onImport(restored);
        onClose();
      }
    } finally {
      setRestoring(false);
    }
  };

  const doneChapters = project.chapters.filter(c => c.status === 'done');
  const totalWords = project.chapters.reduce((s, c) => s + c.wordCount, 0);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className={styles.header}>
          <div>
            <div className={styles.title}>📖 故事圣经</div>
            <div className={styles.subtitle}>{project.title}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 统计摘要 */}
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{totalWords.toLocaleString()}</span>
            <span className={styles.statLabel}>总字数</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{doneChapters.length}</span>
            <span className={styles.statLabel}>完成章节</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{project.characters.length}</span>
            <span className={styles.statLabel}>人物数</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{project.foreshadows.length}</span>
            <span className={styles.statLabel}>伏笔数</span>
          </div>
        </div>

        {/* 导出/导入操作 */}
        <div className={styles.actions}>
          <div className={styles.actionsTitle}>导出 / 迁移</div>
          <div className={styles.actionBtns}>
            <button className={styles.actionBtn} onClick={handleExportMd}>导出 Markdown</button>
            <button className={styles.actionBtn} onClick={handleExportTxt}>导出 TXT</button>
            <button className={styles.actionBtn} onClick={handleExportJSON}>导出存档 JSON</button>
            <label className={styles.actionBtn} style={{ cursor: 'pointer' }}>
              导入存档 JSON
              <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
            </label>
          </div>
          <div className={styles.importHint}>
            💡 导出的 JSON 存档包含所有创作数据，可在不同设备上导入继续创作
          </div>
        </div>

        {/* 内容标签页 */}
        <div className={styles.tabs}>
          {(['overview', 'chapters', 'snapshots'] as const).map(t => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {{ overview: '设定概览', chapters: '章节摘要', snapshots: '版本快照' }[t]}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>
          {/* 设定概览 */}
          {tab === 'overview' && (
            <div className={styles.overview}>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>大纲</h3>
                <p><strong>类型：</strong>{project.outline.genre}</p>
                <p><strong>主题：</strong>{project.outline.theme}</p>
                <p><strong>概述：</strong>{project.outline.logline}</p>
                {project.outline.conflict && <p><strong>冲突：</strong>{project.outline.conflict}</p>}
              </section>

              {project.world.worldType && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>世界观</h3>
                  <p><strong>类型：</strong>{project.world.worldType}</p>
                  {project.world.powerSystem && <p><strong>力量体系：</strong>{project.world.powerSystem.slice(0, 100)}{project.world.powerSystem.length > 100 ? '…' : ''}</p>}
                </section>
              )}

              {project.characters.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>人物（{project.characters.length}位）</h3>
                  {project.characters.map(c => (
                    <div key={c.id} className={styles.charRow}>
                      <span className={styles.charAvatar}>{c.avatar || c.name[0]}</span>
                      <div>
                        <div className={styles.charName}>{c.name}</div>
                        <div className={styles.charPersonality}>{c.personality?.slice(0, 60) || '未填写'}</div>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}

          {/* 章节摘要 */}
          {tab === 'chapters' && (
            <div className={styles.chapterList}>
              {project.chapters.length === 0 ? (
                <p className={styles.empty}>还没有任何章节</p>
              ) : (
                project.chapters
                  .sort((a, b) => a.number - b.number)
                  .map(c => (
                    <div key={c.id} className={styles.chapterRow}>
                      <div className={styles.chapterLabel}>
                        第{c.number}章《{c.title}》
                        <span style={{ color: '#34d399', fontSize: '0.7rem', marginLeft: '0.5rem' }}>
                          {c.status === 'done' ? '✓' : ''}
                        </span>
                        {c.wordCount > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem', marginLeft: '0.4rem' }}>{c.wordCount}字</span>}
                      </div>
                      <div className={styles.chapterSummary}>
                        {c.summary || '（摘要尚未生成）'}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* 版本快照 */}
          {tab === 'snapshots' && (
            <div className={styles.snapshotList}>
              {loadingSnapshots ? (
                <p className={styles.empty}>加载中…</p>
              ) : snapshots.length === 0 ? (
                <p className={styles.empty}>暂无版本快照<br /><span style={{ fontSize: '0.72rem', opacity: 0.5 }}>完成一章时会自动创建快照</span></p>
              ) : (
                snapshots.map(s => (
                  <div key={s.timestamp} className={styles.snapshotRow}>
                    <div>
                      <div className={styles.snapshotLabel}>{s.label}</div>
                      <div className={styles.snapshotTime}>{new Date(s.timestamp).toLocaleString()}</div>
                    </div>
                    <button
                      className={styles.restoreBtn}
                      onClick={() => handleRestore(s.timestamp)}
                      disabled={restoring}
                    >
                      回滚
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
