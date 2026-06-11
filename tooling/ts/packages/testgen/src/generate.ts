/**
 * Generate a DETERMINISTIC conformance test suite from a v4 "Suluk" document — the contract's claims made
 * EXECUTABLE (council whuovh6gs, L2; the executable form of the C022 access subset-checker). The generated suite,
 * run against a deployment, asserts:
 *   • ACCESS ENFORCEMENT, on the REAL WIRE (the ceiling-raiser): the server actually enforces x-suluk-access — anon
 *     gets NO success on a non-public op; a public op is NOT auth-blocked for anon. x-suluk-access is used only as
 *     the EXPECTATION; the test passes iff the WIRE agrees with it. It never asserts over a projection, and never
 *     treats the facet as if it were the enforcement (C022 inv.3).
 *   • STATUS SMOKE + SCHEMA CONFORMANCE (L1): a public, parameter-free GET returns a declared status, and its 2xx
 *     body validates against the declared response schema (same generic engine the SDK uses).
 *   • COST DECLARED (L2, static): every op that prices itself declares a WELL-FORMED x-suluk-cost — never a literal
 *     µ$ amount (that couples tests to billing internals and goes flaky).
 * A pure function of the document: same contract in, same suite out, NO network at generate-time. Each op's tests
 * are LABELLED with its provenance (x-suluk-source) so a failure points at the authoring source.
 */
import type { OpenAPIv4Document, SulukSource } from "@suluk/core";

interface AccessFacet { requires?: string; scope?: string }
interface CostModel { estimateMicroUsd?: number; components?: { microUsd?: number }[] }
interface RawReq {
  method: string; summary?: string; contentSchema?: unknown;
  parameterSchema?: { path?: unknown; query?: unknown; body?: unknown };
  responses?: Record<string, { status: string | number; contentSchema?: unknown }>;
  ["x-suluk-cost"]?: CostModel; ["x-suluk-access"]?: AccessFacet; ["x-suluk-source"]?: SulukSource;
}
interface OpInfo {
  name: string; method: string; uri: string; filledPath: string; requires: string;
  declaredStatuses: number[]; okSchema?: unknown; cost: number | null; source?: SulukSource;
  hasBody: boolean; paramFree: boolean;
}

const fillPath = (uri: string) => ("/" + uri.replace(/^\/+/, "")).replace(/\{\+?([^}?&]+)\}/g, "1");
const requiredKeys = (s: unknown): string[] => (s && typeof s === "object" && Array.isArray((s as { required?: unknown }).required) ? ((s as { required: string[] }).required) : []);
function costOf(req: RawReq): number | null {
  const c = req["x-suluk-cost"]; if (!c) return null;
  return c.estimateMicroUsd ?? (c.components ?? []).reduce((s, x) => s + Number(x.microUsd ?? 0), 0);
}

function walkOps(doc: OpenAPIv4Document): OpInfo[] {
  const ops: OpInfo[] = [];
  for (const [uri, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as { requests?: Record<string, RawReq> };
    for (const [name, req] of Object.entries(pi.requests ?? {})) {
      const method = req.method.toUpperCase();
      const ps = req.parameterSchema ?? {};
      const statuses = Object.values(req.responses ?? {}).map((r) => Number(r.status)).filter((n) => Number.isFinite(n));
      const ok = Object.values(req.responses ?? {}).find((r) => String(r.status).startsWith("2") && r.contentSchema != null);
      const hasPathParam = /\{/.test(uri);
      const reqQuery = requiredKeys(ps.query);
      ops.push({
        name, method, uri, filledPath: fillPath(uri),
        requires: req["x-suluk-access"]?.requires ?? "anyone",
        declaredStatuses: [...new Set(statuses)].sort((a, b) => a - b),
        okSchema: ok?.contentSchema, cost: costOf(req), source: req["x-suluk-source"],
        hasBody: req.contentSchema != null || ps.body != null,
        paramFree: method === "GET" && !hasPathParam && reqQuery.length === 0,
      });
    }
  }
  return ops.sort((a, b) => (a.uri + a.name).localeCompare(b.uri + b.name));
}

// Embed a response schema as a self-contained literal: splice components in as $defs + rewrite pointers, so the
// generic validator resolves $ref without the whole document (same trick @suluk/sdk uses).
function schemaLiteral(doc: OpenAPIv4Document, s: unknown): string {
  const defs = (doc.components?.schemas ?? {}) as Record<string, unknown>;
  const str = JSON.stringify(s ?? {});
  if (!Object.keys(defs).length || !str.includes("#/components/schemas/")) return str;
  const merged = { $defs: JSON.parse(JSON.stringify(defs)), ...JSON.parse(str) };
  return JSON.stringify(merged).replace(/#\/components\/schemas\//g, "#/$defs/");
}

export interface TestgenOptions {
  /** the deployment under test; the generated suite reads SULUK_BASE_URL first, then falls back to this. */
  baseURL?: string;
  /** which test runner's imports to emit (both share the test/expect/describe API). Default "bun". */
  framework?: "bun" | "vitest";
}

const lbl = (s: string) => s.replace(/`/g, "'").replace(/\$\{/g, "\\${");

function emitOp(doc: OpenAPIv4Document, op: OpInfo): string {
  const src = op.source ? `  ←  ${op.source.file}#${op.source.symbol}` : "";
  const head = `${op.name}  [${op.method} ${op.uri}]  · ${op.requires}${src}`;
  const tests: string[] = [];
  const public_ = op.requires === "anyone";

  // ── L2: access enforcement, on the real wire (the ceiling-raiser) ──────────────────────────────────────────
  if (public_) {
    tests.push(`  test("access — public: anon is NOT auth-blocked (x-suluk-access: anyone, verified on the wire)", async () => {
    const r = await call("${op.method}", "${op.filledPath}"${op.hasBody ? ", { body: {} }" : ""});
    expect([401, 403], "a public op must be reachable by anon — got " + r.status).not.toContain(r.status);
  });`);
  } else {
    tests.push(`  test("access — ENFORCED: anon gets NO success (x-suluk-access: ${op.requires}, verified on the wire — not the facet)", async () => {
    const r = await call("${op.method}", "${op.filledPath}"${op.hasBody ? ", { body: {} }" : ""});
    // the server is the boundary (C022 inv.3): a non-public op must DENY anon. Success here is a real hole.
    expect([200, 201, 204], "anon succeeded on a ${op.requires} op — the server is NOT enforcing x-suluk-access").not.toContain(r.status);
  });`);
    tests.push(`  test("access — admin/owner principal reaches it (positive; skipped without SULUK_${op.requires === "admin" ? "ADMIN" : "USER"}_TOKEN)", async () => {
    const tok = ${op.requires === "admin" ? "ADMIN" : "USER"};
    if (!tok) return; // optional: provide a synthetic principal token to assert the positive side
    const r = await call("${op.method}", "${op.filledPath}", { token: tok${op.hasBody ? ", body: {}" : ""} });
    expect([401, 403], "a valid principal was rejected (status " + r.status + ")").not.toContain(r.status);
  });`);
    // ── error-conformance (B1 envelope): a deny is a well-formed RFC-9457 Problem Details body ────────────────
    tests.push(`  test("error-conformance — a denied request returns a well-formed Problem Details body (RFC-9457)", async () => {
    const r = await call("${op.method}", "${op.filledPath}"${op.hasBody ? ", { body: {} }" : ""});
    if (r.status < 400) return; // a success here is already flagged by the access test above
    const body = isJson(r) ? await r.json() : {};
    // the shared @suluk/hono envelope: title (string) + status (number) === HTTP status (isProblemDetails shape).
    expect(typeof body.title === "string" && body.status === r.status, "deny body is not RFC-9457 Problem Details: " + JSON.stringify(body)).toBe(true);
  });`);
  }

  // ── L1: status smoke + schema conformance (public, parameter-free GET) ─────────────────────────────────────
  if (op.paramFree && public_) {
    if (op.declaredStatuses.length) tests.push(`  test("status — returns a declared status", async () => {
    const r = await call("GET", "${op.filledPath}");
    expect(${JSON.stringify(op.declaredStatuses)}, "undeclared status " + r.status).toContain(r.status);
  });`);
    if (op.okSchema != null) tests.push(`  test("conformance — a 2xx body validates against the declared response schema", async () => {
    const r = await call("GET", "${op.filledPath}");
    if (r.status >= 300 || !isJson(r)) return;
    const v = validate(${schemaLiteral(doc, op.okSchema)}, await r.json());
    expect(v.valid, "response body does not conform: " + JSON.stringify(v.errors?.slice(0, 3))).toBe(true);
  });`);
  }

  // ── L2 (static): a declared cost is well-formed (never a literal µ$ amount) ────────────────────────────────
  if (op.cost != null) tests.push(`  test("cost — declares a well-formed x-suluk-cost", () => {
    expect(Number.isFinite(${op.cost}) && ${op.cost} >= 0, "x-suluk-cost is malformed").toBe(true);
  });`);

  return `describe("${lbl(head)}", () => {\n${tests.join("\n")}\n});`;
}

export function generateTests(doc: OpenAPIv4Document, opts: TestgenOptions = {}): string {
  const ops = walkOps(doc);
  const importLine = opts.framework === "vitest" ? `import { test, expect, describe } from "vitest";` : `import { test, expect, describe } from "bun:test";`;
  const title = doc.info?.title ?? "API";
  const version = doc.openapi ?? "4.0.0-candidate";
  const enforced = ops.filter((o) => o.requires !== "anyone").length;
  const body = ops.map((o) => emitOp(doc, o)).join("\n\n");

  return `/**
 * ${title} — CONFORMANCE suite. AUTO-GENERATED by @suluk/testgen from the v4 contract (OpenAPI ${version}). Do not edit.
 *
 * The contract's claims, made executable. Run it against a deployment:
 *   SULUK_BASE_URL=${opts.baseURL ?? "https://your.api"} bun test ${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.conformance.test.ts
 *
 * It asserts the SERVER ENFORCES x-suluk-access on the real wire (${enforced}/${ops.length} ops are non-public and must
 * deny anon), smoke-tests declared statuses, validates 2xx bodies against their declared schemas, and checks every
 * declared cost is well-formed. x-suluk-access is the EXPECTATION; the WIRE is the truth — a green run proves the
 * two AGREE. The server is the only authz boundary (C022 inv.3); this never asserts over a projection.
 *
 * Optional positive-side checks: set SULUK_ADMIN_TOKEN / SULUK_USER_TOKEN to SYNTHETIC principals (never a
 * production credential) to also assert that a valid principal IS allowed through.
 *
 * Requires: \`npm i @cfworker/json-schema\` (for response-schema conformance) + a fetch-capable runtime.
 */
${importLine}
import { Validator } from "@cfworker/json-schema";

const BASE = (typeof process !== "undefined" && process.env.SULUK_BASE_URL) || ${JSON.stringify(opts.baseURL ?? "")};
const ADMIN = typeof process !== "undefined" ? process.env.SULUK_ADMIN_TOKEN : undefined;
const USER = typeof process !== "undefined" ? process.env.SULUK_USER_TOKEN : undefined;

const isJson = (r: Response) => (r.headers.get("content-type") || "").includes("json");
function validate(schema: unknown, value: unknown) { return new Validator(schema as object, "2020-12").validate(value); }
async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = "Bearer " + opts.token;
  let body: string | undefined;
  if (opts.body !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.body); }
  return fetch(BASE + path, { method, headers, body });
}

${body}
`;
}
