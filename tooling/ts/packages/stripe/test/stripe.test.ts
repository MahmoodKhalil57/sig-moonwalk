import { test, expect, describe } from "bun:test";
import type { CostEvent } from "@suluk/cost";
import {
  customerParams, meterParams, meteredPriceParams, subscriptionParams, meterEventParams,
  setupUsageBilling, stripeProvider, usageEventsFromCost, reportCostUsage, type StripeLike,
} from "../src/index";

/** A recording mock that satisfies StripeLike — records every call + returns fake ids. */
function mockStripe() {
  const calls: { method: string; params: unknown }[] = [];
  const rec = (method: string, id: string) => async (params: Record<string, unknown>) => { calls.push({ method, params }); return { id, identifier: id }; };
  const client: StripeLike = {
    customers: { create: rec("customers.create", "cus_1") },
    products: { create: rec("products.create", "prod_1") },
    prices: { create: rec("prices.create", "price_1") },
    subscriptions: { create: rec("subscriptions.create", "sub_1") },
    billing: {
      meters: { create: rec("billing.meters.create", "mtr_1") },
      meterEvents: { create: rec("billing.meterEvents.create", "evt_1") },
    },
    webhooks: { constructEvent: (b, s, secret) => { calls.push({ method: "webhooks.constructEvent", params: { b, s, secret } }); return { type: "invoice.paid", data: { ok: true } }; } },
  };
  return { client, calls };
}

describe("pure param builders → exact Stripe payloads", () => {
  test("meter uses default_aggregation.formula", () => {
    expect(meterParams("api_cost", "API usage")).toEqual({ display_name: "API usage", event_name: "api_cost", default_aggregation: { formula: "sum" } });
  });
  test("metered price attaches the meter + usage_type metered", () => {
    const p = meteredPriceParams({ productId: "prod_1", currency: "usd", unitAmountDecimal: "0.000002", meterId: "mtr_1" }) as any;
    expect(p.recurring).toEqual({ interval: "month", usage_type: "metered", meter: "mtr_1" });
    expect(p.product).toBe("prod_1");
  });
  test("meter event carries stripe_customer_id + a string value (+ unix timestamp)", () => {
    expect(meterEventParams({ eventName: "api_cost", customerId: "cus_1", value: 4050, at: 2000 })).toEqual({
      event_name: "api_cost", payload: { stripe_customer_id: "cus_1", value: "4050" }, timestamp: 2,
    });
  });
  test("customer + subscription params", () => {
    expect(customerParams({ email: "a@b.c" })).toEqual({ email: "a@b.c" });
    expect(subscriptionParams({ customerId: "cus_1", priceId: "price_1" })).toEqual({ customer: "cus_1", items: [{ price: "price_1" }] });
  });
});

describe("flows over a StripeLike client", () => {
  test("setupUsageBilling creates product → meter → metered price", async () => {
    const { client, calls } = mockStripe();
    const out = await setupUsageBilling(client, { productName: "API", eventName: "api_cost", currency: "usd", unitAmountDecimal: "0.000002" });
    expect(out).toEqual({ productId: "prod_1", meterId: "mtr_1", priceId: "price_1", eventName: "api_cost" });
    expect(calls.map((c) => c.method)).toEqual(["products.create", "billing.meters.create", "prices.create"]);
    expect((calls[2].params as any).recurring.meter).toBe("mtr_1"); // the price is tied to the meter
  });

  test("stripeProvider: customer, metered subscription, usage, webhook", async () => {
    const { client, calls } = mockStripe();
    const stripe = stripeProvider(client, { webhookSecret: "whsec_x" });
    expect(stripe.name).toBe("stripe");
    expect((await stripe.createCustomer({ email: "a@b.c" })).id).toBe("cus_1");
    expect((await stripe.subscribeMetered({ customerId: "cus_1", priceId: "price_1" })).id).toBe("sub_1");
    await stripe.reportUsage({ customerId: "cus_1", eventName: "api_cost", value: 4050 });
    const evt = stripe.verifyWebhook("{raw}", "sig_1");
    expect(evt.type).toBe("invoice.paid");
    expect(calls.find((c) => c.method === "billing.meterEvents.create")!.params).toMatchObject({ event_name: "api_cost", payload: { stripe_customer_id: "cus_1", value: "4050" } });
    expect(calls.find((c) => c.method === "webhooks.constructEvent")!.params).toMatchObject({ secret: "whsec_x" });
  });
});

describe("the @suluk/cost → Stripe bridge", () => {
  const events: CostEvent[] = [
    { at: 1, principal: "user_a", operation: "ask", breakdown: [{ source: "openai", microUsd: 3000 }], totalMicroUsd: 3000 },
    { at: 2, principal: "user_a", operation: "ask", breakdown: [{ source: "openai", microUsd: 1000 }], totalMicroUsd: 1000 },
    { at: 3, principal: "user_b", operation: "ask", breakdown: [{ source: "openai", microUsd: 500 }], totalMicroUsd: 500 },
    { at: 4, operation: "ping", breakdown: [], totalMicroUsd: 0 }, // no principal → skipped
  ];
  const customerOf = (p: string) => ({ user_a: "cus_a", user_b: "cus_b" }[p]);

  test("usageEventsFromCost aggregates per principal (raw cost-µ$) into meter events", () => {
    const usage = usageEventsFromCost(events, { eventName: "api_cost", customerOf });
    expect(usage).toEqual([
      { event_name: "api_cost", payload: { stripe_customer_id: "cus_a", value: "4000" } },
      { event_name: "api_cost", payload: { stripe_customer_id: "cus_b", value: "500" } },
    ]);
  });

  test("request-count basis meters 1 per request", () => {
    const usage = usageEventsFromCost(events, { eventName: "api_calls", customerOf, basis: "request-count" }) as any[];
    expect(usage.find((u) => u.payload.stripe_customer_id === "cus_a").payload.value).toBe("2");
  });

  test("reportCostUsage pushes one meter event per principal to the provider", async () => {
    const { client, calls } = mockStripe();
    const reported = await reportCostUsage(stripeProvider(client), events, { eventName: "api_cost", customerOf });
    expect(reported).toBe(2);
    expect(calls.filter((c) => c.method === "billing.meterEvents.create").length).toBe(2);
  });
});
