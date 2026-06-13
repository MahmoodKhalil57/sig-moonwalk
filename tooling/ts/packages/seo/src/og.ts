/** OG-image SVG generation — a branded 1200×630 social card (eyebrow + wrapped title + subtitle + brand) on a
 *  gradient-accented dark panel. Serve as `image/svg+xml`, or rasterize to PNG with a renderer if a platform needs it. */
import { escXml } from "./util";

export interface OgImageInput {
  title: string;
  subtitle?: string;
  brand?: string;
  eyebrow?: string;
  width?: number;
  height?: number;
  bg?: string;
  fg?: string;
  accent?: string;
  accent2?: string;
}

/** Greedy word-wrap to ~`max` chars/line, capped at `lines` lines (last line ellipsized if it overflows). */
function wrap(text: string, max: number, lines: number): string[] {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; if (out.length === lines) break; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur && out.length < lines) out.push(cur);
  if (out.length === lines && words.join(" ").length > out.join(" ").length) out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, "") + "…";
  return out.length ? out : [""];
}

export function ogImageSvg(i: OgImageInput): string {
  const W = i.width ?? 1200, H = i.height ?? 630;
  const bg = i.bg ?? "#0b0f1a", fg = i.fg ?? "#f4f6fb", accent = i.accent ?? "#6366f1", accent2 = i.accent2 ?? "#8b5cf6";
  const lines = wrap(i.title, 22, 3);
  const titleTop = 252 + (3 - lines.length) * 40;
  const F = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";
  const titleSvg = lines.map((ln, idx) =>
    `<text x="80" y="${titleTop + idx * 88}" font-size="74" font-weight="800" letter-spacing="-2" fill="${escXml(fg)}" font-family="${F}">${escXml(ln)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escXml(accent)}"/><stop offset="1" stop-color="${escXml(accent2)}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="${escXml(bg)}"/>
  <circle cx="${W - 110}" cy="${H - 90}" r="240" fill="url(#g)" opacity="0.16"/>
  <rect width="${W}" height="9" fill="url(#g)"/>
  ${i.eyebrow ? `<text x="80" y="140" font-size="28" font-weight="700" letter-spacing="5" fill="${escXml(accent)}" font-family="${F}">${escXml(i.eyebrow.toUpperCase())}</text>` : ""}
  ${titleSvg}
  ${i.subtitle ? `<text x="80" y="${titleTop + lines.length * 88 + 18}" font-size="33" fill="${escXml(fg)}" opacity="0.72" font-family="${F}">${escXml(i.subtitle)}</text>` : ""}
  ${i.brand ? `<text x="80" y="${H - 64}" font-size="32" font-weight="700" fill="${escXml(fg)}" font-family="${F}">${escXml(i.brand)}</text>` : ""}
</svg>`;
}
