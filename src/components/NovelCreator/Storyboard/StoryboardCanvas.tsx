'use client';

import type { StoryboardPanel } from '@/types/storyboard';

interface Props {
  panel: StoryboardPanel;
  width?: number;
  height?: number;
}

export default function StoryboardCanvas({ panel, width = 220, height = 165 }: Props) {
  // 优先用 imageUrl（永久 URL 或降级 base64 data URL）
  // 兼容旧 imageBase64 字段
  const imgSrc = panel.imageUrl
    ? panel.imageUrl
    : panel.imageBase64
    ? `data:image/jpeg;base64,${panel.imageBase64}`
    : null;

  if (imgSrc) {
    return (
      <div
        style={{
          position: 'relative',
          width,
          height,
          borderRadius: 4,
          overflow: 'hidden',
          background: '#1a1a2e',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={panel.narration || `分镜 ${panel.index}`}
          width={width}
          height={height}
          style={{ display: 'block', objectFit: 'cover', borderRadius: 4 }}
        />
      </div>
    );
  }

  // 无图片时显示占位（生图失败降级）
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 4,
        background: '#1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        color: 'rgba(255,255,255,0.2)',
        fontSize: '0.7rem',
      }}
    >
      <span style={{ fontSize: '1.4rem' }}>🎨</span>
      <span>生图失败</span>
    </div>
  );
}
