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

/** An entity is CRUD-MANAGED iff the contract serves it the FULL generic CRUD (list + create + delete) — only the
 *  generic mount emits all of them, so this excludes ProblemDetails + the Better-Auth schemas (which have, at most,
 *  some list-ish ops from the ingest, never the generic createX/deleteX). */
function isManaged(e: EntityModel): boolean {
  return e.access.list !== undefined && e.access.create !== undefined && e.access.delete !== undefined;
}

/** The data-admin index: every CRUD-managed entity + its access scopes, linking to its per-entity page. */
export function renderDataIndex(doc: OpenAPIv4Document, base: string): string {
  const rows = entityModels(doc).filter(isManaged).map((e) =>
    `<li><a href="${esc(base)}/data/${esc(e.name)}">${esc(e.name)}</a> <span class="muted">${e.fields.length} fields · list: ${esc(e.access.list ?? "—")} · write: ${esc(e.access.create ?? "—")}</span></li>`).join("");
  return `<h2>Data admin</h2><p class="muted">Each entity projected from the contract — a live list + create/edit/delete over the generic CRUD.</p><ul>${rows || '<li class="muted">no manageable entities</li>'}</ul>`;
}

/** The CRUD path the generic mount serves an entity at (Product → /product). */
function crudPath(name: string): string {
  return "/" + name.charAt(0).toLowerCase() + name.slice(1);
}

/** A labelled input for the LIVE form (no method/action — the inline JS submits it); ids target the form by name. */
function liveInput(f: EntityField): string {
  const name = esc(f.name);
  if (f.enum) return `<select name="${name}">${f.enum.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select>`;
  if (f.type === "boolean") return `<input type="checkbox" name="${name}"/>`;
  if (f.type === "integer" || f.type === "number") return `<input type="number" step="any" name="${name}"/>`;
  if (f.type === "object" || f.type === "array") return `<textarea name="${name}" rows="2" placeholder="JSON"></textarea>`;
  const t = f.format === "date-time" ? "datetime-local" : f.format === "email" ? "email" : "text";
  return `<input type="${t}" name="${name}"/>`;
}

/**
 * One entity's data-admin page — a FULLY FUNCTIONAL CRUD UI (saastarter's Payload admin, projected): a live list
 * table (loaded from the entity's CRUD endpoint), a create/edit form, and per-row Edit + Delete — all driven by
 * inline vanilla JS hitting the same admin-gated CRUD routes the contract already serves, so the admin can never
 * drift from the schema AND actually writes. `id`/server-managed fields are read-only on create.
 */
export function renderEntityAdmin(doc: OpenAPIv4Document, name: string, base: string, _rows: Record<string, unknown>[] = []): string {
  const entity = entityModels(doc).find((e) => e.name === name);
  if (!entity) return `<h2>${esc(name)}</h2><p class="muted">No such entity in the contract.</p>`;
  const a = entity.access;
  const path = crudPath(entity.name);
  const editable = entity.fields.filter((f) => f.name !== "id");
  const cols = entity.fields.map((f) => f.name);
  const formRows = editable.map((f) => `<label class="adm-field"><span>${esc(f.name)}${f.required ? " *" : ""}</span>${liveInput(f)}</label>`).join("");
  // field metadata for the inline JS (escaped against a `</script>` break)
  const fieldsJson = JSON.stringify(entity.fields.map((f) => ({ name: f.name, type: f.type }))).replace(/</g, "\\u003c");
  const ent = esc(entity.name);

  return `<style>
      .adm-tablewrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; margin:8px 0 18px; }
      .adm-tablewrap table { white-space:nowrap; } .adm-tablewrap td { max-width:280px; overflow:hidden; text-overflow:ellipsis; }
      .adm-form { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px 16px; align-items:end; max-width:920px; }
      .adm-field { display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--muted); }
      .adm-field input, .adm-field select, .adm-field textarea { font:13px ui-monospace,monospace; background:var(--panel); color:var(--fg); border:1px solid var(--line); border-radius:7px; padding:7px 9px; }
      .adm-field input[type=checkbox] { width:18px; height:18px; }
      .adm-actions { grid-column:1/-1; display:flex; gap:8px; margin-top:4px; }
      .adm-actions button, #adm-rows button { font:13px ui-monospace,monospace; background:var(--accent); color:var(--on-accent); border:0; border-radius:7px; padding:7px 13px; cursor:pointer; }
      #adm-rows button { background:var(--panel); color:var(--accent); border:1px solid var(--line); padding:4px 9px; }
      #adm-rows .adel { color:var(--danger,#e5484d); } #adm-cancel { background:var(--panel); color:var(--muted); border:1px solid var(--line); }
    </style>
    <h2>${ent}</h2>
    <p class="muted">access — list: ${esc(a.list ?? "—")} · create: ${esc(a.create ?? "—")} · update: ${esc(a.update ?? "—")} · delete: ${esc(a.delete ?? "—")} · <code>${esc(path)}</code></p>
    <div id="adm-msg"></div>
    <div class="adm-tablewrap"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}<th>actions</th></tr></thead><tbody id="adm-rows"><tr><td colspan="${cols.length + 1}" class="muted">Loading…</td></tr></tbody></table></div>
    <h3 id="adm-formtitle">New ${ent}</h3>
    <form id="adm-form" class="adm-form" autocomplete="off">
      <input type="hidden" name="_id"/>
      ${formRows}
      <div class="adm-actions"><button type="submit" id="adm-save">Create</button> <button type="button" id="adm-cancel" hidden>Cancel</button></div>
    </form>
    <script>(function(){
      var PATH=${JSON.stringify(path)}, ENT=${JSON.stringify(entity.name)}, FIELDS=${fieldsJson};
      var EDIT=FIELDS.filter(function(f){return f.name!=="id";});
      var form=document.getElementById("adm-form"),tbody=document.getElementById("adm-rows"),msg=document.getElementById("adm-msg");
      var title=document.getElementById("adm-formtitle"),save=document.getElementById("adm-save"),cancel=document.getElementById("adm-cancel");
      function e(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
      function cell(v){if(v==null)return "";if(typeof v==="object")return e(JSON.stringify(v)).slice(0,70);return e(v).slice(0,90);}
      function setMsg(t,bad){msg.innerHTML=t?'<p style="margin:8px 0;color:'+(bad?"#e5484d":"#a6da95")+'">'+e(t)+'</p>':"";}
      function render(rows){if(!Array.isArray(rows))rows=[];tbody.innerHTML=rows.length?rows.map(function(r){return "<tr>"+FIELDS.map(function(f){return "<td>"+cell(r[f.name])+"</td>";}).join("")+'<td style="white-space:nowrap"><button class="aedit" data-row=\\''+e(JSON.stringify(r))+'\\'>Edit</button> <button class="adel" data-id="'+e(r.id)+'">Delete</button></td></tr>";}).join(""):'<tr><td colspan="'+(FIELDS.length+1)+'" class="muted">No rows yet — create one below.</td></tr>';}
      function load(){fetch(PATH,{credentials:"same-origin"}).then(function(r){return r.json();}).then(render).catch(function(){tbody.innerHTML='<tr><td class="muted">Could not load '+e(PATH)+'.</td></tr>';});}
      function reset(){form.reset();form.elements["_id"].value="";title.textContent="New "+ENT;save.textContent="Create";cancel.hidden=true;}
      function collect(){var b={};EDIT.forEach(function(f){var el=form.elements[f.name];if(!el)return;if(f.type==="boolean"){b[f.name]=el.checked;}else if(el.value===""){return;}else if(f.type==="integer"||f.type==="number"){b[f.name]=Number(el.value);}else if(f.type==="object"||f.type==="array"){try{b[f.name]=JSON.parse(el.value);}catch(x){b[f.name]=el.value;}}else{b[f.name]=el.value;}});return b;}
      form.addEventListener("submit",function(ev){ev.preventDefault();save.disabled=true;var id=form.elements["_id"].value;fetch(id?PATH+"/"+encodeURIComponent(id):PATH,{method:id?"PATCH":"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(collect())}).then(function(res){return res.json().catch(function(){return {};}).then(function(d){if(!res.ok)throw new Error(d.error||d.title||("Failed ("+res.status+")"));reset();setMsg(id?"Updated.":"Created "+ENT+".");load();});}).catch(function(err){setMsg(err.message||"Failed.",true);}).then(function(){save.disabled=false;});});
      tbody.addEventListener("click",function(ev){var ed=ev.target.closest(".aedit"),dl=ev.target.closest(".adel");if(ed){var row=JSON.parse(ed.getAttribute("data-row"));EDIT.forEach(function(f){var el=form.elements[f.name];if(!el)return;if(f.type==="boolean")el.checked=!!row[f.name];else if(f.type==="object"||f.type==="array")el.value=row[f.name]==null?"":JSON.stringify(row[f.name]);else el.value=row[f.name]==null?"":row[f.name];});form.elements["_id"].value=row.id;title.textContent="Edit "+ENT+" #"+row.id;save.textContent="Save";cancel.hidden=false;title.scrollIntoView({behavior:"smooth",block:"center"});}else if(dl){var id=dl.getAttribute("data-id");if(confirm("Delete "+ENT+" #"+id+"?"))fetch(PATH+"/"+encodeURIComponent(id),{method:"DELETE",credentials:"same-origin"}).then(function(r){if(r.ok){setMsg("Deleted.");load();}else setMsg("Delete failed.",true);});}});
      cancel.addEventListener("click",function(){reset();setMsg("");});
      load();
    })();</script>`;
}
