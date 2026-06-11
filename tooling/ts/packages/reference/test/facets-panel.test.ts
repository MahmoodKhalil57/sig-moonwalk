import { test, expect, describe } from "bun:test";
import { facetsPanel } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "t", version: "1" },
  paths: {
    "discount/validate": {
      requests: {
        validateDiscount: { method: "post", responses: {}, "x-suluk-ratelimit": { windowMs: 60000, maxRequests: 10, key: "ip" } },
        plainOp: { method: "get", responses: {}, "x-suluk-cost": { estimateMicroUsd: 10 } }, // synchronous — NOT background
      },
    },
  },
  webhooks: {
    stripeCharge: { method: "post", responses: {}, "x-suluk-cost": { estimateMicroUsd: 2900, trigger: "webhook-received", attribution: { strategy: "event-expression", expression: "{$event.body#/customer}" } } },
  },
  "x-suluk-jobs": {
    drainQueue: { trigger: "queue-consumed", queue: "emails", "x-suluk-cost": { estimateMicroUsd: 100, trigger: "queue-consumed" } }, // no attribution
  },
} as unknown as OpenAPIv4Document;

describe("facetsPanel — surfaces the v4 operational facets in the cockpit", () => {
  const html = facetsPanel(doc);

  test("rate-limit section lists metered ops + the coverage gauge", () => {
    expect(html).toContain("Rate limits");
    expect(html).toContain("1/2 operations metered"); // 1 of the 2 path ops declares a budget
    expect(html).toContain("validateDiscount");
    expect(html).toContain("10 / 60s"); // maxRequests / window
  });

  test("background-cost section lists DEFERRED costs (webhook + job), not the synchronous one", () => {
    expect(html).toContain("Background-event costs");
    expect(html).toContain("2 deferred");           // stripeCharge (webhook) + drainQueue (job)
    expect(html).toContain("stripeCharge");
    expect(html).toContain("drainQueue");
    expect(html).not.toContain("plainOp");          // synchronous cost is not a background cost
  });

  test("attribution state is shown: an attributed webhook vs an unattributed job (fail-loud)", () => {
    expect(html).toContain("✓ attributed");          // stripeCharge has an event-expression
    expect(html).toContain("⚠ unattributed");        // drainQueue has none
  });

  test("an empty doc degrades to honest 'none declared' lines", () => {
    const empty = facetsPanel({ openapi: "4.0.0-candidate", info: { title: "t", version: "1" }, paths: {} } as unknown as OpenAPIv4Document);
    expect(empty).toContain("budgets declared");                 // no rate limits
    expect(empty).toContain("every cost accrues on its own route"); // no background costs
  });
});
