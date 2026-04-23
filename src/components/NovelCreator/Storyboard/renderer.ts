import type { StoryboardPanel, PoseType } from '@/types/storyboard';

// 骨骼点相对于人物底部中心的偏移（scale=1时的像素值）
const POSES: Record<PoseType, {
  head: [number, number];
  neck: [number, number];
  shoulder: [number, number];
  hip: [number, number];
  lHand: [number, number];
  rHand: [number, number];
  lFoot: [number, number];
  rFoot: [number, number];
}> = {
  stand: {
    head: [0, -56], neck: [0, -46], shoulder: [0, -38],
    hip: [0, -26], lHand: [-14, -36], rHand: [14, -36],
    lFoot: [-7, 0], rFoot: [7, 0],
  },
  sit: {
    head: [0, -48], neck: [0, -38], shoulder: [0, -30],
    hip: [0, -18], lHand: [-12, -28], rHand: [12, -28],
    lFoot: [-14, 0], rFoot: [14, 0],
  },
  run: {
    head: [4, -54], neck: [4, -44], shoulder: [2, -36],
    hip: [0, -24], lHand: [-16, -38], rHand: [10, -30],
    lFoot: [12, 0], rFoot: [-8, -4],
  },
  fight: {
    head: [-2, -54], neck: [-2, -44], shoulder: [-2, -36],
    hip: [0, -24], lHand: [-20, -42], rHand: [16, -34],
    lFoot: [-10, 0], rFoot: [12, 0],
  },
  fall: {
    head: [-20, -20], neck: [-14, -16], shoulder: [-6, -14],
    hip: [0, -8], lHand: [-24, -24], rHand: [10, -20],
    lFoot: [16, 0], rFoot: [24, -8],
  },
};

const POS_X_RATIO: Record<'left' | 'center' | 'right', number> = {
  left: 0.25, center: 0.5, right: 0.75,
};

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawBackground(ctx: CanvasRenderingContext2D, sceneType: StoryboardPanel['sceneType'], w: number, h: number) {
  if (sceneType === 'outdoor') {
    // 天空
    ctx.fillStyle = '#b8d4f0';
    ctx.fillRect(0, 0, w, h * 0.6);
    // 地面
    ctx.fillStyle = '#8db87a';
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    // 地平线
    ctx.strokeStyle = '#5a7a4a';
    ctx.lineWidth = 1;
    line(ctx, 0, h * 0.6, w, h * 0.6);
  } else if (sceneType === 'indoor') {
    ctx.fillStyle = '#f0ece4';
    ctx.fillRect(0, 0, w, h);
    // 地板线
    ctx.strokeStyle = '#c8b89a';
    ctx.lineWidth = 1;
    line(ctx, 0, h * 0.75, w, h * 0.75);
    // 透视墙角
    line(ctx, 0, 0, w * 0.2, h * 0.75);
    line(ctx, w, 0, w * 0.8, h * 0.75);
  } else {
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(0, 0, w, h);
  }
}

function drawFigure(
  ctx: CanvasRenderingContext2D,
  pose: PoseType,
  cx: number,
  cy: number,
  scale: number
) {
  const sk = POSES[pose] ?? POSES['stand'];
  const s = scale;

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';

  // 头
  ctx.beginPath();
  ctx.arc(cx + sk.head[0] * s, cy + sk.head[1] * s, 7 * s, 0, Math.PI * 2);
  ctx.stroke();

  // 躯干
  line(ctx, cx + sk.neck[0] * s, cy + sk.neck[1] * s, cx + sk.hip[0] * s, cy + sk.hip[1] * s);
  // 手臂
  line(ctx, cx + sk.shoulder[0] * s, cy + sk.shoulder[1] * s, cx + sk.lHand[0] * s, cy + sk.lHand[1] * s);
  line(ctx, cx + sk.shoulder[0] * s, cy + sk.shoulder[1] * s, cx + sk.rHand[0] * s, cy + sk.rHand[1] * s);
  // 腿
  line(ctx, cx + sk.hip[0] * s, cy + sk.hip[1] * s, cx + sk.lFoot[0] * s, cy + sk.lFoot[1] * s);
  line(ctx, cx + sk.hip[0] * s, cy + sk.hip[1] * s, cx + sk.rFoot[0] * s, cy + sk.rFoot[1] * s);
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  headX: number,
  headY: number,
  w: number
) {
  const padding = 5;
  const fontSize = 10;
  ctx.font = `${fontSize}px sans-serif`;

  // 简单换行：每10个字一行
  const maxChars = 10;
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.slice(i, i + maxChars));
  }

  const lineH = fontSize + 3;
  const bw = Math.min(maxChars * fontSize * 0.65 + padding * 2, w * 0.45);
  const bh = lines.length * lineH + padding * 2;

  // 气泡框位置（人物头部左上方或右上方）
  const bx = headX < w / 2 ? headX + 8 : headX - bw - 8;
  const by = headY - bh - 14;

  // 圆角矩形
  const r = 4;
  ctx.fillStyle = '#fffef5';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
  ctx.lineTo(bx + r, by + bh);
  ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
  ctx.lineTo(bx, by + r);
  ctx.arcTo(bx, by, bx + r, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 尖角
  const tipX = headX < w / 2 ? bx + 10 : bx + bw - 10;
  ctx.beginPath();
  ctx.moveTo(tipX - 4, by + bh);
  ctx.lineTo(headX, headY - 2);
  ctx.lineTo(tipX + 4, by + bh);
  ctx.fillStyle = '#fffef5';
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 文字
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'left';
  lines.forEach((ln, i) => {
    ctx.fillText(ln, bx + padding, by + padding + (i + 1) * lineH - 2);
  });
}

function drawNarration(ctx: CanvasRenderingContext2D, text: string, w: number) {
  const boxH = 20;
  ctx.fillStyle = 'rgba(30,30,30,0.75)';
  ctx.fillRect(0, 0, w, boxH);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#f0ece4';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, 14);
}

function drawPanelBorder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

function drawIndexLabel(ctx: CanvasRenderingContext2D, index: number, w: number, h: number) {
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.textAlign = 'right';
  ctx.fillText(`#${index}`, w - 6, h - 6);
}

export function renderPanel(
  ctx: CanvasRenderingContext2D,
  panel: StoryboardPanel,
  w: number,
  h: number
) {
  ctx.clearRect(0, 0, w, h);

  drawBackground(ctx, panel.sceneType, w, h);

  const groundY = h * 0.8;
  const scale = w / 240;

  panel.figures.forEach((fig) => {
    const cx = w * (POS_X_RATIO[fig.positionX] ?? 0.5);
    drawFigure(ctx, fig.pose, cx, groundY, scale);

    if (fig.dialogue) {
      const sk = POSES[fig.pose];
      const headX = cx + sk.head[0] * scale;
      const headY = groundY + sk.head[1] * scale;
      drawSpeechBubble(ctx, fig.dialogue, headX, headY, w);
    }

    // 名字标注
    ctx.font = `${9 * scale}px sans-serif`;
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(fig.name, cx, groundY + 11 * scale);
  });

  if (panel.narration) {
    drawNarration(ctx, panel.narration, w);
  }

  drawIndexLabel(ctx, panel.index, w, h);
  drawPanelBorder(ctx, w, h);
}
