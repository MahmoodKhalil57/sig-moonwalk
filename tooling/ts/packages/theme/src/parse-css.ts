/**
 * Import a shadcn / tweakcn theme CSS file into the @suluk/theme vocabulary. tweakcn (tweakcn.com) and the shadcn
 * registry publish themes as CSS blocks of `--background: oklch(…)`-style custom properties: one set under `:root`
 * (light) and one under `.dark` or `html[data-theme="dark"]` (dark). This parser turns that into ColorTokens, so any
 * tweakcn theme drops into the SAME emit/derive pipeline as a hand-authored TokenSpec — the bridge that lets the
 * thousands of community themes become a single-source-of-truth Suluk theme.
 */
import { parseOklch, oklch, type Oklch } from "./oklch";
import { COLOR_ROLES, cssVarName, type ColorTokens, type TokenSpec } from "./tokens";
import { deriveDark } from "./derive";

const DARK_SELECTORS = [/html\[data-theme\s*=\s*["']?dark["']?\]\s*\{([^}]*)\}/i, /\.dark\s*\{([^}]*)\}/i];
const RED: Oklch = oklch(0.6, 0.21, 27); // a sane `destructive` when a theme omits it

/** Pull `--name: value;` declarations out of the FIRST block matching `selector`. */
function block(css: string, selector: RegExp): Record<string, string> {
  const m = selector.exec(css);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const decl of m[1].split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const name = decl.slice(0, i).trim();
    if (name.startsWith("--")) out[name] = decl.slice(i + 1).trim();
  }
  return out;
}

/** Build ColorTokens from a decl map. Missing surfaces fall back to `background`, foregrounds to `foreground`, the
 *  brand to `primary` — so an incomplete theme still yields a coherent set. null if the essentials are absent (so a
 *  non-theme `:root` block, e.g. one that only sets `--radius`, is correctly rejected). */
function tokensFrom(d: Record<string, string>): ColorTokens | null {
  const get = (role: keyof ColorTokens): Oklch | null => parseOklch(d[cssVarName(role)] ?? "");
  const background = get("background"), foreground = get("foreground"), primary = get("primary");
  if (!background || !foreground || !primary) return null;
  const out = {} as ColorTokens;
  const SURFACE = new Set<keyof ColorTokens>(["card", "popover", "secondary", "muted", "accent", "border", "input"]);
  const FG = new Set<keyof ColorTokens>(["cardForeground", "popoverForeground", "secondaryForeground", "mutedForeground", "accentForeground"]);
  for (const role of COLOR_ROLES) {
    const v = get(role);
    if (v) { out[role] = v; continue; }
    out[role] =
      role === "primary" || role === "ring" ? primary :
      role === "primaryForeground" || role === "destructiveForeground" ? background :
      role === "destructive" ? RED :
      SURFACE.has(role) ? background :
      FG.has(role) ? foreground : foreground;
  }
  return out;
}

/** Parse a shadcn/tweakcn theme CSS string into light + dark ColorTokens. Dark is read from a `.dark` /
 *  `html[data-theme="dark"]` block when present, otherwise deterministically derived from light. Returns null when
 *  the CSS has no recognizable `:root` shadcn token block. */
export function parseShadcnCss(css: string, name = ""): { name: string; light: ColorTokens; dark: ColorTokens } | null {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, ""); // drop comments
  const light = tokensFrom(block(stripped, /:root\s*\{([^}]*)\}/));
  if (!light) return null;
  let dark: ColorTokens | null = null;
  for (const sel of DARK_SELECTORS) { dark = tokensFrom(block(stripped, sel)); if (dark) break; }
  if (!dark) dark = deriveDark({ name, colors: light, radius: 0.625, fonts: { sans: "", serif: "", mono: "" } } as TokenSpec).colors;
  return { name, light, dark };
}
