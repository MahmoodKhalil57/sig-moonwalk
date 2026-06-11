/**
 * JSON Schema (2020-12) → HTML, and JSON Schema → a sample value. Handles $ref (resolved against the document,
 * linked to the Models section, with a recursion guard), objects, arrays, enums/const, oneOf/anyOf/allOf, and
 * common formats. Kept dependency-light: only @suluk/core for $ref resolution.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { isReference, deref } from "@suluk/core";
import { escapeHtml } from "./facets";

type Schema = Record<string, unknown>;

export function refName(ref: unknown): string | null {
  return isReference(ref) ? String((ref as { $ref: string }).$ref).split("/").pop() ?? "ref" : null;
}

export function typeOf(s: Schema): string {
  if (Array.isArray(s.type)) return (s.type as string[]).join(" | ");
  if (typeof s.type === "string") return s.format ? `${s.type}<${s.format}>` : (s.type as string);
  if (s.enum) return "enum";
  if (s.const !== undefined) return "const";
  if (s.oneOf) return "oneOf"; if (s.anyOf) return "anyOf"; if (s.allOf) return "allOf";
  if (s.properties) return "object";
  if (s.items) return "array";
  return "any";
}

/** Render a schema compactly. `depth`/`seen` guard against $ref cycles + runaway nesting. */
export function schemaHtml(doc: OpenAPIv4Document, schema: unknown, depth = 0, seen: Set<string> = new Set()): string {
  if (schema == null) return `<span class="chip">any</span>`;
  if (typeof schema === "boolean") return `<span class="chip">${schema ? "any" : "never"}</span>`;
  const ref = refName(schema);
  if (ref) {
    const id = String((schema as { $ref: string }).$ref);
    if (seen.has(id) || depth > 6) return `<a class="chip ref-link" href="#model-${escapeHtml(ref)}">${escapeHtml(ref)} ↗</a>`;
    const resolved = deref(doc, schema);
    if (resolved && !isReference(resolved)) {
      return `<div class="ref"><a class="ref-name" href="#model-${escapeHtml(ref)}">${escapeHtml(ref)}</a>${schemaHtml(doc, resolved, depth + 1, new Set([...seen, id]))}</div>`;
    }
    return `<a class="chip ref-link" href="#model-${escapeHtml(ref)}">${escapeHtml(ref)} ↗</a>`;
  }
  const s = schema as Schema;
  for (const key of ["oneOf", "anyOf", "allOf"] as const) {
    if (Array.isArray(s[key])) {
      const variants = (s[key] as unknown[]).map((v) => `<div class="variant">${schemaHtml(doc, v, depth + 1, seen)}</div>`).join("");
      return `<div class="compose"><span class="compose-kind">${key}</span>${variants}</div>`;
    }
  }
  if (s.enum) return `<span class="chip">enum</span> <span class="muted enum-vals">${(s.enum as unknown[]).map((e) => `<code>${escapeHtml(JSON.stringify(e))}</code>`).join(" ")}</span>`;
  if (s.const !== undefined) return `<span class="chip">const</span> <code>${escapeHtml(JSON.stringify(s.const))}</code>`;
  if (s.type === "array" || s.items) {
    return `<div class="arr"><span class="chip">array</span> of ${schemaHtml(doc, s.items, depth + 1, seen)}</div>`;
  }
  if (s.type === "object" || s.properties) {
    const props = (s.properties ?? {}) as Record<string, unknown>;
    const required = new Set((s.required as string[] | undefined) ?? []);
    const keys = Object.keys(props);
    if (!keys.length) return `<span class="chip">object</span>`;
    const rows = keys.map((k) => {
      const ps = props[k];
      const r = refName(ps);
      const t = r ?? (typeof ps === "object" && ps ? typeOf(ps as Schema) : "any");
      const meta = (typeof ps === "object" && ps && !isReference(ps)) ? (ps as Schema) : {};
      const desc = typeof meta.description === "string" ? meta.description : "";
      const def = meta.default !== undefined ? `<span class="pdefault">= ${escapeHtml(JSON.stringify(meta.default))}</span>` : "";
      const enumv = Array.isArray(meta.enum) ? `<span class="penum">${(meta.enum as unknown[]).slice(0, 6).map((e) => `<code>${escapeHtml(JSON.stringify(e))}</code>`).join(" ")}</span>` : "";
      const nested = (typeof ps === "object" && ps && !isReference(ps) && ((ps as Schema).properties || (ps as Schema).items)) ? `<div class="pnest">${schemaHtml(doc, ps, depth + 1, seen)}</div>` : "";
      return `<tr><td class="pname">${escapeHtml(k)}${required.has(k) ? '<span class="req">*</span>' : ""}</td><td class="ptype">${escapeHtml(String(t))}</td><td class="pdesc">${escapeHtml(desc)} ${def} ${enumv}${nested}</td></tr>`;
    }).join("");
    return `<table class="props"><thead><tr><th>field</th><th>type</th><th>notes</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  return `<span class="chip">${escapeHtml(typeOf(s))}</span>`;
}

/** A representative sample VALUE for a schema (for request/response examples). Cycle/depth-guarded. */
export function sampleOf(doc: OpenAPIv4Document, schema: unknown, depth = 0, seen: Set<string> = new Set()): unknown {
  if (schema == null || typeof schema === "boolean") return null;
  if (isReference(schema)) {
    const id = String((schema as { $ref: string }).$ref);
    if (seen.has(id) || depth > 6) return {};
    return sampleOf(doc, deref(doc, schema), depth + 1, new Set([...seen, id]));
  }
  const s = schema as Schema;
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined) return s.default;
  if (Array.isArray(s.enum)) return s.enum[0];
  if (s.const !== undefined) return s.const;
  if (Array.isArray(s.oneOf) || Array.isArray(s.anyOf)) return sampleOf(doc, ((s.oneOf || s.anyOf) as unknown[])[0], depth + 1, seen);
  if (Array.isArray(s.allOf)) return Object.assign({}, ...(s.allOf as unknown[]).map((x) => sampleOf(doc, x, depth + 1, seen)).filter((v) => v && typeof v === "object"));
  const t = Array.isArray(s.type) ? (s.type as string[])[0] : s.type;
  if (t === "object" || s.properties) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries((s.properties ?? {}) as Record<string, unknown>)) out[k] = sampleOf(doc, v, depth + 1, seen);
    return out;
  }
  if (t === "array" || s.items) return [sampleOf(doc, s.items, depth + 1, seen)];
  if (t === "string") return s.format === "date-time" ? "2026-01-01T00:00:00Z" : s.format === "email" ? "user@example.com" : "string";
  if (t === "integer" || t === "number") return 0;
  if (t === "boolean") return false;
  if (t === "null") return null;
  return {};
}
