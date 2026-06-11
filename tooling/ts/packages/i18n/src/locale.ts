/**
 * The locale + direction model (saastarter-parity Phase 1). saastarter hardcodes its locale set
 * (`SupportedLocale = "en" | "ar" | "es"`, locale.ts:3) and reads the cookie via `next/headers` (locale.ts:1,9) —
 * neither is reusable. This GENERICIZES the set into a config (the app declares its own locales) and makes
 * resolution FRAMEWORK-AGNOSTIC + Workers-safe (a cookie string / a standard Request, never `next/headers`).
 * Direction (RTL) — which saastarter sets ad-hoc in markup — is modeled here as `dirOf`.
 */

export type Direction = "ltr" | "rtl";

/** One locale in an app's set. */
export interface LocaleDef {
  /** BCP-47 tag, e.g. "en", "ar", "es" (or a region: "ar-EG"). */
  code: string;
  /** human label in its OWN language (for a picker), e.g. "العربية". */
  label?: string;
  /** writing direction (default "ltr"; set "rtl" for ar/he/fa/ur). */
  dir?: Direction;
  /** Intl numbering system, e.g. "arab" for Eastern-Arabic numerals (٠١٢٣). Default "latn". */
  numberingSystem?: string;
}

export interface LocaleConfig {
  readonly locales: readonly LocaleDef[];
  /** the fallback locale — every namespace must ship this one (the `?? en` of saastarter i18n.ts:189). */
  readonly default: string;
}

/** The literal union of an app's locale codes (use with `as const` input): `LocaleCode<typeof MY_LOCALES>`. */
export type LocaleCode<C extends LocaleConfig> = C["locales"][number]["code"];

/**
 * Define an app's locale set. Pass-through (preserves literal types under `<const>`) so callers get a precise
 * `LocaleCode<typeof config>` union AND the config to feed the loader/resolver/formatter.
 */
export function defineLocales<const C extends LocaleConfig>(config: C): C {
  return config;
}

/** All declared codes, in order. */
export function localeCodes(config: LocaleConfig): string[] {
  return config.locales.map((l) => l.code);
}

/** Is `code` a declared locale? */
export function isSupportedLocale(config: LocaleConfig, code: string | null | undefined): boolean {
  return !!code && config.locales.some((l) => l.code === code);
}

/** The writing direction for a locale (default "ltr" — an unknown code is treated as ltr). */
export function dirOf(config: LocaleConfig, code: string): Direction {
  return config.locales.find((l) => l.code === code)?.dir ?? "ltr";
}

/** Resolve a candidate (cookie value, query param, negotiated pick) to a supported locale, else the default. */
export function resolveLocale(config: LocaleConfig, candidate: string | null | undefined): string {
  return isSupportedLocale(config, candidate) ? (candidate as string) : config.default;
}

/** Read one cookie's value out of a Cookie header string (Workers-safe — no `next/headers`). */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/** Resolve the locale from a `locale` cookie in a Cookie header (Workers-safe). */
export function localeFromCookie(
  config: LocaleConfig,
  cookieHeader: string | null | undefined,
  cookieName = "locale",
): string {
  return resolveLocale(config, readCookie(cookieHeader, cookieName));
}

/**
 * Negotiate the best supported locale from an `Accept-Language` header (q-weighted; exact then primary-subtag match).
 * Returns the default when nothing matches. Used as a fallback when no `locale` cookie is set.
 */
export function negotiateLocale(config: LocaleConfig, acceptLanguage: string | null | undefined): string {
  if (!acceptLanguage) return config.default;
  const wanted = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q);
  const codes = config.locales.map((l) => l.code.toLowerCase());
  for (const { tag } of wanted) {
    const exact = codes.indexOf(tag);
    if (exact >= 0) return config.locales[exact].code;
    const primary = codes.findIndex((c) => c.split("-")[0] === tag.split("-")[0]);
    if (primary >= 0) return config.locales[primary].code;
  }
  return config.default;
}

/**
 * Resolve the locale for a standard Request: the `locale` cookie wins; else negotiate from `Accept-Language`.
 * Workers-safe (only reads `request.headers`). This is the server cookie→locale resolution the app calls per request.
 */
export function localeFromRequest(config: LocaleConfig, request: Request, cookieName = "locale"): string {
  const cookie = readCookie(request.headers.get("cookie"), cookieName);
  if (isSupportedLocale(config, cookie)) return cookie as string;
  return negotiateLocale(config, request.headers.get("accept-language"));
}
