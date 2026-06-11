/**
 * Message catalogs (saastarter-parity Phase 1). The PATTERN, not the content: the app authors per-namespace,
 * per-locale catalog files (the source of truth) and an explicit loader map (each arrow a discrete chunk boundary,
 * so a bundler tree-shakes inactive locales — saastarter i18n.ts:27-149); this package owns `t()` interpolation,
 * the default-locale fallback (`?? en`, generalized), and the typing + completeness machinery.
 */

/** A flat catalog: message key → string. */
export type Catalog = Record<string, string>;

/**
 * Interpolate `{token}` params into a message; an unknown key falls back to the key itself.
 * Ported verbatim from saastarter i18n.ts:195-207.
 */
export function t(
  messages: Catalog,
  key: string,
  params?: Record<string, string | number>,
): string {
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

/** Bind a catalog so callers write `tt("key", { name })` instead of threading the catalog every call. */
export function translator(messages: Catalog): (key: string, params?: Record<string, string | number>) => string {
  return (key, params) => t(messages, key, params);
}

/** Per-locale loaders for ONE namespace: locale code → a dynamic-import thunk returning `{ default: catalog }`. */
export type NamespaceLoaders<M> = Record<string, () => Promise<{ default: M }>>;

/**
 * Load a namespace's catalog for a locale, falling back to the DEFAULT locale's chunk when the locale is missing
 * (saastarter's `nsLoaders[locale] ?? nsLoaders.en`, i18n.ts:189 — generalized to any default). Only the resolved
 * chunk is imported (tree-shakeable). Throws only if NEITHER the locale nor the default has a loader (a config bug).
 */
export async function loadMessages<M>(
  loaders: NamespaceLoaders<M>,
  locale: string,
  defaultLocale: string,
): Promise<M> {
  const loader = loaders[locale] ?? loaders[defaultLocale];
  if (!loader) throw new Error(`@suluk/i18n: no loader for locale "${locale}" or default "${defaultLocale}"`);
  return (await loader()).default;
}

export interface CompletenessGrade {
  locale: string;
  /** keys in the default catalog (the target). */
  total: number;
  /** keys present AND non-empty in this locale. */
  translated: number;
  /** keys in the default catalog absent or empty here. */
  missing: string[];
  /** keys present here but not in the default (stale / typo'd). */
  extra: string[];
  /** translated / total, in [0, 1] (1 when the default is empty). */
  grade: number;
}

/**
 * Grade a locale catalog against the default catalog — the runtime, harden-style completeness gauge that complements
 * the compile-time key-parity types. Surfaces missing/extra keys + a 0–1 grade so a locale's coverage is auditable.
 */
export function gradeCompleteness(
  defaultCatalog: Catalog,
  localeCatalog: Catalog,
  locale: string,
): CompletenessGrade {
  const defKeys = Object.keys(defaultCatalog);
  const missing: string[] = [];
  let translated = 0;
  for (const k of defKeys) {
    const v = localeCatalog[k];
    if (typeof v === "string" && v.trim() !== "") translated++;
    else missing.push(k);
  }
  const extra = Object.keys(localeCatalog).filter((k) => !(k in defaultCatalog));
  return {
    locale,
    total: defKeys.length,
    translated,
    missing,
    extra,
    grade: defKeys.length === 0 ? 1 : translated / defKeys.length,
  };
}

/**
 * Compile-time key-parity helper: a locale catalog typed `KeyParity<typeof enCatalog>` must declare EXACTLY the
 * default's keys (no missing, no extra). Use it on each non-default catalog so a dropped/typo'd key is a type error.
 */
export type KeyParity<Default extends Catalog> = { [K in keyof Default]: string };
