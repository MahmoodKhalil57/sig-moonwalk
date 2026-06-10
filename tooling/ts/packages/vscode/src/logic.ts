/**
 * Pure extension logic — the part that does NOT touch the vscode API, so it is unit-testable with bun.
 * The thin vscode shell (extension.ts) wires editor events + webviews to these functions. This separation
 * is the same pattern as @suluk/better-auth (pure functions + a duck-typed adapter).
 */
import { parseDocument, validateDocument } from "@suluk/core";
import type { OpenAPIv4Document } from "@suluk/core";
import { audit, type Finding } from "@suluk/hono";
import { scalarHtml } from "@suluk/scalar";
import { swaggerHtml } from "@suluk/swagger";

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  path: string;
  message: string;
}

/** True if a parsed document looks like a v4 "Suluk" document (so we only act on those). */
export function looksLikeV4(doc: unknown): doc is OpenAPIv4Document {
  return !!doc && typeof doc === "object" && typeof (doc as { openapi?: unknown }).openapi === "string" && (doc as { openapi: string }).openapi.startsWith("4");
}

/** Parse + meta-schema validate a document source. Parse failure → a single error diagnostic. */
export function validateSource(text: string): { ok: boolean; diagnostics: Diagnostic[] } {
  let doc: OpenAPIv4Document;
  try {
    doc = parseDocument(text);
  } catch (e) {
    return { ok: false, diagnostics: [{ severity: "error", path: "/", message: `parse error: ${(e as Error).message}` }] };
  }
  if (!looksLikeV4(doc)) {
    return { ok: false, diagnostics: [{ severity: "info", path: "/openapi", message: "not an OpenAPI v4 'Suluk' document (openapi must start with \"4\")" }] };
  }
  const r = validateDocument(doc);
  return {
    ok: r.valid,
    diagnostics: r.errors.map((e) => ({ severity: "error" as const, path: e.path, message: e.message })),
  };
}

/** Documentation-coverage audit (under-documented routes) via the @suluk/hono engine. */
export function auditSource(text: string): { findings: Finding[]; diagnostics: Diagnostic[] } {
  let doc: OpenAPIv4Document;
  try {
    doc = parseDocument(text);
  } catch {
    return { findings: [], diagnostics: [] };
  }
  if (!looksLikeV4(doc)) return { findings: [], diagnostics: [] };
  const findings = audit(doc);
  return {
    findings,
    diagnostics: findings.map((f) => ({
      severity: f.severity === "warn" ? "warning" : "info",
      path: `${f.path}/${f.operation}`,
      message: `${f.code}: ${f.message}`,
    })),
  };
}

/** Build a self-contained preview page (Scalar or Swagger) for a v4 source. Returns html + downgrade diagnostics. */
export function previewHtml(text: string, ui: "scalar" | "swagger"): { html: string; diagnostics: { message: string }[] } {
  const doc = parseDocument(text);
  if (!looksLikeV4(doc)) throw new Error("not an OpenAPI v4 'Suluk' document");
  const r = ui === "scalar" ? scalarHtml(doc) : swaggerHtml(doc);
  return { html: r.html, diagnostics: r.diagnostics.map((d) => ({ message: `${d.kind}: ${d.message}` })) };
}
