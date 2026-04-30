'use client';

import { useEffect, useRef } from 'react';
import type { StoryboardPanel } from '@/types/storyboard';
import { renderPanel } from './renderer';

interface Props {
  panel: StoryboardPanel;
  width?: number;
  height?: number;
}

export default function StoryboardCanvas({ panel, width = 220, height = 165 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // imageBase64 优先：服务端已生成好，直接展示
  // 降级：无 base64 时用 canvas 棒人渲染
  const hasImage = !!panel.imageBase64;

  useEffect(() => {
    if (hasImage) return; // 有图片就不走 canvas 渲染
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      renderPanel(ctx, panel, width, height);
    } catch (e) {
      console.error('[Storyboard] renderPanel error', e, panel);
    }
  }, [panel, width, height, hasImage]);

  if (hasImage) {
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
          src={`data:image/jpeg;base64,${panel.imageBase64}`}
          alt={panel.narration || `分镜 ${panel.index}`}
          width={width}
          height={height}
          style={{
            display: 'block',
            objectFit: 'cover',
            borderRadius: 4,
          }}
        />
      </div>
    );
  }

  // 降级：canvas 棒人渲染
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', borderRadius: 4 }}
    />
  );
}
