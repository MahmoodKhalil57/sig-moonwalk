/**
 * Component preview + pixel-confidence (surfaces @suluk/visual in the cockpit). A generated form/table is a
 * COMPOSITION of widget primitives; its pixel-confidence reduces to "are all those primitives approved +
 * unchanged?" — decided by content-hash, WITHOUT re-rendering. componentReport decomposes every entity's
 * form/table into primitives, checks them against a baseline (confident / drifted / pending), and carries an
 * inline control preview for each. approveComponents records the "verify once" — after that, the components are
 * pixel-confident at that content hash forever, until a primitive's source drifts. Pure (no host) → unit-tested.
 */
import type { OpenAPIv4Document, SchemaOrRef } from "@suluk/core";
import { formSpec, tableSpec, renderFormTsx, renderTableTsx, type FieldSpec, type FieldWidget } from "@suluk/shadcn";
import {
  formPrimitives, tablePrimitives, knownWidgets, primitiveControl,
  checkConfidence, approve, confidenceCoverage, hash,
  type Baseline, type UsedPrimitive, type ConfidenceReport, type Capture, type PrimitiveSources,
} from "@suluk/visual";

/** A one-field form for a widget — its REAL generated TSX is what we content-hash (so a renderer edit drifts it). */
function canonicalField(widget: FieldWidget): FieldSpec {
  return { name: "field", label: "Field", widget, required: true, options: widget === "select" ? ["a", "b", "c"] : undefined };
}

/**
 * Primitive sources for the content-hash — the ACTUAL @suluk/shadcn generator output (the bytes that ship),
 * NOT the isolated preview mock. A widget's source is renderFormTsx of a one-field form (control + layout, so a
 * layout edit drifts every widget too); the table source is renderTableTsx. Editing render-form.ts /
 * render-table.ts therefore drifts the affected primitives — the confidence is honest. (renderPrimitiveHtml /
 * primitiveControl remain ONLY the human-viewable inline preview.)
 */
function sources(): PrimitiveSources {
  const widgets: Record<string, string> = {};
  for (const w of knownWidgets() as FieldWidget[]) widgets[w] = renderFormTsx({ fields: [canonicalField(w)], warnings: [] });
  const tableLayout = renderTableTsx({ columns: [{ key: "id", header: "Id", type: "integer" }, { key: "name", header: "Name", type: "string" }], warnings: [] });
  return { widgets, tableLayout }; // no separate formLayout marker — each widget render already carries the form layout
}

export interface ComponentReport {
  /** the distinct primitives every generated form/table is composed of (deduped across entities) */
  used: UsedPrimitive[];
  confidence: ConfidenceReport;
  /** 0..1 — fraction of used primitives that are approved + unchanged */
  coverage: number;
  /** primitive key → inline control HTML (widget primitives only — for the preview) */
  preview: Record<string, string>;
  /** which primitives each entity's form/table is built from */
  entities: { name: string; form: string[]; table: string[] }[];
}

/** Decompose a contract's generated components into primitives and check their pixel-confidence vs a baseline. */
export function componentReport(doc: OpenAPIv4Document, baseline: Baseline): ComponentReport {
  const schemas = (doc.components?.schemas ?? {}) as Record<string, SchemaOrRef>;
  const defs = schemas;
  const src = sources();
  const usedMap = new Map<string, UsedPrimitive>();
  const entities: ComponentReport["entities"] = [];
  for (const [name, schema] of Object.entries(schemas)) {
    let fp: UsedPrimitive[] = [];
    let tp: UsedPrimitive[] = [];
    try { fp = formPrimitives(formSpec(schema, { defs }), src); } catch { /* schema not form-able */ }
    try { tp = tablePrimitives(tableSpec(schema, { defs }), src); } catch { /* not table-able */ }
    for (const p of [...fp, ...tp]) usedMap.set(p.key, p);
    entities.push({ name, form: fp.map((p) => p.key), table: tp.map((p) => p.key) });
  }
  const used = [...usedMap.values()];
  const preview: Record<string, string> = {};
  for (const p of used) {
    const m = p.key.match(/^widget:(.+)$/);
    if (m) preview[p.key] = primitiveControl(m[1]);
  }
  return { used, confidence: checkConfidence(used, baseline), coverage: confidenceCoverage(used, baseline), preview, entities };
}

/** The "verify once": approve every used primitive at its current content hash, returning the new baseline. */
export function approveComponents(report: ComponentReport, baseline: Baseline, at: number): Baseline {
  const captures: Capture[] = report.used.map((p) => ({
    key: p.key,
    contentHash: p.contentHash,
    // the snapshot proxy: the hash of what the operator just looked at (the control HTML, else the source hash)
    snapshotHash: hash(report.preview[p.key] ?? p.contentHash),
    label: p.label,
  }));
  return approve(captures, baseline, at);
}
