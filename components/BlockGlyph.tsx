import type { IndustryId } from "@/content/industries";

// The logo's three blocks at small size: Blockchain (top), Finance (left), AI (right).
// Chosen blocks are filled; the rest are outlines.
const CUBES: Record<IndustryId, string[]> = {
  blockchain: ["100,30 134.6,50 100,70 65.4,50", "65.4,50 100,70 100,110 65.4,90", "100,70 134.6,50 134.6,90 100,110"],
  finance: ["65.4,90 100,110 65.4,130 30.7,110", "30.7,110 65.4,130 65.4,170 30.7,150", "65.4,130 100,110 100,150 65.4,170"],
  ai: ["134.6,90 169.3,110 134.6,130 100,110", "100,110 134.6,130 134.6,170 100,150", "134.6,130 169.3,110 169.3,150 134.6,170"],
};
const FILLS = ["#FFFFFF", "#D9C3EC", "#A882CC"];

export default function BlockGlyph({ blocks, size = 28 }: { blocks: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="26 26 148 148" aria-hidden="true" className="mk">
      {(Object.keys(CUBES) as IndustryId[]).map((id) => {
        const on = blocks.includes(id);
        return CUBES[id].map((pts, i) => (
          <polygon key={id + i} points={pts} fill={on ? FILLS[i] : "none"} stroke={on ? "#57068C" : "#6A4590"} strokeWidth={on ? 3 : 4} strokeLinejoin="round" />
        ));
      })}
    </svg>
  );
}
