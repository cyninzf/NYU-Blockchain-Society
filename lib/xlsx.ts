import "server-only";
import { inflateRawSync } from "node:zlib";

// Reads the first worksheet of an .xlsx file into rows of strings, in memory only: the upload
// is never written to disk. Just enough of the format for a contacts export such as the LinkedIn group's (shared strings,
// inline strings, plain values); formulas, styles and dates as dates aren't needed.

const MAX_PART = 20 * 1024 * 1024; // per unzipped part: a guard against zip bombs

function unzip(buf: Buffer): Map<string, () => Buffer> {
  // End of central directory: the last 22+ bytes (the comment can be up to 64 KB).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, () => Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip directory");
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    files.set(name, () => {
      if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error("bad zip entry");
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_PART });
      throw new Error("unsupported zip compression");
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    : ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]);

/** Text of a shared/inline string: all <t> runs, without phonetic hints. */
const textOf = (xml: string) => decode([...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];

/** Column index from a cell reference: "B7" → 1. */
const colOf = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

export function readXlsx(buf: Buffer): string[][] {
  const files = unzip(buf);
  const read = (name: string) => files.get(name)?.().toString("utf8");

  // The first sheet in workbook order, found through the workbook's relationships.
  const wb = read("xl/workbook.xml") ?? "";
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1];
  const rels = read("xl/_rels/workbook.xml.rels") ?? "";
  const target = rid && [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => m[1]).find((a) => attr(a, "Id") === rid);
  let path = target ? attr(target, "Target") ?? "" : "";
  path = path.startsWith("/") ? path.slice(1) : path ? `xl/${path}` : "xl/worksheets/sheet1.xml";
  const sheet = read(path) ?? read("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("no worksheet");

  const shared = [...(read("xl/sharedStrings.xml") ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const rows: string[][] = [];
  for (const [, body] of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    let next = 0;
    for (const [, attrs, inner = ""] of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(attrs, "r"), t = attr(attrs, "t");
      const col = ref ? colOf(ref) : next;
      next = col + 1;
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      const value = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? textOf(inner) : v != null ? decode(v) : "";
      while (row.length < col) row.push("");
      row[col] = value;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}
