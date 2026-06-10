/**
 * contractChecks — auto-generated tests that act as checks for mistakes (the doc/contract as an executable
 * verification). Each check is a pure function returning a verdict, so they run in CI, in the vscode
 * extension, or as bun tests (toBunTest emits source). They catch the mistakes a contract can encode:
 *   - a request/response schema that isn't valid JSON Schema 2020-12
 *   - a provided example that does NOT satisfy its own schema
 *   - the emitted v4 document failing the v4 meta-schema
 *   - two routes whose ADA signatures provably collide (ambiguous routing)
 */
import { validateDocument, buildAda } from "@suluk/core";
import { validateSchema2020 } from "./schema-check";
import { responseList, type RouteContract } from "./contract";
import { emitV4 } from "./emit";
import { zodToV4 } from "@suluk/zod";
import type * as z from "zod";

export interface Check {
  name: string;
  run(): { pass: boolean; message?: string };
}

function schemaValid(label: string, schema: z.ZodType): Check {
  return {
    name: `schema valid 2020-12: ${label}`,
    run() {
      const { schema: js } = zodToV4(schema as Parameters<typeof zodToV4>[0]);
      const r = validateSchema2020(js);
      return { pass: r.valid, message: r.valid ? undefined : r.errors.map((e) => `${e.path} ${e.message}`).join("; ") };
    },
  };
}

function exampleConforms(label: string, schema: z.ZodType, example: unknown, shouldPass = true): Check {
  return {
    name: `example ${shouldPass ? "⊨" : "⊭"} schema: ${label}`,
    run() {
      const ok = (schema as { safeParse(v: unknown): { success: boolean } }).safeParse(example).success;
      return { pass: ok === shouldPass, message: ok === shouldPass ? undefined : `example ${ok ? "unexpectedly passed" : "failed"} its schema` };
    },
  };
}

/** Build the full check suite for a set of route contracts. */
export function contractChecks(routes: readonly RouteContract[]): Check[] {
  const checks: Check[] = [];

  for (const route of routes) {
    const id = `${route.method.toUpperCase()} ${route.path}`;
    const req = route.request;
    for (const [slot, schema] of [["json", req?.json], ["query", req?.query], ["params", req?.params], ["header", req?.header]] as const) {
      if (schema) checks.push(schemaValid(`${id} ${slot}`, schema));
    }
    for (const ex of req?.examples ?? []) if (req?.json) checks.push(exampleConforms(`${id} request example`, req.json, ex));
    for (const r of responseList(route.responses)) {
      if (r.schema) {
        checks.push(schemaValid(`${id} ${r.status}`, r.schema));
        for (const ex of r.examples ?? []) checks.push(exampleConforms(`${id} ${r.status} example`, r.schema, ex));
      }
    }
  }

  // whole-document checks
  checks.push({
    name: "emitted v4 document validates against the meta-schema",
    run() {
      const { document } = emitV4(routes);
      const r = validateDocument(document);
      return { pass: r.valid, message: r.valid ? undefined : r.errors.slice(0, 3).map((e) => `${e.path} ${e.message}`).join("; ") };
    },
  });
  checks.push({
    name: "no two routes provably collide (unambiguous routing)",
    run() {
      const { document } = emitV4(routes);
      const bad = buildAda(document).collisions.filter((c) => c.verdict === "provable-collision");
      return { pass: bad.length === 0, message: bad.length ? bad.map((c) => `${c.a.name} vs ${c.b.name}`).join("; ") : undefined };
    },
  });
  return checks;
}

export interface CheckRun {
  total: number;
  passed: number;
  failures: { name: string; message?: string }[];
}

/** Run every check and summarize. */
export function runContractChecks(routes: readonly RouteContract[]): CheckRun {
  const checks = contractChecks(routes);
  const failures: CheckRun["failures"] = [];
  for (const c of checks) {
    const v = c.run();
    if (!v.pass) failures.push({ name: c.name, message: v.message });
  }
  return { total: checks.length, passed: checks.length - failures.length, failures };
}
