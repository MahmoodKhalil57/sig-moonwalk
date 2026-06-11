/**
 * Schema HARDENING audit — a derived facet (like cost/access) that scores how well a v4 document's INPUT schemas
 * bound untrusted input, the validations that keep weird/oversized data from breaking the system:
 *   • no `any`/`unknown` — every input has a determinable type (or enum/const)
 *   • every string a maxLength AND a pattern (a character allowlist) — unless bounded by enum/const/format
 *   • every number a maximum (and ideally a minimum)
 *   • every array a maxItems (a DoS guard)
 *   • every object CLOSED (additionalProperties:false) and TYPED (defined properties)
 * It produces per-operation + document scores + a letter grade, concrete fixes, and a CI gate — to INCENTIVISE the
 * author to harden the contract. Audits the request body + typed parameter slots (the attack surface).
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { isReference, deref } from "@suluk/core";

export type Severity = "high" | "medium" | "low";
export type Grade = "A" | "B" | "C" | "D" | "F";
export interface Finding { rule: string; severity: Severity; path: string; message: string; fix: string }
export interface Audit { findings: Finding[]; nodes: number; clean: number; score: number; grade: Grade }
export interface OpAudit extends Audit { operation: string; method: string; path: string }
export interface DocAudit extends Audit { byOperation: OpAudit[]; bySeverity: Record<Severity, number> }

export function grade(score: number): Grade { return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F"; }

interface Acc { findings: Finding[]; nodes: Map<string, boolean> } // path → clean

const has = (o: Record<string, unknown>, k: string) => o[k] != null;

function walk(doc: OpenAPIv4Document, schema: unknown, path: string, seen: Set<string>, acc: Acc): void {
  if (schema == null || schema === false) return; // absent / `never` — nothing to audit
  if (isReference(schema)) {
    const id = String((schema as { $ref: string }).$ref);
    if (seen.has(id)) return;
    let r: unknown; try { r = deref(doc, schema); } catch { return; } // dangling — the renderer flags it; skip here
    if (r && !isReference(r)) walk(doc, r, id.replace(/^#\//, ""), new Set([...seen, id]), acc); // model-rooted path → dedupe across ops
    return;
  }
  if (schema === true) { mark(acc, path, false); acc.findings.push({ rule: "no-any", severity: "high", path, message: `'${path}' is \`true\` — permits ANY value`, fix: "replace with a typed, bounded schema" }); return; }
  const s = schema as Record<string, unknown>;
  if (Array.isArray(s.oneOf) || Array.isArray(s.anyOf) || Array.isArray(s.allOf)) { for (const b of (s.oneOf ?? s.anyOf ?? s.allOf) as unknown[]) walk(doc, b, `${path}/~`, seen, acc); return; }
  if (s.enum !== undefined || s.const !== undefined) { mark(acc, path, true); return; } // bounded by an explicit value set → clean

  const types = Array.isArray(s.type) ? (s.type as string[]) : s.type ? [s.type as string] : [];
  mark(acc, path, true); // optimistic; failures flip it
  const fail = (rule: string, sev: Severity, message: string, fix: string) => { acc.findings.push({ rule, severity: sev, path, message, fix }); mark(acc, path, false); };

  if (!types.length) { fail("no-any", "high", `'${path}' has no \`type\` (any/unknown)`, "give it a concrete type + bounds — never accept unconstrained input"); return; }
  for (const t of types) {
    if (t === "string") {
      const bounded = has(s, "format");
      if (!has(s, "maxLength") && !bounded) fail("string-max-length", "high", `string '${path}' has no maxLength`, "add maxLength (e.g. 256) so the field can't be unboundedly large");
      if (!has(s, "pattern") && !bounded) fail("string-pattern", "medium", `string '${path}' has no pattern`, "add a pattern allowlisting characters (e.g. ^[\\w .@-]{0,256}$) to reject weird/injection input");
    } else if (t === "integer" || t === "number") {
      if (!has(s, "maximum") && !has(s, "exclusiveMaximum")) fail("number-maximum", "medium", `number '${path}' has no maximum`, "add a maximum to bound magnitude / digit count");
      if (!has(s, "minimum") && !has(s, "exclusiveMinimum")) fail("number-minimum", "low", `number '${path}' has no minimum`, "add a minimum");
    } else if (t === "array") {
      if (!has(s, "maxItems")) fail("array-max-items", "high", `array '${path}' has no maxItems`, "add maxItems to cap array size (DoS guard)");
      walk(doc, s.items, `${path}[]`, seen, acc);
    } else if (t === "object") {
      const open = s.additionalProperties !== false;
      if (open) fail("object-closed", "medium", `object '${path}' allows additionalProperties`, "set additionalProperties:false to forbid unexpected keys");
      const props = (s.properties ?? {}) as Record<string, unknown>;
      if (Object.keys(props).length) for (const [k, v] of Object.entries(props)) walk(doc, v, `${path}/${k}`, seen, acc);
      else if (open) fail("object-typed", "medium", `object '${path}' has no defined properties (a free-form bag)`, "define properties with explicit types (a closed empty object additionalProperties:false is fine for no-input)");
      // a CLOSED object with no properties (additionalProperties:false) accepts only {} → fully bounded, clean.
    }
  }
}

function mark(acc: Acc, path: string, clean: boolean) { acc.nodes.set(path, (acc.nodes.get(path) ?? true) && clean); }

function score(acc: Acc): Audit {
  const nodes = acc.nodes.size;
  const clean = [...acc.nodes.values()].filter(Boolean).length;
  const sc = nodes === 0 ? 100 : Math.round((clean / nodes) * 100);
  // dedupe findings by rule@path (a shared model audited under many ops collapses)
  const seen = new Set<string>();
  const findings = acc.findings.filter((f) => { const k = `${f.rule}@${f.path}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { findings, nodes, clean, score: sc, grade: grade(sc) };
}

interface RawReq { method: string; contentSchema?: unknown; parameterSchema?: Record<string, unknown> }

/** Audit one request's INPUT surface (request body + typed parameter slots). */
export function auditOperation(doc: OpenAPIv4Document, uri: string, name: string, req: RawReq): OpAudit {
  const acc: Acc = { findings: [], nodes: new Map() };
  const ps = req.parameterSchema ?? {};
  walk(doc, req.contentSchema ?? ps.body, `${name}/body`, new Set(), acc);
  for (const loc of ["path", "query", "header", "cookie"] as const) walk(doc, ps[loc], `${name}/${loc}`, new Set(), acc);
  return { ...score(acc), operation: name, method: req.method.toLowerCase(), path: uri };
}

export interface AuditOptions {
  /** skip operations (e.g. third-party/ingested surfaces you don't author) — they don't count toward the grade. */
  ignore?: (uri: string, name: string) => boolean;
}

/** Audit the document's input surface → per-op grades + a deduped rollup + a severity breakdown. */
export function auditDocument(doc: OpenAPIv4Document, opts: AuditOptions = {}): DocAudit {
  const byOperation: OpAudit[] = [];
  const acc: Acc = { findings: [], nodes: new Map() };
  for (const [uri, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as { requests?: Record<string, RawReq> };
    for (const [name, req] of Object.entries(pi.requests ?? {})) {
      if (opts.ignore?.(uri, name)) continue;
      byOperation.push(auditOperation(doc, uri, name, req));
      // accumulate into the doc-wide map (model-rooted paths dedupe shared schemas)
      const ps = req.parameterSchema ?? {};
      walk(doc, req.contentSchema ?? ps.body, `${name}/body`, new Set(), acc);
      for (const loc of ["path", "query", "header", "cookie"] as const) walk(doc, ps[loc], `${name}/${loc}`, new Set(), acc);
    }
  }
  const s = score(acc);
  const bySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of s.findings) bySeverity[f.severity]++;
  return { ...s, byOperation: byOperation.sort((a, b) => a.score - b.score), bySeverity };
}

const ORDER: Grade[] = ["F", "D", "C", "B", "A"];
/** CI gate (the hard incentive): throw if the document's hardening grade is below `min`. */
export function assertGrade(doc: OpenAPIv4Document, min: Grade, opts: AuditOptions = {}): DocAudit {
  const a = auditDocument(doc, opts);
  if (ORDER.indexOf(a.grade) < ORDER.indexOf(min)) {
    const worst = a.byOperation.slice(0, 5).map((o) => `${o.operation} (${o.grade})`).join(", ");
    throw new Error(`@suluk/harden: contract grade ${a.grade} (${a.score}/100) is below the required ${min}. ${a.bySeverity.high} high · ${a.bySeverity.medium} medium findings. Weakest: ${worst}. Add maxLength/pattern/maximum/maxItems + close objects.`);
  }
  return a;
}
