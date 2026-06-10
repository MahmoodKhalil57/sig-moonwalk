import { test, expect, describe } from "bun:test";
import * as z from "zod";
import { zodToV4 } from "@suluk/zod";
import { formSpec } from "@suluk/shadcn";
import {
  checkConfidence, pendingVerification, approve, confidenceCoverage, contentHash, snapshotHash,
  formPrimitives, renderPrimitiveHtml, knownWidgets, type Baseline, type PrimitiveSources, type Capture,
} from "../src/index";

// the shadcn UI primitive sources (stand-ins for the real component code — what produces the pixels)
const sources: PrimitiveSources = {
  formLayout: "<Form>{fields}</Form>",
  widgets: { text: "<input type=text>", number: "<input type=number>", select: "<select>", switch: "<Switch>" },
};

// a generated form (the petshop-ish Pet), via the real cycle: Zod → v4 → formSpec
const Pet = zodToV4(z.object({ name: z.string(), status: z.enum(["available", "pending", "sold"]), age: z.number(), active: z.boolean() })).schema;
const spec = formSpec(Pet);

/** Approve every primitive a UI uses (simulates the one-time screenshot+approval gate). */
function verifyOnce(used: ReturnType<typeof formPrimitives>, at: number): Baseline {
  const captures: Capture[] = used.map((u) => ({ key: u.key, contentHash: u.contentHash, snapshotHash: snapshotHash(renderPrimitiveHtml({ widget: u.key.replace("widget:", "") })), label: u.label }));
  return approve(captures, {}, at);
}

describe("confidence is decided by HASHING, never by re-rendering", () => {
  const used = formPrimitives(spec, sources);

  test("a fresh UI is NOT confident — its primitives were never pixel-verified", () => {
    const r = checkConfidence(used, {});
    expect(r.confident).toBe(false);
    expect(r.missing.length).toBe(used.length);
    expect(pendingVerification(used, {}).length).toBe(used.length);
  });

  test("after verifying the primitives ONCE, the SAME UI is confident with no new screenshot", () => {
    const baseline = verifyOnce(used, 1000);
    const r = checkConfidence(used, baseline);
    expect(r.confident).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.drifted).toEqual([]);
    expect(confidenceCoverage(used, baseline)).toBe(1);
  });

  test("a DIFFERENT UI reusing the same approved primitives is confident for FREE (propagation)", () => {
    const baseline = verifyOnce(used, 1000);
    // a new form using a subset of the same widgets — no re-verification needed
    const other = formSpec(zodToV4(z.object({ title: z.string(), count: z.number() })).schema);
    const otherUsed = formPrimitives(other, sources);
    expect(checkConfidence(otherUsed, baseline).confident).toBe(true);
  });
});

describe("re-verify ONLY when a primitive's source changes (the hash drifts)", () => {
  const used = formPrimitives(spec, sources);
  const baseline = verifyOnce(used, 1000);

  test("editing one widget's source flags exactly THAT widget for re-verification — nothing else", () => {
    const changed: PrimitiveSources = { ...sources, widgets: { ...sources.widgets, select: "<select class='v2'>" } };
    const usedAfter = formPrimitives(spec, changed);
    const r = checkConfidence(usedAfter, baseline);
    expect(r.confident).toBe(false);
    expect(r.drifted.map((d) => d.key)).toEqual(["widget:select"]); // only the changed primitive
    expect(r.approved).toContain("widget:text");                    // the others stay trusted
    expect(pendingVerification(usedAfter, baseline).map((p) => p.key)).toEqual(["widget:select"]);
  });

  test("approving the changed widget once restores full confidence", () => {
    const changed: PrimitiveSources = { ...sources, widgets: { ...sources.widgets, select: "<select class='v2'>" } };
    const usedAfter = formPrimitives(spec, changed);
    const rebaselined = approve(pendingVerification(usedAfter, baseline).map((p) => ({ ...p, snapshotHash: "newhash" })), baseline, 2000);
    expect(checkConfidence(usedAfter, rebaselined).confident).toBe(true);
  });

  test("a layout change re-verifies the composition (form:layout drifts), widgets unaffected", () => {
    const changed: PrimitiveSources = { ...sources, formLayout: "<Form class='v2'>{fields}</Form>" };
    const r = checkConfidence(formPrimitives(spec, changed), baseline);
    expect(r.drifted.map((d) => d.key)).toEqual(["form:layout"]);
  });
});

describe("the verify-once gate", () => {
  test("renderPrimitiveHtml produces a standalone page for one widget (screenshot input)", () => {
    const html = renderPrimitiveHtml({ widget: "select" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('data-widget="select"');
    expect(html).toContain("<option>available</option>");
  });
  test("knownWidgets covers the shadcn widget set", () => {
    expect(knownWidgets()).toEqual(expect.arrayContaining(["text", "number", "select", "switch", "checkbox", "textarea"]));
  });
  test("contentHash is stable + sensitive", () => {
    expect(contentHash("a")).toBe(contentHash("a"));
    expect(contentHash("a")).not.toBe(contentHash("a "));
  });
});
