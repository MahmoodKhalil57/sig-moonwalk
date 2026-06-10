import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import metaSchema from "../schema/v4-meta-schema.json";
import type { OpenAPIv4Document } from "./types";

export interface ValidationIssue {
  path: string;
  message: string;
}
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

// Lazy: ajv compiles validators via `new Function`, which Cloudflare Workers forbid at IMPORT time. Compiling
// on first use keeps @suluk/core importable on Workers (the deploy target) — you only pay (and only hit the
// eval restriction) if you actually call validateDocument, which a Worker's request path need not.
function buildValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(metaSchema as object);
}
let validateFn: ReturnType<typeof buildValidator> | undefined;

/**
 * Validate a document's STRUCTURE against the v4 meta-schema (SPEC §1, ADRs C003/C004/C009/C013).
 * This is the structural contract from conformance/CONFORMANCE.md §A. It does NOT validate the inner
 * JSON Schema 2020-12 Schema Objects (those are validated by the 2020-12 dialect separately).
 */
export function validateDocument(doc: unknown): ValidationResult {
  if (!validateFn) validateFn = buildValidator();
  const valid = validateFn(doc) as boolean;
  const errors: ValidationIssue[] = (validateFn.errors ?? []).map((e) => ({
    path: e.instancePath || "/",
    message: `${e.message ?? "invalid"}${e.params && Object.keys(e.params).length ? " " + JSON.stringify(e.params) : ""}`,
  }));
  return { valid, errors };
}

/** Type guard: a parsed doc that validates is treated as an OpenAPIv4Document. */
export function isValidDocument(doc: unknown): doc is OpenAPIv4Document {
  return validateDocument(doc).valid;
}
