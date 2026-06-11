/**
 * deriveDark — deterministic generate-dark-from-light (saastarter-parity Phase 1). OKLCH separates lightness from
 * chroma/hue, so a dark scheme is a role-aware LIGHTNESS remap that PRESERVES each token's chroma + hue: surfaces
 * go dark, text goes light, brand colors stay vivid. Deterministic (same light spec → same dark spec) and derived
 * from the light values (a lighter light-surface maps to a slightly lighter dark-surface), so it is a real
 * derivation, not a fixed dark palette. The 40+ curated dark schemes (meta-product) refine this baseline.
 */
import { clampOklch, type Oklch } from "./oklch";
import { COLOR_ROLES, type ColorTokens, type TokenSpec } from "./tokens";

const BRAND = new Set<keyof ColorTokens>(["primary", "destructive", "ring"]);
const BASE_SURFACE = new Set<keyof ColorTokens>(["background", "card", "popover"]);

/** Remap one token's lightness for dark mode by role, keeping chroma + hue. */
function darkenRole(role: keyof ColorTokens, color: Oklch): Oklch {
  const { c, h } = color;
  // text (the bare `foreground` OR any `*Foreground`): light text on dark — derived so a darker light-text stays a
  // touch darker. NOTE: case-insensitive — `"foreground".endsWith("Foreground")` is false, so a capital-F check
  // would misclassify the PRIMARY body-text token as a surface and darken it (dark-on-dark text). This is the fix.
  if (role.toLowerCase().endsWith("foreground")) return clampOklch({ l: 0.97 - color.l * 0.12, c, h });
  // brand accents: a NEUTRAL brand (near-zero chroma) inverts to near-white; a colored brand stays vivid.
  if (BRAND.has(role)) {
    if (c < 0.03) return clampOklch({ l: 0.92, c, h });
    return clampOklch({ l: Math.max(color.l, 0.6), c, h });
  }
  // surfaces: base surfaces are darkest; raised surfaces + borders sit above them. Floor + a small light-derived lift.
  const floor = BASE_SURFACE.has(role) ? 0.13 : 0.22;
  return clampOklch({ l: floor + (1 - color.l) * 0.05, c, h });
}

/** Derive a dark TokenSpec from a light one (colors remapped; radius/fonts/scales carried through). */
export function deriveDark(light: TokenSpec): TokenSpec {
  const colors = {} as ColorTokens;
  for (const role of COLOR_ROLES) colors[role] = darkenRole(role, light.colors[role]);
  return {
    ...light,
    name: light.name,
    colors,
  };
}

/** Build a complete {light, dark} ThemeSpec, deriving dark when not supplied. */
export function themeFromLight(light: TokenSpec, dark?: TokenSpec): { light: TokenSpec; dark: TokenSpec } {
  return { light, dark: dark ?? deriveDark(light) };
}
