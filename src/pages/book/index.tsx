import Head from 'next/head';
import { useRouter } from 'next/router';
import Navigation from '@/components/Navigation';
import BookAccessGate from '@/components/BookAccessGate';
import booksData from '@/data/books.json';
import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './index.module.css';

const { books } = booksData;

// ─── 世界主题配置 ──────────────────────────────────────────────────────────────
const BOOK_WORLDS: Record<string, {
  theme: string;
  color: string;
  rgb: [number, number, number];
  atmosphere: string;
  emoji: string;
  ring: boolean;
}> = {
  'dao-gui-yi-xian': {
    theme: '仙侠异界',
    color: '#a78bfa',
    rgb: [167, 139, 250],
    atmosphere: '杯山下的幻觉世界，道诡横行，人心叵测',
    emoji: '🌀',
    ring: true,
  },
  'wo-kanjian-de-shijie': {
    theme: '现实世界',
    color: '#38bdf8',
    rgb: [56, 189, 248],
    atmosphere: '硅谷到北京，AI 改变人类的征途',
    emoji: '🌍',
    ring: false,
  },
};

// ─── 3D 数学工具 ───────────────────────────────────────────────────────────────
type Vec3 = [number, number, number];

function rotateX(p: Vec3, a: number): Vec3 {
  const [x, y, z] = p;
  return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
}
function rotateY(p: Vec3, a: number): Vec3 {
  const [x, y, z] = p;
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
}
function project(p: Vec3, fov: number, cx: number, cy: number): [number, number, number] {
  const [x, y, z] = p;
  const d = fov / (fov + z + 800);
  return [cx + x * d, cy + y * d, d];
}

// ─── 星球参数 ──────────────────────────────────────────────────────────────────
interface PlanetConfig {
  slug: string;
  orbitA: number;   // 轨道长轴
  orbitB: number;   // 轨道短轴
  orbitTilt: number; // 轨道倾角（绕X轴）
  orbitSpeed: number;
  orbitPhase: number;
  radius: number;
  selfRotSpeed: number;
}

const PLANET_CONFIGS: PlanetConfig[] = [
  {
    slug: 'dao-gui-yi-xian',
    orbitA: 320, orbitB: 320,
    orbitTilt: 0.35,
    orbitSpeed: 0.003,
    orbitPhase: 0,
    radius: 72,
    selfRotSpeed: 0.008,
  },
  {
    slug: 'wo-kanjian-de-shijie',
    orbitA: 200, orbitB: 200,
    orbitTilt: -0.25,
    orbitSpeed: 0.005,
    orbitPhase: Math.PI,
    radius: 58,
    selfRotSpeed: 0.006,
  },
];

// ─── 主 Canvas 渲染器 ──────────────────────────────────────────────────────────
interface RendererState {
  sceneRotX: number;
  sceneRotY: number;
  dragStart: { x: number; y: number } | null;
  dragRotX: number;
  dragRotY: number;
  time: number;
  selectedSlug: string | null;
  coverImages: Record<string, HTMLImageElement>;
  hoveredPlanet: string | null;
  onSelect: (slug: string | null, screenX: number, screenY: number) => void;
  onHover: (slug: string | null) => void;
  entering: boolean;
  zoom: number;        // 当前缩放（目标值，带惯性）
  zoomTarget: number;  // 目标缩放
}

function createRenderer(canvas: HTMLCanvasElement, state: RendererState) {
  const ctx = canvas.getContext('2d')!;

  // 星星数据
  const stars = Array.from({ length: 280 }, () => ({
    x: Math.random() * 2000 - 1000,
    y: Math.random() * 2000 - 1000,
    z: Math.random() * 1200 - 600,
    r: Math.random() * 1.2 + 0.3,
    base: Math.random() * 0.5 + 0.3,
    tw: Math.random() * 0.04 + 0.01,
    twO: Math.random() * Math.PI * 2,
  }));

  let animId = 0;
  let t = 0;
  const ZOOM_MIN = 0.35;
  const ZOOM_MAX = 2.8;

  // 点击检测记录
  const lastPlanetScreenPos: Record<string, { x: number; y: number; r: number; z: number }> = {};

  function drawSphere(
    cx: number, cy: number, r: number,
    color: [number, number, number],
    coverImg: HTMLImageElement | null,
    selfRotAngle: number,
    isSelected: boolean,
    isHovered: boolean,
    depthScale: number,
  ) {
    const [cr, cg, cb] = color;
    ctx.save();
    ctx.translate(cx, cy);

    // 外发光
    const glowR = r + (isSelected ? 28 : isHovered ? 20 : 14);
    const glow = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, glowR);
    glow.addColorStop(0, `rgba(${cr},${cg},${cb},${isSelected ? 0.55 : 0.28})`);
    glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // 球体裁剪
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    // 底色
    const baseGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0, 0, 0, r);
    baseGrad.addColorStop(0, `rgba(${Math.min(cr + 60, 255)},${Math.min(cg + 60, 255)},${Math.min(cb + 60, 255)},1)`);
    baseGrad.addColorStop(1, `rgba(${Math.floor(cr * 0.3)},${Math.floor(cg * 0.3)},${Math.floor(cb * 0.3)},1)`);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    // 书封面贴图（模拟球面自转：水平平移 + 两份拼接）
    if (coverImg && coverImg.complete) {
      const offset = ((selfRotAngle % (Math.PI * 2)) / (Math.PI * 2)) * r * 2;
      ctx.globalAlpha = 0.65;
      // 两份封面并排，实现循环滚动
      ctx.drawImage(coverImg, -r + offset, -r, r * 2, r * 2);
      ctx.drawImage(coverImg, -r + offset - r * 2, -r, r * 2, r * 2);
      ctx.drawImage(coverImg, -r + offset + r * 2, -r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }

    // 主题色调叠加
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.28)`;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    // 大气层边缘渐变
    const atmo = ctx.createRadialGradient(0, 0, r * 0.65, 0, 0, r);
    atmo.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
    atmo.addColorStop(1, `rgba(${cr},${cg},${cb},0.45)`);
    ctx.fillStyle = atmo;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    // 经纬线
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.18)`;
    ctx.lineWidth = 0.5;
    for (let lat = -3; lat <= 3; lat++) {
      const ly = (lat / 4) * r;
      const lw = Math.sqrt(Math.max(0, r * r - ly * ly));
      ctx.beginPath();
      ctx.ellipse(0, ly, lw, lw * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let lng = 0; lng < 6; lng++) {
      const angle = (lng / 6) * Math.PI + (selfRotAngle % Math.PI);
      const ex = Math.cos(angle) * r;
      ctx.beginPath();
      ctx.ellipse(ex * 0.5, 0, Math.abs(ex * 0.5), r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 高光
    const hl = ctx.createRadialGradient(-r * 0.28, -r * 0.3, 0, -r * 0.15, -r * 0.15, r * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,0.35)');
    hl.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    // 暗面渐变（模拟光照）
    const shadow = ctx.createRadialGradient(r * 0.4, r * 0.4, 0, r * 0.2, r * 0.2, r * 1.1);
    shadow.addColorStop(0, 'rgba(0,0,0,0)');
    shadow.addColorStop(0.6, 'rgba(0,0,0,0.15)');
    shadow.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = shadow;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    ctx.restore();

    // 选中边框
    if (isSelected) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.9)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawRing(cx: number, cy: number, r: number, color: [number, number, number], depthScale: number, sceneRX: number) {
    const [cr, cg, cb] = color;
    ctx.save();
    ctx.translate(cx, cy);
    // 环随场景倾角变形
    const ry = (r + 22) * Math.abs(Math.sin(sceneRX + 0.4)) + 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, r + 34, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.55)`;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, r + 22, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.3)`;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(cx: number, cy: number, r: number, title: string, theme: string, color: string, isSelected: boolean, depthScale: number) {
    ctx.save();
    const labelY = cy + r + 20;
    ctx.globalAlpha = Math.min(1, depthScale * 2.5);

    ctx.font = `${Math.round(13 * depthScale * 1.4 + 5)}px "LXGW WenKai Lite", sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText(title, cx, labelY);

    ctx.font = `${Math.round(10 * depthScale * 1.4 + 4)}px sans-serif`;
    ctx.fillStyle = color;
    ctx.shadowBlur = 4;
    ctx.fillText(theme, cx, labelY + 16);

    ctx.restore();
  }

  function frame() {
    t++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const FOV = 900;

    const rotX = state.sceneRotX + state.dragRotX;
    const rotY = state.sceneRotY + state.dragRotY;

    // 惯性缩放平滑插值
    state.zoom += (state.zoomTarget - state.zoom) * 0.12;
    const zoom = state.zoom;

    // ── 星星 ──
    stars.forEach(s => {
      let p: Vec3 = [s.x, s.y, s.z];
      p = rotateX(p, rotX * 0.3);
      p = rotateY(p, rotY * 0.3);
      const [sx, sy, sd] = project(p, FOV, cx, cy);
      if (sd <= 0) return;
      const op = s.base * (0.7 + 0.3 * Math.sin(t * s.tw + s.twO)) * Math.min(1, sd * 1.8);
      ctx.beginPath();
      ctx.arc(sx, sy, s.r * sd * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${op})`;
      ctx.fill();
    });

    // ── 收集星球渲染信息（排序深度）──
    type PlanetDraw = {
      slug: string;
      sx: number; sy: number;
      r: number;
      d: number; // depth scale
      selfRot: number;
      config: PlanetConfig;
      worldZ: number; // for ring split
    };

    const toDraw: PlanetDraw[] = [];

    PLANET_CONFIGS.forEach(cfg => {
      const angle = cfg.orbitPhase + t * cfg.orbitSpeed;
      // 轨道在3D空间中的位置
      let p: Vec3 = [
        cfg.orbitA * Math.cos(angle),
        0,
        cfg.orbitB * Math.sin(angle),
      ];
      // 轨道倾角
      p = rotateX(p, cfg.orbitTilt);
      // 场景旋转
      p = rotateX(p, rotX);
      p = rotateY(p, rotY);
      // 应用缩放（直接缩放3D坐标）
      p = [p[0] * zoom, p[1] * zoom, p[2] * zoom];

      const [sx, sy, sd] = project(p, FOV, cx, cy);
      if (sd <= 0) return;

      const selfRot = t * cfg.selfRotSpeed;
      toDraw.push({
        slug: cfg.slug,
        sx, sy,
        r: cfg.radius * sd * zoom,
        d: sd,
        selfRot,
        config: cfg,
        worldZ: p[2],
      });

      // 更新点击检测
      lastPlanetScreenPos[cfg.slug] = { x: sx, y: sy, r: cfg.radius * sd * zoom, z: p[2] };
    });

    // 按深度排序（远的先画）
    toDraw.sort((a, b) => a.worldZ - b.worldZ);

    // ── 轨道线 ──
    PLANET_CONFIGS.forEach(cfg => {
      const segments = 80;
      const pts: Array<[number, number] | null> = [];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        let p: Vec3 = [cfg.orbitA * Math.cos(a), 0, cfg.orbitB * Math.sin(a)];
        p = rotateX(p, cfg.orbitTilt);
        p = rotateX(p, rotX);
        p = rotateY(p, rotY);
        p = [p[0] * zoom, p[1] * zoom, p[2] * zoom];
        const [sx, sy, sd] = project(p, FOV, cx, cy);
        pts.push(sd > 0 ? [sx, sy] : null);
      }
      ctx.beginPath();
      let started = false;
      pts.forEach(pt => {
        if (!pt) { started = false; return; }
        if (!started) { ctx.moveTo(pt[0], pt[1]); started = true; }
        else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // ── 渲染星球 ──
    toDraw.forEach(({ slug, sx, sy, r, d, selfRot, config }) => {
      const world = BOOK_WORLDS[slug];
      if (!world) return;
      const cover = state.coverImages[slug] || null;
      const isSel = state.selectedSlug === slug;
      const isHov = state.hoveredPlanet === slug;

      // 环（背面部分先画）
      if (world.ring) {
        drawRing(sx, sy, r, world.rgb, d, rotX);
      }

      drawSphere(sx, sy, r, world.rgb, cover, selfRot, isSel, isHov, d);

      // 环前景再叠一半（制造穿过效果）
      if (world.ring) {
        ctx.save();
        ctx.translate(sx, sy);
        const ry = (r + 22) * Math.abs(Math.sin(rotX + 0.4)) + 4;
        const [cr, cg, cb] = world.rgb;
        // 只画下半弧
        ctx.beginPath();
        ctx.ellipse(0, 0, r + 34, ry, 0, 0, Math.PI);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.55)`;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
      }

      drawLabel(sx, sy, r, books.find(b => b.slug === slug)?.title || '', world.theme, world.color, isSel, d);
    });

    animId = requestAnimationFrame(frame);
  }

  frame();

  return {
    getLastPlanetPos: () => lastPlanetScreenPos,
    zoomBy: (delta: number) => {
      state.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoomTarget * delta));
    },
    setZoom: (v: number) => {
      state.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
    },
    destroy: () => cancelAnimationFrame(animId),
  };
}

// ─── 主页面组件 ───────────────────────────────────────────────────────────────
export default function BookListPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RendererState>({
    sceneRotX: 0.3,
    sceneRotY: 0,
    dragStart: null,
    dragRotX: 0,
    dragRotY: 0,
    time: 0,
    selectedSlug: null,
    coverImages: {},
    hoveredPlanet: null,
    onSelect: () => {},
    onHover: () => {},
    entering: false,
    zoom: 1,
    zoomTarget: 1,
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);

  // 同步 state 到 ref
  useEffect(() => {
    stateRef.current.selectedSlug = selectedSlug;
  }, [selectedSlug]);
  useEffect(() => {
    stateRef.current.hoveredPlanet = hoveredPlanet;
  }, [hoveredPlanet]);
  useEffect(() => {
    stateRef.current.entering = entering;
  }, [entering]);

  // 加载封面图
  useEffect(() => {
    books.forEach(book => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = book.cover;
      img.onload = () => {
        stateRef.current.coverImages[book.slug] = img;
      };
    });
  }, []);

  const handleEnter = useCallback((slug: string) => {
    setEntering(true);
    stateRef.current.entering = true;
    setTimeout(() => router.push(`/book/${slug}/world`), 600);
  }, [router]);

  // 初始化 Canvas & renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── 滚轮缩放 ──
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.08 : 0.93;
      rendererRef.current?.zoomBy(delta);
      setZoomLevel(stateRef.current.zoomTarget);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    stateRef.current.onSelect = (slug, sx, sy) => {
      if (!slug) {
        setSelectedSlug(null);
        setPanelPos(null);
        return;
      }
      setSelectedSlug(prev => {
        if (prev === slug) {
          handleEnter(slug);
          return prev;
        }
        setPanelPos({ x: sx, y: sy });
        return slug;
      });
    };
    stateRef.current.onHover = (slug) => setHoveredPlanet(slug);

    rendererRef.current = createRenderer(canvas, stateRef.current);

    return () => {
      rendererRef.current?.destroy();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [handleEnter]);

  // ── 鼠标/触摸事件 ──
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  // 双指捏合
  const lastPinchDist = useRef<number | null>(null);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2) {
      // 双指开始，不启动拖动
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
      return;
    }
    const pos = getPos(e);
    isDragging.current = true;
    dragMoved.current = false;
    lastMouse.current = pos;
    stateRef.current.dragStart = pos;
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    // 双指捏合缩放
    if ('touches' in e && e.touches.length === 2) {
      e.preventDefault?.();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current !== null) {
        const ratio = dist / lastPinchDist.current;
        rendererRef.current?.zoomBy(ratio);
        setZoomLevel(stateRef.current.zoomTarget);
      }
      lastPinchDist.current = dist;
      isDragging.current = false;
      return;
    }
    lastPinchDist.current = null;
    const pos = getPos(e);
    if (isDragging.current) {
      const dx = pos.x - lastMouse.current.x;
      const dy = pos.y - lastMouse.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved.current = true;
      stateRef.current.sceneRotY += dx * 0.006;
      stateRef.current.sceneRotX += dy * 0.006;
      // 限制X轴转角
      stateRef.current.sceneRotX = Math.max(-1.2, Math.min(1.2, stateRef.current.sceneRotX));
      lastMouse.current = pos;
    } else {
      // hover检测
      const renderer = rendererRef.current;
      if (renderer) {
        const positions = renderer.getLastPlanetPos();
        let found: string | null = null;
        for (const [slug, info] of Object.entries(positions)) {
          const dx = pos.x - info.x;
          const dy = pos.y - info.y;
          if (Math.sqrt(dx * dx + dy * dy) < info.r + 8) {
            found = slug;
            break;
          }
        }
        if (found !== stateRef.current.hoveredPlanet) {
          stateRef.current.hoveredPlanet = found;
          setHoveredPlanet(found);
          if (canvasRef.current) {
            canvasRef.current.style.cursor = found ? 'pointer' : 'grab';
          }
        }
      }
    }
  };

  const onPointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    lastPinchDist.current = null;
    const pos = getPos(e);
    if (!dragMoved.current) {
      // 点击检测
      const renderer = rendererRef.current;
      if (renderer) {
        const positions = renderer.getLastPlanetPos();
        let clickedSlug: string | null = null;
        for (const [slug, info] of Object.entries(positions)) {
          const dx = pos.x - info.x;
          const dy = pos.y - info.y;
          if (Math.sqrt(dx * dx + dy * dy) < info.r + 10) {
            clickedSlug = slug;
            break;
          }
        }
        stateRef.current.onSelect(clickedSlug, pos.x, pos.y);
        if (!clickedSlug) {
          setSelectedSlug(null);
          setPanelPos(null);
        }
      }
    }
    isDragging.current = false;
    stateRef.current.dragStart = null;
  };

  const selectedBook = books.find(b => b.slug === selectedSlug);
  const selectedWorld = selectedSlug ? BOOK_WORLDS[selectedSlug] : null;

  // 计算面板位置（避免超出屏幕）
  const getPanelStyle = () => {
    if (!panelPos) return {};
    const W = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const H = typeof window !== 'undefined' ? window.innerHeight : 700;
    let left = panelPos.x + 20;
    let top = panelPos.y - 80;
    if (left + 240 > W - 20) left = panelPos.x - 260;
    if (top + 360 > H - 20) top = H - 380;
    if (top < 80) top = 80;
    return { left, top };
  };

  return (
    <>
      <Head>
        <title>书单 - 星际图书馆 | 卢穗杰的博客</title>
        <meta name="description" content="卢穗杰的书单与阅读笔记，在星际图书馆中漫游探索每一本书的世界。" />
        <link rel="canonical" href="https://lusuijie.com.cn/book/" />
        <meta property="og:title" content="书单 - 星际图书馆 | 卢穗杰的博客" />
        <meta property="og:description" content="卢穗杰的书单，在星际图书馆中漫游探索每一本书的世界。" />
        <meta property="og:url" content="https://lusuijie.com.cn/book/" />
        <meta property="og:type" content="website" />
      </Head>
      <Navigation />
      <BookAccessGate>
      <div className={`${styles.universe} ${entering ? styles.entering : ''}`}>
        <canvas
          ref={canvasRef}
          className={styles.mainCanvas}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={() => { isDragging.current = false; }}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />

        {/* 中心标题 */}
        <div className={styles.centerTitle}>
          <div className={styles.centerTitleText}>多维世界图书馆</div>
          <div className={styles.centerTitleSub}>
            {selectedBook ? `再次点击进入《${selectedBook.title}》` : '拖拽旋转 · 滚轮缩放 · 点击星球探索'}
          </div>
        </div>

        {/* 书籍信息面板（跟随星球位置弹出） */}
        {selectedBook && selectedWorld && panelPos && (
          <div
            className={styles.bookInfoPanel}
            style={{
              ...getPanelStyle(),
              borderColor: selectedWorld.color,
              boxShadow: `0 0 40px rgba(${selectedWorld.rgb.join(',')},0.4)`,
            }}
          >
            <div className={styles.panelEmoji}>{selectedWorld.emoji}</div>
            <div className={styles.panelTitle}>{selectedBook.title}</div>
            <div className={styles.panelAuthor}>{selectedBook.author}</div>
            <div className={styles.panelTheme} style={{ color: selectedWorld.color }}>
              {selectedWorld.theme}
            </div>
            <div className={styles.panelAtmo}>{selectedWorld.atmosphere}</div>
            <div className={styles.panelRating}>
              {'★'.repeat(Math.round(selectedBook.rating))} {selectedBook.rating}
            </div>
            <button
              className={styles.enterBtn}
              style={{ background: selectedWorld.color }}
              onClick={() => handleEnter(selectedSlug!)}
            >
              进入这个世界 →
            </button>
          </div>
        )}

        {/* 底部提示 + 书单 */}
        <div className={styles.bookHints}>
          {books.map(b => {
            const w = BOOK_WORLDS[b.slug];
            return (
              <div
                key={b.slug}
                className={`${styles.bookHintItem} ${selectedSlug === b.slug ? styles.bookHintActive : ''}`}
                style={{ borderColor: w?.color || '#6b7280' }}
                onClick={() => {
                  setSelectedSlug(b.slug);
                  // 面板显示在中间
                  const W = typeof window !== 'undefined' ? window.innerWidth : 1200;
                  const H = typeof window !== 'undefined' ? window.innerHeight : 700;
                  setPanelPos({ x: W * 0.6, y: H * 0.45 });
                }}
              >
                <span style={{ color: w?.color || '#6b7280' }}>{w?.emoji}</span>
                <span>{b.title}</span>
              </div>
            );
          })}

          {/* 创造世界入口 */}
          <div
            className={styles.bookHintItem}
            style={{
              borderColor: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.06)',
              cursor: 'pointer',
            }}
            onClick={() => router.push('/book/create')}
          >
            <span style={{ color: '#f59e0b' }}>✦</span>
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>创造世界</span>
          </div>
        </div>

        {/* 缩放控件 */}
        <div className={styles.zoomControls}>
          <button
            className={styles.zoomBtn}
            onClick={() => { rendererRef.current?.zoomBy(1.2); setZoomLevel(stateRef.current.zoomTarget); }}
            title="放大"
          >＋</button>
          <div className={styles.zoomBar}>
            <div
              className={styles.zoomBarFill}
              style={{ height: `${((Math.log(Math.max(0.35, Math.min(2.8, zoomLevel))) - Math.log(0.35)) / (Math.log(2.8) - Math.log(0.35))) * 100}%` }}
            />
          </div>
          <button
            className={styles.zoomBtn}
            onClick={() => { rendererRef.current?.zoomBy(1 / 1.2); setZoomLevel(stateRef.current.zoomTarget); }}
            title="缩小"
          >－</button>
        </div>

      </div>
      </BookAccessGate>
    </>
  );
}
