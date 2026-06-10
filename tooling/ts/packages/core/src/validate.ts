import standaloneValidate from "./validate.standalone.js";
import type { OpenAPIv4Document } from "./types";

export interface ValidationIssue { path: string; message: string; }
export interface ValidationResult { valid: boolean; errors: ValidationIssue[]; }

/**
 * Validate a document's STRUCTURE against the v4 meta-schema (SPEC §1, ADRs C003/C004/C009/C013).
 *
 * Uses a PRECOMPILED (ajv-standalone) validator (src/validate.standalone.js) — a plain function, no
 * `new Function`/eval — so @suluk/core validates on Cloudflare Workers (the deploy target forbids dynamic
 * code generation) and starts instantly. Regenerate with `bun run scripts/gen-validator.ts`. It does NOT
 * validate the inner JSON Schema 2020-12 Schema Objects (those are the 2020-12 dialect's concern).
 */
export function validateDocument(doc: unknown): ValidationResult {
  const valid = standaloneValidate(doc);
  const errors: ValidationIssue[] = (standaloneValidate.errors ?? []).map((e) => ({
    path: e.instancePath || "/",
    message: `${e.message ?? "invalid"}${e.params && Object.keys(e.params).length ? " " + JSON.stringify(e.params) : ""}`,
  }));
  return { valid, errors };
}

/** Type guard: a parsed doc that validates is treated as an OpenAPIv4Document. */
export function isValidDocument(doc: unknown): doc is OpenAPIv4Document {
  return validateDocument(doc).valid;
}
