import { accelerator } from "@/content/accelerator";
import { ogImage, ogSize } from "@/lib/og";

export const alt = "Accelerator, NYU Blockchain Society: building";
export const size = ogSize;
export const contentType = "image/png";

// No date: the accelerator is still being built.
export default function Image() {
  return ogImage({ kicker: `Block 02 · ${accelerator.status}`, title: accelerator.title, subtitle: "Support for NYU founders building across blockchain, finance and AI, being designed with the NYU alumni community." });
}
