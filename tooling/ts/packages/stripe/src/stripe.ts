/**
 * First-class Stripe. The param builders are PURE (exact Stripe API payloads, testable with no SDK); the
 * provider + setup call a duck-typed StripeLike client (the real `stripe` SDK satisfies it). Usage-based
 * billing uses the modern Billing Meters API (meters + meter events + metered prices), which is what other
 * processors are converging on. The cost bridge turns @suluk/cost events into the usage you bill on.
 */
import type { CostEvent } from "@suluk/cost";
import type { PaymentProvider, StripeLike } from "./types";

type Aggregation = "sum" | "count" | "last";

// ── pure param builders (produce exact Stripe API params) ─────────────────────────────────────────────
export function customerParams(i: { email?: string; name?: string; metadata?: Record<string, string> }): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (i.email) p.email = i.email;
  if (i.name) p.name = i.name;
  if (i.metadata) p.metadata = i.metadata;
  return p;
}

export function productParams(name: string): Record<string, unknown> {
  return { name };
}

/** A Billing Meter — aggregates incoming meter events for one event_name (default: sum). */
export function meterParams(eventName: string, displayName: string, formula: Aggregation = "sum"): Record<string, unknown> {
  return { display_name: displayName, event_name: eventName, default_aggregation: { formula } };
}

/** A METERED recurring price tied to a meter (usage_type:"metered"). unitAmountDecimal is per aggregated unit. */
export function meteredPriceParams(i: { productId: string; currency: string; unitAmountDecimal: string; meterId: string; interval?: "day" | "week" | "month" | "year" }): Record<string, unknown> {
  return {
    product: i.productId,
    currency: i.currency,
    unit_amount_decimal: i.unitAmountDecimal,
    recurring: { interval: i.interval ?? "month", usage_type: "metered", meter: i.meterId },
  };
}

export function subscriptionParams(i: { customerId: string; priceId: string }): Record<string, unknown> {
  return { customer: i.customerId, items: [{ price: i.priceId }] };
}

/** A meter event — reports usage for a customer (the `value` is what you price on). */
export function meterEventParams(i: { eventName: string; customerId: string; value: number; at?: number }): Record<string, unknown> {
  const payload: Record<string, unknown> = { stripe_customer_id: i.customerId, value: String(i.value) };
  const p: Record<string, unknown> = { event_name: i.eventName, payload };
  if (i.at != null) p.timestamp = Math.floor(i.at / 1000); // unix seconds
  return p;
}

// ── flows over a StripeLike client ────────────────────────────────────────────────────────────────────
export interface UsageBillingConfig {
  productName: string;
  eventName: string;
  currency: string;
  /** Price per aggregated unit, as a decimal string (e.g. "0.000002" to charge per cost-µ$). */
  unitAmountDecimal: string;
  interval?: "day" | "week" | "month" | "year";
  aggregation?: Aggregation;
}

/** Wire up usage-based billing: a product + a meter + a metered price. Returns the ids to subscribe customers. */
export async function setupUsageBilling(client: StripeLike, cfg: UsageBillingConfig): Promise<{ productId: string; meterId: string; priceId: string; eventName: string }> {
  const product = await client.products.create(productParams(cfg.productName));
  const meter = await client.billing.meters.create(meterParams(cfg.eventName, `${cfg.productName} usage`, cfg.aggregation ?? "sum"));
  const price = await client.prices.create(meteredPriceParams({ productId: product.id, currency: cfg.currency, unitAmountDecimal: cfg.unitAmountDecimal, meterId: meter.id, interval: cfg.interval }));
  return { productId: product.id, meterId: meter.id, priceId: price.id, eventName: cfg.eventName };
}

/** The Stripe PaymentProvider (the swap point — other processors implement the same interface). */
export function stripeProvider(client: StripeLike, cfg: { webhookSecret?: string } = {}): PaymentProvider {
  return {
    name: "stripe",
    async createCustomer(i) { return { id: (await client.customers.create(customerParams(i))).id }; },
    async subscribeMetered(i) { return { id: (await client.subscriptions.create(subscriptionParams(i))).id }; },
    async reportUsage(i) { await client.billing.meterEvents.create(meterEventParams(i)); },
    verifyWebhook(body, signature) {
      const e = client.webhooks.constructEvent(body, signature, cfg.webhookSecret ?? "");
      return { type: e.type, data: e.data };
    },
  };
}

// ── the cost → Stripe bridge ──────────────────────────────────────────────────────────────────────────
export interface CostBillingConfig {
  eventName: string;
  /** principal id → Stripe customer id. Principals without a customer are skipped. */
  customerOf: (principal: string) => string | undefined;
  /** What to meter: the raw cost in µ$ (default — price per-µ$ for a markup) or the request count. */
  basis?: "cost-micro-usd" | "request-count";
}

/** Aggregate cost events per principal into Stripe meter-event params — the usage you report to bill on. */
export function usageEventsFromCost(events: CostEvent[], cfg: CostBillingConfig): Record<string, unknown>[] {
  const byPrincipal = new Map<string, number>();
  for (const e of events) {
    if (!e.principal) continue;
    const v = cfg.basis === "request-count" ? 1 : e.totalMicroUsd;
    byPrincipal.set(e.principal, (byPrincipal.get(e.principal) ?? 0) + v);
  }
  const out: Record<string, unknown>[] = [];
  for (const [principal, value] of byPrincipal) {
    const customerId = cfg.customerOf(principal);
    if (customerId) out.push(meterEventParams({ eventName: cfg.eventName, customerId, value }));
  }
  return out;
}

/** Report each principal's accrued cost-usage to the provider (one meter event per principal). */
export async function reportCostUsage(provider: PaymentProvider, events: CostEvent[], cfg: CostBillingConfig): Promise<number> {
  const byPrincipal = new Map<string, number>();
  for (const e of events) {
    if (!e.principal) continue;
    byPrincipal.set(e.principal, (byPrincipal.get(e.principal) ?? 0) + (cfg.basis === "request-count" ? 1 : e.totalMicroUsd));
  }
  let reported = 0;
  for (const [principal, value] of byPrincipal) {
    const customerId = cfg.customerOf(principal);
    if (!customerId) continue;
    await provider.reportUsage({ customerId, eventName: cfg.eventName, value });
    reported++;
  }
  return reported;
}
