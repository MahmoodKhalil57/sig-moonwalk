/**
 * @suluk/i18n — the locale primitive every content app needs. Consolidates the fragmented i18n surface into one
 * package: a typed locale/direction model (defineLocales/dirOf), a Workers-safe message loader with default-locale
 * fallback + {token} interpolation (t), compile-time key-parity + a runtime completeness grade, Intl number/
 * currency/date formatting (incl. Eastern-Arabic numerals), and framework-agnostic cookie→locale resolution. The
 * catalog CONTENT is app-authored; this owns the MECHANISM. Astro middleware glue is the `@suluk/i18n/astro` subpath.
 * CANDIDATE tooling.
 */
export {
  defineLocales, localeCodes, isSupportedLocale, dirOf, resolveLocale,
  readCookie, localeFromCookie, negotiateLocale, localeFromRequest,
  type Direction, type LocaleDef, type LocaleConfig, type LocaleCode,
} from "./locale";
export {
  t, translator, loadMessages, gradeCompleteness,
  type Catalog, type NamespaceLoaders, type CompletenessGrade, type KeyParity,
} from "./messages";
export { formatNumber, formatCurrency, formatDate } from "./format";
