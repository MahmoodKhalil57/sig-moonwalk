/**
 * Contract converge — a coherence audit over a WHOLE contract (the burhan-converge spirit). installModule
 * refuses NAME collisions at merge time; converge catches the cross-cutting CONTRADICTIONS that survive a clean
 * merge: an operation requiring a scope no security scheme declares, a security requirement naming a scheme
 * that isn't defined, a $ref to a schema nothing provides, a path with no operations, an entity referenced by
 * nothing. Run it after composing modules to know the merged platform is self-consistent, not just collision-free.
 * Pure (no host) → unit-tested.
 */
import { buildAda } from "@suluk/core";
import type { OpenAPIv4Document, Request, SchemaOrRef, SecurityRequirement } from "@suluk/core";
import { schemaRefName } from "@suluk/builder";

export type ConvergeCode = "dangling-ref" | "undeclared-scheme" | "orphan-scope" | "empty-path" | "unreferenced-entity";

export interface ConvergeFinding {
  code: ConvergeCode;
  severity: "error" | "warn" | "info";
  message: string;
  where?: string;
}
export interface ConvergeReport {
  findings: ConvergeFinding[];
  /** true ⇒ no error-severity findings — the contract is self-consistent */
  clean: boolean;
}

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * The scope universe a scheme allows, for orphan-scope checking — or NULL when the scopes are not LOCALLY
 * knowable (openIdConnect defines its scopes in a remote discovery document), so converge must not flag them.
 * oauth2 → the union of its flows' declared scopes; apiKey/http/mutualTLS → the empty set (they declare none).
 */
function scopeUniverse(scheme: unknown): Set<string> | null {
  const s = scheme as { type?: string; flows?: Record<string, { scopes?: Record<string, string> }> };
  if (s?.type === "openIdConnect") return null; // scopes live in the OIDC discovery doc — not locally checkable
  if (s?.type !== "oauth2") return new Set();
  const out = new Set<string>();
  for (const flow of Object.values(s.flows ?? {})) for (const name of Object.keys(flow?.scopes ?? {})) out.add(name);
  return out;
}

/** Every schema name targeted by a `#/components/schemas/X` $ref anywhere in the document (deep/escaped-safe). */
function referencedSchemas(doc: OpenAPIv4Document): Set<string> {
  const names = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.$ref === "string") { const name = schemaRefName(o.$ref); if (name) names.add(name); }
      for (const val of Object.values(o)) walk(val);
    }
  };
  walk(doc);
  return names;
}

/** Audit a contract for coherence contradictions a clean merge can still leave behind. */
export function convergeContract(doc: OpenAPIv4Document): ConvergeReport {
  const findings: ConvergeFinding[] = [];
  const schemas = (doc.components?.schemas ?? {}) as Record<string, SchemaOrRef>;
  const schemes = (doc.components?.securitySchemes ?? {}) as Record<string, unknown>;

  // dangling $refs — a reference to a schema nothing provides
  const referenced = referencedSchemas(doc);
  for (const name of referenced) if (!hasOwn(schemas, name)) findings.push({ code: "dangling-ref", severity: "error", message: `$ref to schema "${name}" — nothing provides it`, where: name });

  // security coherence — every required scheme is declared, and every required scope is declared by that scheme.
  // Covers BOTH path operations AND webhooks (both carry security; the dangling-ref walk already covers webhooks).
  const secured = [
    ...buildAda(doc).operations.map((o) => ({ name: o.name, security: o.request.security as SecurityRequirement[] | undefined })),
    ...Object.entries((doc as { webhooks?: Record<string, Request> }).webhooks ?? {}).map(([name, req]) => ({ name, security: req.security as SecurityRequirement[] | undefined })),
  ];
  for (const op of secured) {
    for (const req of op.security ?? []) {
      for (const [schemeName, scopes] of Object.entries(req)) {
        if (!hasOwn(schemes, schemeName)) {
          findings.push({ code: "undeclared-scheme", severity: "error", message: `operation "${op.name}" requires security scheme "${schemeName}", which is not declared in components.securitySchemes`, where: op.name });
          continue;
        }
        const universe = scopeUniverse(schemes[schemeName]);
        if (universe && Array.isArray(scopes)) for (const s of scopes) if (!universe.has(s)) findings.push({ code: "orphan-scope", severity: "error", message: `operation "${op.name}" requires scope "${s}", which scheme "${schemeName}" does not declare`, where: op.name });
      }
    }
  }

  // empty path items — a path that declares no operations
  for (const [p, pi] of Object.entries(doc.paths ?? {})) {
    if (!Object.keys((pi as { requests?: object }).requests ?? {}).length) findings.push({ code: "empty-path", severity: "error", message: `path "${p}" declares no operations`, where: p });
  }

  // unreferenced entities — a schema nothing $refs (dead weight; info, not an error)
  for (const name of Object.keys(schemas)) if (!referenced.has(name)) findings.push({ code: "unreferenced-entity", severity: "info", message: `entity "${name}" is referenced by no $ref`, where: name });

  return { findings, clean: !findings.some((f) => f.severity === "error") };
}
