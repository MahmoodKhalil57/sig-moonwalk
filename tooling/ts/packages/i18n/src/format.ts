/**
 * Locale-aware Intl formatting (saastarter-parity Phase 1; PARITY §RTL: "Eastern Arabic numerals (٠١٢٣) auto-render",
 * "Locale-aware currency and date formatting across checkout and account"). Pure `Intl` wrappers that honor each
 * locale's declared `numberingSystem` (so an "arab" locale renders ٠١٢٣, not 0123). Workers-native — no deps.
 */
import type { LocaleConfig } from "./locale";

function defOf(config: LocaleConfig, code: string) {
  return config.locales.find((l) => l.code === code);
}

/** Build the Intl options, injecting the locale's numbering system unless the caller overrode it. */
function withNumbering(config: LocaleConfig, code: string, opts: Intl.NumberFormatOptions = {}): Intl.NumberFormatOptions {
  const ns = defOf(config, code)?.numberingSystem;
  return ns && opts.numberingSystem === undefined ? { numberingSystem: ns, ...opts } : opts;
}

/** Format a number for a locale — honors its numberingSystem (e.g. "arab" → ٠١٢٣). */
export function formatNumber(config: LocaleConfig, code: string, value: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(code, withNumbering(config, code, opts)).format(value);
}

/**
 * Format a MONEY amount. `value` is the major-unit number (e.g. dollars); for integer cents from @suluk/stripe,
 * pass `cents / 100`. Honors the locale's numbering system + currency conventions.
 */
export function formatCurrency(
  config: LocaleConfig,
  code: string,
  value: number,
  currency: string,
  opts?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(code, withNumbering(config, code, { style: "currency", currency, ...opts })).format(value);
}

/** Format a date/time for a locale (honors the numbering system for numeric date parts). */
export function formatDate(
  config: LocaleConfig,
  code: string,
  value: Date | number | string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  const ns = defOf(config, code)?.numberingSystem;
  const merged: Intl.DateTimeFormatOptions = ns && opts?.numberingSystem === undefined ? { numberingSystem: ns, ...opts } : (opts ?? {});
  return new Intl.DateTimeFormat(code, merged).format(date);
}
