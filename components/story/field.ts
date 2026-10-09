// The hero's 3D field: the three-block logo inside a drifting network, drawn on a 2D canvas.
// Ported from the inline script in docs/prototype.html. The DOM it drives (headline words,
// Focus cards, caption) is rendered by React; this module only reads it and toggles classes.

import { industries } from "@/content/industries";
import { createNetwork, densityFor, type P2, type V3 } from "./network";

export type FieldElements = {
  canvas: HTMLCanvasElement;
  cap: HTMLElement;
  capTitle: HTMLElement;
  capText: HTMLElement;
  heroTxt: HTMLElement;
  words: HTMLElement[];
  /** Focus cards: hovering one lights its block. */
  cards: HTMLElement[];
  /** The Focus section: the logo moves above its cards while it's in view. */
  focus: HTMLElement;
  /** Copy that background blocks must not form behind. */
  avoid: HTMLElement[];
};

export type FieldOptions = {
  /** Called when a block is tapped (cube or headline word) while the join flow is open. */
  onToggle: (i: number) => void;
};

export type Field = {
  setJoining: (on: boolean) => void;
  setSelected: (blocks: number[]) => void;
  /** Join progress: `steps` completed steps draw that many nodes building toward the chain. */
  setProgress: (steps: number, blocks: number[]) => void;
  addMember: (name: string, blocks: number[], instant: boolean) => void;
  clearMember: () => void;
  destroy: () => void;
};

const key = (p: number[]) => p.join(",");
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

// The hover label is "mined" like a background block (ms from activation): its four corner
// nodes appear, its edges draw, a dot runs down the connector from the cube, then the text fades in.
const LBL_NODES = 110, LBL_EDGES = [70, 320], LBL_DOT = [220, 470], LBL_TEXT = 440;

export function createField(el: FieldElements, opts: FieldOptions): Field {
  const { canvas: cv, cap, capTitle, capText, heroTxt, words, cards, focus, avoid } = el;
  const ctx = cv.getContext("2d")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fontFamily = getComputedStyle(cv).fontFamily || "sans-serif";
  const INFO = industries;

  // --- logo: three cubes ---
  const cubes: V3[] = [[1, 0, 0], [0, 0, 1], [0, 1, 0]];
  const LV: V3[] = [], LI = new Map<string, number>(), LE = new Set<string>(), tops: number[][] = [], cubeV: Set<number>[] = [];
  const addL = (p: V3) => { const k = key(p); if (!LI.has(k)) { LI.set(k, LV.length); LV.push(p); } return LI.get(k)!; };
  for (const [cx, cy, cz] of cubes) {
    const id: Record<string, number> = {};
    for (const a of [0, 1]) for (const b of [0, 1]) for (const c of [0, 1]) id["" + a + b + c] = addL([cx + a, cy + b, cz + c]);
    for (const a in id) for (const b in id) { let d = 0; for (let i = 0; i < 3; i++) if (a[i] !== b[i]) d++; if (d === 1 && a < b) LE.add(id[a] + "-" + id[b]); }
    tops.push([id["010"], id["011"], id["111"], id["110"]]); cubeV.push(new Set(Object.values(id)));
  }
  const LEdges = [...LE].map((s) => s.split("-").map(Number) as [number, number]);

  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const C: V3 = [.8, .8, .8];
  const center = (p: V3): V3 => [p[0] - C[0], p[1] - C[1], p[2] - C[2]];
  const L0 = LV.map(center);

  // --- background: drifting constellation that periodically forms blocks (network.ts) ---
  // Density scales with the viewport; rebuilt in resize() when the size class changes.
  let network: ReturnType<typeof createNetwork> | null = null;
  // Text the blocks must not form behind: the hero copy, proof strip, mission and Focus cards.
  const copyRects = () => {
    const c = cv.getBoundingClientRect();
    return (capOn ? [...avoid, cap] : avoid).map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left - c.left, top: r.top - c.top, right: r.right - c.left, bottom: r.bottom - c.top };
    });
  };
  const Ls = L0.map((): V3 => [(rnd() - .5) * 9, (rnd() - .5) * 9, (rnd() - .5) * 9]);
  const ISO_YAW = Math.PI / 4, ISO_PITCH = Math.atan(1 / Math.SQRT2);
  let yaw = ISO_YAW, pitch = ISO_PITCH, tYaw = ISO_YAW, tPitch = ISO_PITCH, mx = 0, my = 0, smx = 0, smy = 0;

  let capOn = false, capA = 0, capW = 0, capH = 0, capT0 = -1e9, hero0 = { ox: 0, oy: 0, S: 1 }, side = { ox: 0, oy: 0, S: 1 }, focusPose = { ox: 0, oy: 0, S: 1 }, focusTop = 0;

  let active = -1, hover = -1, pinned = -1, wordHover = -1, cardHover = -1, lastUser = -1e9, centers: [number, number][] = [];
  const glow = [0, 0, 0];
  function setActive(i: number, showCap: boolean) {
    const c = i >= 0 && showCap; if (i === active && c === capOn) return;
    const fresh = c && (i !== active || !capOn); active = i; capOn = c;
    words.forEach((w, j) => w.classList.toggle("on", j === i));
    cap.classList.remove("show");
    if (fresh) {
      capTitle.textContent = `Focus ${String(i + 1).padStart(2, "0")} · ${INFO[i].name}`;
      capText.replaceChildren(...INFO[i].topics.map((t) => { const s = document.createElement("i"); s.textContent = t; return s; }));
      capW = cap.offsetWidth; capH = cap.offsetHeight; // measured once per change, not per frame
      capT0 = reduce ? -1e9 : performance.now();
    }
  }
  const kick = () => { if (reduce) frame(performance.now()); };

  let joining = false;
  let sel = new Set<number>();
  // `from` is a screen point when the block snaps in from the end of the join trail.
  let member: { pos: V3; from: [number, number] | null; links: number[]; blocks: number[]; name: string; t0: number } | null = null;
  let trail: { pos: V3; k: number; t: number[] } | null = null;
  let trailEnd: [number, number] | null = null;
  const TRAIL_F = [0, .3, .52, .7]; // where each step's node sits, from the outer start (0) to the member's spot (1)
  const lerp3 = (a: V3, b: V3, f: number): V3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

  const wordCleanups = words.map((w, i) => {
    const on = () => { wordHover = i; lastUser = performance.now(); kick(); };
    const off = () => { wordHover = -1; lastUser = performance.now(); kick(); };
    const click = () => { if (joining) { opts.onToggle(i); return; } pinned = pinned === i ? -1 : i; lastUser = performance.now(); kick(); };
    w.addEventListener("mouseenter", on); w.addEventListener("focus", on); w.addEventListener("mouseleave", off); w.addEventListener("blur", off); w.addEventListener("click", click);
    return () => { w.removeEventListener("mouseenter", on); w.removeEventListener("focus", on); w.removeEventListener("mouseleave", off); w.removeEventListener("blur", off); w.removeEventListener("click", click); };
  });

  // Focus cards light their block (no label: the card already says what it is).
  const cardCleanups = cards.map((c, i) => {
    const on = () => { cardHover = i; kick(); };
    const off = () => { if (cardHover === i) cardHover = -1; kick(); };
    c.addEventListener("mouseenter", on); c.addEventListener("mouseleave", off);
    return () => { c.removeEventListener("mouseenter", on); c.removeEventListener("mouseleave", off); };
  });

  function memberPos(blocks: number[]): V3 {
    const cs = blocks.map((i): V3 => { let x = 0, y = 0, z = 0, n = 0; for (const v of cubeV[INFO[i].cube]) { x += L0[v][0]; y += L0[v][1]; z += L0[v][2]; n++; } return [x / n, y / n, z / n]; });
    const m = cs.reduce<V3>((a, c) => [a[0] + c[0] / cs.length, a[1] + c[1] / cs.length, a[2] + c[2] / cs.length], [0, 0, 0]);
    // (no blocks picked: m stays at the origin and the default direction below is used)
    const d = Math.hypot(m[0], m[1], m[2]); const dir: V3 = d < .2 ? [.62, .5, .6] : [m[0] / d, m[1] / d, m[2] / d];
    return [m[0] + dir[0] * 1.7, m[1] + dir[1] * 1.7, m[2] + dir[2] * 1.7];
  }
  function addMember(name: string, blocks: number[], instant: boolean) {
    const pos = memberPos(blocks);
    const links = blocks.map((i) => { let best = -1, bd = 1e9; for (const v of cubeV[INFO[i].cube]) { const q = L0[v], dd = Math.hypot(q[0] - pos[0], q[1] - pos[1], q[2] - pos[2]); if (dd < bd) { bd = dd; best = v; } } return best; });
    // Snap in from the end of the join trail when there is one.
    member = { pos, from: trail && trail.k && trailEnd ? trailEnd : null, links, blocks, name, t0: instant ? -1e9 : performance.now() };
    trail = null; trailEnd = null;
    kick();
  }

  let dragging = false, moved = 0, lx = 0, ly = 0, lastInput = -1e9, W = 0, H = 0, ox = 0, oy = 0, S = 1, visible = true, raf = 0, alive = true;
  const t0 = performance.now();
  const packets = Array.from({ length: 9 }, () => ({ e: (rnd() * LEdges.length) | 0, t: rnd(), s: .35 + rnd() * .4, f: rnd() < .5 }));

  function resize() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const d = densityFor(W, H);
    if (!network || Math.abs(d.nodes - network.density.nodes) > network.density.nodes * .2 || d.maxFormations !== network.density.maxFormations) network = createNetwork(rnd, d);
    const wide = W > 860, ht = heroTxt.offsetTop;
    hero0 = wide ? { ox: W / 2, oy: Math.max(H * .22, Math.min(H * .4, (ht + 64) / 2)), S: Math.max(40, Math.min(W * .2, (ht - 110) / 3.4)) } : { ox: W / 2, oy: H * .25, S: Math.min(W, H) * .15 };
    side = wide ? { ox: W * .7, oy: H * .5, S: Math.min(W, H) * .18 } : { ox: W / 2, oy: H * .24, S: Math.min(W, H) * .15 };
    // Above the Focus cards, smaller.
    focusPose = wide ? { ox: W / 2, oy: H * .26, S: Math.min(W * .085, H * .1) } : { ox: W / 2, oy: H * .2, S: Math.min(W, H) * .11 };
    focusTop = focus.getBoundingClientRect().top + scrollY;
  }

  function P(p: V3): P2 {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const x = p[0] * cyw - p[2] * syw, z = p[0] * syw + p[2] * cyw;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = p[1] * cp - z * sp, z2 = p[1] * sp + z * cp;
    const persp = 1 / (1 - z2 * .06);
    return [ox + x * S * persp + smx * z2 * 6, oy - y2 * S * persp + smy * z2 * 4, z2];
  }

  const shouldRun = () => alive && visible && !reduce && !document.hidden;
  const schedule = () => { if (!raf && shouldRun()) raf = requestAnimationFrame(frame); };

  function frame(now: number) {
    raf = 0;
    if (!alive) return;
    const el = (now - t0) / 1000, k = reduce ? 1 : ease((el - .1) / 1.5), gk = reduce ? 1 : ease((el - .5) / 1.6);
    if (!dragging && !reduce && (now - lastInput) / 1000 > 2.5) { tYaw = ISO_YAW + Math.sin(el * .22) * .7; tPitch = ISO_PITCH + Math.sin(el * .17) * .1; }
    yaw += (tYaw - yaw) * .06; pitch += (tPitch - pitch) * .06; smx += (mx - smx) * .05; smy += (my - smy) * .05;
    {
      // hero → side (mission) over the first 70% of a screen, then → above the Focus cards
      const sm = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
      const e2 = sm(scrollY / (H * .7)), e3 = sm((H - (focusTop - scrollY)) / (H * .75));
      const at = (k: "ox" | "oy" | "S") => { const b = hero0[k] + (side[k] - hero0[k]) * e2; return b + (focusPose[k] - b) * e3; };
      ox = at("ox"); oy = at("oy"); S = at("S");
    }
    const direct = wordHover >= 0 || hover >= 0;
    let want = wordHover >= 0 ? wordHover : hover >= 0 ? hover : cardHover >= 0 ? cardHover : pinned;
    if (want < 0 && !joining && scrollY < H * .3 && !reduce && k >= 1 && (now - lastUser) > 4000 && (now - lastInput) > 4000) { const c = Math.floor((el - 2) / 3.2); want = c >= 0 && c % 4 < 3 ? c % 4 : -1; }
    setActive(want, direct || (want >= 0 && want !== cardHover));
    for (let i = 0; i < 3; i++) { const tg = active === i || (joining && sel.has(i)) ? 1 : member && member.blocks.includes(i) ? .4 : 0; glow[i] += (tg - glow[i]) * (reduce ? 1 : .12); }
    ctx.clearRect(0, 0, W, H);
    // background: nearer nodes shift more with scroll (parallax); blocks form away from the logo
    network!.draw(ctx, { now, el, reduce, gk, P, W, H, par: Math.min(scrollY, H * 1.5) * .05, avoid: { x: ox, y: oy, r: S * 3.2 }, avoidRects: copyRects });
    // logo
    const lp = L0.map((h, i) => P(reduce ? h : [Ls[i][0] + (h[0] - Ls[i][0]) * k, Ls[i][1] + (h[1] - Ls[i][1]) * k, Ls[i][2] + (h[2] - Ls[i][2]) * k]));
    ctx.save(); ctx.globalAlpha = k;
    centers = INFO.map((inf) => { let x = 0, y = 0, n = 0; for (const v of cubeV[inf.cube]) { x += lp[v][0]; y += lp[v][1]; n++; } return [x / n, y / n]; });
    INFO.forEach((inf, i) => {
      if (glow[i] < .01) return; const id = [...cubeV[inf.cube]];
      ctx.fillStyle = `rgba(185,120,240,${.22 * glow[i]})`;
      const faces = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
      for (const fc of faces) { ctx.beginPath(); fc.forEach((q, j) => { const p = lp[id[q]]; if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); }
    });
    ctx.fillStyle = "rgba(155,77,219,0.28)";
    for (const q of tops) { ctx.beginPath(); q.forEach((vi, j) => { const p = lp[vi]; if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); }
    ctx.shadowColor = "rgba(155,77,219,0.9)"; ctx.shadowBlur = 14; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    const edgeGlow = (a: number, b: number) => { let g = 0; INFO.forEach((inf, i) => { if (cubeV[inf.cube].has(a) && cubeV[inf.cube].has(b)) g = Math.max(g, glow[i]); }); return g; };
    for (const [a, b] of LEdges) { const d = (lp[a][2] + lp[b][2]) / 2, g = edgeGlow(a, b); ctx.lineWidth = 1.6 + 1.4 * g; ctx.strokeStyle = `rgba(242,236,248,${Math.min(1, .5 + .4 * (d + 1.6) / 3.2 + .3 * g)})`; ctx.beginPath(); ctx.moveTo(lp[a][0], lp[a][1]); ctx.lineTo(lp[b][0], lp[b][1]); ctx.stroke(); }
    ctx.fillStyle = "#fff";
    for (const p of lp) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.6 + 2 * (p[2] + 1.6) / 3.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (trail && trail.k > 0) {
      // Laid out on screen: from a point outward of the member's spot (kept inside the viewport) toward it.
      const tr = trail, target = P(tr.pos), c0 = P([0, 0, 0]);
      let dx = target[0] - c0[0], dy = target[1] - c0[1];
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const R = Math.min(W * .32, 220);
      const start = [Math.max(16, Math.min(W - 16, target[0] + dx * R)), Math.max(80, Math.min(H - 16, target[1] + dy * R))];
      const pts = TRAIL_F.slice(0, tr.k).map((f) => [start[0] + (target[0] - start[0]) * f, start[1] + (target[1] - start[1]) * f]);
      trailEnd = [pts[pts.length - 1][0], pts[pts.length - 1][1]];
      ctx.save(); ctx.lineWidth = 1.4; ctx.strokeStyle = "rgba(216,194,240,.7)";
      pts.forEach((pt, i) => {
        const a = reduce ? 1 : ease((now - tr.t[i]) / 500);
        const prev = i ? pts[i - 1] : pt, x = prev[0] + (pt[0] - prev[0]) * a, y = prev[1] + (pt[1] - prev[1]) * a;
        if (i) { ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]); }
        ctx.globalAlpha = Math.min(1, a * 1.5); ctx.shadowColor = "rgba(216,194,240,1)"; ctx.shadowBlur = 12; ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(x, y, i === pts.length - 1 ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });
      // faint guide from the newest node to where the block will snap in
      const last = pts[pts.length - 1];
      ctx.strokeStyle = "rgba(216,194,240,.22)"; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(target[0], target[1]); ctx.stroke();
      ctx.restore();
    }
    if (member) {
      const mt = reduce ? 1 : ease((now - member.t0) / 1400), end = P(member.pos);
      const mp = member.from
        ? [member.from[0] + (end[0] - member.from[0]) * mt, member.from[1] + (end[1] - member.from[1]) * mt]
        : P(lerp3([member.pos[0] * 3.4, member.pos[1] * 3.4, member.pos[2] * 3.4], member.pos, mt));
      ctx.save(); ctx.globalAlpha = Math.min(1, mt * 1.4); ctx.strokeStyle = "rgba(216,194,240,.85)"; ctx.lineWidth = 1.4; ctx.setLineDash([4, 5]);
      for (const v of member.links) { const q = lp[v]; ctx.beginPath(); ctx.moveTo(mp[0], mp[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      ctx.setLineDash([]); ctx.shadowColor = "rgba(216,194,240,1)"; ctx.shadowBlur = 18; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mp[0], mp[1], 6.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (!reduce && mt >= 1) { const pt = ((now - member.t0) / 1000) % 2.4; ctx.strokeStyle = `rgba(216,194,240,${Math.max(0, 1 - pt / 1.3)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mp[0], mp[1], 6.5 + pt * 20, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = "#F5EEFB"; ctx.font = `500 13px ${fontFamily}`; ctx.fillText(member.name ? "You · " + member.name.split(/\s+/)[0] : "You", mp[0] + 13, mp[1] + 4); ctx.restore();
    }
    // Label: a block-explorer card joined to the active cube by a connector from its nearest corner node.
    capA += ((capOn ? 1 : 0) - capA) * (reduce ? 1 : .25);
    if (active >= 0 && centers[active] && capA > .01) {
      const [cx, cy] = centers[active], small = W <= 860;
      let lx: number, ly: number;
      if (small) { lx = W / 2 - capW / 2; ly = Math.max(oy + S * 1.7, cy + S * 1.1); }
      else {
        // beside the whole logo (never over the other cubes), on the side of the active cube
        let minX = 1e9, maxX = -1e9; for (const q of lp) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); }
        const left = cx < ox - S * .3 && minX - S * .5 - capW > 8;
        lx = left ? minX - S * .5 - capW : maxX + S * .5; ly = cy - capH / 2 - S * .2;
      }
      lx = Math.round(Math.max(8, Math.min(W - capW - 8, lx))) + .5; ly = Math.round(Math.max(76, Math.min(H - capH - 8, ly))) + .5;
      const box: [number, number][] = [[lx, ly], [lx + capW, ly], [lx + capW, ly + capH], [lx, ly + capH]];
      // the label corner nearest the cube, and the cube's corner node nearest that
      let anchor = box[0], ad = 1e9;
      for (const q of box) { const d = Math.hypot(q[0] - cx, q[1] - cy); if (d < ad) { ad = d; anchor = q; } }
      let corner = lp[0], cd = 1e9;
      for (const v of cubeV[INFO[active].cube]) { const q = lp[v], d = Math.hypot(q[0] - anchor[0], q[1] - anchor[1]); if (d < cd) { cd = d; corner = q; } }
      const t = now - capT0;
      const pn = clamp01(t / LBL_NODES), pe = ease((t - LBL_EDGES[0]) / (LBL_EDGES[1] - LBL_EDGES[0])), pd = ease((t - LBL_DOT[0]) / (LBL_DOT[1] - LBL_DOT[0]));
      ctx.save(); ctx.globalAlpha = capA; ctx.lineWidth = 1; ctx.strokeStyle = "rgba(216,194,240,.85)";
      // connector, drawn behind the travelling dot
      const dx = corner[0] + (anchor[0] - corner[0]) * pd, dy = corner[1] + (anchor[1] - corner[1]) * pd;
      if (pd > 0) { ctx.beginPath(); ctx.moveTo(corner[0], corner[1]); ctx.lineTo(dx, dy); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(corner[0], corner[1], 4.5, 0, Math.PI * 2); ctx.stroke();
      // edges grow out of each corner node toward the next
      if (pe > 0) {
        ctx.beginPath();
        box.forEach((A, j) => { const B = box[(j + 1) % 4]; ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] + (B[0] - A[0]) * pe, A[1] + (B[1] - A[1]) * pe); });
        ctx.stroke();
      }
      ctx.shadowColor = "rgba(216,194,240,1)"; ctx.shadowBlur = 10; ctx.fillStyle = "#F5EEFB";
      for (const q of box) { ctx.beginPath(); ctx.arc(q[0], q[1], 2.6 * pn, 0, Math.PI * 2); ctx.fill(); }
      if (pd > 0 && pd < 1) { ctx.beginPath(); ctx.arc(dx, dy, 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      cap.style.transform = `translate(${lx - .5}px, ${ly - .5}px)`;
      if (capOn && t >= LBL_TEXT) cap.classList.add("show");
    }
    if (!reduce && k >= 1) {
      ctx.save(); ctx.shadowColor = "rgba(216,194,240,1)"; ctx.shadowBlur = 12; ctx.fillStyle = "#E9DBF8";
      for (const pk of packets) {
        pk.t += pk.s / 60;
        let [a, b] = LEdges[pk.e]; if (pk.f) [a, b] = [b, a];
        if (pk.t >= 1) { const nx = LEdges.map((e, i) => [e, i] as const).filter(([e]) => e[0] === b || e[1] === b); const [e, i] = nx[(rnd() * nx.length) | 0]; pk.e = i; pk.f = e[1] === b; pk.t = 0; [a, b] = pk.f ? [e[1], e[0]] : e; }
        const A = lp[a], B = lp[b]; ctx.beginPath(); ctx.arc(A[0] + (B[0] - A[0]) * pk.t, A[1] + (B[1] - A[1]) * pk.t, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    schedule();
  }

  const hitAt = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let best = -1, bd = S * .75;
    centers.forEach((c, i) => { const d = Math.hypot(c[0] - px, c[1] - py); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  // Touch has no hover: hit-test on press so a tap shows (or toggles) the label.
  const onDown = (e: PointerEvent) => { hover = hitAt(e); dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; };
  const onMove = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5;
    const best = hitAt(e);
    if (!dragging) {
      if (best >= 0) lastUser = performance.now();
      if (best !== hover) { hover = best; cv.style.cursor = best >= 0 ? "pointer" : "grab"; kick(); }
      return;
    }
    moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
    tYaw += (e.clientX - lx) * .008; tPitch = Math.max(-.3, Math.min(1.2, tPitch + (e.clientY - ly) * .005)); lx = e.clientX; ly = e.clientY; lastInput = performance.now();
    if (reduce) { yaw = tYaw; pitch = tPitch; frame(performance.now()); }
  };
  const onUp = () => {
    if (dragging && moved < 6) { if (joining) { if (hover >= 0) opts.onToggle(hover); } else { pinned = hover >= 0 && pinned !== hover ? hover : -1; } lastUser = performance.now(); }
    dragging = false; cv.style.cursor = "grab"; lastInput = performance.now(); kick();
  };
  const onLeave = () => { hover = -1; kick(); };
  // Tapping or clicking anywhere else (not the canvas or a headline word) hides a pinned label.
  const onDocDown = (e: PointerEvent) => {
    const t = e.target as Element | null;
    if (t === cv || words.some((w) => w.contains(t))) return;
    if (pinned >= 0) { pinned = -1; kick(); }
  };
  document.addEventListener("pointerdown", onDocDown);
  const onResize = () => { resize(); if (reduce) frame(performance.now()); };
  const onScrollReduced = () => frame(performance.now());
  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("pointermove", onMove);
  cv.addEventListener("pointerleave", onLeave);
  cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp);
  addEventListener("resize", onResize);
  if (reduce) addEventListener("scroll", onScrollReduced, { passive: true });
  const heroRO = new ResizeObserver(() => resize()); heroRO.observe(heroTxt);
  const visIO = new IntersectionObserver(([en]) => { visible = en.isIntersecting; schedule(); });
  visIO.observe(cv);
  document.addEventListener("visibilitychange", schedule);
  resize();
  if (reduce) frame(performance.now()); else schedule();

  return {
    setJoining(on) { joining = on; kick(); },
    setSelected(blocks) { sel = new Set(blocks); lastUser = performance.now(); kick(); },
    setProgress(steps, blocks) {
      if (steps <= 0) { trail = null; trailEnd = null; kick(); return; }
      const pos = memberPos(blocks), now = performance.now();
      if (!trail) trail = { pos, k: 0, t: [] };
      trail.pos = pos;
      for (let i = trail.k; i < steps; i++) trail.t[i] = now;
      trail.k = Math.min(steps, TRAIL_F.length);
      kick();
    },
    addMember,
    clearMember() { member = null; trail = null; trailEnd = null; kick(); },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      visIO.disconnect(); heroRO.disconnect();
      wordCleanups.forEach((f) => f()); cardCleanups.forEach((f) => f());
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp);
      removeEventListener("resize", onResize); removeEventListener("scroll", onScrollReduced);
      document.removeEventListener("visibilitychange", schedule);
      document.removeEventListener("pointerdown", onDocDown);
    },
  };
}
