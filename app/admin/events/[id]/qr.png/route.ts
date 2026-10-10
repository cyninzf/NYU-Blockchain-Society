import { checkinUrl, qrPng } from "@/lib/qr";
import { download, qrEvent } from "@/lib/qr-route";

// The check-in QR as a 2048 px PNG. Super admins only.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const e = await qrEvent(params);
  if (e instanceof Response) return e;
  return download(new Uint8Array(await qrPng(checkinUrl(e.slug))), "image/png", `checkin-${e.slug}.png`);
}
