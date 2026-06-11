import { test, expect, describe } from "bun:test";
import { renderAnalytics } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "t", version: "1" },
  paths: {
    order: {
      requests: {
        createOrder: { method: "post", responses: {}, "x-suluk-cost": { components: [{ source: "compute", microUsd: 100 }, { source: "db", microUsd: 40 }], estimateMicroUsd: 140 }, "x-suluk-ratelimit": { windowMs: 60000, maxRequests: 20, key: "ip" } },
        listOrder: { method: "get", responses: {}, "x-suluk-cost": { components: [{ source: "db", microUsd: 12 }], estimateMicroUsd: 12 } },
        freeOp: { method: "get", responses: {} }, // no cost
      },
    },
  },
  webhooks: {
    stripeCharge: { method: "post", responses: {}, "x-suluk-cost": { estimateMicroUsd: 2900, components: [{ source: "stripe", microUsd: 2900 }], trigger: "webhook-received" } }, // deferred + unattributed
  },
} as unknown as OpenAPIv4Document;

describe("analytics dashboard — server-rendered SVG over the cost facets (Phase 3)", () => {
  const html = renderAnalytics(doc);

  test("renders the total subtotal + cost-by-source + costliest-op charts (SVG, no build)", () => {
    expect(html).toContain("<h2>Analytics</h2>");
    expect(html).toContain("<svg");                  // inline SVG, not Recharts/React
    expect(html).toContain("Cost by source");
    expect(html).toContain("Costliest operations");
    expect(html).toContain("stripe");                // a source bar
    expect(html).toContain("createOrder");           // a costly op
  });

  test("coverage gauges: priced ops + rate-limited ops", () => {
    expect(html).toContain("priced operations — 3/4"); // 3 of 4 ops (incl. webhook) declare a cost
    expect(html).toContain("rate-limited operations — 1/3");
  });

  test("surfaces the C024/C025 background-cost summary incl. the unattributed warning", () => {
    expect(html).toContain("Background-event costs");
    expect(html).toContain("<b>1</b> deferred");     // the stripe webhook
    expect(html).toContain("1 unattributed");        // it declares no attribution
  });

  test("an empty doc degrades gracefully", () => {
    const empty = renderAnalytics({ openapi: "4.0.0-candidate", info: { title: "t", version: "1" }, paths: {} } as unknown as OpenAPIv4Document);
    expect(empty).toContain("Analytics");
    expect(empty).toContain("no data");
  });
});
