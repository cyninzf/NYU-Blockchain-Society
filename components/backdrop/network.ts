// The site background: a drifting constellation (nodes, faint edges between near neighbours,
// small dots travelling along edges) that every 3–5 seconds pulls 8 nearby nodes into an
// isometric cube, draws its 12 edges one by one, glows ("block confirmed"), holds, then lets
// the nodes relax back into the network. Drawn by the backdrop engine (backdrop.ts) into the
// one fixed canvas behind every page.

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

/** Density for a viewport: ~140 nodes and ~27 dots at 1440×900, scaled by area; phones get half. */
export function densityFor(W: number, H: number) {
  const phone = W < 700;
  const nodes = Math.round(Math.min(230, Math.max(26, 140 * (W * H) / (1440 * 900) * (phone ? .5 : 1))));
  return { nodes, dots: Math.round(nodes * .19), maxFormations: phone ? 1 : 3 };
}
export type Density = ReturnType<typeof densityFor>;

const ease = (t: number) => { const x = Math.min(Math.max(t, 0), 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

type Node = { home: V3; ph: V3; sp: number; w: number; busy: boolean };
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
};

export function createNetwork(rnd: () => number, density: Density) {
  const nodes: Node[] = [];
  const minGap = Math.cbrt((BOX[0] * BOX[1] * BOX[2]) / density.nodes) * .55;
  for (let tries = 0; nodes.length < density.nodes && tries < 30000; tries++) {
    const p: V3 = [(rnd() - .5) * BOX[0], (rnd() - .5) * BOX[1], (rnd() - .5) * BOX[2]];
    if (nodes.some((n) => dist(n.home, p) < minGap)) continue;
    nodes.push({ home: p, ph: [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], sp: .12 + rnd() * .14, w: 0, busy: false });
  }

  // Faint edges between near neighbours, at most 3 per node.
  const reach = minGap * 2.6;
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
  let nextAt = -1;
  let lastNow = 0;

  function start(now: number, sp: P2[], o: DrawOpts) {
    const { W, H } = o;
    const ok = (i: number) => { const q = sp[i]; return !nodes[i].busy && q[0] > 40 && q[0] < W - 40 && q[1] > 90 && q[1] < H - 60 && !o.blocked(q[0], q[1]); };
    // The block forms where an eligible seed node is; its 7 nearest free neighbours gather to it.
    const seeds = nodes.map((_, i) => i).filter(ok);
    if (!seeds.length) return false;
    const seed = seeds[(rnd() * seeds.length) | 0];
    const group = nodes.map((_, i) => i).filter((i) => !nodes[i].busy)
      .sort((a, b) => dist(nodes[a].home, nodes[seed].home) - dist(nodes[b].home, nodes[seed].home)).slice(0, 8);
    if (group.length < 8) return false;
    const c = nodes[seed].home;
    const s = .9;
    const verts = CUBE_V.map((v): V3 => [c[0] + (v[0] - .5) * s, c[1] + (v[1] - .5) * s, c[2] + (v[2] - .5) * s]);
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

  function draw(ctx: CanvasRenderingContext2D, o: DrawOpts) {
    const { now, el, reduce, gk, P, H } = o;
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

    // network edges (fade out while their nodes are part of a block)
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      const A = sp[a], B = sp[b], k = 1 - Math.max(nodes[a].w, nodes[b].w);
      if (k <= 0 || !near(a, b)) continue;
      ctx.strokeStyle = `rgba(185,138,232,${(.06 + .13 * depth((A[2] + B[2]) / 2)) * k * gk * Math.min(dim[a], dim[b])})`;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
    }
    // nodes
    for (let i = 0; i < sp.length; i++) {
      const q = sp[i], dz = depth(q[2]), w = nodes[i].w;
      ctx.fillStyle = `rgba(216,194,240,${(.2 + .38 * dz + .3 * w) * gk * Math.max(dim[i], w)})`;
      ctx.beginPath(); ctx.arc(q[0], q[1], 1 + 1.1 * dz + .6 * w, 0, Math.PI * 2); ctx.fill();
    }
    // dots travelling along network edges
    if (!reduce) {
      ctx.fillStyle = `rgba(233,219,248,${.6 * gk})`;
      for (const d of dots) {
        d.t += d.s / 60;
        let [a, b] = edges[d.e]; if (d.f) [a, b] = [b, a];
        if (d.t >= 1) {
          const nx = adj[b].filter(([, k]) => k !== d.e);
          const [e, k] = nx.length ? nx[(rnd() * nx.length) | 0] : [edges[d.e], d.e] as const;
          d.e = k; d.f = e[1] === b; d.t = 0; [a, b] = d.f ? [e[1], e[0]] : [e[0], e[1]];
        }
        if (Math.max(nodes[a].w, nodes[b].w) > 0 || !near(a, b)) continue;
        const A = sp[a], B = sp[b];
        ctx.globalAlpha = Math.min(dim[a], dim[b]);
        ctx.beginPath(); ctx.arc(A[0] + (B[0] - A[0]) * d.t, A[1] + (B[1] - A[1]) * d.t, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // forming blocks
    for (const { f, t } of live) {
      const vs = f.nodes.map((i) => sp[i]);
      if (vs.some((q) => Math.abs(q[1] - vs[0][1]) > H * .4)) continue; // split by the wrap seam
      // fades like the rest of the network when the page scrolls copy over it
      const life = (t < HOLD_END ? 1 : 1 - ease((t - HOLD_END) / RELAX)) * Math.min(...f.nodes.map((i) => dim[i]));
      const glow = t > EDGES_END && t < EDGES_END + GLOW ? Math.sin(Math.PI * (t - EDGES_END) / GLOW) : 0;
      const built = clamp01((t - EDGES_END) / 200);
      ctx.save();
      // faint top face once the block is complete, brighter during the glow
      if (built > 0) {
        ctx.fillStyle = `rgba(155,77,219,${(.1 * built + .22 * glow) * life * gk})`;
        ctx.beginPath(); CUBE_TOP.forEach((n, j) => { const q = vs[n]; if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
      }
      ctx.lineWidth = 1.2; ctx.lineCap = "round";
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
  }

  return { draw, density };
}
