/**
 * Reference schemes (saastarter-parity Phase 1). Two or three light TokenSpecs that PROVE the mechanism end-to-end
 * (author light → derive dark → project to CSS/Tailwind/shadcn). The 40+ curated catalog saastarter ships is
 * meta-product BREADTH, authored on top of this same TokenSpec — not part of the package's mechanism surface.
 */
import { oklch, type Oklch } from "./oklch";
import type { ColorTokens, TokenSpec } from "./tokens";

const N = (l: number): Oklch => oklch(l, 0, 0); // a neutral gray at lightness l

/** Build a light ColorTokens set: neutral shadcn surfaces + a brand (primary/ring) + accent foreground. */
function lightColors(brand: Oklch, brandFg: Oklch = N(0.985)): ColorTokens {
  return {
    background: N(1), foreground: N(0.145),
    card: N(1), cardForeground: N(0.145),
    popover: N(1), popoverForeground: N(0.145),
    primary: brand, primaryForeground: brandFg,
    secondary: N(0.97), secondaryForeground: N(0.205),
    muted: N(0.97), mutedForeground: N(0.556),
    accent: N(0.97), accentForeground: N(0.205),
    destructive: oklch(0.577, 0.245, 27.325), destructiveForeground: N(0.985),
    border: N(0.922), input: N(0.922), ring: brand,
  };
}

const FONTS = { sans: "ui-sans-serif, system-ui, sans-serif", serif: "Georgia, serif", mono: "ui-monospace, monospace" };

function scheme(name: string, brand: Oklch, brandFg?: Oklch): TokenSpec {
  return { name, colors: lightColors(brand, brandFg), radius: 0.625, fonts: FONTS };
}

/** Neutral graphite (saastarter's default scheme name) — a chroma-free brand. */
export const graphite: TokenSpec = scheme("graphite", N(0.205), N(0.985));

/** Terracotta — saastarter's signature accent (globals.css oklch(0.6397 0.172 36.44)). */
export const terracotta: TokenSpec = scheme("terracotta", oklch(0.6397, 0.172, 36.44));

/** Ocean — a cool blue brand, to show a colored hue derives correctly. */
export const ocean: TokenSpec = scheme("ocean", oklch(0.55, 0.18, 250));

/** The reference set, keyed by name. */
export const REFERENCE_SCHEMES: Record<string, TokenSpec> = { graphite, terracotta, ocean };
