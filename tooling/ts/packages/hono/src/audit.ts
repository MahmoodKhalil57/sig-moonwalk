/**
 * audit — documentation-coverage detection over a v4 document. This is the *ceiling* side of the
 * Conformance Grade: an under-documented route indicts the producer. Findings are advisory (never a gate),
 * mirroring the honest-loss pattern of compat diagnostics / zod warnings. autofill() supplies sane defaults.
 */
import type { OpenAPIv4Document, PathItem, Request } from "@suluk/core";
import { responseList } from "./contract";

export interface Finding {
  /** "missing-doc" | "no-success-schema" | "response-no-description" | "no-examples" */
  code: string;
  severity: "warn" | "info";
  path: string;
  operation: string;
  message: string;
}

function isSuccess(status: string): boolean {
  return /^2/.test(status) || status === "2XX";
}

/** Walk every operation and report documentation gaps. */
export function audit(doc: OpenAPIv4Document): Finding[] {
  const findings: Finding[] = [];
  for (const [path, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as PathItem;
    for (const [name, reqRaw] of Object.entries(pi.requests ?? {})) {
      const req = reqRaw as Request;
      const add = (code: string, severity: Finding["severity"], message: string) =>
        findings.push({ code, severity, path, operation: name, message });

      if (!req.summary && !req.description) add("missing-doc", "warn", "operation has neither summary nor description");

      const responses = Object.entries(req.responses ?? {});
      const hasSuccessSchema = responses.some(([status, r]) => isSuccess(String((r as { status?: unknown }).status ?? status)) && (r as { contentSchema?: unknown }).contentSchema);
      if (!hasSuccessSchema) add("no-success-schema", "info", "no 2xx response declares a content schema");

      for (const [status, r] of responses) {
        if (!(r as { description?: string }).description) add("response-no-description", "info", `response ${status} has no description`);
      }
    }
  }
  return findings;
}

/** A coarse coverage score in [0,1]: 1 = fully documented (no findings), lower = more gaps. */
export function coverage(doc: OpenAPIv4Document): number {
  let ops = 0;
  for (const pi of Object.values(doc.paths ?? {})) ops += Object.keys((pi as PathItem).requests ?? {}).length;
  if (ops === 0) return 1;
  const warns = audit(doc).filter((f) => f.severity === "warn").length;
  return Math.max(0, 1 - warns / ops);
}

/**
 * Fill obvious documentation gaps in-place-safe (returns a new doc): synthesize a summary from the
 * operation name + method/path, and a description for undescribed responses. Conservative — never
 * overwrites authored text. This is the "automatically document under-documented routes" lever.
 */
export function autofill(doc: OpenAPIv4Document): OpenAPIv4Document {
  const out: OpenAPIv4Document = structuredClone(doc);
  for (const [path, piRaw] of Object.entries(out.paths ?? {})) {
    const pi = piRaw as PathItem;
    for (const [name, reqRaw] of Object.entries(pi.requests ?? {})) {
      const req = reqRaw as Request;
      if (!req.summary && !req.description) req.summary = humanize(name, req.method, path);
      for (const r of Object.values(req.responses ?? {})) {
        const resp = r as { status: string | number; description?: string };
        if (!resp.description) resp.description = defaultStatusText(String(resp.status));
      }
    }
  }
  return out;
}

function humanize(name: string, method: string, path: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)} (${method.toUpperCase()} ${path})`;
}

function defaultStatusText(status: string): string {
  const map: Record<string, string> = {
    "200": "OK", "201": "Created", "204": "No Content", "400": "Bad Request",
    "401": "Unauthorized", "403": "Forbidden", "404": "Not Found", "409": "Conflict",
    "422": "Unprocessable Entity", "500": "Internal Server Error",
  };
  return map[status] ?? (/^5/.test(status) ? "Server Error" : /^4/.test(status) ? "Client Error" : "Response");
}
