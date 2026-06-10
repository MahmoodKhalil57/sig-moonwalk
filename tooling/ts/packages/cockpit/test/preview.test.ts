import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document } from "@suluk/core";
import { installModule, PREVIEW } from "@suluk/builder";
import { previewRoles, previewAllowedRoles, previewLaunchUrl } from "../src/crosscut";
import { convergeContract } from "../src/converge";
import { contractGates, shipSummary } from "../src/lifecycle";
import { previewDeployPlan, deployPlan } from "../src/deploy";

const docWithRoles = (): OpenAPIv4Document => ({
  openapi: "4.0.0-candidate",
  info: { title: "Shop", version: "1.0.0" },
  paths: { user: { requests: { listUser: { method: "get", responses: { ok: { status: 200, contentType: "application/json", contentSchema: { $ref: "#/components/schemas/User" } } } } } } },
  components: { schemas: { User: { type: "object", properties: { id: { type: "integer" }, role: { type: "string", enum: ["user", "admin", "superadmin"] } } } } },
});

describe("previewRoles — contract-sourced principals (never hardcoded)", () => {
  test("derives anonymous + one per User.role enum value", () => {
    const roles = previewRoles(docWithRoles());
    expect(roles.map((r) => r.role)).toEqual(["anonymous", "user", "admin", "superadmin"]);
    expect(roles[0]).toMatchObject({ role: "anonymous", authenticated: false });
    expect(roles[2]).toMatchObject({ role: "admin", authenticated: true, scopes: ["admin"] });
  });
  test("degrades HONESTLY to anonymous-only when there is no User.role enum", () => {
    const noRole: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {}, components: { schemas: {} } };
    expect(previewRoles(noRole).map((r) => r.role)).toEqual(["anonymous"]);
    // and when there's no User at all it does not throw
    const bare: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {} };
    expect(previewRoles(bare).map((r) => r.role)).toEqual(["anonymous"]);
  });
  test("a reserved/unsafe/duplicate enum is reconciled — anonymous appears exactly once, unsafe roles dropped", () => {
    const messy: OpenAPIv4Document = {
      openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {},
      components: { schemas: { User: { type: "object", properties: { role: { type: "string", enum: ["admin", "anonymous", "admin", "ev:il", "x".repeat(50), 42 as unknown as string] } } } } },
    };
    expect(previewRoles(messy).map((r) => r.role)).toEqual(["anonymous", "admin"]); // dedup + reserved + unsafe/long/non-string all dropped
    expect(previewRoles(messy).filter((r) => r.role === "anonymous")).toHaveLength(1);
  });
  test("previewAllowedRoles is the seedable set — authenticated only, NEVER anonymous (the gate's allow-list)", () => {
    expect(previewAllowedRoles(docWithRoles())).toEqual(["user", "admin", "superadmin"]);
    expect(previewAllowedRoles(docWithRoles())).not.toContain("anonymous");
  });
});

describe("previewLaunchUrl — the preview-only guard + deep-link (INV-08, pure & testable)", () => {
  test("REFUSES a non-preview env before producing any URL", () => {
    const r = previewLaunchUrl({ baseUrl: "https://prod.example.com", isPreview: false }, "admin");
    expect(r.refused).toBe(true);
    if (r.refused) expect(r.reason).toContain("refused");
  });
  test("a preview env + a role ⇒ the deploy's own gated /preview/login, role URL-encoded", () => {
    const r = previewLaunchUrl({ baseUrl: "https://app-preview.example.com/", isPreview: true }, "super admin");
    expect(r.refused).toBe(false);
    if (!r.refused) expect(r.url).toBe("https://app-preview.example.com/preview/login?role=super%20admin");
  });
  test("anonymous ⇒ just the app, no login route, no query", () => {
    const r = previewLaunchUrl({ baseUrl: "https://app-preview.example.com", isPreview: true }, "anonymous");
    expect(r.refused).toBe(false);
    if (!r.refused) expect(r.url).toBe("https://app-preview.example.com");
  });
});

describe("converge — surfaces the preview-only backdoor (it must never sit silently in a projection)", () => {
  test("a contract carrying the preview op gets a preview-op-exposed WARN", () => {
    const installed = installModule(docWithRoles(), PREVIEW);
    expect(installed.installed).toBe(true);
    const report = convergeContract(installed.doc);
    const f = report.findings.find((x) => x.code === "preview-op-exposed");
    expect(f).toBeDefined();
    expect(f!.severity).toBe("warn");
    expect(f!.where).toBe("previewLogin");
    expect(report.clean).toBe(true); // a WARN is not an error — it does not fail coherence, only flags
  });
  test("a contract WITHOUT the preview op has no such finding", () => {
    expect(convergeContract(docWithRoles()).findings.some((x) => x.code === "preview-op-exposed")).toBe(false);
  });
  test("a marker hidden on a WEBHOOK is ALSO surfaced (no false negative)", () => {
    const wh: OpenAPIv4Document = {
      openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {},
      webhooks: { sneaky: { method: "post", responses: { ok: { status: 200, description: "x" } }, "x-suluk-preview-only": true } },
    } as unknown as OpenAPIv4Document;
    const f = convergeContract(wh).findings.find((x) => x.code === "preview-op-exposed");
    expect(f).toBeDefined();
    expect(f!.where).toBe("sneaky");
  });
});

describe("ship gate — a contract carrying the backdoor is NOT 'ready to ship' (supply-chain fix)", () => {
  test("contractGates adds a 'noBackdoor' warn that blocks readiness when a preview op is present", () => {
    const installed = installModule(docWithRoles(), PREVIEW).doc;
    const gates = contractGates(installed, {});
    const g = gates.find((x) => x.id === "noBackdoor")!;
    expect(g.status).toBe("warn");
    expect(g.detail).toContain("previewLogin");
    expect(shipSummary(gates).ready).toBe(false); // the smuggled-backdoor contract can no longer read 'ready'
  });
  test("a clean contract has noBackdoor 'ok'", () => {
    const gates = contractGates(docWithRoles(), {});
    expect(gates.find((x) => x.id === "noBackdoor")!.status).toBe("ok");
  });
});

describe("previewDeployPlan — the two locks + the seed, terminal-gated", () => {
  const plan = previewDeployPlan(docWithRoles());
  const wrangler = plan.files.find((f) => f.path === "wrangler.jsonc")!.content;
  test("names a -preview Worker with BOTH locks: the SULUK_PREVIEW var and a PREVIEW_DB binding", () => {
    expect(wrangler).toContain("-preview");
    expect(wrangler).toContain('"SULUK_PREVIEW": "1"');
    expect(wrangler).toContain('"binding": "PREVIEW_DB"');
  });
  test("seeds one throwaway demo user per non-anonymous role", () => {
    const seed = plan.files.find((f) => f.path === "seed.sql")!.content;
    expect(seed).toContain("preview-admin");
    expect(seed).toContain("preview-superadmin");
    expect(seed).not.toContain("preview-anonymous"); // anonymous is never seeded
  });
  test("includes a teardown step (a standing preview is a live credentialed surface)", () => {
    expect(plan.steps.some((s) => s.cmd.includes("wrangler delete"))).toBe(true);
  });
  test("a hostile role enum value never reaches seed.sql (filtered at previewAllowedRoles — no SQL injection)", () => {
    const evil: OpenAPIv4Document = {
      openapi: "4.0.0-candidate", info: { title: "Evil", version: "1.0.0" }, paths: {},
      components: { schemas: { User: { type: "object", properties: { role: { type: "string", enum: ["admin", "x'); DROP TABLE user;--"] } } } } },
    };
    const seed = previewDeployPlan(evil).files.find((f) => f.path === "seed.sql")!.content;
    expect(seed).toContain("preview-admin");          // the safe role is seeded
    expect(seed).not.toContain("DROP TABLE");          // the hostile role is filtered out upstream, never emitted
  });
  test("the PROD plan sets NO preview flag — the backdoor is inert there", () => {
    const prod = deployPlan(docWithRoles());
    const prodWrangler = prod.files.find((f) => f.path === "wrangler.jsonc")!.content;
    expect(prodWrangler).not.toContain("SULUK_PREVIEW");
    expect(prodWrangler).not.toContain("PREVIEW_DB");
    expect(prod.files.some((f) => f.path === "seed.sql")).toBe(false);
  });
});
