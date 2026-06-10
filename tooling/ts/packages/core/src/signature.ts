import type { Request } from "./types";
import { compileTemplate } from "./template";
import { isReference } from "./reference";

/** Canonical signature tuple (C019 §A.2). The ADA's identity of a request; the matcher/collision key. */
export interface SignatureTuple {
  method: string;
  /** Path shape: literals kept, variables erased to `{}` (keys on shape, not on var spelling). */
  path: string;
  /** Sorted query key-set (order/repetition-insensitive). */
  query: string[];
  /** Canonical media type, or "*" if absent (does-not-participate). */
  contentType: string;
  /** Participating header names (lowercased, sorted); "*" sentinel if none (best-effort, #108). */
  headers: string[];
  /** Stable id of the request-body schema: its $ref, or "inline:<hash>", or "*". */
  body: string;
}

function normalizeContentType(ct: Request["contentType"]): string {
  if (ct == null) return "*";
  const one = Array.isArray(ct) ? ct.slice().sort()[0] : ct; // canonical: first sorted media type
  // lowercase type/subtype; strip surrounding whitespace; (params normalization omitted in this default)
  return one.trim().toLowerCase();
}

function bodyId(req: Request): string {
  const cs = req.contentSchema;
  if (cs == null) return "*";
  if (isReference(cs)) return cs.$ref;
  // inline schema: a stable structural hash (djb2 over canonical JSON)
  const json = JSON.stringify(cs, Object.keys(cs as object).sort());
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) >>> 0;
  return "inline:" + h.toString(16);
}

/** Compute a request's canonical signature tuple + deterministic key string (C019 §A.2). */
export function computeSignature(uriTemplate: string, req: Request): { tuple: SignatureTuple; key: string } {
  const ct = compileTemplate(uriTemplate);
  const method = req.method.toUpperCase();
  const path = ct.pathSegments.map((s) => (s.kind === "literal" ? s.value : "{}")).join("/");
  const query = [...new Set(ct.queryKeys)].sort();
  const contentType = normalizeContentType(req.contentType);
  const headers: string[] = []; // best-effort default: no header participates in identity (#108 deferred)
  const body = bodyId(req);
  const tuple: SignatureTuple = { method, path, query, contentType, headers, body };
  const key =
    `M=${method}|P=${path}|Q=${query.join(",") || "*"}` +
    `|C=${contentType}|H=${headers.join(",") || "*"}|B=${body}`;
  return { tuple, key };
}

export type CollisionVerdict = "provably-disjoint" | "provable-collision" | "not-statically-determinable";

const STAR = (v: string | string[]): boolean => v === "*" || (Array.isArray(v) && v.length === 0);

/** Pairwise three-valued collision predicate (C003 detect-and-tolerate; NOT a gate). */
export function collide(a: SignatureTuple, b: SignatureTuple): CollisionVerdict {
  if (a.method !== b.method) return "provably-disjoint";
  // path shapes: same shape => potential collision; different literal at a position => disjoint
  if (a.path !== b.path) {
    const as = a.path.split("/");
    const bs = b.path.split("/");
    if (as.length !== bs.length) return "provably-disjoint";
    for (let i = 0; i < as.length; i++) {
      if (as[i] !== "{}" && bs[i] !== "{}" && as[i] !== bs[i]) return "provably-disjoint";
    }
    // same length, differ only where one side is a variable => one is more specific => collision-candidate
  }
  // content-type: two concrete, different media types are disjoint
  if (!STAR(a.contentType) && !STAR(b.contentType) && a.contentType !== b.contentType) return "provably-disjoint";
  // body / query discrimination is schema-dependent (runtime, D1) — not statically decidable here
  if (a.body !== b.body || a.query.join(",") !== b.query.join(",")) return "not-statically-determinable";
  return "provable-collision";
}
