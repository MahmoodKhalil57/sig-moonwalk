import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { enforceAccess, createGuard, type AccessFacet } from "../src/index";

// a tiny app identity model: the x-user header is the "principal", x-admin:1 marks admin, x-scopes is csv.
const ID = {
  principal: (c: any) => c.req.header("x-user") || null,
  isAdmin: (c: any) => c.req.header("x-admin") === "1",
  scopes: (c: any) => (c.req.header("x-scopes") || "").split(",").filter(Boolean),
};

describe("@suluk/hono enforceAccess — facet-driven wire enforcement (the server is the boundary)", () => {
  // a fake contract: op name → access facet + the path it lives at
  const OPS: Record<string, { path: string; access?: AccessFacet }> = {
    listPet: { path: "/pet", access: { requires: "anyone" } },
    createPet: { path: "/pet-create", access: { requires: "admin" } },
    myCart: { path: "/cart", access: { requires: "authenticated", scope: "owner" } },
    orgReport: { path: "/report", access: { requires: "authenticated", scope: "org:read" } },
    undeclared: { path: "/undeclared" },                                   // no facet → DENY by default
    scopedPublic: { path: "/scoped-public", access: { requires: "anyone", scope: "admin" } }, // a named scope despite anyone
    miscased: { path: "/miscased", access: { requires: "Admin" } },        // a casing typo must still gate as admin
    unknownLevel: { path: "/unknown", access: { requires: "superuser" } }, // an unknown level must fail closed
  };
  const byPath = Object.fromEntries(Object.entries(OPS).map(([name, o]) => [o.path, name]));

  const app = new Hono();
  app.use("*", enforceAccess({
    operationOf: (c) => byPath[new URL(c.req.url).pathname],
    accessOf: (op) => OPS[op]?.access,
    ...ID,
  }));
  for (const [name, o] of Object.entries(OPS)) app.get(o.path, (c) => c.json({ ok: name }));
  app.get("/static.css", (c) => c.text("body{}")); // a non-contract path

  const get = (path: string, h: Record<string, string> = {}) => app.request(path, { headers: h });

  test("public op (requires: anyone) is reachable by anon", async () => {
    expect((await get("/pet")).status).toBe(200);
  });

  test("admin op: anon → 401, signed-in non-admin → 403, admin → 200", async () => {
    expect((await get("/pet-create")).status).toBe(401);
    expect((await get("/pet-create", { "x-user": "u1" })).status).toBe(403);
    expect((await get("/pet-create", { "x-user": "u1", "x-admin": "1" })).status).toBe(200);
  });

  test("authenticated op (owner-scoped): anon → 401, any signed-in caller → 200 (row-scoping is the app's job)", async () => {
    expect((await get("/cart")).status).toBe(401);
    expect((await get("/cart", { "x-user": "alice" })).status).toBe(200); // owner scope NOT enforced here
  });

  test("named-scope op: signed-in WITHOUT the scope → 403, WITH it → 200", async () => {
    expect((await get("/report", { "x-user": "u1" })).status).toBe(403);
    expect((await get("/report", { "x-user": "u1", "x-scopes": "org:read" })).status).toBe(200);
  });

  test("FAIL-CLOSED: an undeclared op denies by default (anon → 401), not opens publicly", async () => {
    expect((await get("/undeclared")).status).toBe(401);                 // deny-by-default (was the fail-open hole)
    expect((await get("/undeclared", { "x-user": "u" })).status).toBe(200); // a signed-in caller passes the default
  });

  test("FAIL-CLOSED: a named scope is enforced even when requires is \"anyone\" (no silent scope-drop)", async () => {
    expect((await get("/scoped-public")).status).toBe(401);              // anon can't reach a scope-gated op
    expect((await get("/scoped-public", { "x-user": "u" })).status).toBe(403);            // signed-in but no admin scope
    expect((await get("/scoped-public", { "x-user": "u", "x-admin": "1" })).status).toBe(200);
  });

  test("FAIL-CLOSED: a mis-cased requires (\"Admin\") still gates as admin (not degraded to authenticated)", async () => {
    expect((await get("/miscased", { "x-user": "u" })).status).toBe(403);
    expect((await get("/miscased", { "x-user": "u", "x-admin": "1" })).status).toBe(200);
  });

  test("FAIL-CLOSED: an UNKNOWN requires level denies everyone (a typo can't open a route)", async () => {
    expect((await get("/unknown")).status).toBe(403);
    expect((await get("/unknown", { "x-user": "u" })).status).toBe(403);
    expect((await get("/unknown", { "x-user": "u", "x-admin": "1" })).status).toBe(403); // even admin — a typo is fixed, not bypassed
  });

  test("a non-contract path (no matched op) is passed straight through", async () => {
    expect((await get("/static.css")).status).toBe(200);
  });

  test("deny responses are RFC-9457-shaped problem+json", async () => {
    const r = await get("/pet-create");
    expect(r.headers.get("content-type")).toContain("application/problem+json");
    const body = await r.json();
    expect(body).toMatchObject({ error: "unauthorized", status: 401 });
  });

  test("admin can be expressed via a scope when no isAdmin callback is given", async () => {
    const app2 = new Hono();
    app2.use("*", enforceAccess({ operationOf: () => "x", accessOf: () => ({ requires: "admin" }), principal: (c: any) => c.req.header("x-user") || null, scopes: (c: any) => (c.req.header("x-scopes") || "").split(",").filter(Boolean) }));
    app2.get("/x", (c) => c.json({ ok: true }));
    expect((await app2.request("/x", { headers: { "x-user": "u" } })).status).toBe(403);
    expect((await app2.request("/x", { headers: { "x-user": "u", "x-scopes": "admin" } })).status).toBe(200);
  });
});

describe("@suluk/hono createGuard — explicit per-route guards", () => {
  const guard = createGuard(ID);
  const app = new Hono();
  app.get("/auth", guard.requireAuth, (c) => c.json({ ok: true }));
  app.get("/admin", guard.requireAdmin, (c) => c.json({ ok: true }));
  app.get("/write", guard.requireScopes("write:pets", "read:pets"), (c) => c.json({ ok: true }));
  const get = (path: string, h: Record<string, string> = {}) => app.request(path, { headers: h });

  test("requireAuth: 401 anon, 200 signed-in", async () => {
    expect((await get("/auth")).status).toBe(401);
    expect((await get("/auth", { "x-user": "u" })).status).toBe(200);
  });
  test("requireAdmin: 401 anon, 403 non-admin, 200 admin", async () => {
    expect((await get("/admin")).status).toBe(401);
    expect((await get("/admin", { "x-user": "u" })).status).toBe(403);
    expect((await get("/admin", { "x-user": "u", "x-admin": "1" })).status).toBe(200);
  });
  test("requireScopes needs EVERY scope (401 anon, 403 partial, 200 all)", async () => {
    expect((await get("/write")).status).toBe(401);
    expect((await get("/write", { "x-user": "u", "x-scopes": "write:pets" })).status).toBe(403); // missing read:pets
    expect((await get("/write", { "x-user": "u", "x-scopes": "write:pets,read:pets" })).status).toBe(200);
  });
});
