'use client';

import { useState, useEffect, useRef } from 'react';
import type { StoryboardPanel } from '@/types/storyboard';
import { renderPanel } from './renderer';

interface Props {
  panel: StoryboardPanel;
  width?: number;
  height?: number;
}

/** 将 prompt 编码为 Pollinations.AI 图片 URL */
function buildImageUrl(prompt: string, width: number, height: number): string {
  const encoded = encodeURIComponent(prompt);
  // nologo=true 去掉水印；model=flux 高质量
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&nologo=true&seed=${hashCode(prompt)}`;
}

/** 简单哈希，保证同 prompt 生成同一张图（seed 不变） */
function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 1000000;
}

export default function StoryboardCanvas({ panel, width = 220, height = 165 }: Props) {
  const [imgStatus, setImgStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasPrompt = !!panel.imagePrompt;

  // 有 imagePrompt 时走 Pollinations.AI，否则降级到 canvas 渲染
  useEffect(() => {
    if (!hasPrompt) {
      // 降级：用 canvas 渲染
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        renderPanel(ctx, panel, width, height);
      } catch (e) {
        console.error('[Storyboard] renderPanel error', e, panel);
      }
    }
  }, [panel, width, height, hasPrompt]);

  if (hasPrompt) {
    const imageUrl = buildImageUrl(panel.imagePrompt!, width, height);

    return (
      <div
        style={{
          position: 'relative',
          width,
          height,
          borderRadius: 4,
          overflow: 'hidden',
          background: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* loading 骨架屏 */}
        {imgStatus !== 'loaded' && imgStatus !== 'error' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, #1a1a2e 25%, #252540 50%, #1a1a2e 75%)',
              backgroundSize: '200% 100%',
              animation: 'skeletonShimmer 1.5s infinite',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.7rem',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>🎨</span>
            <span>AI 绘图中…</span>
          </div>
        )}

        {/* 错误状态 */}
        {imgStatus === 'error' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.7rem',
              background: '#1a1a2e',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>图片加载失败</span>
          </div>
        )}

        {/* 实际图片 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={panel.narration || `分镜 ${panel.index}`}
          width={width}
          height={height}
          style={{
            display: 'block',
            objectFit: 'cover',
            opacity: imgStatus === 'loaded' ? 1 : 0,
            transition: 'opacity 0.4s ease',
            borderRadius: 4,
          }}
          onLoad={() => setImgStatus('loaded')}
          onError={() => setImgStatus('error')}
          onLoadStart={() => setImgStatus('loading')}
        />
      </div>
    );
  }

  // 降级：canvas 渲染
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', borderRadius: 4 }}
    />
  );
}
