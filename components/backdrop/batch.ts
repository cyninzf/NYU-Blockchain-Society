// Batches canvas paths by (quantized) opacity, so a frame strokes or fills a few dozen paths
// instead of one per edge or node. 40 opacity steps are indistinguishable at these alphas.

export function batch() {
  const m = new Map<number, Path2D>();
  return {
    /** The path for this opacity, or null when it rounds to invisible. */
    path(alpha: number) { const k = Math.round(alpha * 40); if (k <= 0) return null; let p = m.get(k); if (!p) m.set(k, (p = new Path2D())); return p; },
    stroke(ctx: CanvasRenderingContext2D, rgb: string) { for (const [k, p] of m) { ctx.strokeStyle = `rgba(${rgb},${Math.min(k, 40) / 40})`; ctx.stroke(p); } },
    fill(ctx: CanvasRenderingContext2D, rgb: string) { for (const [k, p] of m) { ctx.fillStyle = `rgba(${rgb},${Math.min(k, 40) / 40})`; ctx.fill(p); } },
  };
}

/** Adds a full circle to a path as its own subpath. */
export const dot = (p: Path2D, x: number, y: number, r: number) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2); };
