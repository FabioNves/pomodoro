"use client";

// Force-directed graph of subjects and notes drawn on a canvas. Subjects are
// the coloured hubs, notes hang off the subjects they carry, and [[links]]
// between notes are the thin lines. Drag nodes, pan the canvas, scroll to
// zoom; click selects, double-click opens a note.

import React, { useCallback, useEffect, useRef } from "react";
import { IconFit, IconZoomIn, IconZoomOut } from "@/components/notebook/notebookUi";

const REPULSION = 2600;
const SPRING = 0.03;
const GRAVITY = 0.004;
const DAMPING = 0.82;
const ALPHA_DECAY = 0.985;
const ALPHA_MIN = 0.008;

function cssVar(name, fallback) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function readColors() {
  let font = "sans-serif";
  try {
    font = getComputedStyle(document.body).fontFamily || font;
  } catch {
    /* ignore */
  }
  return {
    surface: cssVar("--surface", "#ffffff"),
    surface2: cssVar("--surface-2", "#eeeeee"),
    fg: cssVar("--fg", "#111111"),
    fgMuted: cssVar("--fg-muted", "#555555"),
    fgSubtle: cssVar("--fg-subtle", "#999999"),
    borderStrong: cssVar("--border-strong", "#999999"),
    primary: cssVar("--primary", "#333333"),
    accent: cssVar("--accent", "#dc602e"),
    font,
  };
}

const keep = (n) => ({ label: n.label, color: n.color, r: n.r, kind: n.kind, count: n.count, docId: n.docId });

export default function BrainGraph({ nodes, edges, selectedId, onSelect, onOpen, themeKey }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sim = useRef({
    nodes: [],
    edges: [],
    byId: new Map(),
    alpha: 0,
    transform: { x: 0, y: 0, k: 1 },
    center: { x: 400, y: 300 },
    size: { w: 0, h: 0 },
    hover: null,
    drag: null,
    pan: null,
    pointer: null,
    colors: null,
    raf: 0,
    autoFit: false,
  });
  const selectedRef = useRef(selectedId);
  const cb = useRef({ onSelect, onOpen });
  selectedRef.current = selectedId;
  cb.current = { onSelect, onOpen };

  /* ── drawing ─────────────────────────────────────────── */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const s = sim.current;
    if (!canvas || !s.size.w || !s.size.h) return;
    if (!s.colors) s.colors = readColors();
    const col = s.colors;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = s.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { x: tx, y: ty, k } = s.transform;
    ctx.translate(tx, ty);
    ctx.scale(k, k);

    const focus = selectedRef.current || s.hover;
    const near = new Set();
    if (focus) {
      near.add(focus);
      for (const e of s.edges) {
        if (e.a.id === focus) near.add(e.b.id);
        if (e.b.id === focus) near.add(e.a.id);
      }
    }

    for (const e of s.edges) {
      const lit = !focus || e.a.id === focus || e.b.id === focus;
      ctx.globalAlpha = lit ? (e.kind === "subject" ? 0.5 : 0.7) : 0.08;
      ctx.strokeStyle = e.kind === "subject" ? e.color || col.borderStrong : col.fgSubtle;
      ctx.lineWidth = Math.max(0.6, (e.kind === "subject" ? 1.3 : 1) / k);
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    }

    for (const n of s.nodes) {
      const dim = focus && !near.has(n.id);
      ctx.globalAlpha = dim ? 0.2 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      if (n.kind === "subject") {
        ctx.fillStyle = n.color;
        ctx.fill();
      } else {
        ctx.fillStyle = col.surface2;
        ctx.fill();
        ctx.lineWidth = 1.6 / k;
        ctx.strokeStyle = n.color || col.primary;
        ctx.stroke();
      }
      if (n.id === selectedRef.current || n.id === s.hover) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 4 / k, 0, Math.PI * 2);
        ctx.lineWidth = 2 / k;
        ctx.strokeStyle = n.id === selectedRef.current ? col.accent : col.primary;
        ctx.stroke();
      }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const n of s.nodes) {
      const dim = focus && !near.has(n.id);
      const show =
        n.kind === "subject" || k >= 0.85 || n.id === s.hover || n.id === selectedRef.current || (focus && near.has(n.id));
      if (!show) continue;
      ctx.globalAlpha = dim ? 0.25 : 1;
      const size = (n.kind === "subject" ? 12 : 11) / Math.max(k, 0.9);
      ctx.font = `${n.kind === "subject" ? 600 : 500} ${size}px ${col.font}`;
      const text = n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label;
      const y = n.y + n.r + 3 / k;
      ctx.lineWidth = 3 / k;
      ctx.strokeStyle = col.surface;
      ctx.strokeText(text, n.x, y);
      ctx.fillStyle = n.kind === "subject" ? col.fg : col.fgMuted;
      ctx.fillText(text, n.x, y);
    }
    ctx.globalAlpha = 1;
  }, []);

  const fit = useCallback(() => {
    const s = sim.current;
    if (!s.nodes.length || !s.size.w) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of s.nodes) {
      minX = Math.min(minX, n.x - n.r);
      minY = Math.min(minY, n.y - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }
    const pad = 56;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const k = Math.min(1.6, Math.max(0.2, Math.min((s.size.w - pad * 2) / bw, (s.size.h - pad * 2) / bh)));
    s.transform = {
      k,
      x: s.size.w / 2 - ((minX + maxX) / 2) * k,
      y: s.size.h / 2 - ((minY + maxY) / 2) * k,
    };
    draw();
  }, [draw]);

  /* ── simulation ──────────────────────────────────────── */

  const tick = useCallback(() => {
    const s = sim.current;
    const N = s.nodes;
    const alpha = s.alpha;
    for (let i = 0; i < N.length; i += 1) {
      const a = N[i];
      for (let j = i + 1; j < N.length; j += 1) {
        const b = N[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const minD = a.r + b.r + 14;
        let f = (REPULSION * alpha) / d2;
        if (d < minD) f += (minD - d) * 0.5 * alpha;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        if (!a.fixed) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (!b.fixed) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }
    for (const e of s.edges) {
      const { a, b } = e;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const rest = e.kind === "subject" ? 90 : 70;
      const f = (d - rest) * SPRING * alpha;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      if (!a.fixed) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.fixed) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    for (const n of N) {
      if (n.fixed) continue;
      n.vx += (s.center.x - n.x) * GRAVITY * alpha;
      n.vy += (s.center.y - n.y) * GRAVITY * alpha;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
    }
    s.alpha *= ALPHA_DECAY;
  }, []);

  const start = useCallback(() => {
    const s = sim.current;
    if (s.raf) return;
    const loop = () => {
      if (s.alpha > ALPHA_MIN) {
        tick();
        draw();
        s.raf = requestAnimationFrame(loop);
      } else {
        s.raf = 0;
        if (s.autoFit) {
          s.autoFit = false;
          fit();
        }
        draw();
      }
    };
    s.raf = requestAnimationFrame(loop);
  }, [tick, draw, fit]);

  // Simulation nodes follow the data; nodes that already exist keep their place.
  useEffect(() => {
    const s = sim.current;
    const prev = s.byId;
    const next = [];
    const map = new Map();
    const subjects = nodes.filter((n) => n.kind === "subject");
    const c = s.center;
    const ring = 150 + subjects.length * 8;
    subjects.forEach((n, i) => {
      const old = prev.get(n.id);
      const angle = (i / Math.max(1, subjects.length)) * Math.PI * 2;
      const node = old
        ? Object.assign(old, keep(n))
        : { ...n, x: c.x + Math.cos(angle) * ring, y: c.y + Math.sin(angle) * ring, vx: 0, vy: 0 };
      next.push(node);
      map.set(n.id, node);
    });
    for (const n of nodes) {
      if (n.kind === "subject") continue;
      const old = prev.get(n.id);
      if (old) {
        next.push(Object.assign(old, keep(n)));
        map.set(n.id, old);
        continue;
      }
      const anchor = n.anchor ? map.get(n.anchor) : null;
      const node = {
        ...n,
        x: (anchor ? anchor.x : c.x) + (Math.random() - 0.5) * 140,
        y: (anchor ? anchor.y : c.y) + (Math.random() - 0.5) * 140,
        vx: 0,
        vy: 0,
      };
      next.push(node);
      map.set(n.id, node);
    }
    const changed = next.length !== s.nodes.length || next.some((n) => !prev.has(n.id));
    s.nodes = next;
    s.byId = map;
    s.edges = edges
      .map((e) => ({ kind: e.kind, color: e.color, a: map.get(e.source), b: map.get(e.target) }))
      .filter((e) => e.a && e.b && e.a !== e.b);
    if (changed) {
      s.alpha = 1;
      if (!prev.size) s.autoFit = true;
    } else {
      s.alpha = Math.max(s.alpha, 0.25);
    }
    start();
  }, [nodes, edges, start]);

  // Theme colours come from the CSS variables; re-read them when the theme changes.
  useEffect(() => {
    sim.current.colors = readColors();
    draw();
  }, [themeKey, draw]);

  // Size the canvas to its container (device-pixel aware).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const s = sim.current;
      const first = !s.size.w;
      s.size = { w: rect.width, h: rect.height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      if (first) fit();
      draw();
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw, fit]);

  useEffect(
    () => () => {
      if (sim.current.raf) cancelAnimationFrame(sim.current.raf);
    },
    [],
  );

  /* ── interaction ─────────────────────────────────────── */

  const toWorld = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const s = sim.current;
    return {
      x: (clientX - rect.left - s.transform.x) / s.transform.k,
      y: (clientY - rect.top - s.transform.y) / s.transform.k,
    };
  };

  const nodeAt = (p) => {
    const s = sim.current;
    const slack = 4 / s.transform.k;
    for (let i = s.nodes.length - 1; i >= 0; i -= 1) {
      const n = s.nodes[i];
      if (Math.hypot(n.x - p.x, n.y - p.y) <= n.r + slack) return n;
    }
    return null;
  };

  const zoomAt = (mx, my, factor) => {
    const s = sim.current;
    const k = Math.min(4, Math.max(0.15, s.transform.k * factor));
    const ratio = k / s.transform.k;
    s.transform = {
      k,
      x: mx - (mx - s.transform.x) * ratio,
      y: my - (my - s.transform.y) * ratio,
    };
    draw();
  };

  // Wheel zoom needs preventDefault, so it is attached as a non-passive listener.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e) => {
    const s = sim.current;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);
    const node = nodeAt(p);
    s.pointer = { x: e.clientX, y: e.clientY, node, moved: false };
    if (node) {
      s.drag = { node, dx: node.x - p.x, dy: node.y - p.y };
      node.fixed = true;
    } else {
      s.pan = { x: e.clientX - s.transform.x, y: e.clientY - s.transform.y };
    }
  };

  const onPointerMove = (e) => {
    const s = sim.current;
    if (s.pointer && Math.hypot(e.clientX - s.pointer.x, e.clientY - s.pointer.y) > 4) s.pointer.moved = true;
    if (s.drag) {
      const p = toWorld(e.clientX, e.clientY);
      s.drag.node.x = p.x + s.drag.dx;
      s.drag.node.y = p.y + s.drag.dy;
      s.drag.node.vx = 0;
      s.drag.node.vy = 0;
      s.alpha = Math.max(s.alpha, 0.3);
      start();
      return;
    }
    if (s.pan) {
      s.transform = { ...s.transform, x: e.clientX - s.pan.x, y: e.clientY - s.pan.y };
      draw();
      return;
    }
    const node = nodeAt(toWorld(e.clientX, e.clientY));
    const id = node ? node.id : null;
    if (id !== s.hover) {
      s.hover = id;
      e.currentTarget.style.cursor = node ? "pointer" : "grab";
      draw();
    }
  };

  const endPointer = (e) => {
    const s = sim.current;
    if (s.drag) {
      s.drag.node.fixed = false;
      s.drag = null;
      s.alpha = Math.max(s.alpha, 0.2);
      start();
    }
    s.pan = null;
    const pointer = s.pointer;
    s.pointer = null;
    if (pointer && !pointer.moved && e.type === "pointerup") {
      cb.current.onSelect?.(pointer.node ? pointer.node.id : null);
    }
  };

  const onDoubleClick = (e) => {
    const node = nodeAt(toWorld(e.clientX, e.clientY));
    if (node) cb.current.onOpen?.(node.id);
  };

  const zoomButtons = [
    { label: "Zoom in", Icon: IconZoomIn, onClick: () => zoomAt(sim.current.size.w / 2, sim.current.size.h / 2, 1.3) },
    { label: "Zoom out", Icon: IconZoomOut, onClick: () => zoomAt(sim.current.size.w / 2, sim.current.size.h / 2, 1 / 1.3) },
    { label: "Fit to view", Icon: IconFit, onClick: fit },
  ];

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Graph of subjects and notes"
        className="block w-full h-full touch-none select-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(e) => {
          if (sim.current.hover) {
            sim.current.hover = null;
            e.currentTarget.style.cursor = "grab";
            draw();
          }
        }}
        onDoubleClick={onDoubleClick}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        {zoomButtons.map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.label}
            aria-label={b.label}
            onClick={b.onClick}
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-surface/90 border border-edge text-fg-muted hover:text-fg hover:bg-surface-hover shadow-sm transition-colors"
          >
            <b.Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
