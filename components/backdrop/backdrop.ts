// One fixed, full-page canvas behind every public page, with one rAF loop. It draws the
// background network (network.ts), then any registered painters (the hero's 3D logo,
// field.ts), then the network's core around that logo (core.ts), so the whole site animates
// on a single canvas.
//
// Copy marks itself with data-bg: "clear" (the hero text), "dim" (mission, Focus cards,
// chain cards, join copy, sub-page text) or "solid" (event pages: nothing at all behind each
// line of text, with a short soft edge). The network fades softly behind those areas; blocks
// never form anywhere near them (their whole footprint is checked) and fade out entirely before
// copy scrolls over them, so no cube ever sits behind text.

import { BOX, createNetwork, densityFor, type Box, type P2, type V3 } from "./network";
import { createCore, type Anchors } from "./core";

type Circle = { x: number; y: number; r: number };
type Rect = { left: number; top: number; right: number; bottom: number };

export type Painter = {
  draw: (ctx: CanvasRenderingContext2D, now: number) => void;
  /** Screen areas the network fades behind (circles, e.g. the logo itself) and where blocks
   *  never form (all of them, plus `block`, e.g. a ring around the logo and an open label). */
  avoid?: () => { circles: Circle[]; rects: Rect[]; block?: Circle[] };
  /** The hero logo's vertices this frame (read after `draw`): the network reaches into them. */
  anchors?: () => Anchors | null;
};

const FADE = { clear: .3, dim: .6, solid: 0 } as const; // remaining opacity behind copy
const SOFT = 56; // px over which the fade eases out past an element's edge
const SOFT_SOLID = 18; // "solid" text: a tight halo, so the network still shows between lines and around them

let engine: ReturnType<typeof createEngine> | null = null;
const painters = new Set<Painter>();

/** Register a painter; returns the unregister function. Safe before the backdrop mounts. */
export function addPainter(p: Painter) {
  painters.add(p);
  engine?.request();
  return () => { painters.delete(p); engine?.request(); };
}

/** The background network as drawn last frame (screen positions), e.g. for the logo to assemble from. */
export const networkSnapshot = () => engine?.snapshot() ?? null;

/** The live screen: one new node per check-in, arriving with a glow. */
export const backdropArrive = () => engine?.arrive();

/** Ask for a frame (only needed under reduced motion; otherwise the loop runs anyway). */
export const requestBackdropFrame = () => engine?.request();

export function startBackdrop(canvas: HTMLCanvasElement) {
  engine = createEngine(canvas);
  return () => { engine?.destroy(); engine = null; };
}

/**
 * The public member count for the background, from /api/chain, remembered per tab session. Null
 * below the threshold (the endpoint sends no count then): the background shows its baseline.
 */
const memberCount = {
  KEY: "nyubs:chain-members",
  cached(): number | null { try { const v = Number(sessionStorage.getItem(this.KEY)); return v > 0 ? v : null; } catch { return null; } },
  load(cb: (n: number | null) => void) {
    fetch("/api/chain").then((r) => (r.ok ? r.json() : null)).then((j: { stats?: { members?: number } | null } | null) => {
      const v = Math.floor(Number(j?.stats?.members));
      const n = v > 0 ? v : null;
      try { if (n) sessionStorage.setItem(this.KEY, String(n)); else sessionStorage.removeItem(this.KEY); } catch {}
      cb(n);
    }).catch(() => {});
  },
};

function createEngine(cv: HTMLCanvasElement) {
  const ctx = cv.getContext("2d")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let W = 0, H = 0, raf = 0, alive = true, network: ReturnType<typeof createNetwork> | null = null, members = memberCount.cached();
  const t0 = performance.now();
  const core = createCore(rnd);

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w === W && h === H && network && network.density.members === densityFor(W, H, members).members) return;
    if (w !== W || h !== H) { W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    const d = densityFor(W, H, members);
    if (!network || Math.abs(d.nodes - network.density.nodes) > network.density.nodes * .2 || d.maxFormations !== network.density.maxFormations || d.members !== network.density.members) network = createNetwork(rnd, d);
  }

  // Copy areas, read once per frame (cheap: a handful of rects) so the mask tracks scrolling.
  let zones: { r: Rect; f: number; soft: number }[] = [];
  const readZones = () => {
    zones = [];
    for (const el of document.querySelectorAll<HTMLElement>("[data-bg]")) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -SOFT || r.top > H + SOFT || !r.width) continue;
      const kind = el.dataset.bg === "clear" || el.dataset.bg === "solid" ? el.dataset.bg : "dim";
      zones.push({ r, f: FADE[kind], soft: kind === "solid" ? SOFT_SOLID : SOFT });
    }
  };
  const outside = (x: number, y: number, r: Rect) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
  /** Distance between two rectangles (0 when they overlap). */
  const gap = (a: Rect, b: Box) => Math.hypot(Math.max(a.left - b.right, 0, b.left - a.right), Math.max(a.top - b.bottom, 0, b.top - a.bottom));
  /** Whether segment A→B meets a "solid" zone grown by its soft edge (Liang–Barsky clipping). */
  const crossesSolid = (A: P2, B: P2) => {
    for (const z of zones) {
      if (z.f > 0) continue;
      const m = z.soft, dx = B[0] - A[0], dy = B[1] - A[1];
      let t0 = 0, t1 = 1, hit = true;
      for (const [p, q] of [[-dx, A[0] - (z.r.left - m)], [dx, z.r.right + m - A[0]], [-dy, A[1] - (z.r.top - m)], [dy, z.r.bottom + m - A[1]]]) {
        if (p === 0) { if (q < 0) { hit = false; break; } continue; }
        const t = q / p;
        if (p < 0) { if (t > t1) { hit = false; break; } t0 = Math.max(t0, t); } else { if (t < t0) { hit = false; break; } t1 = Math.min(t1, t); }
      }
      if (hit) return true;
    }
    return false;
  };
  const boxBlocked = (b: Box) => zones.some((z) => gap(z.r, b) < SOFT) || [...painters].some((p) => p.avoid?.().rects.some((r) => gap(r, b) < 28));
  const boxFade = (b: Box) => {
    let f = 1;
    for (const z of zones) { const d = gap(z.r, b); if (d < SOFT) { const k = d / SOFT; f = Math.min(f, k * k * (3 - 2 * k)); } }
    return f;
  };

  function frame(now: number) {
    raf = 0;
    if (!alive) return;
    resize();
    readZones();
    const el = (now - t0) / 1000, gk = reduce ? 1 : Math.min(1, Math.max(0, (el - .3) / 1.4));
    const extra = [...painters].map((p) => p.avoid?.() ?? { circles: [], rects: [] });
    const circles = extra.flatMap((a) => a.circles), rects = extra.flatMap((a) => a.rects), holds = [...circles, ...extra.flatMap((a) => a.block ?? [])];

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
      for (const z of zones) { const d = outside(x, y, z.r); if (d < z.soft) { const k = d / z.soft, s = k * k * (3 - 2 * k); f = Math.min(f, z.f + (1 - z.f) * s); } }
      for (const c of circles) { const d = Math.hypot(x - c.x, y - c.y); if (d < c.r + SOFT) f = Math.min(f, FADE.clear + (1 - FADE.clear) * Math.max(0, (d - c.r) / SOFT)); }
      return f;
    };
    const blocked = (x: number, y: number) =>
      zones.some((z) => outside(x, y, z.r) < 28) || rects.some((r) => outside(x, y, r) < 28) || holds.some((c) => Math.hypot(x - c.x, y - c.y) < c.r);

    ctx.clearRect(0, 0, W, H);
    const logo = [...painters].find((p) => p.anchors);
    network!.draw(ctx, { now, el, reduce, gk, P, W, H, fade, blocked, boxBlocked, boxFade, crossesSolid, near: core.wantNear(now, logo?.anchors?.() ?? null) });
    for (const p of painters) p.draw(ctx, now);
    // the core: ~30% of the page's node count, so it follows the same desktop/phone density rules
    core.draw(ctx, now, el, reduce, gk, network!.snapshot(), logo?.anchors?.() ?? null, Math.round((network!.density.nodes - network!.density.members) * .3), fade);
    if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
  }

  const request = () => { if (!raf && alive && !document.hidden) raf = requestAnimationFrame(frame); };
  // Under reduced motion nothing animates: redraw only when something changes.
  const onChange = () => request();
  addEventListener("resize", onChange);
  if (reduce) addEventListener("scroll", onChange, { passive: true });
  document.addEventListener("visibilitychange", onChange);
  request();
  // Member nodes: a count only. The last known count (this tab session) applies at once; a
  // changed count rebuilds the network once, usually before the fade-in has got far.
  memberCount.load((n) => { if (alive && n !== members) { members = n; request(); } });

  return {
    request,
    arrive: () => { network?.arrive(performance.now()); request(); },
    snapshot: () => network?.snapshot() ?? null,
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener("resize", onChange); removeEventListener("scroll", onChange);
      document.removeEventListener("visibilitychange", onChange);
    },
  };
}
