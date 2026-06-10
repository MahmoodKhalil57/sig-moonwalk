/**
 * Decompose a generated UI (a @suluk/shadcn FormSpec/TableSpec) into the leaf PRIMITIVES it is built from,
 * each tagged with the content hash of its source. This is what makes confidence propagate: a form is just a
 * composition of widget primitives + a layout, so its pixel-confidence reduces to "are all those primitives
 * approved + unchanged?" — checked WITHOUT rendering the form.
 */
import type { FormSpec, TableSpec } from "@suluk/shadcn";
import { contentHash, type UsedPrimitive } from "./baseline";

export interface PrimitiveSources {
  /** widget name (text/number/select/switch/…) → the source of its UI component (the bytes that draw pixels). */
  widgets: Record<string, string>;
  /** The form renderer/layout source — so changing the form's arrangement re-verifies the composition. */
  formLayout?: string;
  /** The table renderer/layout source. */
  tableLayout?: string;
}

/** The distinct primitives a generated FORM is composed of: its layout + each widget it uses. */
export function formPrimitives(spec: FormSpec, sources: PrimitiveSources): UsedPrimitive[] {
  const used = new Map<string, UsedPrimitive>();
  if (sources.formLayout != null) used.set("form:layout", { key: "form:layout", contentHash: contentHash(sources.formLayout), label: "form layout" });
  for (const f of spec.fields) {
    const src = sources.widgets[f.widget];
    if (src != null) used.set(`widget:${f.widget}`, { key: `widget:${f.widget}`, contentHash: contentHash(src), label: f.widget });
  }
  return [...used.values()];
}

/** The distinct primitives a generated TABLE is composed of: its layout + the cell primitive. */
export function tablePrimitives(spec: TableSpec, sources: PrimitiveSources): UsedPrimitive[] {
  const used = new Map<string, UsedPrimitive>();
  if (sources.tableLayout != null) used.set("table:layout", { key: "table:layout", contentHash: contentHash(sources.tableLayout), label: "table layout" });
  const cell = sources.widgets.cell ?? sources.tableLayout;
  if (cell != null) used.set("widget:cell", { key: "widget:cell", contentHash: contentHash(cell), label: "table cell" });
  void spec; // the cell primitive covers every column; columns differ only in data, not pixels-of-the-primitive
  return [...used.values()];
}
