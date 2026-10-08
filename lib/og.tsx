import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteName } from "@/content/site";

export const ogSize = { width: 1200, height: 630 };

async function loadMark() {
  "use cache";
  return readFile(join(process.cwd(), "public/brand/mark-node-white.svg"), "base64");
}

/** The site's share image: brand mark, a large title and a muted line. */
export async function ogImage({ title, subtitle }: { title: string; subtitle: string }) {
  const mark = await loadMark();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(120% 90% at 72% 30%, #3A0A63 0%, #24063F 45%, #1C0533 100%)",
          color: "#F5EEFB",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser */}
          <img src={`data:image/svg+xml;base64,${mark}`} width={72} height={72} alt="" />
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.01em" }}>{siteName}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <span style={{ fontSize: title.length > 26 ? 76 : 92, lineHeight: 1.02, letterSpacing: "-0.05em", maxWidth: 1040 }}>{title}</span>
          <span style={{ fontSize: 32, lineHeight: 1.35, color: "#B9A3D0", maxWidth: 980 }}>{subtitle}</span>
        </div>
      </div>
    ),
    ogSize,
  );
}
