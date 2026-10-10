// The site background: a drifting constellation (nodes, faint edges between near neighbours,
// small dots travelling along edges) that every 3–5 seconds pulls 8 nearby nodes into an
// isometric cube, draws its 12 edges one by one, glows ("block confirmed"), holds, then lets
// the nodes relax back into the network. Drawn by the backdrop engine (backdrop.ts) into the
// one fixed canvas behind every page.

import { batch, dot } from "./batch";

export type V3 = [number, number, number];
export type P2 = [number, number, number]; // screen x, screen y, depth

const CUBE_V: V3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
// Drawing order for the 12 edges: bottom square, verticals, top square.
const CUBE_E: [number, number][] = [[0, 1], [1, 5], [5, 4], [4, 0], [0, 2], [1, 3], [5, 7], [4, 6], [2, 3], [3, 7], [7, 6], [6, 2]];
const CUBE_TOP = [2, 3, 7, 6];

// Formation timeline (ms).
const GATHER = 1400, EDGE = 170, EDGES_END = GATHER + EDGE * 12, GLOW = 650, HOLD_END = EDGES_END + GLOW + 2000, RELAX = 1400;
const END = HOLD_END + RELAX;

/** Node volume (world units). The engine scales it to fill the viewport. */
export const BOX: V3 = [20, 13, 12];

/**
 * Member nodes. Below the public threshold (50 members) the true count is never sent to the
 * browser, so the background always shows this fixed ambient baseline; from the threshold on,
 * one node per member, never fewer than the baseline, capped at MAX_MEMBER_NODES (phones half).
 */
export const AMBIENT_MEMBER_NODES = 40;
export const MAX_MEMBER_NODES = 120;

/**
 * Density for a viewport. The base is ~140 nodes at 1440×900, scaled by area (phones half).
 * Screens ≥1280px wide get 30% more nodes; phones and tablets keep the base. Dots are 1.5× the
 * old ratio (base × .19 × 1.5, ~40 at 1440×900), so most of the extra density is motion. If
 * frame time ever needs trimming, cut nodes (the ≥1280 bonus first), not dots.
 * `members` is the public count from /api/chain, or null below the threshold (then only the
 * ambient baseline); member nodes are ordinary nodes, and the edge reach stays tied to the base density.
 */
export function densityFor(W: number, H: number, members: number | null = null) {
  const phone = W < 700;
  const base = Math.min(230, Math.max(26, 140 * (W * H) / (1440 * 900) * (phone ? .5 : 1)));
  const memberNodes = Math.round(Math.min(Math.max(members ?? 0, AMBIENT_MEMBER_NODES), MAX_MEMBER_NODES) * (phone ? .5 : 1));
  const nodes = Math.round(Math.min(300, base * (W >= 1280 ? 1.3 : 1))) + memberNodes;
  return { nodes, base: Math.round(base), members: memberNodes, dots: Math.round(base * .19 * 1.5), maxFormations: phone ? 1 : 3 };
}
export type Density = ReturnType<typeof densityFor>;

// Live screen check-ins (round 13.1): each arrives at the centre with a ripple and glow, holds,
// then drifts to its place on the evening's own chain and stays highlighted.
const CI_HOLD = 2800; // ms at the centre: ripple and glow
const CI_DRIFT = 1700; // ms to drift to its place; its link to the previous check-in draws in meanwhile
const CI_FADE = 700; // ms: the reduced-motion fade-in
const ease = (t: number) => { const x = Math.min(Math.max(t, 0), 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

type Node = { home: V3; ph: V3; sp: number; w: number; busy: boolean };
/** A screen rectangle. */
export type Box = { left: number; top: number; right: number; bottom: number };
const boxOf = (pts: P2[]): Box => ({
  left: Math.min(...pts.map((q) => q[0])), right: Math.max(...pts.map((q) => q[0])),
  top: Math.min(...pts.map((q) => q[1])), bottom: Math.max(...pts.map((q) => q[1])),
});
type Formation = { nodes: number[]; verts: V3[]; t0: number };

export type DrawOpts = {
  now: number;
  /** seconds since start, for drift */
  el: number;
  reduce: boolean;
  /** fade-in factor for the whole background */
  gk: number;
  /** World → screen, including the scroll parallax and vertical wrap. */
  P: (p: V3) => P2;
  W: number;
  H: number;
  /** Opacity factor at a screen point: 1 in the open, lower behind copy (soft-edged). */
  fade: (x: number, y: number) => number;
  /** True where a block may not form (copy, the hero logo, an open label). */
  blocked: (x: number, y: number) => boolean;
  /** True when a block's whole footprint would come near copy or an open label: it doesn't form there. */
  boxBlocked: (b: Box) => boolean;
  /** True when the segment A→B passes through "solid" copy (event pages): that edge isn't drawn. */
  crossesSolid: (A: P2, B: P2) => boolean;
  /** 1 when a block's footprint is clear of copy, easing to 0 as it reaches it (copy scrolled over it). */
  boxFade: (b: Box) => number;
  /** Opacity factor for the ambient network (the live screen dims it so check-ins stand out). */
  ambient?: number;
  /** When set, the next block prefers to form within this screen circle (e.g. near the hero logo). */
  near?: { x: number; y: number; r: number } | null;
};

/** What the network drew last frame, for layers drawn on top of it (core.ts, the logo intro). */
export type Snapshot = {
  /** Screen position of every node. */
  sp: P2[];
  /** Formation weight per node (0 = drifting freely). */
  w: number[];
  /** Live blocks: their 8 screen vertices, and whether they're fully built and holding. */
  blocks: { id: object; pts: P2[]; holding: boolean; life: number }[];
};

export function createNetwork(rnd: () => number, density: Density) {
  const nodes: Node[] = [];
  const minGap = Math.cbrt((BOX[0] * BOX[1] * BOX[2]) / density.nodes) * .55;
  for (let tries = 0; nodes.length < density.nodes && tries < 30000; tries++) {
    const p: V3 = [(rnd() - .5) * BOX[0], (rnd() - .5) * BOX[1], (rnd() - .5) * BOX[2]];
    if (nodes.some((n) => dist(n.home, p) < minGap)) continue;
    nodes.push({ home: p, ph: [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], sp: .12 + rnd() * .14, w: 0, busy: false });
  }

  // Faint edges between near neighbours, at most 3 per node. The reach is ~20% longer than the
  // old 2.6 gaps, measured on the base density so the extra nodes on large screens don't shrink it.
  const reach = Math.cbrt((BOX[0] * BOX[1] * BOX[2]) / density.base) * .55 * 2.6 * 1.2;
  const edges: [number, number][] = [];
  const deg = nodes.map(() => 0);
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const d = dist(nodes[i].home, nodes[j].home);
    if (d < reach) pairs.push([i, j, d]);
  }
  pairs.sort((a, b) => a[2] - b[2]);
  for (const [i, j] of pairs) if (deg[i] < 3 && deg[j] < 3) { edges.push([i, j]); deg[i]++; deg[j]++; }
  const adj = nodes.map((_, i) => edges.map((e, k) => [e, k] as const).filter(([e]) => e[0] === i || e[1] === i));
  const dots = Array.from({ length: density.dots }, () => ({ e: (rnd() * edges.length) | 0, t: rnd(), s: .18 + rnd() * .22, f: rnd() < .5 }));

  let formations: Formation[] = [];
  /**
   * The live screen's check-in nodes, a layer of their own (never part of the ambient web or its
   * blocks). `t0` is when it arrived (-Infinity for ones already there when the screen opened).
   */
  const checkins: { home: V3; from: V3; ph: V3; t0: number }[] = [];
  let walkDir = rnd() * Math.PI * 2;
  let nextAt = -1;
  let lastNow = 0;
  let snap: Snapshot = { sp: [], w: [], blocks: [] };

  function start(now: number, sp: P2[], o: DrawOpts) {
    const { W, H } = o;
    const ok = (i: number) => { const q = sp[i]; return !nodes[i].busy && q[0] > 40 && q[0] < W - 40 && q[1] > 90 && q[1] < H - 60 && !o.blocked(q[0], q[1]); };
    // The block forms where an eligible seed node is; its 7 nearest free neighbours gather to it.
    let seeds = nodes.map((_, i) => i).filter(ok);
    const nr = o.near;
    if (nr) { const close = seeds.filter((i) => Math.hypot(sp[i][0] - nr.x, sp[i][1] - nr.y) < nr.r); if (close.length) seeds = close; }
    // A few tries: the whole block (where its nodes are now and the cube they'll form) must stay
    // clear of copy, not just its seed, so no edge ever crosses text.
    for (let tries = 0; tries < 8 && seeds.length; tries++) {
      const seed = seeds[(rnd() * seeds.length) | 0];
      const group = nodes.map((_, i) => i).filter((i) => !nodes[i].busy)
        .sort((a, b) => dist(nodes[a].home, nodes[seed].home) - dist(nodes[b].home, nodes[seed].home)).slice(0, 8);
      if (group.length < 8) return false;
      const c = nodes[seed].home;
      const s = .9;
      const verts = CUBE_V.map((v): V3 => [c[0] + (v[0] - .5) * s, c[1] + (v[1] - .5) * s, c[2] + (v[2] - .5) * s]);
      if (o.boxBlocked(boxOf([...verts.map(o.P), ...group.map((i) => sp[i])]))) { seeds = seeds.filter((i) => i !== seed); continue; }
      // Each vertex takes the nearest node still free.
      const free = new Set(group), assigned: number[] = [];
      for (const v of verts) {
        let best = -1, bd = 1e9;
        for (const i of free) { const d = dist(nodes[i].home, v); if (d < bd) { bd = d; best = i; } }
        free.delete(best); assigned.push(best); nodes[best].busy = true;
      }
      formations.push({ nodes: assigned, verts, t0: now });
      return true;
    }
    return false;
  }

  function draw(ctx: CanvasRenderingContext2D, o: DrawOpts) {
    const { now, el, reduce, P, H } = o;
    // The live screen dims the ambient network so check-ins stand out (o.ambient < 1).
    const gk = o.gk * (o.ambient ?? 1);
    // A long pause (hidden tab) shouldn't fast-forward formations.
    if (now - lastNow > 500) for (const f of formations) f.t0 += now - lastNow;
    lastNow = now;
    if (nextAt < 0) nextAt = now + 1200 + rnd() * 1500;

    // Formation weight per node: 0 drifting, 1 sitting on a cube vertex.
    for (const n of nodes) n.w = 0;
    const live: { f: Formation; t: number }[] = [];
    formations = formations.filter((f) => {
      const t = now - f.t0;
      if (t >= END) { for (const i of f.nodes) nodes[i].busy = false; return false; }
      const w = t < GATHER ? ease(t / GATHER) : t < HOLD_END ? 1 : 1 - ease((t - HOLD_END) / RELAX);
      for (const i of f.nodes) nodes[i].w = w;
      live.push({ f, t });
      return true;
    });

    const pos = nodes.map((n, i): V3 => {
      const d: V3 = reduce ? n.home : [
        n.home[0] + Math.sin(el * n.sp + n.ph[0]) * .3,
        n.home[1] + Math.sin(el * n.sp * .8 + n.ph[1]) * .24,
        n.home[2] + Math.sin(el * n.sp * .9 + n.ph[2]) * .3,
      ];
      if (!n.w) return d;
      const f = formations.find((x) => x.nodes.includes(i))!, v = f.verts[f.nodes.indexOf(i)];
      return [d[0] + (v[0] - d[0]) * n.w, d[1] + (v[1] - d[1]) * n.w, d[2] + (v[2] - d[2]) * n.w];
    });
    const sp = pos.map(P);
    const depth = (z: number) => clamp01((z + BOX[2] / 2) / BOX[2]);
    const dim = sp.map((q) => o.fade(q[0], q[1]));
    // The layer wraps vertically as the page scrolls: skip edges that straddle the seam.
    const near = (a: number, b: number) => Math.abs(sp[a][1] - sp[b][1]) < H * .4;

    if (!reduce && formations.length < density.maxFormations && now >= nextAt) {
      nextAt = start(now, sp, o) ? now + 3000 + rnd() * 2000 : now + 700;
    }

    // A block's nodes share one opacity (its faintest node's), so a block never shows bright,
    // loose nodes next to faded edges; a block split by the wrap seam hides its nodes.
    const blockDim = new Map<number, number>();
    for (const { f } of live) {
      const split = f.nodes.some((i) => Math.abs(sp[i][1] - sp[f.nodes[0]][1]) > H * .4);
      // ...and the whole block fades out before any part of it reaches copy.
      const m = split ? 0 : Math.min(o.boxFade(boxOf(f.nodes.map((i) => sp[i]))), ...f.nodes.map((i) => dim[i]));
      for (const i of f.nodes) blockDim.set(i, m);
    }

    // network edges (fade out while their nodes are part of a block)
    ctx.lineWidth = 1;
    const eb = batch();
    for (const [a, b] of edges) {
      const A = sp[a], B = sp[b], k = 1 - Math.max(nodes[a].w, nodes[b].w);
      if (k <= 0 || !near(a, b) || o.crossesSolid(A, B)) continue;
      const p = eb.path((.06 + .13 * depth((A[2] + B[2]) / 2)) * k * gk * Math.min(dim[a], dim[b]));
      if (p) { p.moveTo(A[0], A[1]); p.lineTo(B[0], B[1]); }
    }
    eb.stroke(ctx, "185,138,232");
    // nodes
    const nb = batch();
    for (let i = 0; i < sp.length; i++) {
      const q = sp[i], dz = depth(q[2]), w = nodes[i].w;
      const p = nb.path((.2 + .38 * dz + .3 * w) * gk * (blockDim.get(i) ?? dim[i]));
      if (p) dot(p, q[0], q[1], 1 + 1.1 * dz + .6 * w);
    }
    nb.fill(ctx, "216,194,240");
    // dots travelling along network edges
    if (!reduce) {
      const db = batch();
      for (const d of dots) {
        d.t += d.s / 60;
        let [a, b] = edges[d.e]; if (d.f) [a, b] = [b, a];
        if (d.t >= 1) {
          const nx = adj[b].filter(([, k]) => k !== d.e);
          const [e, k] = nx.length ? nx[(rnd() * nx.length) | 0] : [edges[d.e], d.e] as const;
          d.e = k; d.f = e[1] === b; d.t = 0; [a, b] = d.f ? [e[1], e[0]] : [e[0], e[1]];
        }
        if (Math.max(nodes[a].w, nodes[b].w) > 0 || !near(a, b) || o.crossesSolid(sp[a], sp[b])) continue;
        const A = sp[a], B = sp[b], p = db.path(.6 * gk * Math.min(dim[a], dim[b]));
        if (p) dot(p, A[0] + (B[0] - A[0]) * d.t, A[1] + (B[1] - A[1]) * d.t, 1.5);
      }
      db.fill(ctx, "233,219,248");
    }
    snap = { sp, w: nodes.map((n) => n.w), blocks: [] };
    // forming blocks
    for (const { f, t } of live) {
      const vs = f.nodes.map((i) => sp[i]);
      if (vs.some((q) => Math.abs(q[1] - vs[0][1]) > H * .4)) continue; // split by the wrap seam
      // fades out entirely when the page scrolls copy over it
      const life = (t < HOLD_END ? 1 : 1 - ease((t - HOLD_END) / RELAX)) * (blockDim.get(f.nodes[0]) ?? 1);
      snap.blocks.push({ id: f, pts: vs, holding: t > EDGES_END + GLOW && t < HOLD_END - 900, life });
      const glow = t > EDGES_END && t < EDGES_END + GLOW ? Math.sin(Math.PI * (t - EDGES_END) / GLOW) : 0;
      const built = clamp01((t - EDGES_END) / 200);
      ctx.save();
      // faint top face once the block is complete, brighter during the glow
      if (built > 0) {
        ctx.fillStyle = `rgba(155,77,219,${(.1 * built + .22 * glow) * life * gk})`;
        ctx.beginPath(); CUBE_TOP.forEach((n, j) => { const q = vs[n]; if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
      }
      ctx.lineWidth = 1; ctx.lineCap = "round";
      // Faint edges hold the block's nodes together the whole time: while they gather (as the
      // network edges they leave fade out), while its edges draw, and while it relaxes.
      const w = nodes[f.nodes[0]].w;
      ctx.strokeStyle = `rgba(200,164,238,${(.08 + .16 * w) * life * gk})`;
      ctx.beginPath();
      for (const [a, b] of CUBE_E) { ctx.moveTo(vs[a][0], vs[a][1]); ctx.lineTo(vs[b][0], vs[b][1]); }
      ctx.stroke();
      ctx.lineWidth = 1.2;
      if (glow > 0) { ctx.shadowColor = "rgba(185,120,240,.9)"; ctx.shadowBlur = 14 * glow; }
      CUBE_E.forEach(([a, b], k) => {
        const p = clamp01((t - GATHER - k * EDGE) / EDGE);
        if (p <= 0) return;
        const A = vs[a], B = vs[b], x = A[0] + (B[0] - A[0]) * p, y = A[1] + (B[1] - A[1]) * p;
        ctx.strokeStyle = `rgba(226,204,248,${(.34 + .4 * glow) * life * gk})`;
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(x, y); ctx.stroke();
        if (p < 1) { // the dot racing along the edge being drawn
          ctx.fillStyle = `rgba(245,238,251,${.9 * gk * life})`;
          ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.restore();
    }
     if (checkins.length) drawCheckins(ctx, o);
  }

  /** A check-in node's world position now: at the centre while it arrives, then drifting home. */
  function checkinPos(c: (typeof checkins)[number], now: number, el: number, reduce: boolean): V3 {
    const sway = (n: number) => (reduce ? 0 : Math.sin(el * .2 + c.ph[n]) * .18);
    const home: V3 = [c.home[0] + sway(0), c.home[1] + sway(1), c.home[2] + sway(2)];
    if (reduce) return home;
    const t = now - c.t0;
    if (t <= CI_HOLD) return c.from;
    const k = ease((t - CI_HOLD) / CI_DRIFT);
    return [c.from[0] + (home[0] - c.from[0]) * k, c.from[1] + (home[1] - c.from[1]) * k, c.from[2] + (home[2] - c.from[2]) * k];
  }

  /**
   * The evening's chain: violet nodes about twice the ambient size, each linked to the previous
   * one, always bright. A new one ripples and glows at the centre, then drifts to its place while
   * its link draws in. Under reduced motion it simply fades in at its place.
   */
  function drawCheckins(ctx: CanvasRenderingContext2D, o: DrawOpts) {
    const { now, el, reduce, P, gk } = o;
    const sp = checkins.map((c) => P(checkinPos(c, now, el, reduce)));
    const age = (c: (typeof checkins)[number]) => now - c.t0;
    // fade-in (reduced motion) or a quick appear; links show once a node has started to drift
    const vis = checkins.map((c) => (reduce ? Math.min(1, age(c) / CI_FADE) : Math.min(1, age(c) / 250)));
    const linkK = checkins.map((c) => (reduce ? Math.min(1, age(c) / CI_FADE) : Math.min(1, Math.max(0, (age(c) - CI_HOLD) / CI_DRIFT))));
    ctx.save();
    ctx.lineCap = "round";
    // links: previous → this, drawn in as this one drifts into place
    for (let i = 1; i < checkins.length; i++) {
      const k = linkK[i];
      if (k <= 0) continue;
      const A = sp[i - 1], B = sp[i];
      ctx.strokeStyle = `rgba(185,120,240,${.55 * gk * Math.min(vis[i - 1], 1)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]);
      ctx.lineTo(A[0] + (B[0] - A[0]) * (reduce ? 1 : k), A[1] + (B[1] - A[1]) * (reduce ? 1 : k));
      ctx.stroke();
    }
    checkins.forEach((c, i) => {
      const q = sp[i], t = age(c), a = vis[i] * gk;
      const arriving = !reduce && t < CI_HOLD + CI_DRIFT;
      // ripple: two rings expanding from the centre during the hold
      if (arriving && t < CI_HOLD) {
        for (const off of [0, 700]) {
          const r = (t - off) / (CI_HOLD - 700);
          if (r <= 0 || r >= 1) continue;
          ctx.strokeStyle = `rgba(216,170,250,${.8 * (1 - r) * gk})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(q[0], q[1], 10 + 120 * ease(r), 0, Math.PI * 2); ctx.stroke();
        }
      }
      // glow: strong while arriving, then a steady halo for the rest of the evening
      const glow = arriving ? 1 - Math.max(0, (t - CI_HOLD) / CI_DRIFT) * .65 : .35;
      ctx.fillStyle = `rgba(155,77,219,${.28 * glow * a})`;
      ctx.beginPath(); ctx.arc(q[0], q[1], 9 + 14 * (arriving ? glow : 0), 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = "rgba(185,120,240,.95)"; ctx.shadowBlur = (arriving ? 26 : 12) * a;
      ctx.fillStyle = `rgba(214,176,247,${a})`;
      ctx.beginPath(); ctx.arc(q[0], q[1], arriving ? 4 + 2 * glow : 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  /** Whether a check-in is still animating (the engine keeps drawing, even under reduced motion's fade). */
  const animating = (now: number, reduce: boolean) => checkins.some((c) => now - c.t0 < (reduce ? CI_FADE : CI_HOLD + CI_DRIFT));

  /**
   * One check-in (live screen). Its place is the next step of a meandering walk across the screen,
   * so the evening's arrivals form their own chain. `quiet`: already there when the screen opened
   * (no arrival moment).
   */
  function arrive(now: number, quiet = false) {
    const lim: V3 = [BOX[0] * .4, BOX[1] * .34, BOX[2] * .25];
    const prev = checkins[checkins.length - 1]?.home;
    let home: V3;
    if (!prev) home = [(rnd() - .5) * BOX[0] * .3, (rnd() - .5) * BOX[1] * .3, 0];
    else {
      walkDir += (rnd() - .5) * 2.1;
      // Out past ~55% of the frame, turn halfway back toward the middle: the chain wanders across
      // the screen instead of hugging an edge.
      if (Math.hypot(prev[0] / lim[0], prev[1] / lim[1]) > .55) {
        const back = Math.atan2(-prev[1], -prev[0]);
        walkDir += Math.atan2(Math.sin(back - walkDir), Math.cos(back - walkDir)) * .5;
      }
      const step = 2.3;
      home = [prev[0] + Math.cos(walkDir) * step, prev[1] + Math.sin(walkDir) * step * .8, (rnd() - .5) * BOX[2] * .3];
      // turn back at the edges, so the chain stays on screen
      for (const k of [0, 1] as const) if (Math.abs(home[k]) > lim[k]) {
        home[k] = Math.sign(home[k]) * lim[k] - (home[k] - Math.sign(home[k]) * lim[k]);
        walkDir = k === 0 ? Math.PI - walkDir : -walkDir;
      }
    }
    const from: V3 = [(rnd() - .5) * .6, (rnd() - .5) * .4, 2];
    checkins.push({ home, from, ph: [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], t0: quiet ? -Infinity : now });
  }

  /** The check-ins move to a rebuilt network (resize, member count), so the evening's chain survives. */
  const takeCheckins = (from: { checkins: typeof checkins; walkDir: number }) => { checkins.push(...from.checkins); walkDir = from.walkDir; };
  const exportCheckins = () => ({ checkins, walkDir });

  return { draw, density, snapshot: () => snap, arrive, animating, exportCheckins, takeCheckins };
}
