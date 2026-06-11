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

export interface BaseCssOptions {
  /** CSS value for keyboard focus rings (default the theme's `var(--ring)`). Pass your own accent var if your app
   *  uses a different color vocabulary. */
  ring?: string;
  /** CSS value for error / invalid states (default `var(--destructive)`). */
  destructive?: string;
  /** CSS value for the corner radius used on focus rings (default `var(--radius)`). */
  radius?: string;
}

/**
 * The reusable design-system BASE layer — the accessibility + motion contract every builder inherits, independent
 * of the scheme colors. Parameterized by CSS-var names so an app on its OWN color vocabulary (not the shadcn role
 * names) can point it at its own ring/destructive vars. Emits, all reduced-motion-gated:
 *   - keyboard-only focus rings (`:focus-visible`) on every interactive element — mouse clicks stay clean;
 *   - the `[aria-invalid]` destructive border+ring contract (app toggles the attribute, theme owns the look);
 *   - the `.sr-only` + `.skip-link` accessibility utilities (skip-to-content);
 *   - motion primitives — `shake`/`fade-in-down` (form errors), `[data-reveal]` staggered scroll-reveal, and the
 *     asymptotic `.navprogress` bar — so each app drives behavior while the look is one inherited source;
 *   - a GLOBAL `prefers-reduced-motion` baseline that neutralizes all of the above for users who ask for it.
 */
export function renderBaseCss(opts: BaseCssOptions = {}): string {
  const ring = opts.ring ?? "var(--ring)";
  const destructive = opts.destructive ?? "var(--destructive)";
  const radius = opts.radius ?? "var(--radius)";
  return `/* @suluk/theme base layer — a11y + motion contract (reduced-motion-gated). */
:where(a,button,[role="button"],input,select,textarea,summary,[tabindex]):focus-visible {
  outline: 2px solid ${ring}; outline-offset: 2px; border-radius: ${radius};
}
:where(a,button,input,select,textarea):focus:not(:focus-visible) { outline: none; }
[aria-invalid="true"], [data-invalid="true"] {
  border-color: ${destructive} !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, ${destructive} 22%, transparent) !important;
}
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.skip-link { position:fixed; top:8px; inset-inline-start:8px; z-index:100; padding:9px 15px; border-radius:9px; background:var(--panel,#fff); color:var(--fg,#000); border:1px solid ${ring}; font-weight:600; transform:translateY(-160%); transition:transform .18s ease; }
.skip-link:focus { transform:translateY(0); outline:2px solid ${ring}; outline-offset:2px; }
@keyframes suluk-shake { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(2px)} 30%,50%,70%{transform:translateX(-4px)} 40%,60%{transform:translateX(4px)} }
@keyframes suluk-fade-in-down { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
.shake { animation: suluk-shake .4s cubic-bezier(.36,.07,.19,.97) both; }
.fade-in-down { animation: suluk-fade-in-down .22s ease both; }
[data-reveal] { opacity:0; transform:translateY(12px); transition:opacity .5s ease, transform .5s ease; transition-delay:calc(var(--i,0)*80ms); }
[data-reveal].reveal-in { opacity:1; transform:none; }
.navprogress { position:fixed; top:0; inset-inline-start:0; height:3px; width:0; z-index:95; background:${ring}; box-shadow:0 0 9px ${ring}, 0 0 4px ${ring}; opacity:0; transition:width .2s ease, opacity .3s ease; pointer-events:none; }
.navprogress.active { opacity:1; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important; scroll-behavior:auto!important; }
  [data-reveal] { opacity:1; transform:none; }
}`;
}
