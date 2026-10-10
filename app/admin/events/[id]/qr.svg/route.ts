import { checkinUrl, qrSvg } from "@/lib/qr";
import { download, qrEvent } from "@/lib/qr-route";

// The check-in QR as SVG (vector: any print size). Super admins only.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const e = await qrEvent(params);
  if (e instanceof Response) return e;
  return download(await qrSvg(checkinUrl(e.slug)), "image/svg+xml", `checkin-${e.slug}.svg`);
}
