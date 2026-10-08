// Brand assets for the media kit. Files live in public/brand/; PNGs and the ZIP are generated
// into public/media-kit/ at build time by scripts/media-kit.mjs.

/** `best`: the background a transparent mark is meant for (the icon and avatar carry their own). */
export type Mark = { file: string; name: string; use: string; best?: "dark" | "light" };

export const marks: Mark[] = [
  { file: "mark-node-white", name: "Node mark, white", use: "Dark backgrounds, 48 px and up", best: "dark" },
  { file: "mark-node-violet", name: "Node mark, violet", use: "Light backgrounds, 48 px and up", best: "light" },
  { file: "mark-solid-white", name: "Solid mark, white", use: "Dark backgrounds, under 48 px", best: "dark" },
  { file: "mark-solid-violet", name: "Solid mark, violet", use: "Light backgrounds, under 48 px", best: "light" },
  { file: "favicon", name: "App icon", use: "Favicon and app icon" },
  { file: "avatar", name: "Avatar", use: "X and LinkedIn profile image" },
];

export const PNG_SIZES = [512, 1024, 2048];
export const ZIP_FILE = "/media-kit/nyu-blockchain-society-media-kit.zip";

/** Mirrors the tokens in :root (app/globals.css). */
export const colors: { group: string; swatches: { name: string; token?: string; hex: string; note?: string }[] }[] = [
  {
    group: "Brand",
    swatches: [
      { name: "NYU Violet", token: "--violet", hex: "#57068C" },
      { name: "Glow", token: "--glow", hex: "#9B4DDB" },
      { name: "Lilac", token: "--lilac", hex: "#D8C2F0" },
      { name: "Night", token: "--ink", hex: "#1C0533", note: "Base of the violet night gradient" },
      { name: "Night high", hex: "#3A0A63", note: "Top of the violet night gradient" },
    ],
  },
  {
    group: "On dark",
    swatches: [
      { name: "Surface", token: "--ink-2", hex: "#250A42" },
      { name: "Line", token: "--ink-line", hex: "#3E1D5E" },
      { name: "Muted text", token: "--ink-muted", hex: "#B9A3D0" },
      { name: "Text", token: "--ink-fg", hex: "#F5EEFB" },
    ],
  },
  {
    group: "On light",
    swatches: [
      { name: "Background", token: "--bg", hex: "#F5F1F9" },
      { name: "Line", token: "--line", hex: "#DED2EA" },
      { name: "Muted text", token: "--muted", hex: "#5C4C6C" },
      { name: "Text", token: "--fg", hex: "#120A1C" },
    ],
  },
];
