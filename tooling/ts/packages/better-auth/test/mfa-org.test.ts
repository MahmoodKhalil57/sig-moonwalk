import { test, expect, describe } from "bun:test";
import { principalFromSession, MFA_SCOPE, orgScope, parseOrgScope, authSecuritySchemes } from "../src/index";

describe("2FA + org scope-encoding (Phase 1) — Principal extension via scopes", () => {
  test("a 2FA-cleared session gains mfa:verified; an un-verified one does not", () => {
    expect(principalFromSession({ twoFactorVerified: true }).scopes).toContain(MFA_SCOPE);
    expect(principalFromSession({ twoFactorVerified: false }).scopes).not.toContain(MFA_SCOPE);
    expect(principalFromSession({}).scopes).not.toContain(MFA_SCOPE);
  });

  test("org memberships → org:<id>:<scope> (explicit + role-mapped, namespaced per org)", () => {
    const p = principalFromSession(
      { organizations: [{ id: "123", scopes: ["read"], role: "owner" }, { id: "456", scopes: ["read"] }] },
      { orgRoleScopes: { owner: ["write", "admin"] } },
    );
    expect(p.scopes).toEqual(expect.arrayContaining(["org:123:read", "org:123:write", "org:123:admin", "org:456:read"]));
    // org 456 has no owner role → no write/admin there (tenancy isolation)
    expect(p.scopes).not.toContain("org:456:write");
  });

  test("orgScope builds and parseOrgScope round-trips; a non-org scope parses null", () => {
    expect(orgScope("123", "read")).toBe("org:123:read");
    expect(parseOrgScope("org:123:read")).toEqual({ orgId: "123", action: "read" });
    expect(parseOrgScope("admin")).toBeNull();
  });

  test("the encoded scopes work with a plain scope check (what enforceAccess does)", () => {
    const p = principalFromSession({ twoFactorVerified: true, organizations: [{ id: "1", scopes: ["billing:write"] }] });
    const has = (s: string) => p.scopes.includes(s);
    expect(has(MFA_SCOPE)).toBe(true);          // a route can requireScopes("mfa:verified")
    expect(has("org:1:billing:write")).toBe(true);
  });

  test("authSecuritySchemes surfaces the session-based plugins (no new wire scheme)", () => {
    const sec = authSecuritySchemes({ session: true, twoFactor: true, passkey: true, organization: true });
    expect(sec.plugins).toEqual({ twoFactor: true, passkey: true, organization: true });
    // they add NO new securityScheme — they gate INTO the session
    expect(Object.keys(sec.securitySchemes)).toEqual(["sessionCookie"]);
  });
});
