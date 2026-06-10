// Build the full Suluk asset set from the master SVGs.
// Run: bun build.ts   (cwd = branding/.render)
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");        // branding/
const OUT = resolve(ROOT, "export");
mkdirSync(OUT, { recursive: true });

function png(svgFile: string, size: number): Buffer {
  const svg = readFileSync(resolve(ROOT, svgFile), "utf8");
  return new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  }).render().asPng();
}

function write(name: string, buf: Buffer) {
  writeFileSync(resolve(OUT, name), buf);
  console.log(`  ${name}  (${buf.length.toLocaleString()} bytes)`);
}

// ---- icon tile ladder (app icon / marketplace / favicon source) ----
const ICON_SIZES = [16, 32, 48, 64, 128, 180, 256, 512, 1024];
console.log("icon tile:");
const iconPngs: Record<number, Buffer> = {};
for (const s of ICON_SIZES) {
  const b = png("suluk-icon.svg", s);
  iconPngs[s] = b;
  write(`icon-${s}.png`, b);
}

// ---- transparent glyph mark ----
console.log("mark (transparent):");
for (const s of [128, 256, 512]) write(`mark-${s}.png`, png("suluk-mark.svg", s));

// ---- wordmark lockup (1x + 2x for crisp README/banner) ----
console.log("wordmark:");
write("wordmark.png", png("suluk-wordmark.svg", 760));
write("wordmark@2x.png", png("suluk-wordmark.svg", 1520));

// ---- social card (OG / GitHub social preview, 1200x630) ----
console.log("social card:");
write("social-card.png", png("suluk-social-card.svg", 1200));

// ---- favicon.ico (PNG-embedded, sizes 16/32/48) ----
function buildIco(entries: { size: number; png: Buffer }[]): Buffer {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type = icon
  header.writeUInt16LE(count, 4);  // image count
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const blobs: Buffer[] = [];
  entries.forEach((e, i) => {
    const o = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 0);   // width  (0 => 256)
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1);   // height (0 => 256)
    dir.writeUInt8(0, o + 2);                            // palette
    dir.writeUInt8(0, o + 3);                            // reserved
    dir.writeUInt16LE(1, o + 4);                         // color planes
    dir.writeUInt16LE(32, o + 6);                        // bits per pixel
    dir.writeUInt32LE(e.png.length, o + 8);             // size of data
    dir.writeUInt32LE(offset, o + 12);                  // offset of data
    offset += e.png.length;
    blobs.push(e.png);
  });
  return Buffer.concat([header, dir, ...blobs]);
}
console.log("favicon:");
const ico = buildIco([16, 32, 48].map((s) => ({ size: s, png: iconPngs[s] })));
write("favicon.ico", ico);
// modern SVG favicon is just the tile master
write("favicon.svg", Buffer.from(readFileSync(resolve(ROOT, "suluk-icon.svg"))));
// apple-touch convention
write("apple-touch-icon.png", iconPngs[180]);

console.log("\nDone -> branding/export/");
