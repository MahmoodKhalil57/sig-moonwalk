/**
 * Drizzle table → metadata + naming. The "DATA floor" reads the table's column descriptors directly
 * (drizzle-orm's getTableColumns) — the source of truth about nullability, defaults, primary keys, and
 * SQL-level enums — and lifts them into a small, JSON-friendly record the rest of the package projects from.
 * CANDIDATE tooling (not official OAS).
 */
import { getTableColumns, getTableName } from "drizzle-orm";

/** Any drizzle table object accepted by getTableColumns/getTableName. We stay structural — the concrete
 *  dialect type (SQLite/Pg/MySQL) is irrelevant here; we only read the column descriptor surface. */
export type AnyTable = Parameters<typeof getTableColumns>[0];

/** One column's metadata, lifted from drizzle's column descriptor (verified against drizzle-orm 0.45). */
export interface ColumnMeta {
  name: string;
  /** drizzle's coarse JS dataType, e.g. "string" | "number" | "boolean" | "date". */
  dataType: string;
  /** drizzle's concrete column type tag, e.g. "SQLiteText" | "SQLiteInteger". */
  columnType: string;
  /** NOT NULL at the SQL level. */
  notNull: boolean;
  /** Has a DB-side default (also true for autoincrement PKs) ⇒ optional on insert. */
  hasDefault: boolean;
  /** Part of the (single-column) primary key. */
  primaryKey: boolean;
  /** SQL CHECK/enum allowed values when the column was declared with `{ enum: [...] }`. */
  enumValues?: string[];
}

export interface TableMeta {
  name: string;
  /** Column names flagged `primary` (ordered as drizzle reports the columns). */
  primaryKey: string[];
  columns: ColumnMeta[];
}

/**
 * Read a drizzle table's metadata. This is the honest floor: every value comes from the column descriptor,
 * nothing is inferred. `enumValues` is only present when the underlying column actually carries one — we
 * don't synthesize an empty array (that would be a silent invention).
 */
export function tableMetadata(table: AnyTable): TableMeta {
  const cols = getTableColumns(table);
  const columns: ColumnMeta[] = [];
  const primaryKey: string[] = [];

  for (const [name, col] of Object.entries(cols)) {
    // drizzle's descriptor surface — read defensively (any dialect, any version in our peer range).
    const c = col as unknown as {
      dataType: string;
      columnType: string;
      notNull: boolean;
      hasDefault: boolean;
      primary: boolean;
      enumValues?: string[];
    };
    const meta: ColumnMeta = {
      name,
      dataType: c.dataType,
      columnType: c.columnType,
      notNull: !!c.notNull,
      hasDefault: !!c.hasDefault,
      primaryKey: !!c.primary,
      // enumValues is often an empty array on non-enum columns — only surface a non-empty one.
      ...(Array.isArray(c.enumValues) && c.enumValues.length ? { enumValues: c.enumValues } : {}),
    };
    columns.push(meta);
    if (meta.primaryKey) primaryKey.push(name);
  }

  return { name: getTableName(table), primaryKey, columns };
}

/** "user_accounts" / "users" → "UserAccounts" / "Users". The v4 component key (C009 by-name). */
export function pascalCase(s: string): string {
  return s.replace(/(^|[-_\s]+)(\w)/g, (_m, _sep, ch: string) => ch.toUpperCase());
}

/** A drizzle table's PascalCase component name, derived from its SQL name. */
export function tableComponentName(table: AnyTable): string {
  return pascalCase(getTableName(table));
}
