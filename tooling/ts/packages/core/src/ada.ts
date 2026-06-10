import type { OpenAPIv4Document, PathItem, Request } from "./types";
import { compileTemplate, matchPath, variableCount, type CompiledTemplate } from "./template";
import { computeSignature, collide, type SignatureTuple, type CollisionVerdict } from "./signature";

/** One operation in the ADA: a request resolved with its pathItem context, signature, and compiled template. */
export interface Operation {
  pathTemplate: string;
  /** The DOM handle (key in pathItem.requests) — the by-name identity (C009). */
  name: string;
  request: Request;
  tuple: SignatureTuple;
  signatureKey: string;
  compiled: CompiledTemplate;
}

export interface Collision {
  a: Operation;
  b: Operation;
  verdict: CollisionVerdict;
}

/** The Abstract Description API (SPEC §13, CONFORMANCE §B): the consumption surface computed from the DOM. */
export interface Ada {
  operations: Operation[];
  bySignature: Map<string, Operation[]>;
  /** Best-effort static collision verdicts among operations (detect-and-tolerate, never a gate; C003). */
  collisions: Collision[];
}

/** Build the ADA from a parsed document: index every request, compute signatures, detect collisions. */
export function buildAda(doc: OpenAPIv4Document): Ada {
  const operations: Operation[] = [];
  for (const [pathTemplate, pathItem] of Object.entries(doc.paths ?? {})) {
    const pi = pathItem as PathItem;
    for (const [name, request] of Object.entries(pi.requests ?? {})) {
      const { tuple, key } = computeSignature(pathTemplate, request as Request);
      operations.push({ pathTemplate, name, request: request as Request, tuple, signatureKey: key, compiled: compileTemplate(pathTemplate) });
    }
  }
  const bySignature = new Map<string, Operation[]>();
  for (const op of operations) {
    const list = bySignature.get(op.signatureKey);
    if (list) list.push(op);
    else bySignature.set(op.signatureKey, [op]);
  }
  const collisions: Collision[] = [];
  for (let i = 0; i < operations.length; i++) {
    for (let j = i + 1; j < operations.length; j++) {
      const verdict = collide(operations[i].tuple, operations[j].tuple);
      if (verdict !== "provably-disjoint") collisions.push({ a: operations[i], b: operations[j], verdict });
    }
  }
  return { operations, bySignature, collisions };
}

export interface MatchResult {
  operation: Operation;
  /** Captured path variables (the per-location PATH slot instance). */
  pathParams: Record<string, string>;
  /** Raw query string key→values (the per-location QUERY slot instance, before schema coercion). */
  query: Record<string, string[]>;
}

/**
 * Match a concrete HTTP request (method + URL) to zero-or-one operation (CONFORMANCE §B.3).
 * Recognition direction: reverse-parse the path, filter by method; concrete-over-variable is a runtime
 * tiebreak (fewest path variables wins). Returns null if no operation matches.
 */
export function matchRequest(ada: Ada, method: string, url: string): MatchResult | null {
  const qIdx = url.indexOf("?");
  const path = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const query = parseQuery(qIdx >= 0 ? url.slice(qIdx + 1) : "");
  const m = method.toUpperCase();

  const candidates: { operation: Operation; pathParams: Record<string, string> }[] = [];
  for (const op of ada.operations) {
    if (op.request.method.toUpperCase() !== m) continue;
    const pathParams = matchPath(op.compiled, path);
    if (pathParams) candidates.push({ operation: op, pathParams });
  }
  if (candidates.length === 0) return null;
  // concrete-over-variable precedence (runtime tiebreak): fewest path variables wins.
  candidates.sort((a, b) => variableCount(a.operation.compiled) - variableCount(b.operation.compiled));
  return { operation: candidates[0].operation, pathParams: candidates[0].pathParams, query };
}

/** Parse a raw query string into the form-style key→values map (C019 §A.3 default; repeated keys → array). */
export function parseQuery(qs: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!qs) return out;
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
    const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " ")) : "";
    (out[k] ??= []).push(v);
  }
  return out;
}
