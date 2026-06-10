import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document, PathItem } from "@suluk/core";
import { installModule, PREVIEW, PREVIEW_ONLY_MARKER, FIRST_PARTY_REGISTRY, STACK_TEMPLATES, resolveTemplate, parseRegistry, validateModule } from "../src/index";

// a host that owns User (with the role enum the auth module ships) — so PREVIEW's requires:["User"] is satisfied.
const hostWithUser = (): OpenAPIv4Document => ({
  openapi: "4.0.0-candidate",
  info: { title: "Host", version: "1.0.0" },
  paths: {
    user: { requests: { listUser: { method: "get", responses: { ok: { status: 200, contentType: "application/json", contentSchema: { $ref: "#/components/schemas/User" } } } } } },
  } as Record<string, PathItem>,
  components: { schemas: { User: { type: "object", required: ["email"], properties: { id: { type: "integer" }, email: { type: "string" }, role: { type: "string", enum: ["user", "admin", "superadmin"] } } } } },
});

describe("PREVIEW module — installs as a fragment (INV-merge-integrity)", () => {
  const r = installModule(hostWithUser(), PREVIEW);
  test("installs atop a contract with User, adding the previewLogin op", () => {
    expect(r.installed).toBe(true);
    expect(r.conflicts).toHaveLength(0);
    expect(r.added.operations).toContain("previewLogin");
    expect((r.doc.paths as Record<string, PathItem>)["preview/login"].requests.previewLogin.method).toBe("get");
  });
  test("the installed op carries the x-suluk-preview-only marker (so converge can surface the backdoor)", () => {
    const op = (r.doc.paths as Record<string, PathItem>)["preview/login"].requests.previewLogin as unknown as Record<string, unknown>;
    expect(op[PREVIEW_ONLY_MARKER]).toBe(true);
  });
  test("requires User — refused (unchanged) on a contract without it", () => {
    const noUser: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {}, components: { schemas: {} } };
    const rr = installModule(noUser, PREVIEW);
    expect(rr.installed).toBe(false);
    expect(rr.conflicts.some((c) => c.includes('requires "User"'))).toBe(true);
  });
  test("refuses on an operation-name collision (a host already exposing previewLogin)", () => {
    const collide = hostWithUser();
    (collide.paths as Record<string, PathItem>)["preview/login"] = { requests: { previewLogin: { method: "get", responses: { ok: { status: 200, description: "x" } } } } } as PathItem;
    const rr = installModule(collide, PREVIEW);
    expect(rr.installed).toBe(false);
    expect(rr.conflicts.length).toBeGreaterThan(0);
  });
});

describe("PREVIEW module — NOT marketplace/compose-installable (INV-distribution / supply-chain)", () => {
  test("is absent from FIRST_PARTY_REGISTRY.modules — never browsable via installModule UI", () => {
    expect(FIRST_PARTY_REGISTRY.modules.some((e) => e.module.name === "preview")).toBe(false);
  });
  test("no stack template resolves to it — never auto-composed via composePlatform", () => {
    for (const t of STACK_TEMPLATES) {
      const { modules } = resolveTemplate(t, FIRST_PARTY_REGISTRY);
      expect(modules.some((m) => m.name === "preview")).toBe(false);
    }
  });
  test("an UNTRUSTED remote module smuggling a marker-carrying op is REJECTED at validateModule", () => {
    // a community module under an innocuous name that hides a session-establishing role-login op
    const smuggled = {
      name: "analytics-pro", version: "1.0.0", provides: [], requires: ["User"], schemas: {},
      paths: { "metrics/login": { requests: { backdoorLogin: { method: "get", responses: { found: { status: 302, description: "x" } }, [PREVIEW_ONLY_MARKER]: true } } } },
    };
    const v = validateModule(smuggled);
    expect(v.module).toBeUndefined();
    expect(v.error).toContain("backdoor");
    // and a whole registry carrying it surfaces it as REJECTED, never as an installable module
    const parsed = parseRegistry({ name: "evil", modules: [{ title: "Analytics Pro", module: smuggled }] });
    expect(parsed.modules).toHaveLength(0);
    expect(parsed.rejected).toHaveLength(1);
  });
  test("the FIRST-PARTY preview module is unaffected by that gate (it is installed directly, not via a remote registry)", () => {
    // installModule (the first-party path) still merges PREVIEW clean — the rejection is only at the untrusted boundary
    expect(installModule(hostWithUser(), PREVIEW).installed).toBe(true);
  });
});
