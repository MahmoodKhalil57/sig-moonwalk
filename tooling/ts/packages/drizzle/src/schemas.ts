/**
 * Drizzle table → Zod → v4 Schema Objects. The chain is: table --drizzle-zod--> Zod (select/insert/update)
 * --@suluk/zod zodToV4--> v4 Schema Object (= JSON Schema 2020-12). drizzle-zod already encodes the DB's
 * shape correctly — insert makes notNull-AND-no-default columns required (e.g. "email"), leaves autoincrement
 * PKs and defaulted columns optional, and makes nullable columns `.nullable()`. We do not re-derive any of
 * that; we only compose the three projections and lift them to v4. CANDIDATE tooling (not official OAS).
 */
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { zodToV4 } from "@suluk/zod";
import type * as z from "zod";
import type { Schema } from "@suluk/core";
import { tableComponentName, type AnyTable } from "./meta";

/** The three Zod projections of a table. */
export interface TableZodSchemas {
  /** Full row shape — every column required (createSelectSchema). */
  select: z.ZodType;
  /** Write shape — notNull-AND-no-default columns required; PK/defaulted/nullable relaxed (createInsertSchema). */
  insert: z.ZodType;
  /** Partial write shape — every insert field optional (insert.partial()), for PATCH. */
  update: z.ZodType;
}

/** The three v4 Schema Objects, mirroring {@link TableZodSchemas}. */
export interface TableV4Schemas {
  select: Schema;
  insert: Schema;
  update: Schema;
}

/**
 * Build the select / insert / update Zod schemas for a table.
 * update = insert.partial() — the canonical PATCH body (any subset of writable columns).
 */
export function tableSchemas(table: AnyTable): TableZodSchemas {
  const select = createSelectSchema(table) as unknown as z.ZodType;
  const insert = createInsertSchema(table) as unknown as z.ZodType;
  // .partial() exists on the Zod object createInsertSchema returns; cast through to keep the public type clean.
  const update = (insert as unknown as { partial(): z.ZodType }).partial();
  return { select, insert, update };
}

/**
 * Lift a table's three Zod schemas to v4 Schema Objects via zodToV4. drizzle-zod produces plain object
 * schemas (no .transform/.refine), so this is lossless here — but we still honor the house rule and surface
 * any zodToV4 warnings rather than dropping them silently (see {@link tableToV4Warnings}).
 */
export function tableToV4(table: AnyTable): TableV4Schemas {
  const { select, insert, update } = tableSchemas(table);
  return {
    select: zodToV4(select).schema,
    insert: zodToV4(insert).schema,
    update: zodToV4(update).schema,
  };
}

/**
 * Same conversion as {@link tableToV4} but also returns the enumerated lossy boundary (per-projection
 * zodToV4 warnings). Empty arrays ⇒ fully lossless. Callers wanting the honest-loss accounting use this.
 */
export function tableToV4Warnings(table: AnyTable): {
  schemas: TableV4Schemas;
  warnings: { select: string[]; insert: string[]; update: string[] };
} {
  const { select, insert, update } = tableSchemas(table);
  const s = zodToV4(select), i = zodToV4(insert), u = zodToV4(update);
  return {
    schemas: { select: s.schema, insert: i.schema, update: u.schema },
    warnings: { select: s.warnings, insert: i.warnings, update: u.warnings },
  };
}

/**
 * Build a v4 components.schemas record from a set of tables: { [PascalName]: select-v4-schema }.
 * Keyed by the table's PascalCase name (C009 by-name). Collisions (two tables mapping to the same Pascal
 * name) are NOT silently merged — the last writer wins AND a warning is surfaced via {@link tableComponentsAudit}.
 */
export function tableComponents(tables: readonly AnyTable[]): Record<string, Schema> {
  return tableComponentsAudit(tables).schemas;
}

/** Like {@link tableComponents} but enumerates name collisions instead of dropping them silently. */
export function tableComponentsAudit(tables: readonly AnyTable[]): {
  schemas: Record<string, Schema>;
  collisions: string[];
} {
  const schemas: Record<string, Schema> = {};
  const collisions: string[] = [];
  for (const table of tables) {
    const key = tableComponentName(table);
    if (key in schemas) collisions.push(`component name collision: '${key}' produced by more than one table`);
    schemas[key] = tableToV4(table).select;
  }
  return { schemas, collisions };
}
