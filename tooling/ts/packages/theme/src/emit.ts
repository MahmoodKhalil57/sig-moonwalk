/**
 * The projections (saastarter-parity Phase 1): one TokenSpec → CSS custom properties, the Tailwind v4 @theme block,
 * and a shadcn token map. This is the contract-first move — the look is DERIVED from one spec instead of three
 * hand-synced copies (the globals.css `:root` vars, the Tailwind theme, and shadcn's token names always agree).
 */
import { formatOklch } from "./oklch";
import { COLOR_ROLES, cssVarName, type TokenSpec, type ThemeSpec } from "./tokens";

export interface CssVarsOptions {
  /** the selector to scope the vars under (default ":root"). */
  selector?: string;
}

/** A scheme's CSS custom properties — the colors (OKLCH) + radius + any fonts/shadows/scales — under one selector. */
export function toCssVars(spec: TokenSpec, opts: CssVarsOptions = {}): string {
  const sel = opts.selector ?? ":root";
  const lines: string[] = [];
  for (const role of COLOR_ROLES) lines.push(`  ${cssVarName(role)}: ${formatOklch(spec.colors[role])};`);
  lines.push(`  --radius: ${spec.radius}rem;`);
  if (spec.fonts?.sans) lines.push(`  --font-sans: ${spec.fonts.sans};`);
  if (spec.fonts?.serif) lines.push(`  --font-serif: ${spec.fonts.serif};`);
  if (spec.fonts?.mono) lines.push(`  --font-mono: ${spec.fonts.mono};`);
  for (const [k, v] of Object.entries(spec.shadows ?? {})) lines.push(`  --shadow-${k}: ${v};`);
  for (const [k, v] of Object.entries(spec.typeScale ?? {})) lines.push(`  --text-${k}: ${v};`);
  for (const [k, v] of Object.entries(spec.spacing ?? {})) lines.push(`  --spacing-${k}: ${v};`);
  return `${sel} {\n${lines.join("\n")}\n}`;
}

export interface ThemeCssOptions {
  /** the selector under which the dark scheme's vars apply (default "[data-theme='dark']" — saastarter's convention). */
  darkSelector?: string;
}

/** Both modes as CSS: light at :root, dark at the dark selector. */
export function toThemeCss(theme: ThemeSpec, opts: ThemeCssOptions = {}): string {
  return toCssVars(theme.light) + "\n\n" + toCssVars(theme.dark, { selector: opts.darkSelector ?? "[data-theme='dark']" });
}

/**
 * The Tailwind v4 `@theme inline` block — maps each token to its utility variable (`--color-background`,
 * `--radius-lg`, `--font-sans`, breakpoints) referencing the `:root` custom properties, so Tailwind utilities
 * (`bg-background`, `rounded-lg`) resolve to the same source the CSS vars define.
 */
export function toTailwindTheme(spec: TokenSpec): string {
  const lines: string[] = [];
  for (const role of COLOR_ROLES) {
    const name = cssVarName(role).slice(2); // "primary-foreground"
    lines.push(`  --color-${name}: var(${cssVarName(role)});`);
  }
  lines.push(`  --radius-sm: calc(var(--radius) - 4px);`);
  lines.push(`  --radius-md: calc(var(--radius) - 2px);`);
  lines.push(`  --radius-lg: var(--radius);`);
  if (spec.fonts?.sans) lines.push(`  --font-sans: var(--font-sans);`);
  if (spec.fonts?.serif) lines.push(`  --font-serif: var(--font-serif);`);
  if (spec.fonts?.mono) lines.push(`  --font-mono: var(--font-mono);`);
  for (const [k, v] of Object.entries(spec.breakpoints ?? {})) lines.push(`  --breakpoint-${k}: ${v};`);
  return `@theme inline {\n${lines.join("\n")}\n}`;
}

/** The shadcn token map: CSS-var name → OKLCH value (+ --radius). What a shadcn `components.json`/globals consumes. */
export function toShadcnTokens(spec: TokenSpec): Record<string, string> {
  const out: Record<string, string> = {};
  for (const role of COLOR_ROLES) out[cssVarName(role)] = formatOklch(spec.colors[role]);
  out["--radius"] = `${spec.radius}rem`;
  return out;
}
