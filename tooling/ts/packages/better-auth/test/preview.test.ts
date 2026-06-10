import { test, expect, describe } from "bun:test";
import { previewLoginHandler, isPreviewRuntime, type PreviewEnvLike } from "../src/preview";

const ALLOWED = ["user", "admin", "superadmin"];
// a mintSession spy that records the role it was asked to bind to (and never runs unless the gate passes).
function spy() {
  const calls: string[] = [];
  const mintSession = (role: string) => { calls.push(role); return { setCookie: `session=preview-${role}; HttpOnly` }; };
  return { calls, mintSession };
}
const req = (role?: string) => ({ url: `https://app-preview.example.com/preview/login${role === undefined ? "" : `?role=${encodeURIComponent(role)}`}` });
const previewEnv: PreviewEnvLike = { SULUK_PREVIEW: "1", PREVIEW_DB: {} };

describe("previewLoginHandler — fail-closed behind TWO independent locks (INV-01)", () => {
  test("flag unset ⇒ 404, mint NEVER called", async () => {
    const { calls, mintSession } = spy();
    const res = await previewLoginHandler(req("admin"), { PREVIEW_DB: {} }, { allowedRoles: ALLOWED, mintSession });
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });
  test("flag set but NO PREVIEW_DB binding ⇒ 404 (the second lock), mint NEVER called", async () => {
    const { calls, mintSession } = spy();
    const res = await previewLoginHandler(req("admin"), { SULUK_PREVIEW: "1" }, { allowedRoles: ALLOWED, mintSession });
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });
  test("a non-'1' flag value does not pass (no truthiness slop)", async () => {
    const { calls, mintSession } = spy();
    for (const v of ["0", "true", "yes", "preview", " 1"]) {
      const res = await previewLoginHandler(req("admin"), { SULUK_PREVIEW: v, PREVIEW_DB: {} }, { allowedRoles: ALLOWED, mintSession });
      expect(res.status).toBe(404);
    }
    expect(calls).toHaveLength(0);
  });
  test("BOTH locks + a valid seeded role ⇒ 302 to '/' with the role-scoped session cookie", async () => {
    const { calls, mintSession } = spy();
    const res = await previewLoginHandler(req("admin"), previewEnv, { allowedRoles: ALLOWED, mintSession });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    expect(res.headers.get("set-cookie")).toContain("preview-admin");
    expect(calls).toEqual(["admin"]); // bound exactly to the requested seeded role
  });
});

describe("previewLoginHandler — role allow-list, never client-trusted (INV-04)", () => {
  test("a role outside the contract's set ⇒ 403, mint NEVER called", async () => {
    const { calls, mintSession } = spy();
    for (const r of ["root", "", "ADMIN", "superadmin "]) {
      const res = await previewLoginHandler(req(r), previewEnv, { allowedRoles: ALLOWED, mintSession });
      expect(res.status).toBe(403);
    }
    expect(calls).toHaveLength(0);
  });
  test("missing role param ⇒ 403, mint NEVER called", async () => {
    const { calls, mintSession } = spy();
    const res = await previewLoginHandler(req(undefined), previewEnv, { allowedRoles: ALLOWED, mintSession });
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  test("'anonymous' is rejected even if a caller smuggles it into allowedRoles (login-less by definition)", async () => {
    const { calls, mintSession } = spy();
    const res = await previewLoginHandler(req("anonymous"), previewEnv, { allowedRoles: [...ALLOWED, "anonymous"], mintSession });
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});

describe("previewLoginHandler — the gate precedes input (INV-07: server-side, not a client header)", () => {
  test("with the flag OFF, a forged x-role header cannot reach the mint — still 404", async () => {
    const { calls, mintSession } = spy();
    // the handler only reads env + the role QUERY param; a header is meaningless. Gate is checked first.
    const res = await previewLoginHandler({ url: "https://x/preview/login?role=admin" }, { PREVIEW_DB: {} }, { allowedRoles: ALLOWED, mintSession });
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });
  test("isPreviewRuntime requires BOTH a '1' flag and a PREVIEW_DB binding", () => {
    expect(isPreviewRuntime({ SULUK_PREVIEW: "1", PREVIEW_DB: {} })).toBe(true);
    expect(isPreviewRuntime({ SULUK_PREVIEW: "1" })).toBe(false);
    expect(isPreviewRuntime({ PREVIEW_DB: {} })).toBe(false);
    expect(isPreviewRuntime({})).toBe(false);
  });
});
