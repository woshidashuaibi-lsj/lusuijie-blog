'use client';
/**
 * ForeshadowPanel - 伏笔追踪面板
 * 显示所有伏笔状态，支持点击切换，高亮当前章节相关伏笔
 */
import type { Foreshadow, ForeshadowStatus } from '@/types/novel';
import styles from './ForeshadowPanel.module.css';

interface Props {
  foreshadows: Foreshadow[];
  currentChapterNumber: number;
  onUpdate: (updater: (foreshadows: Foreshadow[]) => Foreshadow[]) => void;
}

const STATUS_CONFIG: Record<ForeshadowStatus, { label: string; color: string; next: ForeshadowStatus }> = {
  planned: { label: '计划中', color: '#6b7280', next: 'planted' },
  planted: { label: '已埋设', color: '#f59e0b', next: 'resolved' },
  resolved: { label: '已回收', color: '#34d399', next: 'planned' },
};

export default function ForeshadowPanel({ foreshadows, currentChapterNumber, onUpdate }: Props) {
  const cycleStatus = (id: string) => {
    onUpdate(foreshadows => foreshadows.map(f => {
      if (f.id !== id) return f;
      const next = STATUS_CONFIG[f.status].next;
      return { ...f, status: next };
    }));
  };

  // 判断是否与当前章节相关
  const isRelatedToCurrentChapter = (f: Foreshadow) => {
    return (
      f.plantedChapter === currentChapterNumber ||
      f.resolvedChapter === currentChapterNumber ||
      (f.status === 'planned' && f.plantedChapter === currentChapterNumber)
    );
  };

  const related = foreshadows.filter(isRelatedToCurrentChapter);
  const others = foreshadows.filter(f => !isRelatedToCurrentChapter(f));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>🧵 伏笔追踪</span>
        <span className={styles.hint}>点击状态切换</span>
      </div>

      <div className={styles.list}>
        {related.length > 0 && (
          <>
            <div className={styles.sectionLabel}>✦ 本章相关</div>
            {related.map(f => {
              const conf = STATUS_CONFIG[f.status];
              return (
                <div key={f.id} className={`${styles.item} ${styles.highlighted}`}>
                  <div className={styles.desc}>{f.description || '未填写描述'}</div>
                  <div className={styles.meta}>
                    {f.plantedChapter && <span>埋：第{f.plantedChapter}章</span>}
                    {f.resolvedChapter && <span>收：第{f.resolvedChapter}章</span>}
                  </div>
                  <button
                    className={styles.statusBtn}
                    style={{ color: conf.color, borderColor: `${conf.color}40` }}
                    onClick={() => cycleStatus(f.id)}
                    title="点击切换状态"
                  >
                    {conf.label}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {others.length > 0 && (
          <>
            {related.length > 0 && <div className={styles.divider} />}
            {others.map(f => {
              const conf = STATUS_CONFIG[f.status];
              return (
                <div key={f.id} className={styles.item}>
                  <div className={styles.desc}>{f.description || '未填写描述'}</div>
                  <div className={styles.meta}>
                    {f.plantedChapter && <span>埋：第{f.plantedChapter}章</span>}
                    {f.resolvedChapter && <span>收：第{f.resolvedChapter}章</span>}
                  </div>
                  <button
                    className={styles.statusBtn}
                    style={{ color: conf.color, borderColor: `${conf.color}40` }}
                    onClick={() => cycleStatus(f.id)}
                    title="点击切换状态"
                  >
                    {conf.label}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {foreshadows.length === 0 && (
          <div className={styles.empty}>
            暂无伏笔记录<br />
            <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>在&ldquo;情节规划&rdquo;步骤中添加</span>
          </div>
        )}
      </div>
    </div>
  );
}
