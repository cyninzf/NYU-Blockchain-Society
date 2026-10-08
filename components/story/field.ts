// The hero's 3D field: the three-block logo inside a sparse lattice, drawn on a 2D canvas.
// Ported from the inline script in docs/prototype.html. The DOM it drives (headline words,
// story steps, caption) is rendered by React; this module only reads it and toggles classes.

import { industries } from "@/content/industries";

type V3 = [number, number, number];
type P2 = [number, number, number]; // screen x, screen y, depth

export type FieldElements = {
  canvas: HTMLCanvasElement;
  cap: HTMLElement;
  capTitle: HTMLElement;
  capText: HTMLElement;
  heroTxt: HTMLElement;
  words: HTMLElement[];
  steps: HTMLElement[];
};

export type FieldOptions = {
  /** Called when a block is tapped (cube or headline word) while the join flow is open. */
  onToggle: (i: number) => void;
};

export type Field = {
  setJoining: (on: boolean) => void;
  setSelected: (blocks: number[]) => void;
  addMember: (name: string, blocks: number[], instant: boolean) => void;
  clearMember: () => void;
  destroy: () => void;
};

const key = (p: number[]) => p.join(",");
const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

export function createField(el: FieldElements, opts: FieldOptions): Field {
  const { canvas: cv, cap, capTitle, capText, heroTxt, words, steps } = el;
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

  // --- background: sparse tiny wireframe cubes (node-stack style), faintly linked, drifting ---
  const CUBE_V: V3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const CUBE_E: [number, number][] = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const d = CUBE_V[a].reduce((n, v, i) => n + (v !== CUBE_V[b][i] ? 1 : 0), 0); if (d === 1) CUBE_E.push([a, b]); }
  const CUBE_TOP = [2, 3, 7, 6];
  const bg: { c: V3; s: number; dir: V3; ph: number; sp: number }[] = [];
  for (let tries = 0; bg.length < 22 && tries < 2000; tries++) {
    const c: V3 = [(rnd() - .5) * 15, (rnd() - .5) * 10, (rnd() - .5) * 15];
    const r = Math.hypot(c[0], c[1], c[2]);
    if (r < 3.4 || r > 7.6) continue;
    if (bg.some((o) => Math.hypot(o.c[0] - c[0], o.c[1] - c[1], o.c[2] - c[2]) < 1.8)) continue;
    const d: V3 = [rnd() - .5, rnd() - .5, rnd() - .5], dl = Math.hypot(d[0], d[1], d[2]) || 1;
    bg.push({ c, s: .13 + rnd() * .09, dir: [d[0] / dl, d[1] / dl, d[2] / dl], ph: rnd() * Math.PI * 2, sp: .05 + rnd() * .06 });
  }
  // Link each cube to its nearest neighbours, corner to corner.
  const bgLinks: [number, number, number, number][] = [];
  const linked = new Set<string>();
  bg.forEach((a, i) => {
    bg.map((b, j) => [j, Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1], a.c[2] - b.c[2])] as const)
      .filter(([j, d]) => j !== i && d < 4.2).sort((x, y) => x[1] - y[1]).slice(0, 2)
      .forEach(([j]) => {
        const k = i < j ? i + "-" + j : j + "-" + i; if (linked.has(k)) return; linked.add(k);
        const b = bg[j], corner = (from: typeof a, to: typeof a) => { let best = 0, bd = 1e9; CUBE_V.forEach((v, n) => { const d = Math.hypot(from.c[0] + v[0] * from.s - to.c[0], from.c[1] + v[1] * from.s - to.c[1], from.c[2] + v[2] * from.s - to.c[2]); if (d < bd) { bd = d; best = n; } }); return best; };
        bgLinks.push([i, corner(a, b), j, corner(b, a)]);
      });
  });
  const Ls = L0.map((): V3 => [(rnd() - .5) * 9, (rnd() - .5) * 9, (rnd() - .5) * 9]);
  const ISO_YAW = Math.PI / 4, ISO_PITCH = Math.atan(1 / Math.SQRT2);
  let yaw = ISO_YAW, pitch = ISO_PITCH, tYaw = ISO_YAW, tPitch = ISO_PITCH, mx = 0, my = 0, smx = 0, smy = 0;

  let scrollActive = -1, capOn = false, hero0 = { ox: 0, oy: 0, S: 1 }, side = { ox: 0, oy: 0, S: 1 };
  const stepIO = new IntersectionObserver((ens) => {
    for (const en of ens) { const i = +((en.target as HTMLElement).dataset.step ?? -1); if (en.isIntersecting) scrollActive = i; else if (scrollActive === i) scrollActive = -1; }
    steps.forEach((st, j) => st.classList.toggle("on", j === scrollActive));
    if (reduce) frame(performance.now());
  }, { rootMargin: "-42% 0px -42% 0px" });
  steps.forEach((st) => stepIO.observe(st));

  let active = -1, hover = -1, pinned = -1, wordHover = -1, lastUser = -1e9, centers: [number, number][] = [];
  const glow = [0, 0, 0];
  function setActive(i: number, showCap: boolean) {
    const c = i >= 0 && showCap; if (i === active && c === capOn) return; active = i; capOn = c;
    words.forEach((w, j) => w.classList.toggle("on", j === i));
    if (c) { capTitle.textContent = INFO[i].name; capText.textContent = INFO[i].caption; cap.classList.add("show"); } else cap.classList.remove("show");
  }
  const kick = () => { if (reduce) frame(performance.now()); };

  let joining = false;
  let sel = new Set<number>();
  let member: { pos: V3; links: number[]; blocks: number[]; name: string; t0: number } | null = null;

  const wordCleanups = words.map((w, i) => {
    const on = () => { wordHover = i; lastUser = performance.now(); };
    const off = () => { wordHover = -1; lastUser = performance.now(); };
    const click = () => { if (joining) { opts.onToggle(i); return; } pinned = pinned === i ? -1 : i; lastUser = performance.now(); kick(); };
    w.addEventListener("mouseenter", on); w.addEventListener("focus", on); w.addEventListener("mouseleave", off); w.addEventListener("blur", off); w.addEventListener("click", click);
    return () => { w.removeEventListener("mouseenter", on); w.removeEventListener("focus", on); w.removeEventListener("mouseleave", off); w.removeEventListener("blur", off); w.removeEventListener("click", click); };
  });

  function addMember(name: string, blocks: number[], instant: boolean) {
    const cs = blocks.map((i): V3 => { let x = 0, y = 0, z = 0, n = 0; for (const v of cubeV[INFO[i].cube]) { x += L0[v][0]; y += L0[v][1]; z += L0[v][2]; n++; } return [x / n, y / n, z / n]; });
    const m = cs.reduce<V3>((a, c) => [a[0] + c[0] / cs.length, a[1] + c[1] / cs.length, a[2] + c[2] / cs.length], [0, 0, 0]);
    const d = Math.hypot(m[0], m[1], m[2]); const dir: V3 = d < .2 ? [.62, .5, .6] : [m[0] / d, m[1] / d, m[2] / d];
    const pos: V3 = [m[0] + dir[0] * 1.7, m[1] + dir[1] * 1.7, m[2] + dir[2] * 1.7];
    const links = blocks.map((i) => { let best = -1, bd = 1e9; for (const v of cubeV[INFO[i].cube]) { const q = L0[v], dd = Math.hypot(q[0] - pos[0], q[1] - pos[1], q[2] - pos[2]); if (dd < bd) { bd = dd; best = v; } } return best; });
    member = { pos, links, blocks, name, t0: instant ? -1e9 : performance.now() };
    kick();
  }

  let dragging = false, moved = 0, lx = 0, ly = 0, lastInput = -1e9, W = 0, H = 0, ox = 0, oy = 0, S = 1, visible = true, raf = 0, alive = true;
  const t0 = performance.now();
  const packets = Array.from({ length: 9 }, () => ({ e: (rnd() * LEdges.length) | 0, t: rnd(), s: .35 + rnd() * .4, f: rnd() < .5 }));

  function resize() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wide = W > 860, ht = heroTxt.offsetTop;
    hero0 = wide ? { ox: W / 2, oy: Math.max(H * .22, Math.min(H * .4, (ht + 64) / 2)), S: Math.max(40, Math.min(W * .2, (ht - 110) / 3.4)) } : { ox: W / 2, oy: H * .25, S: Math.min(W, H) * .15 };
    side = wide ? { ox: W * .7, oy: H * .5, S: Math.min(W, H) * .18 } : { ox: W / 2, oy: H * .24, S: Math.min(W, H) * .15 };
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
    { const pr = Math.min(1, Math.max(0, scrollY / (H * .7))), e2 = pr * pr * (3 - 2 * pr); ox = hero0.ox + (side.ox - hero0.ox) * e2; oy = hero0.oy + (side.oy - hero0.oy) * e2; S = hero0.S + (side.S - hero0.S) * e2; }
    const direct = wordHover >= 0 || hover >= 0;
    let want = wordHover >= 0 ? wordHover : hover >= 0 ? hover : scrollActive >= 0 ? scrollActive : pinned;
    if (want < 0 && !joining && scrollY < H * .3 && !reduce && k >= 1 && (now - lastUser) > 4000 && (now - lastInput) > 4000) { const c = Math.floor((el - 2) / 3.2); want = c >= 0 && c % 4 < 3 ? c % 4 : -1; }
    setActive(want, direct || (scrollActive < 0 && want >= 0));
    for (let i = 0; i < 3; i++) { const tg = active === i || (joining && sel.has(i)) ? 1 : member && member.blocks.includes(i) ? .4 : 0; glow[i] += (tg - glow[i]) * (reduce ? 1 : .12); }
    ctx.clearRect(0, 0, W, H);
    // background cubes: drift slowly; nearer cubes shift more with scroll (parallax)
    const par = Math.min(scrollY, H * 1.5) * .05;
    const bgp = bg.map((cb) => {
      const w = reduce ? 0 : Math.sin(el * cb.sp * Math.PI * 2 + cb.ph) * .35;
      const o: V3 = [cb.c[0] + cb.dir[0] * w, cb.c[1] + cb.dir[1] * w, cb.c[2] + cb.dir[2] * w];
      return CUBE_V.map((v) => { const q = P([o[0] + v[0] * cb.s, o[1] + v[1] * cb.s, o[2] + v[2] * cb.s]); return [q[0], q[1] - par * (1 + q[2] / 8), q[2]] as P2; });
    });
    const depth = (z: number) => Math.min(1, Math.max(0, (z + 7) / 14));
    ctx.lineWidth = 1;
    for (const [i, a, j, b] of bgLinks) { const A = bgp[i][a], B = bgp[j][b]; ctx.strokeStyle = `rgba(185,138,232,${(.03 + .05 * depth((A[2] + B[2]) / 2)) * gk})`; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }
    for (const vs of bgp) {
      const dz = depth(vs.reduce((n, q) => n + q[2], 0) / 8);
      ctx.fillStyle = `rgba(155,77,219,${(.04 + .06 * dz) * gk})`; ctx.beginPath(); CUBE_TOP.forEach((n, j) => { if (j) ctx.lineTo(vs[n][0], vs[n][1]); else ctx.moveTo(vs[n][0], vs[n][1]); }); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(216,194,240,${(.07 + .13 * dz) * gk})`; ctx.beginPath(); for (const [a, b] of CUBE_E) { ctx.moveTo(vs[a][0], vs[a][1]); ctx.lineTo(vs[b][0], vs[b][1]); } ctx.stroke();
      ctx.fillStyle = `rgba(216,194,240,${(.1 + .2 * dz) * gk})`; for (const q of vs) { ctx.beginPath(); ctx.arc(q[0], q[1], .7 + .6 * dz, 0, Math.PI * 2); ctx.fill(); }
    }
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
    if (member) {
      const mt = reduce ? 1 : ease((now - member.t0) / 1400), pos = member.pos, mp = P([pos[0] * 3.4 + (pos[0] - pos[0] * 3.4) * mt, pos[1] * 3.4 + (pos[1] - pos[1] * 3.4) * mt, pos[2] * 3.4 + (pos[2] - pos[2] * 3.4) * mt]);
      ctx.save(); ctx.globalAlpha = Math.min(1, mt * 1.4); ctx.strokeStyle = "rgba(216,194,240,.85)"; ctx.lineWidth = 1.4; ctx.setLineDash([4, 5]);
      for (const v of member.links) { const q = lp[v]; ctx.beginPath(); ctx.moveTo(mp[0], mp[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      ctx.setLineDash([]); ctx.shadowColor = "rgba(216,194,240,1)"; ctx.shadowBlur = 18; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mp[0], mp[1], 6.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (!reduce && mt >= 1) { const pt = ((now - member.t0) / 1000) % 2.4; ctx.strokeStyle = `rgba(216,194,240,${Math.max(0, 1 - pt / 1.3)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mp[0], mp[1], 6.5 + pt * 20, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = "#F5EEFB"; ctx.font = `500 13px ${fontFamily}`; ctx.fillText(member.name ? "You · " + member.name.split(/\s+/)[0] : "You", mp[0] + 13, mp[1] + 4); ctx.restore();
    }
    if (active >= 0 && centers[active]) {
      const [cx, cy] = centers[active], right = cx < W * .62 || W <= 860;
      const small = W <= 860; const x = small ? W / 2 - cap.offsetWidth / 2 : right ? cx + S * .95 : cx - S * .95 - cap.offsetWidth, y = small ? oy + S * 1.55 : cy - cap.offsetHeight / 2;
      cap.style.transform = `translate(${Math.max(8, Math.min(W - cap.offsetWidth - 8, x))}px, ${Math.max(76, y)}px)`;
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

  const onDown = (e: PointerEvent) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; };
  const onMove = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5;
    const px = e.clientX - r.left, py = e.clientY - r.top; let best = -1, bd = S * .75;
    centers.forEach((c, i) => { const d = Math.hypot(c[0] - px, c[1] - py); if (d < bd) { bd = d; best = i; } });
    if (!dragging) { hover = best; if (best >= 0) lastUser = performance.now(); cv.style.cursor = best >= 0 ? "pointer" : "grab"; return; }
    moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
    tYaw += (e.clientX - lx) * .008; tPitch = Math.max(-.3, Math.min(1.2, tPitch + (e.clientY - ly) * .005)); lx = e.clientX; ly = e.clientY; lastInput = performance.now();
    if (reduce) { yaw = tYaw; pitch = tPitch; frame(performance.now()); }
  };
  const onUp = () => {
    if (dragging && moved < 6) { if (joining) { if (hover >= 0) opts.onToggle(hover); } else { pinned = hover >= 0 && pinned !== hover ? hover : -1; } lastUser = performance.now(); }
    dragging = false; cv.style.cursor = "grab"; lastInput = performance.now();
  };
  const onLeave = () => { hover = -1; };
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
    addMember,
    clearMember() { member = null; kick(); },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      stepIO.disconnect(); visIO.disconnect(); heroRO.disconnect();
      wordCleanups.forEach((f) => f());
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp);
      removeEventListener("resize", onResize); removeEventListener("scroll", onScrollReduced);
      document.removeEventListener("visibilitychange", schedule);
    },
  };
}
