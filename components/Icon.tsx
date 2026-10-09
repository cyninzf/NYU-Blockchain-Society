// Inline arrows and marks. Unicode arrows (↗ → ←) render as emoji on some iOS versions,
// so every arrow on the site is one of these SVGs. Decorative: pair with text or an sr label.

const PATHS = {
  "arrow-up-right": "M5 11 11 5M6 5h5v5",
  "arrow-right": "M3 8h10M9 4l4 4-4 4",
  "arrow-left": "M13 8H3M7 4 3 8l4 4",
  "arrow-down": "M8 3v10M4 9l4 4 4-4",
  check: "M3.5 8.5 6.5 11.5 12.5 4.5",
  menu: "M2.5 5h11M2.5 11h11",
  close: "M4 4l8 8M12 4l-8 8",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = "0.9em", className }: { name: IconName; size?: number | string; className?: string }) {
  return (
    <svg className={className ? `ic ${className}` : "ic"} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
