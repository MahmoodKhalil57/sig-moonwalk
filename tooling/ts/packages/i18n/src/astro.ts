/**
 * @suluk/i18n/astro — the thin Astro glue (saastarter-parity Phase 1). Astro owns i18n ROUTING + prerendering;
 * this only resolves the request locale (cookie → Accept-Language) and stamps `locale` + `dir` onto
 * `context.locals` so a layout can set `<html lang dir>` server-side (PARITY: "dir/lang set server-side"). The
 * no-flash theme stamper / picker stays an app-layer helper (roadmap) — NOT this package. Duck-typed so it needs
 * no `astro` dependency.
 */
import { dirOf, localeFromRequest, type Direction, type LocaleConfig } from "./locale";

/** The slice of Astro's APIContext this middleware touches (duck-typed — no astro import). */
export interface I18nAstroContext {
  request: Request;
  locals: Record<string, unknown> & { locale?: string; dir?: Direction };
}

export interface I18nMiddlewareOptions {
  /** the cookie carrying the locale (default "locale"). */
  cookieName?: string;
}

/** Astro's `MiddlewareHandler` shape (next returns the downstream Response). */
type MiddlewareNext = () => Promise<Response>;

/**
 * Build an Astro middleware that resolves the locale per request and exposes `context.locals.locale` + `.dir`.
 * Register it in `src/middleware.ts`: `export const onRequest = i18nMiddleware(MY_LOCALES)`.
 */
export function i18nMiddleware(
  config: LocaleConfig,
  opts: I18nMiddlewareOptions = {},
): (context: I18nAstroContext, next: MiddlewareNext) => Promise<Response> {
  return (context, next) => {
    const locale = localeFromRequest(config, context.request, opts.cookieName ?? "locale");
    context.locals.locale = locale;
    context.locals.dir = dirOf(config, locale);
    return next();
  };
}
