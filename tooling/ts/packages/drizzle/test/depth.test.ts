import { test, expect, describe } from "bun:test";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { emitV4 } from "@suluk/hono";
import {
  tableMetadata, crudRoutes,
  listQuerySchema, parseListQuery,
  softDeleteValues, anonymizeValues, touchTimestamps, notSoftDeleted,
} from "../src/index";

const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  deletedAt: text("deleted_at"),
});

describe("unique-index metadata", () => {
  test("tableMetadata surfaces UNIQUE columns at the column + table level", () => {
    const meta = tableMetadata(users);
    expect(meta.unique).toEqual(["email"]);
    expect(meta.columns.find((c) => c.name === "email")?.unique).toBe(true);
    expect(meta.columns.find((c) => c.name === "name")?.unique).toBe(false);
  });
});

describe("list query-param synthesis", () => {
  test("listQuerySchema parses + coerces reserved params and validates sort against columns", () => {
    const schema = listQuerySchema(users);
    expect((schema as { parse: (v: unknown) => unknown }).parse({ page: "2", perPage: "10", sort: "email", order: "desc", q: "ab" }))
      .toEqual({ page: 2, perPage: 10, sort: "email", order: "desc", q: "ab" });
    // an unknown sort column is rejected
    expect(() => (schema as { parse: (v: unknown) => unknown }).parse({ sort: "nope" })).toThrow();
  });

  test("parseListQuery normalizes to limit/offset/orderBy/filters (clamped, column-validated)", () => {
    const q = parseListQuery({ page: "3", perPage: "10", sort: "name", order: "desc", q: "lina", email: "a@b.co", bogus: "x" }, users);
    expect(q).toMatchObject({ limit: 10, offset: 20, page: 3, perPage: 10, orderBy: { column: "name", dir: "desc" }, q: "lina" });
    expect(q.filters).toEqual({ email: "a@b.co" }); // only real columns become filters; `bogus` ignored
  });

  test("parseListQuery clamps perPage to maxPerPage and defaults page/perPage", () => {
    expect(parseListQuery({ perPage: "9999" }, users, { maxPerPage: 50 }).limit).toBe(50);
    expect(parseListQuery({}, users)).toMatchObject({ page: 1, perPage: 20, offset: 0 });
    // a sort on a non-existent column is dropped (no injection)
    expect(parseListQuery({ sort: "evil" }, users).orderBy).toBeUndefined();
  });
});

describe("soft-delete / anonymize / timestamp CrudOptions", () => {
  test("a soft-deleting table's DELETE returns the row (200), not 204; summary says soft-delete", () => {
    const routes = crudRoutes(users, { softDelete: true });
    const del = routes.find((r) => r.name === "deleteUsers")!;
    const statuses = (Array.isArray(del.responses) ? del.responses : []).map((r) => r.status);
    expect(statuses).toContain(200);
    expect(statuses).not.toContain(204);
    expect(del.summary).toContain("Soft-delete");
  });

  test("the list route declares query params when listQuery is on (default)", () => {
    const list = crudRoutes(users).find((r) => r.name === "listUsers")!;
    expect(list.request?.query).toBeDefined();
    expect(crudRoutes(users, { listQuery: false }).find((r) => r.name === "listUsers")!.request?.query).toBeUndefined();
  });

  test("the extended CRUD still projects to a valid v4 document", () => {
    const { document } = emitV4(crudRoutes(users, { softDelete: true }));
    expect(document.paths["users"].requests.listUsers).toBeDefined();
  });

  test("runtime helpers build the right patches (pure, time-injected)", () => {
    const now = new Date("2026-06-11T00:00:00.000Z");
    expect(softDeleteValues({}, now)).toEqual({ deletedAt: "2026-06-11T00:00:00.000Z" });
    expect(softDeleteValues({ column: "removed_at" }, now)).toEqual({ removed_at: "2026-06-11T00:00:00.000Z" });
    expect(anonymizeValues(["email", "name"])).toEqual({ email: null, name: null });
    expect(anonymizeValues(["email"], "[redacted]")).toEqual({ email: "[redacted]" });
    expect(touchTimestamps({}, true, now)).toEqual({ updatedAt: "2026-06-11T00:00:00.000Z", createdAt: "2026-06-11T00:00:00.000Z" });
    expect(touchTimestamps({}, false, now)).toEqual({ updatedAt: "2026-06-11T00:00:00.000Z" });
    expect(notSoftDeleted()).toEqual({ column: "deletedAt", isNull: true });
  });
});
