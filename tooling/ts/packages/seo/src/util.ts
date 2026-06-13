/** Shared escapers + date helpers. No argless `new Date()` / `Date.now()` here — callers pass explicit dates. */

/** XML/HTML text + attribute escape. */
export const escXml = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));

/** Normalize a date input to an ISO-8601 string (undefined if absent/invalid). */
export const isoDate = (d: string | number | Date | undefined): string | undefined => {
  if (d == null || d === "") return undefined;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
};

/** Drop null/undefined keys (so JSON-LD nodes don't carry empty fields). */
export const clean = <T extends Record<string, unknown>>(o: T): T => {
  const r = {} as T;
  for (const k in o) if (o[k] !== undefined && o[k] !== null) r[k] = o[k];
  return r;
};
