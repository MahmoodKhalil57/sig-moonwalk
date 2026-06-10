/**
 * The DATA floor at runtime — REAL Drizzle over bun:sqlite. bun:sqlite IS SQLite, which IS Cloudflare D1, so
 * the only thing that changes on deploy is the driver (drizzle-orm/d1 + env.DB). The CRUD handlers below run
 * actual Drizzle queries against the same tables that produced the v4 contract — the source of record, end to
 * end (schema → contract → routes → Drizzle → SQLite/D1). Request validation still comes from the contract.
 */
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq, type Table } from "drizzle-orm";
import type { Context } from "hono";

// in-memory SQLite for the demo (no setup); the schema matches the Drizzle tables in entities.ts.
const sqlite = new Database(":memory:");
sqlite.run(`CREATE TABLE pet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  category_id INTEGER
);`);
sqlite.run(`CREATE TABLE category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);`);

export const db: BunSQLiteDatabase = drizzle(sqlite);

export interface CrudHandlers {
  list: (c: Context) => Response | Promise<Response>;
  get: (c: Context) => Response | Promise<Response>;
  create: (c: Context) => Response | Promise<Response>;
  update: (c: Context) => Response | Promise<Response>;
  delete: (c: Context) => Response | Promise<Response>;
}

/** Generic Drizzle-backed CRUD handlers for one table (the table has an `id` primary key). */
export function drizzleHandlers(table: Table & { id: import("drizzle-orm").Column }): CrudHandlers {
  const id = (c: Context) => Number(c.req.param("id"));
  return {
    list: (c) => c.json(db.select().from(table).all()),
    get: (c) => {
      const row = db.select().from(table).where(eq(table.id, id(c))).get();
      return row ? c.json(row) : c.json({ error: "not found" }, 404);
    },
    create: async (c) => {
      const body = (await c.req.json()) as Record<string, unknown>;
      const row = db.insert(table).values(body).returning().get();
      return c.json(row, 201);
    },
    update: async (c) => {
      const body = (await c.req.json()) as Record<string, unknown>;
      db.update(table).set(body).where(eq(table.id, id(c))).run();
      return c.json(db.select().from(table).where(eq(table.id, id(c))).get());
    },
    delete: (c) => {
      db.delete(table).where(eq(table.id, id(c))).run();
      return c.body(null, 204);
    },
  };
}
