/**
 * Validate a document against the OFFICIAL OpenAPI 3.1 meta-schema (vendored, 2022-10-07 revision).
 * This is how we prove the downgrade output is real 3.1 that Scalar/Swagger will accept — not just
 * "shaped like" 3.1.
 *
 * One adaptation: the published 3.1 schema makes Schema Objects pluggable via JSON Schema's
 * `$dynamicRef: "#meta"` / `$dynamicAnchor: "meta"` mechanism (so a custom OAS dialect can be layered).
 * ajv does not resolve that `$dynamicRef` to `$defs/schema` here — it falls through to the document root,
 * spuriously failing every Schema Object. Since we layer NO custom dialect, we statically rebind the hook
 * to `$defs/schema` (= "any object or boolean", the permissive base). Schema Objects are then checked for
 * REAL JSON-Schema-2020-12 validity separately (checkSchemas), so nothing is waved through — this matches
 * v4's guarantee that Schema Objects are 2020-12 verbatim (SPEC C013 == OAS 3.1).
 */
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema31raw from "../schema/openapi-3.1-schema.json";

export interface Validation31 {
  valid: boolean;
  errors: { path: string; message: string }[];
}

/** Deep-clone the 3.1 schema, rebinding the Schema-Object dialect hook to a static, ajv-resolvable ref. */
function rebindSchemaDialect(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rebindSchemaDialect);
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.$dynamicRef === "#meta") return { $ref: "#/$defs/schema" };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === "$dynamicAnchor" && v === "meta") continue; // becomes a plain static target
      out[k] = rebindSchemaDialect(v);
    }
    return out;
  }
  return node;
}

const schema31 = rebindSchemaDialect(schema31raw) as object;

function buildOasValidator() {
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  addFormats(ajv);
  return ajv.compile(schema31);
}

/** A validator for one Schema Object against the real JSON Schema 2020-12 meta-schema (built into ajv/2020). */
function buildSchemaValidator() {
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  addFormats(ajv);
  return ajv.getSchema("https://json-schema.org/draft/2020-12/schema")!;
}

let oasFn: ReturnType<typeof buildOasValidator> | undefined;
let schemaFn: ReturnType<typeof buildSchemaValidator> | undefined;

/** Walk components.schemas + every operation schema position and deep-validate each as 2020-12. */
function checkSchemas(document: unknown, errors: { path: string; message: string }[]): void {
  if (!schemaFn) schemaFn = buildSchemaValidator();
  const seen = new Set<unknown>();
  const visit = (node: unknown, path: string, inSchema: boolean): void => {
    if (node == null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (inSchema) {
      const ok = schemaFn!(node);
      if (!ok) for (const e of schemaFn!.errors ?? []) errors.push({ path: path + (e.instancePath ?? ""), message: `schema: ${e.message}` });
      return; // its children are JSON-Schema internals, already covered by the 2020-12 check
    }
    const o = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (k === "schema") visit(v, `${path}/schema`, true);
      else if (k === "schemas" && v && typeof v === "object") for (const [n, s] of Object.entries(v)) visit(s, `${path}/schemas/${n}`, true);
      else visit(v, `${path}/${k}`, false);
    }
  };
  visit(document, "", false);
}

export function validate31(document: unknown): Validation31 {
  if (!oasFn) oasFn = buildOasValidator();
  const valid = oasFn(document) as boolean;
  const errors = (oasFn.errors ?? []).map((e: { instancePath?: string; message?: string }) => ({
    path: e.instancePath || "/",
    message: e.message ?? "invalid",
  }));
  checkSchemas(document, errors);
  return { valid: valid && errors.length === 0, errors };
}
