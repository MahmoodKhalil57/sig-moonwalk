/**
 * The TokenSpec — the typed design-token CONTRACT (saastarter-parity Phase 1). The shadcn/Tailwind-v4 token set
 * (the colors saastarter defines as OKLCH CSS vars in globals.css) plus radius/fonts/shadows + the optional
 * type/spacing/breakpoint scales. ONE spec projects into CSS vars, the Tailwind @theme block, and a shadcn token
 * map (emit.ts), so the look has a single source of truth instead of three hand-synced copies.
 */
import type { Oklch } from "./oklch";

/** The shadcn color-token roles (each a foreground/surface pair where applicable). */
export interface ColorTokens {
  background: Oklch;
  foreground: Oklch;
  card: Oklch;
  cardForeground: Oklch;
  popover: Oklch;
  popoverForeground: Oklch;
  primary: Oklch;
  primaryForeground: Oklch;
  secondary: Oklch;
  secondaryForeground: Oklch;
  muted: Oklch;
  mutedForeground: Oklch;
  accent: Oklch;
  accentForeground: Oklch;
  destructive: Oklch;
  destructiveForeground: Oklch;
  border: Oklch;
  input: Oklch;
  ring: Oklch;
}

/** the color roles, in CSS-var order — the single list emit + derive iterate. */
export const COLOR_ROLES: ReadonlyArray<keyof ColorTokens> = [
  "background", "foreground", "card", "cardForeground", "popover", "popoverForeground",
  "primary", "primaryForeground", "secondary", "secondaryForeground", "muted", "mutedForeground",
  "accent", "accentForeground", "destructive", "destructiveForeground", "border", "input", "ring",
];

export interface FontTokens {
  sans?: string;
  serif?: string;
  mono?: string;
}

/** One mode's tokens (light or dark). */
export interface TokenSpec {
  /** scheme name (e.g. "terracotta"). */
  name: string;
  colors: ColorTokens;
  /** base corner radius in rem (drives --radius and the derived sm/md/lg). */
  radius: number;
  fonts?: FontTokens;
  /** named box-shadows → CSS shadow value. */
  shadows?: Record<string, string>;
  /** named type-scale steps → font-size value (e.g. { base: "1rem", lg: "1.125rem" }). */
  typeScale?: Record<string, string>;
  /** named spacing steps → length. */
  spacing?: Record<string, string>;
  /** named breakpoints → min-width (e.g. { md: "48rem" }). */
  breakpoints?: Record<string, string>;
}

/** A complete scheme: the light mode + its dark mode (authored, or derived via deriveDark). */
export interface ThemeSpec {
  light: TokenSpec;
  dark: TokenSpec;
}

/** The CSS custom-property name for a color role (kebab-cased: primaryForeground → --primary-foreground). */
export function cssVarName(role: keyof ColorTokens): string {
  return "--" + role.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
