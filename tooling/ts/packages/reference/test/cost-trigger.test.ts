import { test, expect, describe } from "bun:test";
import { costRollup, costTriggerLabel } from "../src/facets";
import type { OpenAPIv4Document } from "@suluk/core";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "t", version: "1" },
  paths: { order: { requests: { createOrder: { method: "post", responses: {}, "x-suluk-cost": { estimateMicroUsd: 10 } } } } },
  webhooks: { stripeCharge: { method: "post", responses: {}, "x-suluk-cost": { estimateMicroUsd: 2900, trigger: "webhook-received", triggerRef: "stripeCharge" } } },
} as unknown as OpenAPIv4Document;

describe("C024 — reference UI propagation", () => {
  test("costRollup walks webhooks so a background cost rolls into the total + the deferred count", () => {
    const r = costRollup(doc);
    expect(r.priced).toBe(2);                 // path op + webhook op
    expect(r.totalMicroUsd).toBe(2910);       // includes the webhook's 2900
    expect(r.deferred).toBe(1);               // one background-triggered cost
  });

  test("costTriggerLabel renders a background badge label and is null for synchronous", () => {
    expect(costTriggerLabel({ trigger: "webhook-received", triggerRef: "stripeCharge" })).toBe("charged on: incoming webhook (stripeCharge)");
    expect(costTriggerLabel({ trigger: "scheduled" })).toBe("charged on: scheduled job");
    expect(costTriggerLabel({ trigger: "synchronous" })).toBeNull();
    expect(costTriggerLabel(undefined)).toBeNull();
  });
});
