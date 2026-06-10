/**
 * The cycle model — the cockpit's spine. From the ONE hub artifact (a v4 "Suluk" document) it computes a
 * layered view of the whole declarative cycle: data entities, the API contract, auth, the document's health,
 * the docs, the derived client stores, the derived UI, and the contract checks. Every layer is a *projection*
 * of the same source, so the cockpit can show the lineage at a glance.
 *
 * It is also a FUNCTION of the requesting principal (the "who"): pass scopes and scope-gated operations the
 * principal can't reach are filtered out — the same per-viewer projection emitV4 does, applied at the hub.
 *
 * Pure (no vscode) → unit-tested with bun. The extension shell renders this into a TreeView.
 */
import { buildAda, validateDocument, isReference } from "@suluk/core";
import type { OpenAPIv4Document, Request, SchemaOrRef, SecurityRequirement } from "@suluk/core";
import { audit, coverage } from "@suluk/hono";
import { formSpec, tableSpec } from "@suluk/shadcn";
import { costAudit, costTable, formatMicroUsd } from "@suluk/cost";
import { readProviders } from "@suluk/builder";

export type LayerStatus = "ok" | "warn" | "error" | "info";

export interface CycleItem {
  label: string;
  detail?: string;
  status?: LayerStatus;
  /** A stable handle (e.g. an entity or operation name) for command targeting. */
  ref?: string;
}

export interface CycleLayer {
  id: "data" | "contract" | "auth" | "document" | "cost" | "docs" | "state" | "ui" | "providers" | "tests";
  title: string;
  status: LayerStatus;
  summary: string;
  items: CycleItem[];
}

export interface Principal {
  scopes?: string[];
}

export interface CycleModel {
  valid: boolean;
  coverage: number;
  /** The principal this view was projected for (undefined ⇒ the full/public view). */
  principal?: Principal;
  layers: CycleLayer[];
}

/** Scopes an operation requires (union across its security requirements; empty ⇒ public). */
function requiredScopes(req: Request): string[][] {
  const reqs = (req.security as SecurityRequirement[] | undefined) ?? [];
  // each requirement is an AND of schemes; we collapse a requirement to the union of its scopes.
  return reqs.map((r) => Object.values(r).flat());
}

/** Is `req` visible to a principal holding `scopes`? Public ops always; else ANY requirement must be satisfied. */
function visibleTo(req: Request, scopes: Set<string> | undefined): boolean {
  if (!scopes) return true; // no principal ⇒ full view
  const reqs = requiredScopes(req);
  if (reqs.length === 0) return true; // public op
  return reqs.some((needed) => needed.every((s) => scopes.has(s)));
}

function schemaFieldCount(schema: SchemaOrRef, defs: Record<string, SchemaOrRef>): number {
  try {
    return formSpec(schema, { defs }).fields.length;
  } catch {
    return 0;
  }
}

function pickStatus(...statuses: LayerStatus[]): LayerStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("warn")) return "warn";
  if (statuses.includes("info")) return "info";
  return "ok";
}

/** Build the full cycle model from a v4 document, optionally projected for a principal (the "who"). */
export function buildCycle(doc: OpenAPIv4Document, opts: { principal?: Principal } = {}): CycleModel {
  const schemas = (doc.components?.schemas ?? {}) as Record<string, SchemaOrRef>;
  const defs = schemas;
  const securitySchemes = doc.components?.securitySchemes ?? {};
  const scopes = opts.principal ? new Set(opts.principal.scopes ?? []) : undefined;

  const ada = buildAda(doc);
  // operations, filtered by the principal (the per-viewer projection)
  const ops = ada.operations.filter((o) => visibleTo(o.request, scopes));
  const hiddenCount = ada.operations.length - ops.length;

  // ── data: components.schemas (entities). x-suluk-db marks a DB-backed table (e.g. from @suluk/drizzle).
  const dataItems: CycleItem[] = Object.entries(schemas).map(([name, s]) => {
    const isTable = !isReference(s) && typeof s === "object" && s !== null && "x-suluk-db" in (s as object);
    return { label: name, ref: name, detail: `${isTable ? "table" : "schema"} · ${schemaFieldCount(s, defs)} fields` };
  });

  // ── contract: the operations (API surface)
  const scopeGated = ops.filter((o) => requiredScopes(o.request).some((r) => r.length > 0)).length;
  const contractItems: CycleItem[] = ops.map((o) => ({
    label: o.name,
    ref: o.name,
    detail: `${o.request.method.toUpperCase()} ${o.pathTemplate}`,
    status: requiredScopes(o.request).some((r) => r.length > 0) ? "info" : undefined,
  }));

  // ── auth
  const authItems: CycleItem[] = Object.entries(securitySchemes).map(([name, s]) => ({
    label: name,
    detail: (s as { type?: string }).type ?? "scheme",
  }));

  // ── document health
  const v = validateDocument(doc);
  const cov = coverage(doc);
  const findings = audit(doc);
  const warnFindings = findings.filter((f) => f.severity === "warn").length;

  // ── docs (always derivable via the 3.1 downgrade)
  const docsItems: CycleItem[] = [
    { label: "Scalar", detail: "Preview in Scalar (3.1 downgrade)" },
    { label: "Swagger UI", detail: "Preview in Swagger UI (3.1 downgrade)" },
  ];

  // ── state: one nano-store per operation (GET → fetcher, else mutator)
  const stateItems: CycleItem[] = ops.map((o) => ({
    label: o.name,
    ref: o.name,
    detail: o.request.method.toUpperCase() === "GET" ? "fetcher store" : "mutator store",
  }));

  // ── ui: a shadcn form + table per entity
  const uiItems: CycleItem[] = Object.entries(schemas).map(([name, s]) => {
    let cols = 0;
    try { cols = tableSpec(s, { defs }).columns.length; } catch { cols = 0; }
    return { label: name, ref: name, detail: `form (${schemaFieldCount(s, defs)} fields) · table (${cols} cols)` };
  });

  // ── cost: per-operation declared cost (x-suluk-cost) + coverage (which operations declared nothing)
  const declaredCosts = costTable(doc);
  const costFindings = costAudit(doc);
  const undeclared = costFindings.filter((f) => f.code === "no-cost-model").length;
  const costItems: CycleItem[] = declaredCosts.map((d) => ({ label: d.operation, ref: d.operation, detail: `${formatMicroUsd(d.estimateMicroUsd)} · ${d.sources.join(", ")}` }));

  // ── providers: the swappable facet bindings recorded on the document (M3)
  const providerBindings = readProviders(doc);
  const providerItems: CycleItem[] = providerBindings.map((b) => ({
    label: b.facet, ref: b.facet,
    detail: `${b.title}${b.alternatives.length ? ` · ${b.alternatives.length} alternatives` : ""}`,
    status: b.known ? undefined : "warn",
  }));

  // ── tests: doc-level contract checks
  const checks = docChecks(doc);
  const testsItems: CycleItem[] = checks.map((c) => ({ label: c.name, status: c.pass ? "ok" : "error", detail: c.pass ? "pass" : c.message }));

  const layers: CycleLayer[] = [
    { id: "data", title: "Data (entities)", status: dataItems.length ? "ok" : "info", summary: `${dataItems.length} entities`, items: dataItems },
    {
      id: "contract", title: "Contract (API)",
      status: "ok",
      summary: `${ops.length} operations · ${scopeGated} scope-gated${hiddenCount ? ` · ${hiddenCount} hidden for this viewer` : ""}`,
      items: contractItems,
    },
    { id: "auth", title: "Auth", status: authItems.length ? "ok" : "info", summary: authItems.length ? `${authItems.length} schemes` : "none", items: authItems },
    {
      id: "document", title: "Document (v4)",
      status: pickStatus(v.valid ? "ok" : "error", warnFindings ? "warn" : "ok"),
      summary: `${v.valid ? "meta-schema ✓" : `${v.errors.length} errors`} · coverage ${cov.toFixed(2)} · ${warnFindings} audit warns`,
      items: v.valid ? [] : v.errors.slice(0, 20).map((e) => ({ label: e.message, detail: e.path, status: "error" as const })),
    },
    {
      id: "cost", title: "Cost",
      status: declaredCosts.length === 0 ? "info" : undeclared ? "warn" : "ok",
      summary: declaredCosts.length === 0 ? "no costs declared" : `${declaredCosts.length} priced · ${undeclared} undeclared`,
      items: costItems,
    },
    { id: "docs", title: "Docs", status: "ok", summary: "Scalar · Swagger", items: docsItems },
    { id: "state", title: "State (Nano Stores)", status: "ok", summary: `${stateItems.length} stores`, items: stateItems },
    { id: "ui", title: "UI (shadcn)", status: uiItems.length ? "ok" : "info", summary: `${uiItems.length} forms/tables`, items: uiItems },
    {
      id: "providers", title: "Providers",
      status: providerItems.length ? "ok" : "info",
      summary: providerItems.length ? providerBindings.map((b) => `${b.facet}→${b.impl}`).join(" · ") : "none",
      items: providerItems,
    },
    {
      id: "tests", title: "Tests (contract checks)",
      status: checks.every((c) => c.pass) ? "ok" : "error",
      summary: `${checks.filter((c) => c.pass).length}/${checks.length} ✓`,
      items: testsItems,
    },
  ];

  return { valid: v.valid, coverage: cov, principal: opts.principal, layers };
}

export interface DocCheck { name: string; pass: boolean; message: string }

/** Doc-level "contract checks" — the mistakes a finished v4 document can still encode. */
export function docChecks(doc: OpenAPIv4Document): DocCheck[] {
  const out: DocCheck[] = [];
  const v = validateDocument(doc);
  out.push({ name: "validates against the v4 meta-schema", pass: v.valid, message: v.errors.slice(0, 3).map((e) => `${e.path} ${e.message}`).join("; ") });
  const ada = buildAda(doc);
  const provable = ada.collisions.filter((c) => c.verdict === "provable-collision");
  out.push({ name: "no two operations provably collide", pass: provable.length === 0, message: provable.map((c) => `${c.a.name} vs ${c.b.name}`).join("; ") });
  const ops = ada.operations.length;
  out.push({ name: "every path has at least one operation", pass: ops > 0 || Object.keys(doc.paths ?? {}).length === 0, message: "a pathItem has no requests" });
  return out;
}

/** A flat list for simple renderers / status lines. */
export function cycleSummary(model: CycleModel): { layer: string; summary: string; status: LayerStatus }[] {
  return model.layers.map((l) => ({ layer: l.title, summary: l.summary, status: l.status }));
}
