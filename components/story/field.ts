// The hero's 3D logo: three blocks drawn into the site's one background canvas as a painter
// (components/backdrop). Ported from the inline script in docs/prototype.html. The DOM it
// drives (headline words, Focus cards, label) is rendered by React; this module only reads it
// and toggles classes. Pointer input comes from `surface`, a transparent layer in the pin.

import { addPainter, networkSnapshot, requestBackdropFrame } from "@/components/backdrop/backdrop";
import type { P2, V3 } from "@/components/backdrop/network";
import type { Anchors } from "@/components/backdrop/core";
import { focusTags } from "@/content/focus";
import { industries } from "@/content/industries";

export type FieldElements = {
  /** Fills the pinned area: receives pointer input; its position offsets the drawing. */
  surface: HTMLElement;
  cap: HTMLElement;
  capTitle: HTMLElement;
  capText: HTMLElement;
  heroTxt: HTMLElement;
  words: HTMLElement[];
  /** Focus cards: hovering one lights its block. */
  cards: HTMLElement[];
  /** The Focus section: the logo moves above its cards while it's in view. */
  focus: HTMLElement;
  /** "You · <first name>" beside the member's block, with its Hide button; `youName` holds the text. */
  you: HTMLElement;
  youName: HTMLElement;
};

export type FieldOptions = {
  /** Called when a block is tapped (cube or headline word) while the join flow is open. */
  onToggle: (i: number) => void;
};

export type Field = {
  setJoining: (on: boolean) => void;
  /** The join flow (questions or the success/strengthen step) is open: the logo makes room for it. */
  setFlow: (on: boolean) => void;
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
  const { surface: cv, cap, capTitle, capText, heroTxt, words, cards, focus, you, youName } = el;
  const h1 = heroTxt.querySelector("h1");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  // Assemble on load, once per session: nodes fly in from the network to the cubes' vertices,
  // then the edges draw in (~1.2 s), then the logo settles. Skipped under reduced motion.
  const INTRO_AT = .35, INTRO_FLY = .65, INTRO_EDGES = [.55, 1.2] as const, INTRO_END = 1.2;
  const INTRO_KEY = "nyubs:assembled";
  const skipIntro = reduce || (() => { try { return sessionStorage.getItem(INTRO_KEY) === "1"; } catch { return false; } })();
  let introFrom: [number, number][] | null = null, introDone = skipIntro;
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
      // Single source of truth: the first three tags of that Focus block.
      capText.replaceChildren(...focusTags(INFO[i].id).map((t) => { const s = document.createElement("i"); s.textContent = t; return s; }));
      capW = cap.offsetWidth; capH = cap.offsetHeight; // measured once per change, not per frame
      capT0 = reduce ? -1e9 : performance.now();
    }
  }
  const kick = () => requestBackdropFrame();

  let joining = false, flow = false, flowK = 0;
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
    // (no blocks picked: m stays at the origin and the marker sits to the right)
    // Beside the blocks, toward the side of the logo they're on: in the isometric view
    // (x - z) is screen-horizontal, and straight up from the top block would sit under the nav.
    const side = m[0] - m[2] < -.1 ? -1 : 1, dir: V3 = [side * .68, .26, -side * .68];
    const r = W <= 560 ? 1.25 : 1.7; // phones: keep it on screen
    return [m[0] + dir[0] * r, m[1] + dir[1] * r, m[2] + dir[2] * r];
  }
  function addMember(name: string, blocks: number[], instant: boolean) {
    const pos = memberPos(blocks);
    const links = blocks.map((i) => { let best = -1, bd = 1e9; for (const v of cubeV[INFO[i].cube]) { const q = L0[v], dd = Math.hypot(q[0] - pos[0], q[1] - pos[1], q[2] - pos[2]); if (dd < bd) { bd = dd; best = v; } } return best; });
    // Snap in from the end of the join trail when there is one.
    member = { pos, from: trail && trail.k && trailEnd ? trailEnd : null, links, blocks, name, t0: instant ? -1e9 : performance.now() };
    trail = null; trailEnd = null;
    youName.textContent = name ? `You · ${name}` : "You";
    youW = youH = 0;
    kick();
  }
  let youOn = false, youW = 0, youH = 0;
  const showYou = (on: boolean) => { if (on !== youOn) { youOn = on; you.classList.toggle("show", on); } };

  let dragging = false, moved = 0, lx = 0, ly = 0, lastInput = -1e9, W = 0, H = 0, ox = 0, oy = 0, S = 1, pinTop = 0, logoA = 1;
  const t0 = performance.now();
  const packets = Array.from({ length: 9 }, () => ({ e: (rnd() * LEdges.length) | 0, t: rnd(), s: .35 + rnd() * .4, f: rnd() < .5 }));

  function resize() {
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    const wide = W > 860, ht = heroTxt.offsetTop;
    // Small screens: the logo is ~57% of the width (it's about 2.7·S wide and 3.1·S tall) and
    // sits right above the headline, in the space the CSS reserves (min(66vw, 42svh); while
    // the flow is open on phones, min(50vw, 30svh) so each question sits right under the visual).
    const flowSmall = flow && W <= 560;
    const sS = Math.max(30, flowSmall ? Math.min(W * .16, Math.min(W * .5, H * .3) / 3.15) : Math.min(W * .21, Math.min(W * .66, H * .42) / 3.15));
    hero0 = wide ? { ox: W / 2, oy: Math.max(H * .22, Math.min(H * .4, (ht + 64) / 2)), S: Math.max(40, Math.min(W * .2, (ht - 110) / 3.4)) } : { ox: W / 2, oy: Math.max(68 + sS * 1.6, ht - 12 - sS * 1.58), S: sS };
    side = wide ? { ox: W * .7, oy: H * .5, S: Math.min(W, H) * .18 } : { ox: W / 2, oy: H * .26, S: Math.min(W * .16, H * .1) };
    // Above the Focus blocks, sized to the space they leave (the logo fades where they'd overlap).
    const fin = focus.querySelector<HTMLElement>(".focus-in") ?? focus;
    const avail = H - fin.offsetHeight - parseFloat(getComputedStyle(focus).paddingBottom) - 76;
    focusPose = { ox: W / 2, oy: 72 + Math.max(avail, 0) / 2, S: Math.max(12, Math.min(wide ? W * .085 : W * .11, H * .1, avail / 3.4)) };
    focusTop = focus.getBoundingClientRect().top + scrollY;
    // While the join flow is open on wide screens the logo moves into the gutter beside the
    // form (which is centred, max 560px), sized to fit it, so it never sits behind an input.
    const formW = Math.min(560, W - 2 * Math.min(Math.max(W * .04, 20), 56));
    flowL = (W + formW) / 2;
    flowS = Math.max(24, Math.min((W - flowL - 56) / 3, H * .11));
  }
  let flowL = 0, flowS = 1;
  const flowPose = { ox: 0, oy: 0, S: 1 };

  function P(p: V3): P2 {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const x = p[0] * cyw - p[2] * syw, z = p[0] * syw + p[2] * cyw;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = p[1] * cp - z * sp, z2 = p[1] * sp + z * cp;
    const persp = 1 / (1 - z2 * .06);
    return [ox + x * S * persp + smx * z2 * 6, oy - y2 * S * persp + smy * z2 * 4, z2];
  }

  // The logo's vertices as the network sees them (viewport coordinates), refreshed each frame.
  let anchors: Anchors | null = null;
  const hullOf = (ps: P2[]) => {
    // monotone chain: which projected vertices are on the outline
    const ix = ps.map((_, i) => i).sort((a, b) => ps[a][0] - ps[b][0] || ps[a][1] - ps[b][1]);
    const cross = (o: number, a: number, b: number) => (ps[a][0] - ps[o][0]) * (ps[b][1] - ps[o][1]) - (ps[a][1] - ps[o][1]) * (ps[b][0] - ps[o][0]);
    const half = (order: number[]) => { const h: number[] = []; for (const i of order) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], i) <= 0) h.pop(); h.push(i); } h.pop(); return h; };
    return new Set([...half(ix), ...half([...ix].reverse())]);
  };

  /** Intro start points (pin coordinates): a distinct nearby network node for each vertex, or a scatter. */
  function introStarts(lp: P2[]): [number, number][] {
    const net = networkSnapshot();
    const pool = (net?.sp ?? [])
      .map((q, n) => ({ n, x: q[0], y: q[1] - pinTop }))
      .filter((q) => q.x > 0 && q.x < W && q.y > 0 && q.y < H && Math.hypot(q.x - ox, q.y - oy) > S * 1.6);
    const used = new Set<number>();
    return lp.map((t) => {
      let best = -1, bd = 1e9;
      for (const q of pool) { if (used.has(q.n)) continue; const d = Math.hypot(q.x - t[0], q.y - t[1]); if (d < bd) { bd = d; best = q.n; } }
      if (best >= 0 && bd < S * 6) { used.add(best); const q = pool.find((x) => x.n === best)!; return [q.x, q.y]; }
      const a = rnd() * Math.PI * 2; return [t[0] + Math.cos(a) * S * 3, t[1] + Math.sin(a) * S * 3];
    });
  }

  // Drawn by the backdrop each frame, in viewport coordinates shifted by the pin's position.
  function draw(ctx: CanvasRenderingContext2D, now: number) {
    pinTop = cv.getBoundingClientRect().top;
    anchors = null;
    if (pinTop + H < 0) return; // the pinned section has scrolled away
    ctx.save(); ctx.translate(0, pinTop);
    frame(ctx, now);
    ctx.restore();
  }

  function frame(ctx: CanvasRenderingContext2D, now: number) {
    const el = (now - t0) / 1000, it = skipIntro ? 1e9 : el - INTRO_AT, k = clamp01(it / INTRO_END);
    // Fade the logo out wherever the (transparent) Focus blocks would run into it.
    const fin = focus.querySelector<HTMLElement>(".focus-in") ?? focus;
    if (!dragging && !reduce && (now - lastInput) / 1000 > 2.5) { tYaw = ISO_YAW + Math.sin(el * .22) * .7; tPitch = ISO_PITCH + Math.sin(el * .17) * .1; }
    yaw += (tYaw - yaw) * .06; pitch += (tPitch - pitch) * .06; smx += (mx - smx) * .05; smy += (my - smy) * .05;
    {
      // hero → side (mission) over the first 70% of a screen, then → above the Focus cards
      const sm = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
      const e2 = sm(scrollY / (H * .7)), e3 = sm((H - (focusTop - scrollY)) / (H * .75));
      // Join flow open: beside the form (wide; kept below the headline) or above it, scrolling
      // away with it (small screens), instead of sliding over the form toward the side pose.
      flowK = reduce ? (flow ? 1 : 0) : flowK + ((flow ? 1 : 0) - flowK) * .1;
      let fp = hero0;
      if (flowK > .001) {
        if (W > 860) {
          // above the headline while there's room for it there, else in the gutter beside the form
          const hr = h1?.getBoundingClientRect(), top = (hr?.top ?? 0) - pinTop - 76, Sa = Math.min(hero0.S, (top - 16) / 3.3);
          const target = Sa >= 48 ? { ox: W / 2, oy: 76 + top / 2 + Sa * .1, S: Sa }
            : { ox: flowL + (W - flowL) / 2, oy: Math.min(H - flowS * 1.8 - 16, Math.max(H * .42, (hr?.bottom ?? 0) - pinTop + flowS * 1.8 + 16)), S: flowS };
          const e = reduce || flowK < .05 ? 1 : .1;
          for (const q of ["ox", "oy", "S"] as const) flowPose[q] += (target[q] - flowPose[q]) * e;
          fp = flowPose;
        } else fp = { ...hero0, oy: hero0.oy - scrollY };
      }
      const at = (k: "ox" | "oy" | "S") => {
        const idle = hero0[k] + (side[k] - hero0[k]) * e2, b = idle + (fp[k] - idle) * flowK;
        return b + (focusPose[k] - b) * e3;
      };
      ox = at("ox"); oy = at("oy"); S = at("S");
    }
    logoA = clamp01((fin.getBoundingClientRect().top - pinTop - (oy + S * 1.7)) / 50);
    const direct = wordHover >= 0 || hover >= 0;
    let want = wordHover >= 0 ? wordHover : hover >= 0 ? hover : cardHover >= 0 ? cardHover : pinned;
    let auto = false;
    if (want < 0 && !joining && scrollY < H * .3 && !reduce && k >= 1 && (now - lastUser) > 4000 && (now - lastInput) > 4000) { const c = Math.floor((el - 2) / 3.2); want = c >= 0 && c % 4 < 3 ? c % 4 : -1; auto = true; }
    // Small screens have no room beside the logo: the idle cycle only lights blocks there.
    // No label while the join flow is open: it would cover the form (the words and blocks still light).
    setActive(want, !flow && (direct || (want >= 0 && want !== cardHover && !(auto && W <= 860))));
    for (let i = 0; i < 3; i++) { const tg = active === i || (joining && sel.has(i)) ? 1 : member && member.blocks.includes(i) ? .4 : 0; glow[i] += (tg - glow[i]) * (reduce ? 1 : .12); }
    // logo
    const lp = L0.map(P);
    if (it < 0) return; // the intro hasn't started yet
    if (it < INTRO_FLY + .1) {
      // each vertex leaves a nearby node of the network and flies to its place in the cubes
      introFrom ??= introStarts(lp);
      lp.forEach((q, i) => { const f = ease((it - i * .008) / (INTRO_FLY - .15)), a = introFrom![i]; q[0] = a[0] + (q[0] - a[0]) * f; q[1] = a[1] + (q[1] - a[1]) * f; });
    }
    if (!introDone && it >= INTRO_END) { introDone = true; try { sessionStorage.setItem(INTRO_KEY, "1"); } catch {} }
    // after it's assembled, the network's core (core.ts) connects into it
    const coreA = ease((it - INTRO_END + .1) / .5) * logoA;
    if (coreA > .01) {
      const hull = hullOf(lp);
      anchors = { pts: lp.map((p, i) => ({ x: p[0], y: p[1] + pinTop, hull: hull.has(i) })), c: [ox, oy + pinTop], r: S * 1.7, a: coreA };
    }
    // Same material as the network, only a little larger and brighter: lilac nodes, solid lilac edges.
    const edgeP = (j: number) => it > INTRO_EDGES[1] + .2 ? 1 : clamp01((it - INTRO_EDGES[0] - j * ((INTRO_EDGES[1] - INTRO_EDGES[0] - .15) / LEdges.length)) / .15);
    const faceA = clamp01((it - INTRO_END + .2) / .3);
    ctx.save(); ctx.globalAlpha = logoA;
    centers = INFO.map((inf) => { let x = 0, y = 0, n = 0; for (const v of cubeV[inf.cube]) { x += lp[v][0]; y += lp[v][1]; n++; } return [x / n, y / n]; });
    INFO.forEach((inf, i) => {
      if (glow[i] < .01) return; const id = [...cubeV[inf.cube]];
      ctx.fillStyle = `rgba(185,120,240,${.22 * glow[i]})`;
      const faces = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
      for (const fc of faces) { ctx.beginPath(); fc.forEach((q, j) => { const p = lp[id[q]]; if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); }
    });
    ctx.fillStyle = `rgba(155,77,219,${.2 * faceA})`;
    for (const q of tops) { ctx.beginPath(); q.forEach((vi, j) => { const p = lp[vi]; if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); }
    ctx.lineCap = "round"; ctx.shadowColor = "rgba(185,120,240,.9)";
    const edgeGlow = (a: number, b: number) => { let g = 0; INFO.forEach((inf, i) => { if (cubeV[inf.cube].has(a) && cubeV[inf.cube].has(b)) g = Math.max(g, glow[i]); }); return g; };
    LEdges.forEach(([a, b], j) => {
      const pe = edgeP(j);
      if (pe <= 0) return;
      const dn = ((lp[a][2] + lp[b][2]) / 2 + 1.6) / 3.2, g = edgeGlow(a, b);
      ctx.lineWidth = 1.15 + 1.3 * g; ctx.shadowBlur = 10 * g; // a glow only on the highlighted block
      ctx.strokeStyle = `rgba(226,204,248,${Math.min(1, .42 + .22 * dn + .4 * g)})`;
      ctx.beginPath(); ctx.moveTo(lp[a][0], lp[a][1]); ctx.lineTo(lp[a][0] + (lp[b][0] - lp[a][0]) * pe, lp[a][1] + (lp[b][1] - lp[a][1]) * pe); ctx.stroke();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = logoA * Math.min(1, Math.max(it, 0) * 6);
    for (const p of lp) { const dn = (p[2] + 1.6) / 3.2; ctx.fillStyle = `rgba(233,219,248,${.72 + .26 * dn})`; ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 + 1.5 * dn, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (trail && trail.k > 0) {
      // Laid out on screen: from a point outward of the member's spot (kept inside the viewport) toward it.
      const tr = trail, target = P(tr.pos), c0 = P([0, 0, 0]);
      let dx = target[0] - c0[0], dy = target[1] - c0[1];
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const R = Math.min(W * .32, 220);
      const minX = flow && W > 860 ? flowL + 16 : 16; // stays out of the form
      const start = [Math.max(minX, Math.min(W - 16, target[0] + dx * R)), Math.max(80, Math.min(H - 16, target[1] + dy * R))];
      const pts = TRAIL_F.slice(0, tr.k).map((f) => [start[0] + (target[0] - start[0]) * f, start[1] + (target[1] - start[1]) * f]);
      trailEnd = [pts[pts.length - 1][0], pts[pts.length - 1][1]];
      ctx.save(); ctx.lineWidth = 1.4; ctx.strokeStyle = "rgba(216,194,240,.7)";
      pts.forEach((pt, i) => {
        const a = reduce ? 1 : ease((now - tr.t[i]) / 500);
        const prev = i ? pts[i - 1] : pt, x = prev[0] + (pt[0] - prev[0]) * a, y = prev[1] + (pt[1] - prev[1]) * a;
        if (i) { ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(x, y); ctx.stroke(); }
        ctx.globalAlpha = Math.min(1, a * 1.5); ctx.shadowColor = "rgba(216,194,240,1)"; ctx.shadowBlur = 12; ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(x, y, i === pts.length - 1 ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });
      // faint guide from the newest node to where the block will snap in
      const last = pts[pts.length - 1];
      ctx.strokeStyle = "rgba(216,194,240,.2)"; ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(target[0], target[1]); ctx.stroke();
      ctx.restore();
    }
    if (member) {
      const mt = reduce ? 1 : ease((now - member.t0) / 1400), end = P(member.pos);
      const mp = member.from
        ? [member.from[0] + (end[0] - member.from[0]) * mt, member.from[1] + (end[1] - member.from[1]) * mt]
        : P(lerp3([member.pos[0] * 3.4, member.pos[1] * 3.4, member.pos[2] * 3.4], member.pos, mt));
      ctx.save(); ctx.globalAlpha = Math.min(1, mt * 1.4); ctx.strokeStyle = "rgba(216,194,240,.7)"; ctx.lineWidth = 1.2;
      for (const v of member.links) { const q = lp[v]; ctx.beginPath(); ctx.moveTo(mp[0], mp[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      ctx.shadowColor = "rgba(216,194,240,1)"; ctx.shadowBlur = 18; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mp[0], mp[1], 6.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (!reduce && mt >= 1) { const pt = ((now - member.t0) / 1000) % 2.4; ctx.strokeStyle = `rgba(216,194,240,${Math.max(0, 1 - pt / 1.3)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mp[0], mp[1], 6.5 + pt * 20, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      // the label is DOM (it carries a Hide button): beside the node, flipped left near the edge
      showYou(mt > .6 && logoA > .3 && mp[1] + pinTop > 84); // never under the nav
      if (youOn) {
        youW ||= you.offsetWidth; youH ||= you.offsetHeight;
        // beside the node; under it when there's no room on the right (phones)
        const fits = mp[0] + 13 + youW <= W - 8;
        const x = fits ? mp[0] + 13 : Math.max(8, Math.min(W - 8 - youW, mp[0] - youW / 2)), y = fits ? mp[1] - youH / 2 : mp[1] + 6;
        you.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
    } else showYou(false);
    // Label: a block-explorer card joined to the active cube by a connector from its nearest corner node.
    capA += ((capOn ? 1 : 0) - capA) * (reduce ? 1 : .25);
    if (active >= 0 && centers[active] && capA > .01) {
      const [cx, cy] = centers[active], small = W <= 860;
      let lx: number, ly: number;
      if (small) { lx = W / 2 - capW / 2; ly = 76; } // just under the nav, over the logo (filled, below)
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
      if (small && pe > 0) { ctx.fillStyle = `rgba(28,5,51,${.88 * pe})`; ctx.fillRect(lx, ly, capW, capH); }
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
    if (!reduce && k >= 1 && logoA > .01) {
      ctx.save(); ctx.globalAlpha = logoA; ctx.fillStyle = "rgba(233,219,248,.85)"; // the network's dots
      for (const pk of packets) {
        pk.t += pk.s / 60;
        let [a, b] = LEdges[pk.e]; if (pk.f) [a, b] = [b, a];
        if (pk.t >= 1) { const nx = LEdges.map((e, i) => [e, i] as const).filter(([e]) => e[0] === b || e[1] === b); const [e, i] = nx[(rnd() * nx.length) | 0]; pk.e = i; pk.f = e[1] === b; pk.t = 0; [a, b] = pk.f ? [e[1], e[0]] : e; }
        const A = lp[a], B = lp[b]; ctx.beginPath(); ctx.arc(A[0] + (B[0] - A[0]) * pk.t, A[1] + (B[1] - A[1]) * pk.t, 1.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  const hitAt = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let best = -1, bd = logoA > .3 ? S * .75 : 0;
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
    if (reduce) { yaw = tYaw; pitch = tPitch; kick(); }
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
  const onResize = () => { resize(); kick(); };
  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("pointermove", onMove);
  cv.addEventListener("pointerleave", onLeave);
  cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp);
  addEventListener("resize", onResize);
  const heroRO = new ResizeObserver(() => { resize(); kick(); }); heroRO.observe(heroTxt);
  resize();
  // The network fades only right behind the logo (it's the network's core, not an object on
  // top of it); blocks don't form in a ring around it or under an open label.
  const removePainter = addPainter({
    draw,
    anchors: () => anchors,
    avoid: () => pinTop + H < 0 ? { circles: [], rects: [] } : {
      circles: [{ x: ox, y: oy + pinTop, r: S * 1.7 }],
      rects: capOn ? [cap.getBoundingClientRect()] : [],
      block: [{ x: ox, y: oy + pinTop, r: S * 2.4 }],
    },
  });

  return {
    setJoining(on) { joining = on; resize(); kick(); },
    setFlow(on) { flow = on; resize(); kick(); },
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
    clearMember() { member = null; trail = null; trailEnd = null; showYou(false); kick(); },
    destroy() {
      removePainter();
      heroRO.disconnect();
      wordCleanups.forEach((f) => f()); cardCleanups.forEach((f) => f());
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp);
      removeEventListener("resize", onResize);
      document.removeEventListener("pointerdown", onDocDown);
    },
  };
}
