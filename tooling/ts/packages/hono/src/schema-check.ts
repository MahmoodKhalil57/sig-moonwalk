/**
 * Validate that a value is a well-formed JSON Schema 2020-12 (the dialect v4 Schema Objects must use).
 * Used by contractChecks to catch a Zod→v4 conversion that produced a malformed schema.
 */
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

export interface SchemaCheck {
  valid: boolean;
  errors: { path: string; message: string }[];
}

function build() {
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  addFormats(ajv);
  return ajv.getSchema("https://json-schema.org/draft/2020-12/schema")!;
}

let metaFn: ReturnType<typeof build> | undefined;

export function validateSchema2020(schema: unknown): SchemaCheck {
  if (!metaFn) metaFn = build();
  const valid = metaFn(schema) as boolean;
  const errors = (metaFn.errors ?? []).map((e: { instancePath?: string; message?: string }) => ({
    path: e.instancePath || "/",
    message: e.message ?? "invalid",
  }));
  return { valid, errors };
}
