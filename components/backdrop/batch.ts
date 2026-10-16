// Batches canvas paths by (quantized) opacity, so a frame strokes or fills a few dozen paths
// instead of one per edge or node. 40 opacity steps are indistinguishable at these alphas.

/** `steps`: opacity levels (fewer = fewer fills, for small sets such as the member accent). */
export function batch(steps = 40) {
  const m = new Map<number, Path2D>();
  return {
    /** The path for this opacity, or null when it rounds to invisible. */
    path(alpha: number) { const k = Math.round(alpha * steps); if (k <= 0) return null; let p = m.get(k); if (!p) m.set(k, (p = new Path2D())); return p; },
    stroke(ctx: CanvasRenderingContext2D, rgb: string) { for (const [k, p] of m) { ctx.strokeStyle = `rgba(${rgb},${Math.min(k, steps) / steps})`; ctx.stroke(p); } },
    fill(ctx: CanvasRenderingContext2D, rgb: string) { for (const [k, p] of m) { ctx.fillStyle = `rgba(${rgb},${Math.min(k, steps) / steps})`; ctx.fill(p); } },
  };
}

/** Adds a full circle to a path as its own subpath. */
export const dot = (p: Path2D, x: number, y: number, r: number) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2); };
