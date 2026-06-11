/**
 * List query-param synthesis (saastarter-parity Phase 1). The list route today returns the whole collection; real
 * lists are paginated, sortable, filterable, searchable. This DECLARES those query params (so they appear in the v4
 * doc + the SDK + the conformance tests) AND ships a pure `parseListQuery` that normalizes a raw query string into
 * `{ limit, offset, orderBy, filters, q }` the app's Drizzle handler builds its query from — one synthesis, both ends.
 */
import * as z from "zod";
import { tableMetadata, type AnyTable } from "./meta";

export interface ListQueryOptions {
  /** sortable + filterable columns (default: all of the table's columns). */
  columns?: string[];
  /** default page size (default 20). */
  defaultPerPage?: number;
  /** max page size — `perPage` is clamped to it (default 100). */
  maxPerPage?: number;
}

/** Reserved query keys (everything else that matches a column becomes an equality filter). */
const RESERVED = new Set(["page", "perPage", "sort", "order", "q"]);

/** The Zod query schema for a list route: page/perPage/sort/order/q (coerced from strings). Extra column filters
 * are read by {@link parseListQuery} at runtime (OpenAPI query params are flat, so they aren't enumerated here).
 * `table` is OPTIONAL: with a table (or `opts.columns`) `sort` is a column enum; without either it is a free string —
 * so the contract-projection layer (@suluk/builder), which holds a Zod entity rather than a Drizzle table, can call
 * `listQuerySchema()` and still emit the same five params into the v4 doc + SDK. */
export function listQuerySchema(table?: AnyTable, opts: ListQueryOptions = {}): z.ZodType {
  const cols = opts.columns ?? (table ? tableMetadata(table).columns.map((c) => c.name) : []);
  const sort = cols.length ? z.enum(cols as [string, ...string[]]).optional() : z.string().optional();
  return z.object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).optional(),
    sort,
    order: z.enum(["asc", "desc"]).optional(),
    q: z.string().optional(),
  });
}

export interface ListQuery {
  /** rows to return (= perPage). */
  limit: number;
  /** rows to skip (= (page-1)*perPage). */
  offset: number;
  orderBy?: { column: string; dir: "asc" | "desc" };
  /** free-text search term. */
  q?: string;
  /** column → equality value. */
  filters: Record<string, string>;
  page: number;
  perPage: number;
}

type RawQuery = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const intOr = (v: string | undefined, fallback: number) => {
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Normalize a raw query object into a {@link ListQuery} — pure, validating against the table's real columns:
 * page/perPage are clamped (≥1, ≤maxPerPage); `sort` is honored only for a real column; any other key matching a
 * column becomes an equality filter (unknown keys are ignored — no injection of arbitrary columns).
 */
export function parseListQuery(raw: RawQuery, table: AnyTable, opts: ListQueryOptions = {}): ListQuery {
  const colSet = new Set(opts.columns ?? tableMetadata(table).columns.map((c) => c.name));
  const defaultPer = opts.defaultPerPage ?? 20;
  const maxPer = opts.maxPerPage ?? 100;

  const page = Math.max(1, intOr(first(raw.page), 1));
  const perPage = Math.min(maxPer, Math.max(1, intOr(first(raw.perPage), defaultPer)));

  const sortCol = first(raw.sort);
  const orderBy = sortCol && colSet.has(sortCol)
    ? { column: sortCol, dir: (first(raw.order) === "desc" ? "desc" : "asc") as "asc" | "desc" }
    : undefined;

  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (RESERVED.has(k)) continue;
    const val = first(v);
    if (colSet.has(k) && val != null) filters[k] = val;
  }
  const q = first(raw.q) || undefined;

  return {
    limit: perPage,
    offset: (page - 1) * perPage,
    ...(orderBy ? { orderBy } : {}),
    ...(q ? { q } : {}),
    filters,
    page,
    perPage,
  };
}
