/**
 * CrudOptions runtime helpers (saastarter-parity Phase 1): pure value-builders for soft-delete, anonymize-on-delete,
 * and server-managed timestamps. The package projects CONTRACTS (it runs no SQL), so these produce the PATCH an
 * app's Drizzle handler applies — keeping the policy (which column is `deletedAt`, which columns to redact) in one
 * place. anonymizeValues is the row-level counterpart of @suluk/better-auth's GDPR erasure cascade (the keep-record,
 * FK-safe posture).
 */

export interface SoftDeleteOptions {
  /** the timestamp column set on delete (default "deletedAt"). */
  column?: string;
}

export interface TimestampOptions {
  createdAt?: string;
  updatedAt?: string;
}

/** The patch a soft delete applies — sets the deletedAt column to `now` (default current time). */
export function softDeleteValues(opts: SoftDeleteOptions = {}, now: Date = new Date()): Record<string, string> {
  return { [opts.column ?? "deletedAt"]: now.toISOString() };
}

/** The patch an anonymize-on-delete applies — redacts each named column to `value` (null by default). Pair with a
 *  soft-delete to keep the row (FK-safe right-to-be-forgotten). */
export function anonymizeValues(columns: string[], value: string | null = null): Record<string, string | null> {
  return Object.fromEntries(columns.map((c) => [c, value]));
}

/** The patch server-managed timestamps apply on write — `updatedAt` always, `createdAt` only when `creating`. */
export function touchTimestamps(opts: TimestampOptions = {}, creating = false, now: Date = new Date()): Record<string, string> {
  const iso = now.toISOString();
  const out: Record<string, string> = { [opts.updatedAt ?? "updatedAt"]: iso };
  if (creating) out[opts.createdAt ?? "createdAt"] = iso;
  return out;
}

/** The implicit list filter for a soft-deleting table — exclude rows whose deletedAt is set (unless asked to include). */
export function notSoftDeleted(column = "deletedAt"): { column: string; isNull: true } {
  return { column, isNull: true };
}
