import { hero } from "@/content/site";
import { ogImage, ogSize } from "@/lib/og";

export const alt = "NYU Blockchain Society: Blockchain, Finance & AI.";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "Blockchain, Finance & AI.", subtitle: `${hero.ledeLead} ${hero.lede}` });
}
