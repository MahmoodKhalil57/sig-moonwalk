/**
 * The OKLCH value type (saastarter-parity Phase 1). saastarter's themes are OKLCH (globals.css), the modern
 * perceptually-uniform color space — lightness, chroma, hue are independent, which is exactly what makes a
 * deterministic light→dark derivation tractable (you move L without smearing hue). Pure value type + parse/format;
 * no CSS engine, no deps.
 */

export interface Oklch {
  /** perceptual lightness, 0 (black) … 1 (white). */
  l: number;
  /** chroma (colorfulness), ≥ 0 (~0.37 max for sRGB). */
  c: number;
  /** hue angle in degrees, 0 … 360. */
  h: number;
  /** optional alpha, 0 … 1. */
  alpha?: number;
}

const round = (n: number, dp = 4) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Construct an OKLCH color (clamped to valid ranges). */
export function oklch(l: number, c: number, h: number, alpha?: number): Oklch {
  return clampOklch({ l, c, h, ...(alpha === undefined ? {} : { alpha }) });
}

/** Clamp to valid ranges: l∈[0,1], c≥0, h wrapped to [0,360), alpha∈[0,1]. Non-finite inputs collapse to 0. */
export function clampOklch(color: Oklch): Oklch {
  const fin = (n: number) => (Number.isFinite(n) ? n : 0);
  const out: Oklch = {
    l: Math.min(1, Math.max(0, fin(color.l))),
    c: Math.max(0, fin(color.c)),
    h: ((fin(color.h) % 360) + 360) % 360,
  };
  if (color.alpha !== undefined) out.alpha = Math.min(1, Math.max(0, fin(color.alpha)));
  return out;
}

/** Format as a CSS `oklch(L C H)` / `oklch(L C H / A)` string. */
export function formatOklch(color: Oklch): string {
  const { l, c, h, alpha } = clampOklch(color);
  const base = `${round(l)} ${round(c)} ${round(h)}`;
  return alpha === undefined ? `oklch(${base})` : `oklch(${base} / ${round(alpha)})`;
}

/** Parse a CSS `oklch(L C H)` / `oklch(L C H / A)` string. Percentages on L are normalized (50% → 0.5). Null on miss. */
export function parseOklch(input: string): Oklch | null {
  const m = /^\s*oklch\(\s*([^)]+)\)\s*$/i.exec(input);
  if (!m) return null;
  const [coords, alphaRaw] = m[1].split("/");
  const parts = coords.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const num = (s: string, isL = false) => {
    if (s.endsWith("%")) { const v = parseFloat(s); return isL ? v / 100 : v; }
    return parseFloat(s);
  };
  const l = num(parts[0], true), c = num(parts[1]), h = num(parts[2]);
  if (![l, c, h].every(Number.isFinite)) return null;
  const alpha = alphaRaw !== undefined ? num(alphaRaw.trim()) : undefined;
  return clampOklch({ l, c, h, ...(alpha !== undefined && Number.isFinite(alpha) ? { alpha } : {}) });
}

/** A copy with a new lightness (kept in [0,1]). */
export function withLightness(color: Oklch, l: number): Oklch {
  return clampOklch({ ...color, l });
}

/** A copy with a new alpha. */
export function withAlpha(color: Oklch, alpha: number): Oklch {
  return clampOklch({ ...color, alpha });
}
