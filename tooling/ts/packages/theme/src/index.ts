/**
 * @suluk/theme — the design-token CONTRACT. Author ONE TokenSpec (OKLCH colors + radius/fonts/scales) and project
 * it into CSS custom properties, the Tailwind v4 @theme block, and a shadcn token map — so the look has a single
 * source of truth instead of three hand-synced copies. Includes an OKLCH value type + a deterministic
 * generate-dark-from-light, with reference schemes proving the mechanism. The 40+ curated catalog + the no-flash
 * stamper/picker are meta-product / app-layer breadth, NOT this package. CANDIDATE tooling.
 */
export {
  oklch, clampOklch, formatOklch, parseOklch, withLightness, withAlpha, type Oklch,
} from "./oklch";
export {
  COLOR_ROLES, cssVarName,
  type ColorTokens, type FontTokens, type TokenSpec, type ThemeSpec,
} from "./tokens";
export { deriveDark, themeFromLight } from "./derive";
export {
  toCssVars, toThemeCss, toTailwindTheme, toShadcnTokens, renderBaseCss,
  type CssVarsOptions, type ThemeCssOptions, type BaseCssOptions,
} from "./emit";
export { graphite, terracotta, ocean, REFERENCE_SCHEMES } from "./schemes";
