'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './index.module.css';

export interface ReaderSettings {
  fontSize: number; // 14-28
  background: 'light' | 'sepia' | 'dark' | 'black';
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  background: 'light',
};

const FONT_SIZE_MIN = 14;
const FONT_SIZE_MAX = 28;

export function loadSettings(): ReaderSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem('reader-settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ReaderSettings) {
  try {
    localStorage.setItem('reader-settings', JSON.stringify(settings));
  } catch {}
}

interface ReaderSettingsProps {
  onClose: () => void;
}

export default function ReaderSettings({ onClose }: ReaderSettingsProps) {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const update = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const bgOptions: { value: ReaderSettings['background']; label: string; bg: string; color: string }[] = [
    { value: 'light', label: '默认', bg: '#ffffff', color: '#333' },
    { value: 'sepia', label: '护眼', bg: '#f4ecd8', color: '#5b4636' },
    { value: 'dark', label: '深色', bg: '#2c2c2c', color: '#c8c8c8' },
    { value: 'black', label: '夜间', bg: '#000000', color: '#888' },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>阅读设置</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 字号 */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>字体大小</span>
          <div className={styles.fontSizeControl}>
            <button
              className={styles.fontBtn}
              onClick={() => update({ fontSize: Math.max(FONT_SIZE_MIN, settings.fontSize - 2) })}
              disabled={settings.fontSize <= FONT_SIZE_MIN}
            >
              A−
            </button>
            <span className={styles.fontSizeValue}>{settings.fontSize}</span>
            <button
              className={styles.fontBtn}
              onClick={() => update({ fontSize: Math.min(FONT_SIZE_MAX, settings.fontSize + 2) })}
              disabled={settings.fontSize >= FONT_SIZE_MAX}
            >
              A+
            </button>
          </div>
        </div>

        {/* 背景 */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>背景主题</span>
          <div className={styles.bgOptions}>
            {bgOptions.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.bgOption} ${settings.background === opt.value ? styles.bgOptionActive : ''}`}
                style={{ background: opt.bg, color: opt.color }}
                onClick={() => update({ background: opt.value })}
                title={opt.label}
              >
                <span className={styles.bgOptionText}>文</span>
                <span className={styles.bgOptionLabel}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
