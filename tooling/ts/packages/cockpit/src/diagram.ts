/**
 * Diagrams (D2) — ANOTHER projection from the one v4 contract. Suluk already derives data/API/docs/UI/cost from
 * the contract; a diagram is the same move in visual form. contractToD2 emits D2 (d2lang.com) source for a few
 * views: an ERD (entities + their references), the declarative cycle (one contract → every layer), and the
 * operation surface (paths → operations, grouped by tag). Pure text generation (no host, no renderer) →
 * unit-tested; the extension/docs render the D2 (d2 CLI, the playground, or a service like kroki.io).
 */
import { buildAda, type OpenAPIv4Document, type SchemaOrRef } from "@suluk/core";
import { schemaRefName } from "@suluk/builder";
import { buildCycle } from "./cycle";

export type DiagramView = "erd" | "cycle" | "operations";
export function diagramViews(): { id: DiagramView; title: string; description: string }[] {
  return [
    { id: "erd", title: "Entity relationships", description: "components.schemas as tables + their $ref relationships" },
    { id: "cycle", title: "The declarative cycle", description: "one v4 contract → every projected layer" },
    { id: "operations", title: "Operation surface", description: "paths → operations, grouped by tag/entity" },
  ];
}

// D2 reserved keywords — interpreted specially when they appear in a KEY position (inside any map), so a schema
// field literally named "shape"/"label"/… must be QUOTED there or D2 treats it as a directive and corrupts the node.
const D2_RESERVED = new Set([
  "shape", "label", "style", "constraint", "width", "height", "icon", "near", "tooltip", "link", "class", "direction",
  "grid-rows", "grid-columns", "source-arrowhead", "target-arrowhead", "vertical-gap", "horizontal-gap", "top", "left",
]);
const quote = (name: string): string => `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
/** A D2 name on the VALUE side (a type) — quote only when it isn't a bare word (reserved words are safe as values). */
function d2id(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : quote(name);
}
/** A D2 name in a KEY position (node/field name, edge endpoint) — also quote reserved keywords. */
function d2key(name: string): string {
  return D2_RESERVED.has(name) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? quote(name) : name;
}
function d2label(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** The display type of a property, and the entity it references (if any). */
function fieldType(schema: unknown, entities: Set<string>): { type: string; ref?: string } {
  const s = schema as { $ref?: string; type?: string; items?: unknown; enum?: unknown[] };
  if (typeof s?.$ref === "string") { const r = schemaRefName(s.$ref); return { type: r ?? "ref", ref: r && entities.has(r) ? r : undefined }; }
  if (s?.type === "array") { const inner = fieldType(s.items, entities); return { type: `${inner.type}[]`, ref: inner.ref }; }
  if (Array.isArray(s?.enum)) return { type: "enum" };
  return { type: s?.type ?? "any" };
}

function erdD2(doc: OpenAPIv4Document): string {
  const schemas = (doc.components?.schemas ?? {}) as Record<string, SchemaOrRef>;
  const entities = new Set(Object.keys(schemas));
  const lines: string[] = ["# Suluk ERD — entities + references (generated from the v4 contract)", "direction: right", ""];
  const edges: string[] = [];
  for (const [name, sObj] of Object.entries(schemas)) {
    const s = sObj as { properties?: Record<string, unknown>; required?: string[] };
    const required = new Set(s.required ?? []);
    lines.push(`${d2key(name)}: {`, "  shape: sql_table");
    for (const [fname, fObj] of Object.entries(s.properties ?? {})) {
      const { type, ref } = fieldType(fObj, entities);
      lines.push(`  ${d2key(fname)}: ${d2id(type)}${required.has(fname) ? " {constraint: NOT NULL}" : ""}`);
      if (ref) edges.push(`${d2key(name)}.${d2key(fname)} -> ${d2key(ref)}: references`);
    }
    if (!Object.keys(s.properties ?? {}).length) lines.push('  "(no fields)": ""');
    lines.push("}");
  }
  if (!entities.size) lines.push("note: 'no components.schemas entities'");
  return [...lines, "", ...edges].join("\n");
}

function cycleD2(doc: OpenAPIv4Document): string {
  const cyc = buildCycle(doc);
  const layers = cyc.layers.filter((l) => l.id !== "document"); // document is the hub itself, drawn as `contract`
  return [
    "# Suluk — one v4 contract projected into every layer",
    "direction: down",
    "",
    // the hub is named `_hub` (NOT `contract`) so it can't collide with the "contract" (API) layer node
    `_hub: {label: "v4 contract\\n${d2label(doc.info?.title ?? "")}"; shape: document; style.bold: true}`,
    ...layers.map((l) => `${l.id}: {label: "${d2label(l.title)}\\n${d2label(l.summary)}"; shape: rectangle}`),
    "",
    ...layers.map((l) => `_hub -> ${l.id}`),
  ].join("\n");
}

function operationsD2(doc: OpenAPIv4Document): string {
  const ops = buildAda(doc).operations;
  const byTag = new Map<string, { name: string; method: string; path: string }[]>();
  for (const o of ops) {
    const tag = (o.request.tags?.[0] as string | undefined) ?? "untagged";
    (byTag.get(tag) ?? byTag.set(tag, []).get(tag)!).push({ name: o.name, method: o.request.method.toUpperCase(), path: o.pathTemplate });
  }
  const lines: string[] = ["# Suluk — operation surface, grouped by tag", "direction: right", ""];
  for (const [tag, list] of byTag) {
    lines.push(`${d2key(tag)}: {`, "  shape: package");
    for (const o of list) lines.push(`  ${d2key(o.name)}: {label: "${d2label(`${o.method} ${o.path}`)}"}`);
    lines.push("}");
  }
  if (!ops.length) lines.push("note: 'no operations'");
  return lines.join("\n");
}

/** Generate D2 diagram source for a view of the contract. */
export function contractToD2(doc: OpenAPIv4Document, view: DiagramView): string {
  switch (view) {
    case "erd": return erdD2(doc);
    case "cycle": return cycleD2(doc);
    case "operations": return operationsD2(doc);
  }
}
