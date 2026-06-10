/**
 * @suluk/drizzle tests — prove the DATA floor: drizzle-zod's required/nullable accounting survives the lift
 * to v4, metadata reads honestly off the column descriptors, crudRoutes emits the five conventional ops, and
 * the whole Drizzle → Hono → v4 chain produces a STRUCTURALLY VALID v4 document. CANDIDATE tooling.
 */
import { test, expect, describe } from "bun:test";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { emitV4 } from "@suluk/hono";
import { validateDocument } from "@suluk/core";
import {
  tableSchemas,
  tableToV4,
  tableToV4Warnings,
  tableMetadata,
  tableComponents,
  tableComponentsAudit,
  crudRoutes,
} from "../src/index";

// The example table the spec calls for: autoinc PK, a required (notNull, no-default) email, two nullables,
// and a notNull-with-default enum. drizzle-zod's required-set should be exactly ["email"] on insert.
const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  name: text("name"),
  age: integer("age"),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
});

/** A v4 Schema Object can be a boolean (true/false) per JSON Schema; narrow to the object form for tests. */
function obj(schema: unknown): Record<string, unknown> {
  expect(typeof schema).toBe("object");
  return schema as Record<string, unknown>;
}

/** Pull the `required` array off a v4 object Schema (JSON Schema 2020-12). */
function required(schema: unknown): string[] {
  return (obj(schema).required as string[] | undefined) ?? [];
}

describe("tableSchemas / tableToV4", () => {
  test("insert requires only notNull-AND-no-default columns (email); PK + defaulted + nullable are optional", () => {
    const { insert } = tableToV4(users);
    expect(required(insert).sort()).toEqual(["email"]);
  });

  test("select requires ALL columns (the full row shape)", () => {
    const { select } = tableToV4(users);
    expect(required(select).sort()).toEqual(["age", "email", "id", "name", "role"]);
  });

  test("update (insert.partial) requires NO columns", () => {
    const { update } = tableToV4(users);
    expect(required(update)).toEqual([]);
    // and it's a usable Zod schema — an empty patch parses.
    expect(() => tableSchemas(users).update.parse({})).not.toThrow();
  });

  test("nullable columns lift to a null-tolerant v4 schema", () => {
    const { select } = tableToV4(users);
    const props = obj(select).properties as Record<string, { anyOf?: { type?: string }[] }>;
    const nameTypes = (props.name.anyOf ?? []).map((s) => s.type);
    expect(nameTypes).toContain("null");
  });

  test("the v4 lift is lossless here — no dropped Zod effects", () => {
    const { warnings } = tableToV4Warnings(users);
    expect(warnings.select).toEqual([]);
    expect(warnings.insert).toEqual([]);
    expect(warnings.update).toEqual([]);
  });
});

describe("tableMetadata", () => {
  const meta = tableMetadata(users);

  test("name + primaryKey are read off the descriptors", () => {
    expect(meta.name).toBe("users");
    expect(meta.primaryKey).toEqual(["id"]);
  });

  test("the role enum's allowed values are surfaced", () => {
    const role = meta.columns.find((c) => c.name === "role")!;
    expect(role.enumValues).toEqual(["admin", "user"]);
    expect(role.notNull).toBe(true);
    expect(role.hasDefault).toBe(true);
  });

  test("non-enum columns carry no enumValues (no silent invention)", () => {
    const email = meta.columns.find((c) => c.name === "email")!;
    expect(email.enumValues).toBeUndefined();
    expect(email.notNull).toBe(true);
    expect(email.hasDefault).toBe(false);
    expect(email.primaryKey).toBe(false);
  });

  test("every column is reported with its drizzle descriptor fields", () => {
    expect(meta.columns.map((c) => c.name).sort()).toEqual(["age", "email", "id", "name", "role"]);
    const id = meta.columns.find((c) => c.name === "id")!;
    expect(id.primaryKey).toBe(true);
    expect(id.columnType).toBe("SQLiteInteger");
    expect(id.dataType).toBe("number");
  });
});

describe("tableComponents", () => {
  test("keys by PascalCase table name, value is the select v4 schema", () => {
    const comps = tableComponents([users]);
    expect(Object.keys(comps)).toEqual(["Users"]);
    expect(required(comps.Users).sort()).toEqual(["age", "email", "id", "name", "role"]);
  });

  test("collisions are enumerated, not dropped silently", () => {
    // two tables with the same SQL name both map to "Users".
    const usersB = sqliteTable("users", { id: integer("id").primaryKey() });
    const { collisions } = tableComponentsAudit([users, usersB]);
    expect(collisions.length).toBe(1);
    expect(collisions[0]).toContain("Users");
  });
});

describe("crudRoutes", () => {
  const routes = crudRoutes(users);

  test("emits the five conventional CRUD operations with by-name handles", () => {
    expect(routes.length).toBe(5);
    expect(routes.map((r) => r.name)).toEqual([
      "listUsers",
      "getUsers",
      "createUsers",
      "updateUsers",
      "deleteUsers",
    ]);
  });

  test("methods + paths follow REST convention; basePath defaults to /<table>", () => {
    const byName = Object.fromEntries(routes.map((r) => [r.name!, r]));
    expect(byName.listUsers.method).toBe("get");
    expect(byName.listUsers.path).toBe("/users");
    expect(byName.getUsers.method).toBe("get");
    expect(byName.getUsers.path).toBe("/users/:id");
    expect(byName.createUsers.method).toBe("post");
    expect(byName.updateUsers.method).toBe("patch");
    expect(byName.deleteUsers.method).toBe("delete");
  });

  test("statuses: list 200, get 200+404, create 201, update 200+404, delete 204", () => {
    const byName = Object.fromEntries(routes.map((r) => [r.name!, r]));
    const statuses = (name: string) =>
      (byName[name].responses as { status: number }[]).map((x) => x.status).sort((a, b) => a - b);
    expect(statuses("listUsers")).toEqual([200]);
    expect(statuses("getUsers")).toEqual([200, 404]);
    expect(statuses("createUsers")).toEqual([201]);
    expect(statuses("updateUsers")).toEqual([200, 404]);
    expect(statuses("deleteUsers")).toEqual([204]);
  });

  test("create body is the insert schema (email required); get/update carry the :id path param", () => {
    const byName = Object.fromEntries(routes.map((r) => [r.name!, r]));
    expect(byName.createUsers.request?.json).toBeDefined();
    expect(byName.getUsers.request?.params).toBeDefined();
    expect(byName.updateUsers.request?.json).toBeDefined();
    expect(byName.updateUsers.request?.params).toBeDefined();
  });

  test("opts.basePath + opts.idParam are honored", () => {
    const r = crudRoutes(users, { basePath: "/v1/people", idParam: "userId" });
    expect(r[0].path).toBe("/v1/people");
    expect(r[1].path).toBe("/v1/people/:userId");
  });
});

describe("end-to-end: Drizzle → Hono → v4 (floor-to-contract)", () => {
  test("emitV4(crudRoutes(users)) yields a STRUCTURALLY VALID v4 document", () => {
    const { document, diagnostics } = emitV4(crudRoutes(users));
    // no provable signature collisions among the five distinct ops.
    expect(diagnostics.filter((d) => d.kind === "collision")).toEqual([]);
    const result = validateDocument(document);
    if (!result.valid) console.error("validation errors:", result.errors);
    expect(result.valid).toBe(true);
    // sanity: the five operations made it into the paths.
    const opNames = Object.values(document.paths).flatMap((pi) => Object.keys(pi.requests));
    expect(opNames.sort()).toEqual(["createUsers", "deleteUsers", "getUsers", "listUsers", "updateUsers"]);
  });
});
