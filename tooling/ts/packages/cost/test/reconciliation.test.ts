import { test, expect, describe } from "bun:test";
import { eventCostEvent, reconciledAmount, costAudit, annotateCosts, type CostModel } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

// Stripe fires payment_intent.succeeded with the REAL amount (cents) — reconcile against it, not the estimate.
const stripeEvent = { id: "evt_1", body: { customer: "cus_9", amount: 3175 } }; // $31.75 actual (incl. tax/proration)
const reconciledModel: CostModel = {
  components: [{ source: "stripe", basis: "per-call", microUsd: 29_000_000 }], // declared estimate: $29
  estimateMicroUsd: 29_000_000,
  trigger: "webhook-received",
  reconciliationBasis: "payload-reconciled",
  amountExpression: "{$event.body#/amount}",
  amountUnit: "cents",
  attribution: { strategy: "event-expression", expression: "{$event.body#/customer}", trust: "verified" },
};

describe("C026 — reconciliation: record the third party's ACTUAL charge, not the estimate", () => {
  test("reconciledAmount reads the payload amount and converts cents → µ$", () => {
    expect(reconciledAmount(reconciledModel, stripeEvent)).toBe(31_750_000); // 3175 cents × 10_000
    expect(reconciledAmount({ ...reconciledModel, amountUnit: "usd" }, { body: { amount: 31.75 } } as never)).toBe(31_750_000);
    expect(reconciledAmount({ components: [] }, stripeEvent)).toBeUndefined(); // not payload-reconciled
  });

  test("eventCostEvent uses the reconciled amount as the authoritative total + flags reconciled", () => {
    const e = eventCostEvent({ operation: "stripeCharge", model: reconciledModel, event: stripeEvent, at: 1 });
    expect(e.totalMicroUsd).toBe(31_750_000);          // the ACTUAL $31.75, not the declared $29
    expect(e.reconciled).toBe(true);
    expect(e.breakdown).toEqual([{ source: "stripe", microUsd: 31_750_000 }]);
  });

  test("a declared-estimate cost is unchanged (the existing path; no reconciliation)", () => {
    const e = eventCostEvent({ operation: "x", model: { components: [{ source: "compute", basis: "per-call", microUsd: 500 }], trigger: "scheduled" }, event: stripeEvent, at: 1 });
    expect(e.totalMicroUsd).toBe(500);
    expect(e.reconciled).toBeUndefined();
  });

  test("costAudit flags a payload-reconciled cost that can't read the amount (incomplete)", () => {
    const doc = { openapi: "4.0.0-candidate", info: { title: "t", version: "1" }, paths: { p: { requests: { op: { method: "post", responses: {} } } } } } as unknown as OpenAPIv4Document;
    const annotated = annotateCosts(doc, { op: { components: [{ source: "stripe", basis: "per-call", microUsd: 1 }], reconciliationBasis: "payload-reconciled" } }); // no amountExpression
    expect(costAudit(annotated).find((f) => f.operation === "op" && f.code === "reconciliation-incomplete")).toBeDefined();
  });
});
