// One fixed, full-page canvas behind every public page, with one rAF loop. It draws the
// background network (network.ts) and then any registered painters (the hero's 3D logo,
// field.ts), so the whole site animates on a single canvas.
//
// Copy marks itself with data-bg: "clear" (the hero text) or "dim" (mission, Focus cards,
// chain cards, join copy, sub-page text). The network fades softly behind those areas and
// blocks never form there.

import { BOX, createNetwork, densityFor, type P2, type V3 } from "./network";

type Circle = { x: number; y: number; r: number };
type Rect = { left: number; top: number; right: number; bottom: number };

export type Painter = {
  draw: (ctx: CanvasRenderingContext2D, now: number) => void;
  /** Screen areas the network keeps clear of (e.g. the logo, an open label). */
  avoid?: () => { circles: Circle[]; rects: Rect[] };
};

const FADE = { clear: .3, dim: .6 } as const; // remaining opacity behind copy
const SOFT = 56; // px over which the fade eases out past an element's edge

let engine: ReturnType<typeof createEngine> | null = null;
const painters = new Set<Painter>();

/** Register a painter; returns the unregister function. Safe before the backdrop mounts. */
export function addPainter(p: Painter) {
  painters.add(p);
  engine?.request();
  return () => { painters.delete(p); engine?.request(); };
}

/** Ask for a frame (only needed under reduced motion; otherwise the loop runs anyway). */
export const requestBackdropFrame = () => engine?.request();

export function startBackdrop(canvas: HTMLCanvasElement) {
  engine = createEngine(canvas);
  return () => { engine?.destroy(); engine = null; };
}

function createEngine(cv: HTMLCanvasElement) {
  const ctx = cv.getContext("2d")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let W = 0, H = 0, raf = 0, alive = true, network: ReturnType<typeof createNetwork> | null = null;
  const t0 = performance.now();

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w === W && h === H && network) return;
    W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const d = densityFor(W, H);
    if (!network || Math.abs(d.nodes - network.density.nodes) > network.density.nodes * .2 || d.maxFormations !== network.density.maxFormations) network = createNetwork(rnd, d);
  }

  // Copy areas, read once per frame (cheap: a handful of rects) so the mask tracks scrolling.
  let zones: { r: Rect; f: number }[] = [];
  const readZones = () => {
    zones = [];
    for (const el of document.querySelectorAll<HTMLElement>("[data-bg]")) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -SOFT || r.top > H + SOFT || !r.width) continue;
      zones.push({ r, f: el.dataset.bg === "clear" ? FADE.clear : FADE.dim });
    }
  };
  const outside = (x: number, y: number, r: Rect) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));

  function frame(now: number) {
    raf = 0;
    if (!alive) return;
    resize();
    readZones();
    const el = (now - t0) / 1000, gk = reduce ? 1 : Math.min(1, Math.max(0, (el - .3) / 1.4));
    const extra = [...painters].map((p) => p.avoid?.() ?? { circles: [], rects: [] });
    const circles = extra.flatMap((a) => a.circles), rects = extra.flatMap((a) => a.rects);

    // Projection: the node box fills the viewport; a slow yaw drift gives depth. The layer
    // scrolls at a fraction of the page speed and wraps vertically, so it never runs out.
    const yaw = reduce ? .18 : .18 + Math.sin(el * .05) * .14, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const sx = W / (BOX[0] * .9), syc = H / (BOX[1] * .86), pad = 40, span = H + pad * 2;
    const par = reduce ? 0 : scrollY * .08;
    const P = (p: V3): P2 => {
      const x = p[0] * cy - p[2] * sy, z = p[0] * sy + p[2] * cy;
      const persp = 1 / (1 - z * .025);
      let y = H / 2 - p[1] * syc * persp - par * (1 + z / BOX[2]);
      y = ((y + pad) % span + span) % span - pad;
      return [W / 2 + x * sx * persp, y, z];
    };
    const fade = (x: number, y: number) => {
      let f = 1;
      for (const z of zones) { const d = outside(x, y, z.r); if (d < SOFT) { const k = d / SOFT, s = k * k * (3 - 2 * k); f = Math.min(f, z.f + (1 - z.f) * s); } }
      for (const c of circles) { const d = Math.hypot(x - c.x, y - c.y); if (d < c.r + SOFT) f = Math.min(f, FADE.clear + (1 - FADE.clear) * Math.max(0, (d - c.r) / SOFT)); }
      return f;
    };
    const blocked = (x: number, y: number) =>
      zones.some((z) => outside(x, y, z.r) < 28) || rects.some((r) => outside(x, y, r) < 28) || circles.some((c) => Math.hypot(x - c.x, y - c.y) < c.r);

    ctx.clearRect(0, 0, W, H);
    network!.draw(ctx, { now, el, reduce, gk, P, W, H, fade, blocked });
    for (const p of painters) p.draw(ctx, now);
    if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
  }

  const request = () => { if (!raf && alive && !document.hidden) raf = requestAnimationFrame(frame); };
  // Under reduced motion nothing animates: redraw only when something changes.
  const onChange = () => request();
  addEventListener("resize", onChange);
  if (reduce) addEventListener("scroll", onChange, { passive: true });
  document.addEventListener("visibilitychange", onChange);
  request();

  return {
    request,
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener("resize", onChange); removeEventListener("scroll", onChange);
      document.removeEventListener("visibilitychange", onChange);
    },
  };
}
