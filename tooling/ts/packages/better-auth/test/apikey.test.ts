import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { createGuard } from "@suluk/hono";
import {
  verifyApiKey, scopesToPermissions, permissionsToScopes, parseApiKeyMetadata,
  type ApiKeyVerifierLike,
} from "../src/index";

describe("scope ⇄ permission conversion (ported from saastarter api-key/scopes.ts)", () => {
  test("scopesToPermissions groups by resource (scopes.ts:150-161)", () => {
    expect(scopesToPermissions(["cart:read", "cart:write", "products:read"])).toEqual({
      cart: ["read", "write"], products: ["read"],
    });
  });

  test("scopesToPermissions: a segment-less scope is skipped; 'a:b:c' keeps only resource:action (faithful destructure)", () => {
    expect(scopesToPermissions(["bare", "a:b:c"])).toEqual({ a: ["b"] }); // 'c' dropped, 'bare' skipped
  });

  test("permissionsToScopes flattens; null ⇒ []", () => {
    expect(permissionsToScopes({ cart: ["read", "write"] })).toEqual(["cart:read", "cart:write"]);
    expect(permissionsToScopes(null)).toEqual([]);
  });

  test("permissionsToScopes is round-trip-stable and (DEVIATION) keeps non-catalog scopes", () => {
    const perms = { anything: ["do"], orders: ["read"] };
    // saastarter would filter `anything:do` against API_SCOPES; we keep it (the catalog is the app's concern).
    expect(permissionsToScopes(perms)).toEqual(["anything:do", "orders:read"]);
    expect(scopesToPermissions(permissionsToScopes(perms))).toEqual(perms);
  });
});

describe("parseApiKeyMetadata (ported verbatim, metadata.ts:14-39)", () => {
  test("object passthrough; single + double-stringified JSON; invalid ⇒ null", () => {
    expect(parseApiKeyMetadata({ createdVia: "delegation" })).toEqual({ createdVia: "delegation" });
    expect(parseApiKeyMetadata(JSON.stringify({ parentKeyId: "p1" }))).toEqual({ parentKeyId: "p1" });
    expect(parseApiKeyMetadata(JSON.stringify(JSON.stringify({ parentKeyId: "p2" })))).toEqual({ parentKeyId: "p2" });
    expect(parseApiKeyMetadata("not json")).toBeNull();
    expect(parseApiKeyMetadata(null)).toBeNull();
  });
});

describe("verifyApiKey — scope-aware, returns a { scopes } Principal", () => {
  const verifier = (resp: unknown, capture?: (body: unknown) => void): ApiKeyVerifierLike => ({
    verifyApiKey: async ({ body }) => { capture?.(body); return resp as never; },
  });

  test("a valid key yields ok + a Principal flattened from its permissions + the key identity", async () => {
    const r = await verifyApiKey(verifier({ valid: true, key: { userId: "u1", permissions: { orders: ["read"] }, metadata: JSON.stringify({ createdVia: "delegation" }) } }), "k");
    expect(r.ok).toBe(true);
    expect(r.principal).toEqual({ scopes: ["orders:read"] });
    expect(r.key).toMatchObject({ userId: "u1", metadata: { createdVia: "delegation" } });
  });

  test("requireScopes is checked in the SAME verify call via permissions (services/auth.ts:133-147)", async () => {
    let sentBody: unknown;
    await verifyApiKey(verifier({ valid: true, key: { userId: "u1", permissions: { orders: ["read"] } } }, (b) => (sentBody = b)), "k", { requireScopes: ["orders:read"] });
    expect(sentBody).toEqual({ key: "k", permissions: { orders: ["read"] } });
  });

  test("an invalid key ⇒ ok:false reason 'invalid'; a scope error ⇒ 'insufficient_scope'; a throw ⇒ 'error'", async () => {
    expect((await verifyApiKey(verifier({ valid: false, key: null }), "k")).reason).toBe("invalid");
    expect((await verifyApiKey(verifier({ valid: false, error: { code: "INSUFFICIENT_PERMISSIONS" } }), "k", { requireScopes: ["orders:write"] })).reason).toBe("insufficient_scope");
    const thrower: ApiKeyVerifierLike = { verifyApiKey: async () => { throw new Error("down"); } };
    expect((await verifyApiKey(thrower, "k")).reason).toBe("error");
  });
});

describe("integration: the key Principal makes @suluk/hono enforcement work for key auth", () => {
  test("a key with orders:read passes requireScopes('orders:read') but is 403 for admin", async () => {
    const verifier: ApiKeyVerifierLike = { verifyApiKey: async () => ({ valid: true, key: { userId: "u1", permissions: { orders: ["read"] } } }) };
    const result = await verifyApiKey(verifier, "k");
    const guard = createGuard({ principal: () => result.key!.userId, scopes: () => result.principal!.scopes });
    const app = new Hono();
    app.get("/orders", guard.requireScopes("orders:read"), (c) => c.text("ok"));
    app.get("/admin", guard.requireScopes("admin"), (c) => c.text("ok"));
    expect((await app.request("/orders")).status).toBe(200);
    expect((await app.request("/admin")).status).toBe(403);
  });
});
