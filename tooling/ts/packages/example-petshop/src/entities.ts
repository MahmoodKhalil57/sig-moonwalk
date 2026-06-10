/**
 * The DATA floor — real Drizzle tables (the system of record). @suluk/drizzle projects each table to a v4
 * Schema Object; those become the builder's entities. Everything downstream (routes, docs, stores, UI) is
 * derived from THESE definitions. The tables use sqlite-core — which is exactly Cloudflare D1 — so this same
 * schema is the deploy-target schema with no change.
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { tableToV4 } from "@suluk/drizzle";
import type { Entity } from "@suluk/builder";

export const pet = sqliteTable("pet", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status", { enum: ["available", "pending", "sold"] }).notNull().default("available"),
  categoryId: integer("category_id"),
});

export const category = sqliteTable("category", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

// The builder's entities: each is the table's INSERT shape (id/status optional) — the natural create/edit body.
export const entities: Entity[] = [
  { name: "Pet", schema: tableToV4(pet).insert },
  { name: "Category", schema: tableToV4(category).insert },
];

// entity name → the Drizzle table backing it (the data floor's system of record).
export const tables = { Pet: pet, Category: category } as const;
