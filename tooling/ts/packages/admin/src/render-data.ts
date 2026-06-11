/**
 * Data-admin mode (saastarter-parity Phase 1) — the strongest contract-first admin item: PROJECT each entity's
 * schema (components.schemas) + its access scope (the CRUD ops' x-suluk-access) into a list table + a create/edit
 * form, over the generic CRUD. No hand-built admin per entity — the admin IS a projection of the contract, so it
 * can never drift from it (this is what Payload's auto-admin gave saastarter; here it falls out of the document).
 */
import type { OpenAPIv4Document, Schema } from "@suluk/core";
import { esc } from "./render";

export interface EntityField {
  name: string;
  /** JSON-Schema type: string | integer | number | boolean | array | object. */
  type: string;
  required: boolean;
  format?: string;
  enum?: string[];
}

export interface EntityAccess {
  list?: string;
  get?: string;
  create?: string;
  update?: string;
  delete?: string;
}

export interface EntityModel {
  name: string;
  fields: EntityField[];
  /** the `requires` level of each CRUD op (from x-suluk-access), so the admin shows who may do what. */
  access: EntityAccess;
}

function fieldsOf(schema: Schema): EntityField[] {
  if (typeof schema !== "object" || schema === null) return [];
  const s = schema as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
  const required = new Set(s.required ?? []);
  return Object.entries(s.properties ?? {}).map(([name, p]) => {
    const prop = p as { type?: string | string[]; format?: string; enum?: unknown[] };
    const type = Array.isArray(prop.type) ? prop.type[0] ?? "string" : prop.type ?? "string";
    const field: EntityField = { name, type: String(type), required: required.has(name) };
    if (prop.format) field.format = String(prop.format);
    if (Array.isArray(prop.enum)) field.enum = prop.enum.map(String);
    return field;
  });
}

/** The access `requires` per CRUD op for an entity — read x-suluk-access.requires off the matching operations. */
function accessOf(doc: OpenAPIv4Document, entity: string): EntityAccess {
  const slots: Record<string, keyof EntityAccess> = {
    [`list${entity}`]: "list", [`get${entity}`]: "get", [`create${entity}`]: "create",
    [`update${entity}`]: "update", [`delete${entity}`]: "delete",
  };
  const out: EntityAccess = {};
  for (const pi of Object.values(doc.paths ?? {})) {
    const requests = (pi as { requests?: Record<string, { ["x-suluk-access"]?: { requires?: string } }> }).requests ?? {};
    for (const [opName, op] of Object.entries(requests)) {
      const slot = slots[opName];
      if (slot) out[slot] = op["x-suluk-access"]?.requires ?? "anyone";
    }
  }
  return out;
}

/** Project a v4 document's component schemas into admin entity models (fields + per-CRUD access scope), sorted. */
export function entityModels(doc: OpenAPIv4Document): EntityModel[] {
  const schemas = doc.components?.schemas ?? {};
  return Object.entries(schemas)
    .map(([name, schema]) => ({ name, fields: fieldsOf(schema as Schema), access: accessOf(doc, name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The right <input>/<select> for a field, derived from its JSON-Schema type/format/enum. */
function inputFor(f: EntityField): string {
  const name = esc(f.name);
  const req = f.required ? " required" : "";
  if (f.enum) return `<select name="${name}"${req}>${f.enum.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
  if (f.type === "boolean") return `<input type="checkbox" name="${name}"/>`;
  if (f.type === "integer" || f.type === "number") return `<input type="number" name="${name}"${req}/>`;
  const t = f.format === "date-time" ? "datetime-local" : f.format === "email" ? "email" : "text";
  return `<input type="${t}" name="${name}"${req}/>`;
}

/** A create/edit form for an entity, derived from its schema. `id` is omitted on create (DB-assigned). */
export function renderEntityForm(entity: EntityModel, mode: "create" | "edit", action: string): string {
  const rows = entity.fields
    .filter((f) => !(mode === "create" && f.name === "id"))
    .map((f) => `<label>${esc(f.name)}${f.required ? " *" : ""}<br/>${inputFor(f)}</label>`)
    .join("<br/>");
  return `<form method="post" action="${esc(action)}"><h3>${mode === "create" ? "New" : "Edit"} ${esc(entity.name)}</h3>${rows}<br/><button type="submit">${mode === "create" ? "Create" : "Save"}</button></form>`;
}

/** A list table for an entity — a column per field; `rows` are optional sample data to fill it. */
export function renderEntityTable(entity: EntityModel, rows: Record<string, unknown>[] = []): string {
  const cols = entity.fields.map((f) => f.name);
  const head = `<tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c] ?? "")}</td>`).join("")}</tr>`).join("");
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/** The data-admin index: every entity + its access scopes, linking to its per-entity page. */
export function renderDataIndex(doc: OpenAPIv4Document, base: string): string {
  const rows = entityModels(doc).map((e) =>
    `<li><a href="${esc(base)}/data/${esc(e.name)}">${esc(e.name)}</a> <span class="muted">${e.fields.length} fields · list: ${esc(e.access.list ?? "—")} · write: ${esc(e.access.create ?? "—")}</span></li>`).join("");
  return `<h2>Data admin</h2><p class="muted">Each entity projected from the contract — a list table + create/edit form over the generic CRUD.</p><ul>${rows || '<li class="muted">no entities</li>'}</ul>`;
}

/** One entity's data-admin page: its access scopes + a list table + a create form. */
export function renderEntityAdmin(doc: OpenAPIv4Document, name: string, base: string, rows: Record<string, unknown>[] = []): string {
  const entity = entityModels(doc).find((e) => e.name === name);
  if (!entity) return `<h2>${esc(name)}</h2><p class="muted">No such entity in the contract.</p>`;
  const a = entity.access;
  return `<h2>${esc(entity.name)}</h2>
    <p class="muted">access — list: ${esc(a.list ?? "—")} · create: ${esc(a.create ?? "—")} · update: ${esc(a.update ?? "—")} · delete: ${esc(a.delete ?? "—")}</p>
    ${renderEntityTable(entity, rows)}
    ${renderEntityForm(entity, "create", `${esc(base)}/data/${esc(entity.name)}`)}`;
}
