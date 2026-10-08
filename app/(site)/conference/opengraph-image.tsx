import { series } from "@/content/conferences";
import { ogImage, ogSize } from "@/lib/og";

export const alt = `${series.name}: annual, since ${series.since}`;
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: series.name, subtitle: `Annual, since ${series.since}. Leaders from finance, crypto, and policy at NYU.` });
}
