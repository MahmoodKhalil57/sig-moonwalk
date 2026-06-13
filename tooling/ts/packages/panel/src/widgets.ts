/** Widget rendering — one input per inferred field type. Server-renders empty (the form's client JS fills values
 *  on edit + coerces on submit). Classes are `.pf-*`, themed by the panel shell's CSS (the host site's vars). */
import type { Field } from "./fields";

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Epoch-ms or ISO → yyyy-mm-dd (for <input type=date>). */
function toDateValue(v: unknown): string {
  if (v == null || v === "") return "";
  const d = typeof v === "number" || /^\d+$/.test(String(v)) ? new Date(Number(v)) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function toDateTimeValue(v: unknown): string {
  if (v == null || v === "") return "";
  const d = typeof v === "number" || /^\d+$/.test(String(v)) ? new Date(Number(v)) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

export function renderInput(f: Field, value: unknown = ""): string {
  const v = value == null ? "" : value;
  const a = `id="pf-${esc(f.name)}" name="${esc(f.name)}"${f.required ? " required" : ""}${f.readOnly ? " readonly disabled" : ""}`;
  switch (f.type) {
    case "textarea": return `<textarea class="pf-input" rows="4" ${a}>${esc(v)}</textarea>`;
    case "richtext": return `<textarea class="pf-input pf-rich" rows="9" ${a}>${esc(v)}</textarea>`;
    case "json": return `<textarea class="pf-input pf-mono" rows="6" ${a}>${typeof v === "object" && v ? esc(JSON.stringify(v, null, 2)) : esc(v)}</textarea>`;
    case "number": return `<input type="number" step="any" class="pf-input" value="${esc(v)}" ${a}/>`;
    case "boolean": return `<label class="pf-switch"><input type="checkbox"${v ? " checked" : ""} ${a}/><span class="pf-track"><span class="pf-thumb"></span></span></label>`;
    case "select": return `<select class="pf-input" ${a}><option value="">—</option>${(f.options ?? []).map((o) => `<option value="${esc(o)}"${String(v) === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    case "relationship": return `<select class="pf-input" data-rel="${esc(f.relationTo)}" data-rel-label="${esc(f.relationLabelField ?? "name")}" ${a}><option value="">— ${esc(f.relationTo)} —</option></select>`;
    case "date": return `<input type="date" class="pf-input" value="${esc(toDateValue(v))}" ${a}/>`;
    case "datetime": return `<input type="datetime-local" class="pf-input" value="${esc(toDateTimeValue(v))}" ${a}/>`;
    case "email": return `<input type="email" class="pf-input" value="${esc(v)}" ${a}/>`;
    case "url": return `<input type="url" class="pf-input" value="${esc(v)}" ${a}/>`;
    default: return `<input type="text" class="pf-input" value="${esc(v)}" ${a}/>`;
  }
}

/** One labelled field row (label · required mark · description · the input). */
export function renderFieldRow(f: Field, value: unknown = ""): string {
  const wide = f.type === "textarea" || f.type === "richtext" || f.type === "json";
  return `<div class="pf-field${wide ? " pf-wide" : ""}${f.type === "boolean" ? " pf-inline" : ""}">
    <label for="pf-${esc(f.name)}">${esc(f.label)}${f.required ? ' <span class="pf-req">*</span>' : ""}</label>
    ${renderInput(f, value)}
    ${f.description ? `<small class="pf-desc">${esc(f.description)}</small>` : ""}
  </div>`;
}
