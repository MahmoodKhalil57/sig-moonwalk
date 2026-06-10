import { test, expect, describe } from "bun:test";
import { parseDocument } from "@suluk/core";
import { contentHash, renderPrimitiveHtml, type Baseline } from "@suluk/visual";
import { renderFormTsx } from "@suluk/shadcn";
import { componentReport, approveComponents } from "../src/visual";

const doc = parseDocument(`openapi: 4.0.0-candidate
info: { title: Shop, version: 1.0.0 }
paths: {}
components:
  schemas:
    Product: { type: object, required: [ name ], properties: { id: { type: integer }, name: { type: string }, sku: { type: string } } }
    Order: { type: object, properties: { id: { type: integer }, status: { type: string, enum: [ open, closed ] } } }`);

describe("componentReport — decompose generated UI into primitives", () => {
  test("with an EMPTY baseline, every used primitive is pending (nothing confident yet)", () => {
    const r = componentReport(doc, {});
    expect(r.used.length).toBeGreaterThan(0);
    expect(r.confidence.confident).toBe(false);
    expect(r.confidence.missing.length).toBe(r.used.length);
    expect(r.confidence.approved).toHaveLength(0);
    expect(r.coverage).toBe(0);
  });
  test("decomposes each entity's form + table into shared primitives", () => {
    const r = componentReport(doc, {});
    const product = r.entities.find((e) => e.name === "Product")!;
    expect(product.form.length).toBeGreaterThan(0); // form widgets
    expect(product.table.length).toBeGreaterThan(0); // table layout/cell
    // a text widget primitive is SHARED across entities — deduped in `used`
    const widgetKeys = r.used.map((p) => p.key).filter((k) => k.startsWith("widget:"));
    expect(new Set(widgetKeys).size).toBe(widgetKeys.length);
  });
  test("carries an inline control preview for each widget primitive", () => {
    const r = componentReport(doc, {});
    const widget = r.used.find((p) => p.key.startsWith("widget:"))!;
    expect(r.preview[widget.key]).toBeTruthy();
    expect(r.preview[widget.key]).toMatch(/<(input|select|textarea|label|div)/); // a real control fragment
  });
  test("a widget's content-hash tracks the REAL @suluk/shadcn renderer, not the isolated preview mock", () => {
    const sel = componentReport(doc, {}).used.find((p) => p.key === "widget:select")!;
    // it equals the hash of the ACTUAL generated control (renderFormTsx) — so editing render-form.ts drifts it
    expect(sel.contentHash).toBe(contentHash(renderFormTsx({ fields: [{ name: "field", label: "Field", widget: "select", required: true, options: ["a", "b", "c"] }], warnings: [] })));
    // and is NOT the @suluk/visual preview mock (the bug that made a real control edit never drift)
    expect(sel.contentHash).not.toBe(contentHash(renderPrimitiveHtml({ widget: "select" })));
  });
});

describe("approveComponents — verify once, confident forever (until drift)", () => {
  test("after approval the SAME contract is fully confident — no re-verification", () => {
    const before = componentReport(doc, {});
    const baseline: Baseline = approveComponents(before, {}, 1_000);
    const after = componentReport(doc, baseline);
    expect(after.confidence.confident).toBe(true);
    expect(after.confidence.missing).toHaveLength(0);
    expect(after.confidence.drifted).toHaveLength(0);
    expect(after.coverage).toBe(1);
  });
  test("adding a NEW widget (a new enum/select-backed field) leaves only the new primitive pending", () => {
    const baseline = approveComponents(componentReport(doc, {}), {}, 1_000);
    // a doc that introduces a date widget the baseline never approved
    const withDate = parseDocument(`openapi: 4.0.0-candidate
info: { title: Shop, version: 1.0.0 }
paths: {}
components: { schemas: { Event: { type: object, properties: { when: { type: string, format: date } } } } }`);
    const r = componentReport(withDate, baseline);
    // the approved widgets stay confident; only genuinely-new primitives are pending
    expect(r.confidence.missing.every((p) => !baseline[p.key])).toBe(true);
  });
});
