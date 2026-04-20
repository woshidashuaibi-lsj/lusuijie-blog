'use client';
/**
 * 记忆状态指示器
 * 右下角常驻，显示 IndexedDB 保存状态，防止用户对"AI会不会失忆"感到担忧
 */
import { useEffect, useState } from 'react';
import styles from './MemoryStatus.module.css';

interface MemoryStatusProps {
  status: 'saved' | 'saving' | 'unsaved';
  lastSavedAt: number;
  totalWords: number;
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return '刚刚';
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  return `${Math.floor(diff / 3600000)}小时前`;
}

export default function MemoryStatus({ status, lastSavedAt, totalWords }: MemoryStatusProps) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    setTimeAgo(formatTimeAgo(lastSavedAt));
    const timer = setInterval(() => {
      setTimeAgo(formatTimeAgo(lastSavedAt));
    }, 5000);
    return () => clearInterval(timer);
  }, [lastSavedAt]);

  const statusConfig = {
    saved: { icon: '✓', text: '记忆已保存', subText: timeAgo, color: '#34d399' },
    saving: { icon: '↻', text: '记忆更新中…', subText: '', color: '#a78bfa' },
    unsaved: { icon: '●', text: '未保存变更', subText: '即将自动保存', color: '#f59e0b' },
  };

  const config = statusConfig[status];

  return (
    <div className={styles.container} style={{ borderColor: `${config.color}33` }}>
      <div className={styles.indicator}>
        <span
          className={`${styles.icon} ${status === 'saving' ? styles.spin : ''}`}
          style={{ color: config.color }}
        >
          {config.icon}
        </span>
        <div className={styles.texts}>
          <span className={styles.mainText} style={{ color: config.color }}>{config.text}</span>
          {config.subText && (
            <span className={styles.subText}>{config.subText}</span>
          )}
        </div>
      </div>
      {totalWords > 0 && (
        <div className={styles.wordCount}>
          {totalWords.toLocaleString()} 字
        </div>
      )}
    </div>
  );
}
