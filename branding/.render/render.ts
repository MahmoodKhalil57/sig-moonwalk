// SVG -> PNG renderer + contact sheet for judging logo concepts.
// Usage: bun render.ts <svgPath> <outPng> <size>
//        bun render.ts sheet <out.png> <size> <svg...>   (grid of all svgs at <size>, on checker bg)
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

function renderOne(svg: string, size: number): Buffer {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  return r.render().asPng();
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "sheet") {
  // Compose a horizontal contact sheet by stacking PNGs side-by-side via raw canvas math.
  // Simpler: render each, write individually; sheet handled by caller. (kept for future)
  console.log("use single-render mode");
  process.exit(0);
} else {
  const [svgPath, outPng, sizeStr] = [cmd, rest[0], rest[1]];
  const size = parseInt(sizeStr ?? "512", 10);
  const svg = readFileSync(svgPath, "utf8");
  writeFileSync(outPng, renderOne(svg, size));
  console.log(`rendered ${svgPath} -> ${outPng} @${size}px`);
}
