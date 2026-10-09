// The hero logo as the network's core. Around the logo the network gets denser (a halo of
// extra nodes whose density falls off with distance, ~2–3x the page's near the logo, with
// more short edges), the nearest 8–12 nodes connect straight to the logo's outer vertices
// (re-picked as it turns and nodes drift), and dots keep flowing along those edges into and
// out of the logo. Every 10–15 s a block that forms nearby reaches out to the logo.
// Everything is drawn in the network's own style: solid edges, the same nodes and dots.
// Drawn by the backdrop engine (backdrop.ts) after the network and the painters.

import { batch, dot } from "./batch";
import type { Snapshot } from "./network";

/** The logo's vertices in viewport coordinates; `hull` marks the outer ones. */
export type Anchors = {
  pts: { x: number; y: number; hull: boolean }[];
  /** Logo centre and radius (screen px). */
  c: [number, number];
  r: number;
  /** Logo opacity (assembles on load, fades out over the Focus cards). */
  a: number;
};

const REPICK = 280, BRIDGE_GROW = 700, MAX_LINKS = 12; // with ~8 outer vertices x 3 candidates, 8–12 links
const ease = (t: number) => { const x = Math.min(Math.max(t, 0), 1); return 1 - Math.pow(1 - x, 3); };
const depth = (z: number) => z; // halo nodes carry depth 0..1 directly

type Halo = { rho: number; th: number; z: number; ph: number; sp: number };
type Link = { k: string; v: number; from: number; on: boolean; a: number; t: number; s: number; inward: boolean };
type Dot = { e: number; t: number; s: number; f: boolean };
type Bridge = { id: object; t0: number; dot: number };

// A link's far end: a halo node (index) or a background node (-1 - index).
const isBg = (n: number) => n < 0;

export function createCore(rnd: () => number) {
  let halo: Halo[] = [], haloEdges: [number, number][] = [], haloAdj: number[][] = [], dots: Dot[] = [];
  const links = new Map<string, Link>();
  let outer: [number, number][] = []; // halo node → background node
  let pickedAt = -1e9;
  let bridge: Bridge | null = null, nextBridge = -1, seekUntil = 0;

  /** (Re)build the halo for a node count (scales with the page's density, so phones get fewer). */
  function build(n: number) {
    halo = [];
    for (let tries = 0; halo.length < n && tries < n * 40; tries++) {
      // radius in logo radii: 1.12 at the logo to 2.3 at the halo's edge, denser near the logo
      const u = rnd(), rho = 1.12 + 1.18 * u * u, th = rnd() * Math.PI * 2;
      const p = { rho, th, z: rnd(), ph: rnd() * 6.28, sp: .15 + rnd() * .2 };
      const x = Math.cos(th) * rho, y = Math.sin(th) * rho * .85;
      if (halo.some((h) => Math.hypot(Math.cos(h.th) * h.rho - x, Math.sin(h.th) * h.rho * .85 - y) < .17 + .07 * rho)) continue;
      halo.push(p);
    }
    // short edges between near neighbours, at most 3 per node
    const pos = halo.map((h) => [Math.cos(h.th) * h.rho, Math.sin(h.th) * h.rho * .85]);
    const pairs: [number, number, number][] = [];
    for (let i = 0; i < halo.length; i++) for (let j = i + 1; j < halo.length; j++) {
      const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
      if (d < .55) pairs.push([i, j, d]);
    }
    pairs.sort((a, b) => a[2] - b[2]);
    const deg = halo.map(() => 0);
    haloEdges = [];
    for (const [i, j] of pairs) if (deg[i] < 3 && deg[j] < 3) { haloEdges.push([i, j]); deg[i]++; deg[j]++; }
    haloAdj = halo.map((_, i) => haloEdges.map((e, k) => (e[0] === i || e[1] === i ? k : -1)).filter((k) => k >= 0));
    // more traffic near the core than in the rest of the network
    dots = haloEdges.length ? Array.from({ length: Math.round(halo.length * .45) }, () => ({ e: (rnd() * haloEdges.length) | 0, t: rnd(), s: .3 + rnd() * .3, f: rnd() < .5 })) : [];
    links.clear(); outer = [];
  }

  /** Where the network should prefer to form its next block (near the logo when a bridge is due). */
  function wantNear(now: number, anc: Anchors | null) {
    return anc && seekUntil > now ? { x: anc.c[0], y: anc.c[1], r: anc.r * 2.4 + 240 } : null;
  }

  function draw(
    ctx: CanvasRenderingContext2D, now: number, el: number, reduce: boolean, gk: number,
    net: Snapshot, anc: Anchors | null, count: number, fade: (x: number, y: number) => number,
  ) {
    if (!anc || anc.a < .01 || !net.sp.length) { links.clear(); bridge = null; return; }
    if (Math.abs(count - halo.length) > Math.max(3, count * .15) || !halo.length) build(count);
    const [cx, cy] = anc.c, R = anc.r, A = anc.a * gk;

    // halo node positions, drifting a little
    const hp = halo.map((h) => {
      const d = reduce ? 0 : Math.sin(el * h.sp + h.ph) * .06;
      return [cx + Math.cos(h.th + d * .5) * (h.rho + d) * R, cy + Math.sin(h.th + d * .5) * (h.rho + d) * R * .85] as [number, number];
    });
    const hf = hp.map((p) => fade(p[0], p[1]) * A);
    const end = (n: number): [number, number] => (isBg(n) ? [net.sp[-1 - n][0], net.sp[-1 - n][1]] : hp[n]);

    if (reduce || now - pickedAt > REPICK) {
      pickedAt = now;
      // the nearest 8–12 nodes (halo or background) to the logo's outer vertices, outward of it
      const cand: { v: number; n: number; d: number }[] = [];
      anc.pts.forEach((p, v) => {
        if (!p.hull) return;
        const ox = p.x - cx, oy = p.y - cy;
        const near: { n: number; d: number }[] = [];
        const consider = (n: number, x: number, y: number) => {
          const dx = x - p.x, dy = y - p.y;
          if (dx * ox + dy * oy <= 0 || Math.hypot(x - cx, y - cy) < R * 1.1) return;
          const d = Math.hypot(dx, dy);
          if (d < R * 1.8) near.push({ n, d });
        };
        hp.forEach((q, n) => consider(n, q[0], q[1]));
        net.sp.forEach((q, n) => { if (!net.w[n]) consider(-1 - n, q[0], q[1]); });
        near.sort((a, b) => a.d - b.d);
        for (const c of near.slice(0, 3)) cand.push({ v, ...c });
      });
      cand.sort((a, b) => a.d - b.d);
      // first the nearest node for every outer vertex, then the next nearest overall, up to 12
      const used = new Set<number>(), served = new Set<number>(), want = new Set<string>();
      const take = (c: (typeof cand)[number]) => { used.add(c.n); served.add(c.v); want.add(`${c.v}:${c.n}`); };
      for (const c of cand) if (want.size < MAX_LINKS && !served.has(c.v) && !used.has(c.n)) take(c);
      for (const c of cand) if (want.size < MAX_LINKS && !used.has(c.n)) take(c);
      for (const k of want) if (!links.has(k)) {
        const [v, n] = k.split(":").map(Number);
        links.set(k, { k, v, from: n, on: true, a: 0, t: rnd(), s: .45 + rnd() * .4, inward: rnd() < .5 });
      }
      for (const l of links.values()) l.on = want.has(l.k);
      // the halo's outer nodes join the rest of the network
      outer = [];
      halo.forEach((h, i) => {
        if (h.rho < 1.75) return;
        let best = -1, bd = R * .9;
        net.sp.forEach((q, n) => { const d = Math.hypot(q[0] - hp[i][0], q[1] - hp[i][1]); if (d < bd && !net.w[n]) { bd = d; best = n; } });
        if (best >= 0) outer.push([i, best]);
      });
    }

    ctx.save(); ctx.lineWidth = 1; ctx.lineCap = "round";
    // halo edges, then its ties into the network: the network's edge style, a little stronger near the core
    const eb = batch();
    for (const [a, b] of haloEdges) {
      const path = eb.path((.1 + .12 * depth((halo[a].z + halo[b].z) / 2)) * Math.min(hf[a], hf[b]));
      if (path) { path.moveTo(hp[a][0], hp[a][1]); path.lineTo(hp[b][0], hp[b][1]); }
    }
    for (const [i, n] of outer) {
      const q = net.sp[n];
      if (Math.abs(q[1] - hp[i][1]) > R * 2) continue;
      const path = eb.path(.1 * hf[i]);
      if (path) { path.moveTo(hp[i][0], hp[i][1]); path.lineTo(q[0], q[1]); }
    }
    eb.stroke(ctx, "185,138,232");
    // links into the logo's vertices (stopping at the vertex's node)
    for (const l of links.values()) {
      l.a = reduce ? (l.on ? 1 : 0) : l.a + ((l.on ? 1 : 0) - l.a) * .08;
      if (!l.on && l.a < .01) { links.delete(l.k); continue; }
      const p = anc.pts[l.v];
      if (!p || (isBg(l.from) ? !net.sp[-1 - l.from] : !hp[l.from])) { links.delete(l.k); continue; }
      const q = end(l.from);
      const len = Math.hypot(p.x - q[0], p.y - q[1]);
      if (len > R * 3.2 || len < 4) { links.delete(l.k); continue; } // a node that wrapped to the other edge
      const f = fade(q[0], q[1]);
      const ux = (p.x - q[0]) / len, uy = (p.y - q[1]) / len, tx = p.x - ux * 3, ty = p.y - uy * 3;
      ctx.strokeStyle = `rgba(200,164,238,${.26 * l.a * A * Math.max(f, .5)})`;
      ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(tx, ty); ctx.stroke();
      if (reduce) continue;
      // a dot runs into the logo, then back out, without pausing: the core is always busy
      l.t += l.s / 60;
      if (l.t >= 1) { l.t = 0; l.inward = !l.inward; }
      const k = l.inward ? l.t : 1 - l.t;
      ctx.fillStyle = `rgba(233,219,248,${.75 * l.a * A * Math.min(1, (1 - k) * 8)})`;
      ctx.beginPath(); ctx.arc(q[0] + (tx - q[0]) * k, q[1] + (ty - q[1]) * k, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    // halo nodes, in the network's node style
    const nb = batch();
    halo.forEach((h, i) => {
      const dz = depth(h.z), path = nb.path((.24 + .38 * dz) * hf[i]);
      if (path) dot(path, hp[i][0], hp[i][1], 1 + 1.1 * dz);
    });
    nb.fill(ctx, "216,194,240");
    // dots wandering the halo
    if (!reduce) {
      for (const d of dots) {
        d.t += d.s / 60;
        let [a, b] = haloEdges[d.e]; if (d.f) [a, b] = [b, a];
        if (d.t >= 1) {
          const nx = haloAdj[b].filter((k) => k !== d.e), k = nx.length ? nx[(rnd() * nx.length) | 0] : d.e;
          d.e = k; d.f = haloEdges[k][1] === b; d.t = 0; [a, b] = d.f ? [haloEdges[k][1], haloEdges[k][0]] : haloEdges[k];
        }
        ctx.fillStyle = `rgba(233,219,248,${.6 * Math.min(hf[a], hf[b])})`;
        ctx.beginPath(); ctx.arc(hp[a][0] + (hp[b][0] - hp[a][0]) * d.t, hp[a][1] + (hp[b][1] - hp[a][1]) * d.t, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // A nearby block reaches out to the logo, every 10–15 s (a solid edge, like any other).
    if (!reduce) {
      if (nextBridge < 0) nextBridge = now + 5000 + rnd() * 4000;
      if (!bridge && now >= nextBridge) {
        if (!seekUntil) seekUntil = now + 9000;
        const reach = R * 2.4 + 320;
        const b = net.blocks.find((f) => f.holding && Math.hypot(f.pts[0][0] - cx, f.pts[0][1] - cy) < reach);
        if (b) bridge = { id: b.id, t0: now, dot: 0 };
        if (b || now > seekUntil) { seekUntil = 0; nextBridge = now + 10000 + rnd() * 5000; }
      }
      const b = bridge && net.blocks.find((f) => f.id === bridge!.id);
      if (bridge && !b) bridge = null;
      if (bridge && b && b.life > .01) {
        let from = b.pts[0], fd = 1e9;
        for (const q of b.pts) { const d = Math.hypot(q[0] - cx, q[1] - cy); if (d < fd) { fd = d; from = q; } }
        let to = anc.pts[0], td = 1e9;
        for (const p of anc.pts) { if (!p.hull) continue; const d = Math.hypot(p.x - from[0], p.y - from[1]); if (d < td) { td = d; to = p; } }
        const g = ease((now - bridge.t0) / BRIDGE_GROW), x = from[0] + (to.x - from[0]) * g, y = from[1] + (to.y - from[1]) * g;
        const al = b.life * A;
        ctx.strokeStyle = `rgba(200,164,238,${.3 * al})`;
        ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = `rgba(245,238,251,${.85 * al})`;
        if (g < 1) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
        else {
          bridge.dot = (bridge.dot + 1 / 60 / 1.1) % 1;
          const f = bridge.dot;
          ctx.beginPath(); ctx.arc(from[0] + (to.x - from[0]) * f, from[1] + (to.y - from[1]) * f, 1.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  return { draw, wantNear };
}
