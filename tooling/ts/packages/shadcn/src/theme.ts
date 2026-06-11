/**
 * @suluk/shadcn ← @suluk/theme (saastarter-parity Phase 2). The TokenSpec contract projects into the two files a
 * shadcn project actually needs: `globals.css` (the token CSS vars for light + dark + the Tailwind v4 `@theme inline`
 * block) and `components.json` (the shadcn CLI config, `cssVariables: true` so the tokens drive every component).
 * One TokenSpec → the whole shadcn theme, instead of hand-syncing globals.css against the component library.
 */
import { toThemeCss, toTailwindTheme, themeFromLight, type TokenSpec, type ThemeSpec } from "@suluk/theme";

export interface ShadcnThemeOptions {
  /** shadcn style. Default "new-york". */
  style?: string;
  /** base color name for components.json. Default "neutral". */
  baseColor?: string;
  /** the globals.css path recorded in components.json. Default "src/app/globals.css". */
  cssPath?: string;
  /** the dark-mode selector (shadcn convention is `.dark`; saastarter uses `[data-theme='dark']`). Default ".dark". */
  darkSelector?: string;
  /** React Server Components flag for components.json. Default true. */
  rsc?: boolean;
}

/** Normalize a TokenSpec (light) or a full ThemeSpec into `{ light, dark }` (deriving dark when only light is given). */
function asTheme(theme: TokenSpec | ThemeSpec): ThemeSpec {
  return "light" in theme && "dark" in theme ? (theme as ThemeSpec) : themeFromLight(theme as TokenSpec);
}

/**
 * The shadcn `globals.css`: the Tailwind import + the `dark` custom-variant + the token vars (light at `:root`,
 * dark at the dark selector) + the `@theme inline` mapping + a base layer applying border/bg/text tokens.
 */
export function renderGlobalsCss(theme: TokenSpec | ThemeSpec, opts: ShadcnThemeOptions = {}): string {
  const t = asTheme(theme);
  const darkSelector = opts.darkSelector ?? ".dark";
  const variant = `@custom-variant dark (&:is(${darkSelector} *));`;
  const vars = toThemeCss(t, { darkSelector });
  const themeBlock = toTailwindTheme(t.light);
  return `@import "tailwindcss";

${variant}

${vars}

${themeBlock}

@layer base {
  * { border-color: var(--border); }
  body { background-color: var(--background); color: var(--foreground); }
}
`;
}

/** The shadcn `components.json` CLI config — `cssVariables: true`, so the generated tokens drive the components. */
export function renderComponentsJson(opts: ShadcnThemeOptions = {}): string {
  const config = {
    $schema: "https://ui.shadcn.com/schema.json",
    style: opts.style ?? "new-york",
    rsc: opts.rsc ?? true,
    tsx: true,
    tailwind: {
      config: "",
      css: opts.cssPath ?? "src/app/globals.css",
      baseColor: opts.baseColor ?? "neutral",
      cssVariables: true,
      prefix: "",
    },
    aliases: {
      components: "@/components",
      utils: "@/lib/utils",
      ui: "@/components/ui",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    iconLibrary: "lucide",
  };
  return JSON.stringify(config, null, 2) + "\n";
}

/** The full shadcn theme file set from a TokenSpec/ThemeSpec: the css path → globals.css + components.json. */
export function renderShadcnTheme(theme: TokenSpec | ThemeSpec, opts: ShadcnThemeOptions = {}): Record<string, string> {
  const cssPath = opts.cssPath ?? "src/app/globals.css";
  return {
    [cssPath]: renderGlobalsCss(theme, opts),
    "components.json": renderComponentsJson(opts),
  };
}
