import { test, expect, describe } from "bun:test";
import {
  annotateCosts, costAudit, costTable, eachOperation, triggerOf, isDeferredCost, costOf, UNATTRIBUTED,
  type CostModel,
} from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

// a doc with a path op + a C018 webhook op
const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "t", version: "1" },
  paths: { order: { requests: { createOrder: { method: "post", responses: {} } } } },
  webhooks: { stripeCharge: { method: "post", responses: {} } },
} as unknown as OpenAPIv4Document;

describe("C024 — background-event cost: the three orthogonal axes", () => {
  test("triggerOf defaults to synchronous; isDeferredCost flags a non-sync trigger", () => {
    expect(triggerOf(undefined)).toBe("synchronous");
    expect(triggerOf({ components: [] })).toBe("synchronous");
    expect(isDeferredCost({ components: [], trigger: "webhook-received" })).toBe(true);
    expect(isDeferredCost({ components: [] })).toBe(false);
  });

  test("eachOperation walks paths AND webhooks (the background-cost locus)", () => {
    expect(eachOperation(doc).map((o) => o.name).sort()).toEqual(["createOrder", "stripeCharge"]);
    expect(eachOperation(doc).find((o) => o.name === "stripeCharge")?.path).toBe("webhooks/stripeCharge");
  });

  test("annotateCosts annotates a webhook op; the cost reads back with its trigger", () => {
    const charge: CostModel = {
      components: [{ source: "stripe", basis: "per-call", microUsd: 2900 }],
      trigger: "webhook-received",
      triggerRef: "stripeCharge",
      attribution: { strategy: "event-expression", expression: "{$event.body#/customer}", trust: "verified" },
    };
    const annotated = annotateCosts(doc, { stripeCharge: charge });
    const webhook = (annotated as unknown as { webhooks: Record<string, unknown> }).webhooks.stripeCharge;
    expect(costOf(webhook as never)?.trigger).toBe("webhook-received");
    // basis is UNCHANGED — the metering axis stays orthogonal to the trigger
    expect(costOf(webhook as never)?.components[0].basis).toBe("per-call");
  });
});

describe("C024 — the fail-loud attribution disciplines (audit)", () => {
  test("a deferred cost with NO attribution → unattributed-background-cost (warn, never silent)", () => {
    const annotated = annotateCosts(doc, { stripeCharge: { components: [{ source: "stripe", basis: "per-call", microUsd: 2900 }], trigger: "webhook-received" } });
    const f = costAudit(annotated).find((x) => x.operation === "stripeCharge");
    expect(f?.code).toBe("unattributed-background-cost");
    expect(f?.message).toContain(UNATTRIBUTED);
  });

  test("a deferred cost reading an UNVERIFIED payload → unverified-attribution (attacker-controllable)", () => {
    const annotated = annotateCosts(doc, { stripeCharge: { components: [{ source: "stripe", basis: "per-call", microUsd: 2900 }], trigger: "webhook-received", attribution: { strategy: "event-expression", expression: "{$event.body#/customer}" } } });
    expect(costAudit(annotated).find((x) => x.operation === "stripeCharge")?.code).toBe("unverified-attribution");
  });

  test("a deferred cost with a VERIFIED event attribution is clean (no background finding)", () => {
    const annotated = annotateCosts(doc, { stripeCharge: { components: [{ source: "stripe", basis: "per-call", microUsd: 2900 }], trigger: "webhook-received", attribution: { strategy: "event-expression", expression: "{$event.body#/customer}", trust: "verified" } } });
    const codes = costAudit(annotated).filter((x) => x.operation === "stripeCharge").map((x) => x.code);
    expect(codes).not.toContain("unattributed-background-cost");
    expect(codes).not.toContain("unverified-attribution");
  });

  test("a SYNCHRONOUS op is never flagged for attribution (the default path is unchanged)", () => {
    const annotated = annotateCosts(doc, { createOrder: { components: [{ source: "compute", basis: "per-call", microUsd: 10 }] } });
    expect(costAudit(annotated).filter((x) => x.operation === "createOrder").map((x) => x.code)).not.toContain("unattributed-background-cost");
  });
});

describe("C024 — costTable surfaces the trigger across paths + webhooks", () => {
  test("the table includes the webhook row with its trigger", () => {
    const annotated = annotateCosts(doc, {
      createOrder: { components: [{ source: "compute", basis: "per-call", microUsd: 10 }] },
      stripeCharge: { components: [{ source: "stripe", basis: "per-call", microUsd: 2900 }], trigger: "webhook-received" },
    });
    const rows = costTable(annotated);
    expect(rows.find((r) => r.operation === "createOrder")?.trigger).toBe("synchronous");
    expect(rows.find((r) => r.operation === "stripeCharge")).toMatchObject({ trigger: "webhook-received", estimateMicroUsd: 2900 });
  });
});
