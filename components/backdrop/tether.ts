// Ties the hero logo into the background network: 4–6 faint edges from the logo's outer
// vertices to the nearest constellation nodes (re-picked as the logo turns and the nodes
// drift), with dots running along them into and out of the logo. Every 10–15 s a block that
// forms near the logo reaches out to it with a connecting edge before it relaxes.
// Drawn by the backdrop engine (backdrop.ts) after the network and the painters.

import type { Snapshot } from "./network";

/** The logo's vertices in viewport coordinates; `hull` marks the outer ones. */
export type Anchors = {
  pts: { x: number; y: number; hull: boolean }[];
  /** Logo centre and radius (screen px). */
  c: [number, number];
  r: number;
  /** Logo opacity (fades in on load, out over the Focus cards). */
  a: number;
};

const MAX_LINKS = 6, REPICK = 280, BRIDGE_GROW = 700;
const ease = (t: number) => { const x = Math.min(Math.max(t, 0), 1); return 1 - Math.pow(1 - x, 3); };

type Link = { v: number; n: number; a: number; t: number; s: number; inward: boolean; wait: number };
type Bridge = { id: object; t0: number; dot: number };

export function createTether(rnd: () => number) {
  const links = new Map<string, Link>();
  let pickedAt = -1e9, target = new Set<string>();
  let bridge: Bridge | null = null, nextBridge = -1, seekUntil = 0;

  function pick(net: Snapshot, anc: Anchors) {
    const [cx, cy] = anc.c, maxLen = Math.max(150, anc.r * 2.2);
    const cand: { k: string; v: number; n: number; d: number }[] = [];
    anc.pts.forEach((p, v) => {
      if (!p.hull) return;
      const ox = p.x - cx, oy = p.y - cy;
      let best = -1, bd = maxLen;
      for (let n = 0; n < net.sp.length; n++) {
        if (net.w[n] > 0) continue; // part of a forming block
        const q = net.sp[n], dx = q[0] - p.x, dy = q[1] - p.y;
        if (dx * ox + dy * oy <= 0) continue; // only outward of the logo
        if (Math.hypot(q[0] - cx, q[1] - cy) < anc.r * 1.1) continue;
        const d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = n; }
      }
      if (best >= 0) cand.push({ k: `${v}:${best}`, v, n: best, d: bd });
    });
    cand.sort((a, b) => a.d - b.d);
    const used = new Set<number>();
    target = new Set();
    for (const c of cand) {
      if (target.size >= MAX_LINKS || used.has(c.n)) continue;
      used.add(c.n); target.add(c.k);
      if (!links.has(c.k)) links.set(c.k, { v: c.v, n: c.n, a: 0, t: rnd(), s: .35 + rnd() * .3, inward: rnd() < .5, wait: 0 });
    }
  }

  /** Where the network should prefer to form its next block (near the logo when a bridge is due). */
  function wantNear(now: number, anc: Anchors | null) {
    return anc && seekUntil > now ? { x: anc.c[0], y: anc.c[1], r: anc.r * 2.4 + 280 } : null;
  }

  function draw(ctx: CanvasRenderingContext2D, now: number, reduce: boolean, gk: number, net: Snapshot, anc: Anchors | null) {
    if (!anc || anc.a < .01 || !net.sp.length) { links.clear(); target.clear(); bridge = null; return; }
    if (reduce || now - pickedAt > REPICK) { pick(net, anc); pickedAt = now; }
    const A = anc.a * gk;

    ctx.save(); ctx.lineWidth = 1; ctx.lineCap = "round";
    for (const [k, l] of links) {
      const on = target.has(k);
      l.a = reduce ? (on ? 1 : 0) : l.a + ((on ? 1 : 0) - l.a) * .07;
      if (!on && l.a < .01) { links.delete(k); continue; }
      const p = anc.pts[l.v], q = net.sp[l.n];
      // a node that just wrapped to the other edge of the screen: let the edge go
      if (!p || !q || Math.hypot(q[0] - p.x, q[1] - p.y) > Math.max(240, anc.r * 3.5)) { target.delete(k); continue; }
      ctx.strokeStyle = `rgba(216,194,240,${.2 * l.a * A})`;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q[0], q[1]); ctx.stroke();
      if (reduce) continue;
      // one dot per edge, running into the logo, then back out, with a short rest at each end
      if (l.wait > 0) { l.wait -= 1 / 60; continue; }
      l.t += l.s / 60;
      if (l.t >= 1) { l.t = 0; l.inward = !l.inward; l.wait = .4 + rnd() * 1.6; continue; }
      const f = l.inward ? l.t : 1 - l.t, x = q[0] + (p.x - q[0]) * f, y = q[1] + (p.y - q[1]) * f;
      ctx.fillStyle = `rgba(233,219,248,${.65 * l.a * A})`;
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // A nearby block reaches out to the logo, every 10–15 s.
    if (!reduce) {
      if (nextBridge < 0) nextBridge = now + 5000 + rnd() * 4000;
      if (!bridge && now >= nextBridge) {
        if (!seekUntil) seekUntil = now + 9000;
        const reach = anc.r * 2.4 + 340;
        const b = net.blocks.find((f) => f.holding && Math.hypot(f.pts[0][0] - anc.c[0], f.pts[0][1] - anc.c[1]) < reach);
        if (b) bridge = { id: b.id, t0: now, dot: 0 };
        if (b || now > seekUntil) { seekUntil = 0; nextBridge = now + 10000 + rnd() * 5000; }
      }
      const b = bridge && net.blocks.find((f) => f.id === bridge!.id);
      if (bridge && !b) bridge = null;
      if (bridge && b && b.life > .01) {
        // from the block's vertex nearest the logo to the logo's nearest outer vertex
        let from = b.pts[0], fd = 1e9;
        for (const q of b.pts) { const d = Math.hypot(q[0] - anc.c[0], q[1] - anc.c[1]); if (d < fd) { fd = d; from = q; } }
        let to = anc.pts[0], td = 1e9;
        for (const p of anc.pts) { if (!p.hull) continue; const d = Math.hypot(p.x - from[0], p.y - from[1]); if (d < td) { td = d; to = p; } }
        const g = ease((now - bridge.t0) / BRIDGE_GROW), x = from[0] + (to.x - from[0]) * g, y = from[1] + (to.y - from[1]) * g;
        const al = b.life * A;
        ctx.strokeStyle = `rgba(226,204,248,${.32 * al})`; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = `rgba(245,238,251,${.85 * al})`;
        if (g < 1) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
        else {
          // once connected, dots run from the block into the logo
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
