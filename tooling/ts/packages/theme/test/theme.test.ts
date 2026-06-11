import { test, expect, describe } from "bun:test";
import {
  oklch, clampOklch, formatOklch, parseOklch, withLightness,
  cssVarName, deriveDark, themeFromLight,
  toCssVars, toThemeCss, toTailwindTheme, toShadcnTokens,
  graphite, terracotta, ocean, REFERENCE_SCHEMES,
} from "../src/index";

describe("OKLCH value type", () => {
  test("format + parse round-trip (with and without alpha)", () => {
    expect(formatOklch(oklch(0.64, 0.172, 36.44))).toBe("oklch(0.64 0.172 36.44)");
    expect(formatOklch(oklch(0.6, 0.1, 200, 0.5))).toBe("oklch(0.6 0.1 200 / 0.5)");
    expect(parseOklch("oklch(0.64 0.172 36.44)")).toEqual({ l: 0.64, c: 0.172, h: 36.44 });
    expect(parseOklch("oklch(0.6 0.1 200 / 0.5)")).toEqual({ l: 0.6, c: 0.1, h: 200, alpha: 0.5 });
  });

  test("parse normalizes a percent lightness; rejects junk", () => {
    expect(parseOklch("oklch(50% 0.1 120)")?.l).toBe(0.5);
    expect(parseOklch("rgb(1,2,3)")).toBeNull();
    expect(parseOklch("oklch(0.5 0.1)")).toBeNull();
  });

  test("clamp: hue wraps, lightness clamps, non-finite collapses to 0", () => {
    expect(clampOklch({ l: 1.5, c: -1, h: 400 })).toEqual({ l: 1, c: 0, h: 40 });
    expect(clampOklch({ l: NaN, c: Infinity, h: 10 })).toEqual({ l: 0, c: 0, h: 10 });
    expect(withLightness(oklch(0.5, 0.1, 30), 0.9).l).toBe(0.9);
  });
});

describe("token var names", () => {
  test("cssVarName kebab-cases compound roles", () => {
    expect(cssVarName("background")).toBe("--background");
    expect(cssVarName("primaryForeground")).toBe("--primary-foreground");
    expect(cssVarName("mutedForeground")).toBe("--muted-foreground");
  });
});

describe("deriveDark — deterministic generate-dark-from-light", () => {
  test("is a pure function: same light spec → identical dark spec", () => {
    expect(deriveDark(terracotta)).toEqual(deriveDark(terracotta));
  });

  test("surfaces darken, text lightens, and text stays lighter than its surface (readable)", () => {
    const dark = deriveDark(terracotta);
    expect(dark.colors.background.l).toBeLessThan(terracotta.colors.background.l); // surface goes dark
    expect(dark.colors.foreground.l).toBeGreaterThan(terracotta.colors.foreground.l); // text goes light
    expect(dark.colors.foreground.l).toBeGreaterThan(dark.colors.background.l); // contrast preserved
  });

  test("a colored brand keeps its hue + chroma and stays vivid", () => {
    const dark = deriveDark(terracotta);
    expect(dark.colors.primary.h).toBe(terracotta.colors.primary.h); // hue preserved
    expect(dark.colors.primary.c).toBe(terracotta.colors.primary.c); // chroma preserved
    expect(dark.colors.primary.l).toBeGreaterThanOrEqual(0.6); // vivid on dark
  });

  test("a NEUTRAL brand (graphite, chroma 0) inverts to near-white on dark", () => {
    const dark = deriveDark(graphite);
    expect(dark.colors.primary.c).toBe(0);
    expect(dark.colors.primary.l).toBeGreaterThan(0.85);
  });

  test("themeFromLight derives dark when not supplied, keeps it when supplied", () => {
    expect(themeFromLight(terracotta).dark).toEqual(deriveDark(terracotta));
    expect(themeFromLight(terracotta, graphite).dark).toBe(graphite);
  });
});

describe("projections — one spec → CSS vars / Tailwind @theme / shadcn map", () => {
  test("toCssVars emits OKLCH custom properties + radius, under a selector", () => {
    const css = toCssVars(terracotta);
    expect(css).toStartWith(":root {");
    expect(css).toContain("--background: oklch(1 0 0);");
    expect(css).toContain("--primary: oklch(0.6397 0.172 36.44);");
    expect(css).toContain("--radius: 0.625rem;");
    expect(toCssVars(terracotta, { selector: ".scope" })).toStartWith(".scope {");
  });

  test("toThemeCss scopes light at :root and dark at the data-theme selector", () => {
    const css = toThemeCss(themeFromLight(terracotta));
    expect(css).toContain(":root {");
    expect(css).toContain("[data-theme='dark'] {");
  });

  test("toTailwindTheme maps tokens to utility vars (referencing the :root vars)", () => {
    const tw = toTailwindTheme(terracotta);
    expect(tw).toStartWith("@theme inline {");
    expect(tw).toContain("--color-background: var(--background);");
    expect(tw).toContain("--color-primary-foreground: var(--primary-foreground);");
    expect(tw).toContain("--radius-lg: var(--radius);");
  });

  test("toShadcnTokens returns the CSS-var → value map shadcn consumes", () => {
    const map = toShadcnTokens(terracotta);
    expect(map["--primary"]).toBe("oklch(0.6397 0.172 36.44)");
    expect(map["--radius"]).toBe("0.625rem");
  });
});

describe("reference schemes", () => {
  test("three schemes prove the mechanism; terracotta carries saastarter's hue", () => {
    expect(Object.keys(REFERENCE_SCHEMES)).toEqual(["graphite", "terracotta", "ocean"]);
    expect(terracotta.colors.primary.h).toBe(36.44);
    expect(ocean.colors.primary.h).toBe(250);
    // every reference scheme survives the full pipeline without throwing
    for (const s of Object.values(REFERENCE_SCHEMES)) {
      expect(toThemeCss(themeFromLight(s))).toContain("--primary:");
    }
  });
});
