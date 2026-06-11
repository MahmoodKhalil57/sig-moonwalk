import { test, expect, describe } from "bun:test";
import {
  resolveEventExpression, attributePrincipal, eventCostEvent, recordEventCost,
  MemoryCostSink, UNATTRIBUTED, type CostModel,
} from "../src/index";

// the motivating case: Stripe fires payment_intent.succeeded → it charges you, attributed to the customer.
const stripeEvent = { id: "evt_123", type: "payment_intent.succeeded", body: { customer: "cus_42", amount: 2900 } };
const chargeModel: CostModel = {
  components: [{ source: "stripe", basis: "per-call", microUsd: 2900 }],
  trigger: "webhook-received",
  attribution: { strategy: "event-expression", expression: "{$event.body#/customer}", trust: "verified" },
  idempotencyKey: "{$event.id}",
};

describe("C024 runtime — resolve a C018 runtime-expression against a fired event", () => {
  test("body JSON-pointer, top-level key, and an unresolvable expression", () => {
    expect(resolveEventExpression("{$event.body#/customer}", stripeEvent)).toBe("cus_42");
    expect(resolveEventExpression("{$event.id}", stripeEvent)).toBe("evt_123");
    expect(resolveEventExpression("{$event.body#/missing}", stripeEvent)).toBeUndefined();
    expect(resolveEventExpression("not-an-expression", stripeEvent)).toBeUndefined();
  });
});

describe("C024 runtime — attribute the principal (fail to @unattributed, never silent)", () => {
  test("event-expression reads the principal from the payload", () => {
    expect(attributePrincipal(chargeModel, stripeEvent)).toBe("cus_42");
  });
  test("session/job-stamped use the supplied principal; missing → @unattributed", () => {
    expect(attributePrincipal({ components: [], attribution: { strategy: "session" } }, stripeEvent, "u1")).toBe("u1");
    expect(attributePrincipal({ components: [], attribution: { strategy: "session" } }, stripeEvent)).toBe(UNATTRIBUTED);
    expect(attributePrincipal({ components: [], attribution: { strategy: "event-expression" } }, stripeEvent)).toBe(UNATTRIBUTED); // no expression
  });
});

describe("C024 runtime — build + record the background CostEvent", () => {
  test("eventCostEvent stamps the trigger, principal, dedupeKey, and the computed total", () => {
    const e = eventCostEvent({ operation: "stripeCharge", model: chargeModel, event: stripeEvent, at: 1000 });
    expect(e).toMatchObject({ operation: "stripeCharge", principal: "cus_42", trigger: "webhook-received", dedupeKey: "evt_123", totalMicroUsd: 2900 });
  });

  test("recordEventCost dedupes at-least-once delivery (the same event id records ONCE)", async () => {
    const sink = new MemoryCostSink();
    const seen = new Set<string>();
    const a = await recordEventCost(sink, { operation: "stripeCharge", model: chargeModel, event: stripeEvent, at: 1000 }, seen);
    const b = await recordEventCost(sink, { operation: "stripeCharge", model: chargeModel, event: stripeEvent, at: 1001 }, seen); // redelivery
    expect(a).not.toBeNull();
    expect(b).toBeNull();                 // deduped — not double-charged
    expect(sink.events()).toHaveLength(1);
    expect(sink.events()[0].principal).toBe("cus_42");
  });

  test("a cost that can't attribute records to @unattributed (visible, not lost)", async () => {
    const sink = new MemoryCostSink();
    const orphan: CostModel = { components: [{ source: "stripe", basis: "per-call", microUsd: 500 }], trigger: "webhook-received" };
    await recordEventCost(sink, { operation: "x", model: orphan, event: stripeEvent, at: 1 });
    expect(sink.events()[0].principal).toBe(UNATTRIBUTED);
  });
});
