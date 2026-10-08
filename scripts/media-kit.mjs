// Builds the downloadable media kit from the SVG sources in public/brand/ into
// public/media-kit/ (git-ignored): transparent PNGs at 512, 1024 and 2048 px, and a ZIP
// with everything. Runs before `next build` and `next dev`; never hand-upload these files.
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ZipArchive } from "archiver";
import sharp from "sharp";

const SRC = "public/brand";
const OUT = "public/media-kit";
const SIZES = [512, 1024, 2048];
const ZIP = "nyu-blockchain-society-media-kit.zip";

/** Set the root <svg>'s width/height so it rasterises crisply at `size` px. */
const atSize = (svg, size) =>
  svg.replace(/<svg\b([^>]*)>/, (_, attrs) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, "")} width="${size}" height="${size}">`);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const files = (await readdir(SRC)).filter((f) => f.endsWith(".svg")).sort();
const pngs = [];
for (const file of files) {
  const svg = await readFile(join(SRC, file), "utf8");
  const name = file.replace(/\.svg$/, "");
  for (const size of SIZES) {
    const out = `${name}-${size}.png`;
    await sharp(Buffer.from(atSize(svg, size))).png({ compressionLevel: 9 }).toFile(join(OUT, out));
    pngs.push(out);
  }
}

await writeFile(join(OUT, "README.txt"), [
  "NYU Blockchain Society media kit",
  "",
  "svg/  vector marks (preferred)",
  "png/  transparent PNGs at 512, 1024 and 2048 px",
  "",
  "Usage: keep clear space around the mark; use the node mark at 48 px and up and the solid",
  "mark below that; don't recolor, stretch or rotate it; don't combine it with or use the",
  "NYU logo or torch. Full guidelines: https://www.nyublockchainsociety.com/media-kit",
  "",
].join("\n"));

await new Promise((resolve, reject) => {
  const zip = new ZipArchive({ zlib: { level: 9 } });
  const stream = createWriteStream(join(OUT, ZIP));
  stream.on("close", resolve);
  zip.on("error", reject);
  zip.pipe(stream);
  for (const f of files) zip.file(join(SRC, f), { name: `svg/${f}` });
  for (const f of pngs) zip.file(join(OUT, f), { name: `png/${f}` });
  zip.file(join(OUT, "README.txt"), { name: "README.txt" });
  zip.finalize();
});

console.log(`media-kit: ${files.length} marks → ${pngs.length} PNGs + ${ZIP}`);
