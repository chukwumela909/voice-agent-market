'use client';

import { useEffect, useMemo, useRef } from 'react';

type VividVoiceVisualizerProps = {
  level: number; // 0..1
  isConnected: boolean;
  isSpeaking: boolean;
  isFetching: boolean;
  className?: string;
};

type NodePoint = {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  seed: number;
  hub: boolean;
};

type Edge = [number, number];

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return `rgba(192,192,192,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function nearestEdges(nodes: NodePoint[], maxEdgesPerNode: number) {
  const edges: Edge[] = [];
  const n = nodes.length;

  for (let i = 0; i < n; i++) {
    const distances: Array<{ j: number; d: number }> = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      distances.push({ j, d: dx * dx + dy * dy });
    }
    distances.sort((a, b) => a.d - b.d);

    for (let k = 0; k < Math.min(maxEdgesPerNode, distances.length); k++) {
      const j = distances[k].j;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      edges.push([a, b]);
    }
  }

  // De-dupe
  const seen = new Set<string>();
  const unique: Edge[] = [];
  for (const [a, b] of edges) {
    const key = `${a}:${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push([a, b]);
  }
  return unique;
}

export default function VividVoiceVisualizer(props: VividVoiceVisualizerProps) {
  const { level, isConnected, isSpeaking, isFetching, className } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  const paletteRef = useRef<{
    accent: string;
    accentDark: string;
    background: string;
  }>({
    accent: '#c0c0c0',
    accentDark: '#808080',
    background: '#0f0f1a',
  });

  const stateRef = useRef({
    t: 0,
    last: 0,
    levelSmoothed: 0,
    presenceSmoothed: 0,
    speakingSmoothed: 0,
    fetchingSmoothed: 0,
    w: 1,
    h: 1,
    dpr: 1,
    streams: [] as Array<{
      x: number;
      y: number;
      speed: number;
      len: number;
      alpha: number;
      phase: number;
    }>,
  });

  const shape = useMemo(() => {
    // Deterministic-ish seed per mount
    const seed = Math.floor(Math.random() * 1e9);
    const rng = mulberry32(seed);

    // Brain-ish point cloud: two lobes + a few hubs
    const nodes: NodePoint[] = [];
    const count = 140;
    for (let i = 0; i < count; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      let x = 0;
      let y = 0;

      // Rejection sample inside an ellipse per lobe
      for (let tries = 0; tries < 30; tries++) {
        const rx = (rng() * 2 - 1);
        const ry = (rng() * 2 - 1);
        const inside = rx * rx + ry * ry <= 1;
        if (!inside) continue;

        // Lobe centers at 0.42 / 0.58 with overlap
        x = (0.5 + side * 0.12) + rx * 0.22;
        y = 0.5 + ry * 0.28;

        // Slight “top-heavy” brain vibe
        y = lerp(y, 0.48, 0.15);

        if (x >= 0.18 && x <= 0.82 && y >= 0.12 && y <= 0.88) break;
      }

      nodes.push({
        x,
        y,
        seed: rng(),
        hub: rng() < 0.09,
      });
    }

    const edges = nearestEdges(nodes, 2);
    return { nodes, edges };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);

    const accent = styles.getPropertyValue('--accent').trim() || '#c0c0c0';
    const accentDark = styles.getPropertyValue('--accent-dark').trim() || '#808080';
    const background = styles.getPropertyValue('--background').trim() || '#0f0f1a';

    paletteRef.current = { accent, accentDark, background };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const setSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stateRef.current.w = rect.width;
      stateRef.current.h = rect.height;
      stateRef.current.dpr = dpr;

      // (Re)spawn streams proportional to size
      const streamCount = Math.max(18, Math.min(46, Math.floor(rect.width / 18)));
      const rng = mulberry32(Math.floor(rect.width * 1000 + rect.height * 17));
      stateRef.current.streams = Array.from({ length: streamCount }).map(() => ({
        x: rng() * rect.width,
        y: rng() * rect.height,
        speed: 40 + rng() * 90,
        len: 18 + rng() * 40,
        alpha: 0.08 + rng() * 0.22,
        phase: rng() * Math.PI * 2,
      }));
    };

    setSize();
    resizeObsRef.current = new ResizeObserver(setSize);
    resizeObsRef.current.observe(canvas.parentElement ?? canvas);

    const tick = (now: number) => {
      const s = stateRef.current;
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0.016;
      s.last = now;
      s.t += dt;

      // Smooth inputs
      const rawLevel = clamp01(level);
      const targetPresence = isConnected ? 1 : 0;
      const targetSpeaking = isSpeaking ? 1 : 0;
      const targetFetching = isFetching ? 1 : 0;

      // Attack/release smoothing
      s.levelSmoothed = rawLevel > s.levelSmoothed
        ? lerp(s.levelSmoothed, rawLevel, 0.35)
        : lerp(s.levelSmoothed, rawLevel, 0.12);

      s.presenceSmoothed = lerp(s.presenceSmoothed, targetPresence, 0.12);
      s.speakingSmoothed = lerp(s.speakingSmoothed, targetSpeaking, 0.18);
      s.fetchingSmoothed = lerp(s.fetchingSmoothed, targetFetching, 0.16);

      const w = s.w;
      const h = s.h;

      ctx.clearRect(0, 0, w, h);

      const { accent, accentDark } = paletteRef.current;

      const presence = s.presenceSmoothed;
      const speak = s.speakingSmoothed;
      const fetch = s.fetchingSmoothed;
      const energy = s.levelSmoothed;

      // Base ambient level so something always shows
      const baseAlpha = 0.25;

      // Subtle ambient glow (vignette)
      const vignette = ctx.createRadialGradient(w * 0.55, h * 0.45, 10, w * 0.55, h * 0.45, Math.max(w, h) * 0.55);
      vignette.addColorStop(0, hexToRgba(accent, 0.08 + 0.07 * presence));
      vignette.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // Data streams: left -> right packets
      const streamBoost = 1 + fetch * 1.2 + speak * 0.6 + energy * 0.8;
      for (const st of s.streams) {
        st.x += st.speed * dt * streamBoost;
        if (st.x > w + 60) {
          st.x = -60;
          st.y = (Math.random() * 0.7 + 0.15) * h;
        }

        const y = st.y + Math.sin(s.t * 1.4 + st.phase) * 10;
        const a = st.alpha * (baseAlpha + 0.4 * presence + 0.8 * fetch + 0.4 * speak);

        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(accentDark, a);
        ctx.beginPath();
        ctx.moveTo(st.x - st.len, y);
        ctx.lineTo(st.x, y);
        ctx.stroke();

        // Packet dot
        ctx.fillStyle = hexToRgba(accent, Math.min(0.75, a + 0.18 + 0.25 * speak));
        ctx.beginPath();
        ctx.arc(st.x, y, 1.3 + energy * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Brain “halo” outline (ellipses)
      const cx = w * 0.58;
      const cy = h * 0.5;
      const rx = Math.min(w, h) * 0.28;
      const ry = Math.min(w, h) * 0.22;
      const pulse = 1 + energy * 0.08 + speak * 0.06;

      ctx.save();
      ctx.shadowColor = hexToRgba(accent, baseAlpha + 0.2 * presence);
      ctx.shadowBlur = 18 + speak * 10 + energy * 12;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = hexToRgba(accentDark, baseAlpha + 0.08 * presence);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Brain node mesh
      const { nodes, edges } = shape;

      // Edges first
      ctx.lineWidth = 1;
      for (const [a, b] of edges) {
        const na = nodes[a];
        const nb = nodes[b];

        const jA = (Math.sin(s.t * 1.6 + na.seed * 10) * 0.006) * (0.7 + energy);
        const jB = (Math.cos(s.t * 1.4 + nb.seed * 10) * 0.006) * (0.7 + energy);

        const ax = lerp(w * 0.16, w * 0.88, na.x + jA);
        const ay = lerp(h * 0.12, h * 0.88, na.y);
        const bx = lerp(w * 0.16, w * 0.88, nb.x + jB);
        const by = lerp(h * 0.12, h * 0.88, nb.y);

        const dx = ax - bx;
        const dy = ay - by;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const distNorm = Math.min(1, dist / (Math.min(w, h) * 0.22));

        const edgeAlpha =
          (baseAlpha * 0.4 + 0.12 * (1 - distNorm)) *
          (0.6 + 0.6 * presence) *
          (1 + 0.9 * speak + 0.5 * fetch) *
          (0.7 + energy);

        ctx.strokeStyle = hexToRgba(accentDark, Math.min(0.45, edgeAlpha));
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const jitter = (Math.sin(s.t * 1.8 + n.seed * 12) * 0.008) * (0.7 + energy + 0.4 * speak);
        const x = lerp(w * 0.16, w * 0.88, n.x + jitter);
        const y = lerp(h * 0.12, h * 0.88, n.y);

        const nodeAlphaBase = (n.hub ? 0.30 : 0.18) * (baseAlpha + 0.35 * presence) * (0.8 + 0.9 * speak);
        const alpha = Math.min(0.85, nodeAlphaBase + energy * 0.22);

        const r = (n.hub ? 2.0 : 1.2) + energy * 1.2;

        if (n.hub) {
          ctx.save();
          ctx.shadowColor = hexToRgba(accent, baseAlpha + 0.3 * presence);
          ctx.shadowBlur = 14 + speak * 6;
          ctx.fillStyle = hexToRgba(accent, alpha);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = hexToRgba(accent, alpha);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Subtle scanlines
      ctx.lineWidth = 1;
      for (let yy = 6; yy < h; yy += 10) {
        ctx.strokeStyle = hexToRgba(accentDark, 0.02 * (baseAlpha + 0.2 * presence));
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(w, yy);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (resizeObsRef.current) resizeObsRef.current.disconnect();
      resizeObsRef.current = null;
    };
  }, [level, isConnected, isSpeaking, isFetching, shape]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
