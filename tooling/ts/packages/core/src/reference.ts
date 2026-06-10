import type { OpenAPIv4Document, Reference } from "./types";

/** Structural guard for an OpenAPI Reference Object (C019 §A.1). NOTE: a JSON Schema may also carry a
 *  `$ref` keyword; in Schema-Object position the slot+token rule (C019) decides — this is the structural test. */
export function isReference(x: unknown): x is Reference {
  return typeof x === "object" && x !== null && "$ref" in x && typeof (x as Reference).$ref === "string";
}

function unescapeToken(t: string): string {
  // RFC 6901: ~1 => '/', ~0 => '~' (order matters)
  return t.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Resolve a same-document OpenAPI reference "#/components/<type>/<name>" BY NAME (C019 §A.1, C009).
 * Each pointer token is a map KEY (O(1) by-name); MUST throw if a key is absent; NEVER falls back to
 * positional/order lookup. Returns the referenced target. (Cross-document imports — C013 #72 — are not
 * yet implemented; a bare "#/..." is always same-document.)
 */
export function resolveRef(doc: OpenAPIv4Document, ref: string): unknown {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    throw new Error(`unsupported reference (only same-document JSON-Pointer '#/...' supported): ${ref}`);
  }
  const tokens = ref.slice(2).split("/").map(unescapeToken);
  let cur: unknown = doc;
  for (const tok of tokens) {
    // own-property only — `tok in cur` would walk the prototype chain, so a $ref to a builtin name
    // ("constructor"/"toString") would resolve to a JS function instead of throwing "reference not found".
    if (cur == null || typeof cur !== "object" || Array.isArray(cur) || !Object.prototype.hasOwnProperty.call(cur, tok)) {
      throw new Error(`reference not found: ${ref} (missing key '${tok}')`);
    }
    cur = (cur as Record<string, unknown>)[tok];
  }
  return cur;
}

/** Resolve a value that may itself be a Reference (one hop). Returns the value unchanged if it is not a Reference. */
export function deref<T = unknown>(doc: OpenAPIv4Document, value: T | Reference): T {
  return isReference(value) ? (resolveRef(doc, value.$ref) as T) : (value as T);
}
