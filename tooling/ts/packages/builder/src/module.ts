/**
 * Suluk MODULES (C021) — a module is a mergeable v4 contract FRAGMENT plus its bindings. Installing it merges
 * the fragment into the one app document, and every cockpit layer re-projects unchanged. Because a shared
 * entity is ONE schema (referenced by $ref, never copied), the API client, the DB FK, the cost attribution and
 * the auth scopes all see the same entity — which is why Suluk modules genuinely COMPOSE where generic plugins
 * don't.
 *
 * The product is the INSTALL-TIME DISCIPLINE, not the bundling: installModule REFUSES on any collision
 * (entity/operation name) and CHECKS that `requires` are satisfied, returning the conflicts instead of silently
 * corrupting the contract. namespaceModule resolves a collision by prefixing the module's OWNED entities and
 * rewriting its internal $refs. Pure (no host) → unit-tested.
 */
import { validateDocument } from "@suluk/core";
import type { OpenAPIv4Document, PathItem, Request, SchemaOrRef } from "@suluk/core";
import { audit } from "@suluk/hono";

/** A per-operation cost facet (mirrors @suluk/cost's CostModel; kept local so builder needn't depend on cost). */
export interface ModuleCost {
  components: { source: string; basis: string; microUsd: number }[];
  estimateMicroUsd: number;
}

export interface SulukModule {
  name: string;
  version: string;
  /** Entity names this module OWNS (each must have a schema in `schemas`). */
  provides: string[];
  /** Entity names this module REFERENCES but does not own — must already be present at install time. */
  requires?: string[];
  /** components.schemas fragment (the provided entities; may $ref a required entity like User). */
  schemas: Record<string, SchemaOrRef>;
  /** Explicit operations beyond the auto-CRUD (e.g. checkout); keyed by v4 path. */
  paths?: Record<string, PathItem>;
  /** Auto-generate CRUD operations for each provided entity (default true). */
  crud?: boolean;
  /** x-suluk-cost per operation name (e.g. createOrder). */
  cost?: Record<string, ModuleCost>;
  /** securitySchemes to merge. */
  securitySchemes?: Record<string, unknown>;
  /** Declared provider slots a developer can swap (e.g. { payments: "stripe" }). */
  providerSlots?: Record<string, string>;
}

export interface InstallResult {
  /** The merged document (UNCHANGED from `base` when installed === false). */
  doc: OpenAPIv4Document;
  /** Collision / requirement errors; non-empty ⇒ the install was REFUSED. */
  conflicts: string[];
  added: { schemas: string[]; operations: string[] };
  installed: boolean;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const idPath = { path: { type: "object", properties: { id: { type: "string" } } } } as const;

/** The v4 CRUD operations for one entity, with $ref-based schemas (so the entity lives in components.schemas). */
export function crudV4Paths(entity: string): Record<string, PathItem> {
  const ref = { $ref: `#/components/schemas/${entity}` } as SchemaOrRef;
  const lc = lower(entity);
  return {
    [lc]: { requests: {
      [`list${entity}`]: { method: "get", summary: `List ${entity}`, tags: [entity], responses: { ok: { status: 200, contentType: "application/json", contentSchema: { type: "array", items: ref } } } } as Request,
      [`create${entity}`]: { method: "post", summary: `Create ${entity}`, tags: [entity], contentType: "application/json", contentSchema: ref, responses: { created: { status: 201, description: "created", contentType: "application/json", contentSchema: ref } } } as Request,
    } },
    [`${lc}/{id}`]: { requests: {
      [`get${entity}`]: { method: "get", summary: `Get ${entity}`, tags: [entity], parameterSchema: idPath, responses: { ok: { status: 200, contentType: "application/json", contentSchema: ref }, notFound: { status: 404, description: "not found" } } } as Request,
      [`update${entity}`]: { method: "patch", summary: `Update ${entity}`, tags: [entity], parameterSchema: idPath, contentType: "application/json", contentSchema: ref, responses: { ok: { status: 200, description: "updated", contentType: "application/json", contentSchema: ref } } } as Request,
      [`delete${entity}`]: { method: "delete", summary: `Delete ${entity}`, tags: [entity], parameterSchema: idPath, responses: { deleted: { status: 204, description: "deleted" } } } as Request,
    } },
  };
}

function opNamesOf(paths: Record<string, PathItem>): string[] {
  return Object.values(paths).flatMap((pi) => Object.keys(pi.requests ?? {}));
}

/**
 * Merge a module's contract fragment into the app document — REFUSING on any collision or unmet requirement.
 * On refusal `doc` is the unchanged `base` and `conflicts` explains why; nothing is partially applied.
 */
export function installModule(base: OpenAPIv4Document, mod: SulukModule): InstallResult {
  const conflicts: string[] = [];
  const baseSchemas = (base.components?.schemas ?? {}) as Record<string, SchemaOrRef>;
  const basePaths = (base.paths ?? {}) as Record<string, PathItem>;
  const refused = (): InstallResult => ({ doc: base, conflicts, added: { schemas: [], operations: [] }, installed: false });

  // 1. requires — referenced-but-not-owned entities must already exist
  for (const r of mod.requires ?? []) {
    if (!(r in baseSchemas)) conflicts.push(`requires "${r}", which is not present — install the module that provides it first`);
  }
  // 2. provides — each must ship a schema, must NOT already exist, and must not alias another provide's resource
  const byResource = new Map<string, string>();
  for (const name of mod.provides) {
    if (!(name in mod.schemas)) conflicts.push(`declares provides "${name}" but ships no schema for it`);
    if (name in baseSchemas) conflicts.push(`entity "${name}" already exists in the app — namespace the module to install alongside it`);
    const res = lower(name);
    const prior = byResource.get(res);
    if (prior) conflicts.push(`entities "${prior}" and "${name}" map to the same path resource "${res}" — namespace one`);
    else byResource.set(res, name);
  }

  // 3. the paths the module adds — auto-CRUD (fresh objects) + explicit (deep-cloned so the manifest is never mutated)
  const crud: Record<string, PathItem> = (mod.crud ?? true) ? Object.assign({}, ...mod.provides.map((e) => crudV4Paths(e))) : {};
  const explicit: Record<string, PathItem> = structuredClone(mod.paths ?? {}) as Record<string, PathItem>;
  for (const p of Object.keys(explicit)) if (p in crud) conflicts.push(`path "${p}" is generated by auto-CRUD and also declared explicitly`);
  const newPaths: Record<string, PathItem> = { ...crud, ...explicit };

  // 4. path-key (route) collisions vs base — REFUSE, never silently merge ops into an existing path
  for (const p of Object.keys(newPaths)) if (p in basePaths) conflicts.push(`path "${p}" already exists in the app (collision)`);

  // 5. operation-name collisions — vs base (paths AND webhooks), and duplicated WITHIN the module
  const baseOps = new Set<string>([...opNamesOf(basePaths), ...Object.keys((base as { webhooks?: Record<string, unknown> }).webhooks ?? {})]);
  const allNewOps = [...opNamesOf(crud), ...opNamesOf(explicit)];
  const seen = new Set<string>();
  for (const op of allNewOps) {
    if (baseOps.has(op)) conflicts.push(`operation "${op}" already exists in the app (collision)`);
    if (seen.has(op)) conflicts.push(`module declares operation "${op}" more than once (auto-CRUD vs explicit)`);
    seen.add(op);
  }

  if (conflicts.length) return refused();

  // 6. clean merge into a deep copy — base paths are untouched (collisions were refused above)
  const doc = structuredClone(base) as OpenAPIv4Document;
  doc.components = doc.components ?? {};
  doc.components.schemas = { ...(doc.components.schemas ?? {}), ...mod.schemas } as typeof doc.components.schemas;
  if (mod.securitySchemes) {
    doc.components.securitySchemes = { ...(doc.components.securitySchemes ?? {}), ...mod.securitySchemes } as typeof doc.components.securitySchemes;
  }
  if (mod.providerSlots) {
    // record the module's provider-slot defaults (M3) — but an EXISTING binding (a user's deliberate swap, or
    // an earlier module's choice) WINS, so installing a second module never silently clobbers it.
    const d = doc as unknown as Record<string, unknown>;
    d["x-suluk-providers"] = { ...mod.providerSlots, ...((d["x-suluk-providers"] as Record<string, string>) ?? {}) };
  }
  doc.paths = { ...((doc.paths ?? {}) as Record<string, PathItem>), ...newPaths } as typeof doc.paths;

  // 7. cost facets — x-suluk-cost, stamped ONLY on the operations the module added (never on host ops)
  if (mod.cost) {
    for (const pi of Object.values(newPaths)) {
      for (const [op, req] of Object.entries(pi.requests ?? {})) {
        if (mod.cost[op]) (req as unknown as Record<string, unknown>)["x-suluk-cost"] = mod.cost[op];
      }
    }
  }

  // 8. fail-closed backstop: the merge MUST yield a valid v4 contract, else refuse with the validation errors
  const v = validateDocument(doc);
  if (!v.valid) {
    conflicts.push(...v.errors.slice(0, 10).map((e) => `merged document would be invalid: ${e.path} ${e.message}`));
    return refused();
  }

  return { doc, conflicts: [], added: { schemas: Object.keys(mod.schemas), operations: allNewOps }, installed: true };
}

/**
 * Resolve a collision by NAMESPACING a module: prefix its OWNED entities, rewrite internal $refs that point to
 * them, and remap auto-CRUD cost keys accordingly. `requires` refs (e.g. User) are left untouched so the module
 * still composes with the host. The returned module installs cleanly alongside one that already owns the names.
 */
export function namespaceModule(mod: SulukModule, prefix: string): SulukModule {
  const owned = new Set(mod.provides);
  const rename = (n: string) => `${prefix}${n}`;
  // replace any OWNED entity name appearing inside a string (op names, e.g. checkoutOrder → checkoutShopOrder)
  // in a SINGLE left-to-right pass, longest-name-first, so a substring overlap (Order ⊂ OrderLine) can't
  // double-prefix (`acc.split().join()` in a reduce re-scanned already-renamed text → listShopShopOrderLine).
  const renameInName = (() => {
    const names = [...mod.provides].sort((a, b) => b.length - a.length);
    if (!names.length) return (s: string) => s;
    const re = new RegExp(names.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
    return (s: string) => s.replace(re, (m) => rename(m));
  })();
  // rename a path's resource segments that exactly match a lowercased owned entity (order/{id} → shopOrder/{id})
  const renamePathKey = (p: string) =>
    p.split("/").map((seg) => { const e = mod.provides.find((x) => lower(x) === seg); return e ? lower(rename(e)) : seg; }).join("/");
  const rewriteRefs = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(rewriteRefs);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.$ref === "string") {
        const m = o.$ref.match(/^#\/components\/schemas\/(.+)$/);
        if (m && owned.has(m[1])) return { ...o, $ref: `#/components/schemas/${rename(m[1])}` };
      }
      return Object.fromEntries(Object.entries(o).map(([k, val]) => [k, rewriteRefs(val)]));
    }
    return v;
  };

  const schemas: Record<string, SchemaOrRef> = {};
  for (const [name, s] of Object.entries(mod.schemas)) schemas[owned.has(name) ? rename(name) : name] = rewriteRefs(s) as SchemaOrRef;

  let paths: Record<string, PathItem> | undefined;
  if (mod.paths) {
    paths = {};
    for (const [p, pi] of Object.entries(mod.paths)) {
      const requests: Record<string, Request> = {};
      for (const [op, req] of Object.entries(pi.requests ?? {})) requests[renameInName(op)] = rewriteRefs(req) as Request;
      paths[renamePathKey(p)] = { ...pi, requests };
    }
  }
  const cost = mod.cost ? Object.fromEntries(Object.entries(mod.cost).map(([op, c]) => [renameInName(op), c])) : undefined;

  return { ...mod, name: `${mod.name}:${prefix}`, provides: mod.provides.map(rename), schemas, paths, cost };
}

// ── module registry + conformance grade + install preview (M2 — the curated registry browser) ──

export interface ModuleEntry {
  title: string;
  description: string;
  module: SulukModule;
}
export interface ModuleRegistry {
  name: string;
  homepage?: string;
  modules: ModuleEntry[];
}
export interface ModuleGrade {
  grade: "A" | "B" | "C";
  /** 0..1 — cost-declaration coverage minus a documentation-warning penalty. */
  score: number;
  /** fraction of the module's operations that declare a cost (the real, author-attributable signal). */
  costCoverage: number;
  /** real documentation problems (audit `warn`s) on the module's authored ops. */
  warnings: number;
  notes: string[];
}
export interface InstallPreview {
  willInstall: boolean;
  conflicts: string[];
  requires: string[];
  missingRequires: string[];
  addsSchemas: string[];
  addsOperations: string[];
  cost: { operation: string; estimateMicroUsd: number }[];
  grade: ModuleGrade;
}

/** Every operation handle a module declares (auto-CRUD per provided entity + explicit ops). */
export function moduleOperations(mod: SulukModule): string[] {
  const crud: Record<string, PathItem> = (mod.crud ?? true) ? Object.assign({}, ...mod.provides.map((e) => crudV4Paths(e))) : {};
  return [...opNamesOf(crud), ...opNamesOf(mod.paths ?? {})];
}

/** A self-contained doc for the module (its `requires` entities stubbed) so audit/coverage can grade it. */
function moduleDoc(mod: SulukModule): OpenAPIv4Document {
  const stubs = Object.fromEntries((mod.requires ?? []).map((r) => [r, { type: "object" } as SchemaOrRef]));
  const crud: Record<string, PathItem> = (mod.crud ?? true) ? Object.assign({}, ...mod.provides.map((e) => crudV4Paths(e))) : {};
  return {
    openapi: "4.0.0-candidate",
    info: { title: mod.name, version: mod.version },
    paths: { ...crud, ...(mod.paths ?? {}) },
    components: { schemas: { ...stubs, ...mod.schemas } },
  } as OpenAPIv4Document;
}

/**
 * A conformance grade. The real, author-attributable signal is COST coverage (auto-CRUD ops carry a
 * framework-injected summary, so @suluk/hono `coverage` is structurally ~1.0 and tells us nothing); we use it
 * only as a documentation-WARNING penalty on authored ops. A module that contributes nothing grades C.
 */
export function gradeModule(mod: SulukModule): ModuleGrade {
  const ops = moduleOperations(mod);
  if (ops.length === 0) return { grade: "C", score: 0, costCoverage: 0, warnings: 0, notes: ["declares no operations"] };
  const costCoverage = ops.filter((op) => mod.cost?.[op]).length / ops.length;
  const warnings = audit(moduleDoc(mod)).filter((f) => f.severity === "warn").length;
  const score = Math.max(0, costCoverage - 0.1 * warnings);
  const grade: ModuleGrade["grade"] = warnings === 0 && score >= 0.9 ? "A" : score >= 0.5 ? "B" : "C";
  const notes: string[] = [];
  const undeclared = ops.filter((op) => !mod.cost?.[op]).length;
  if (undeclared) notes.push(`${undeclared}/${ops.length} operations declare no cost`);
  if (warnings) notes.push(`${warnings} documentation warning${warnings === 1 ? "" : "s"}`);
  return { grade, score, costCoverage, warnings, notes };
}

/** Preview an install WITHOUT committing — what it adds, what it requires, any conflicts, and its grade. */
export function previewInstall(base: OpenAPIv4Document, mod: SulukModule): InstallPreview {
  const baseSchemas = (base.components?.schemas ?? {}) as Record<string, SchemaOrRef>;
  const result = installModule(base, mod); // pure — never mutates base
  const ops = new Set(moduleOperations(mod));
  return {
    willInstall: result.installed,
    conflicts: result.conflicts,
    requires: mod.requires ?? [],
    missingRequires: (mod.requires ?? []).filter((r) => !(r in baseSchemas)),
    addsSchemas: Object.keys(mod.schemas),
    addsOperations: [...ops],
    // only the operations install will actually stamp — never a stale/typo cost key install would ignore
    cost: Object.entries(mod.cost ?? {}).filter(([op]) => ops.has(op)).map(([operation, c]) => ({ operation, estimateMicroUsd: c.estimateMicroUsd })),
    grade: gradeModule(mod),
  };
}
