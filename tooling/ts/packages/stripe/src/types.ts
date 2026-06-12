/**
 * The payment abstraction — SWAPPABLE by design. Stripe is the first (and reference) provider because the
 * other processors largely follow its feature set + API shape. The PaymentProvider interface is processor-
 * neutral; the Stripe-specific param builders live in ./stripe and produce exact Stripe API payloads.
 *
 * A duck-typed `StripeLike` lets the real `stripe` SDK plug in while staying testable with a mock — no hard
 * dependency on the SDK in this package.
 */

export interface Customer { id: string }
export interface Subscription { id: string }
export interface WebhookEvent { type: string; data: unknown }

/** A processor-neutral payment surface. Other processors implement the same interface. */
export interface PaymentProvider {
  name: string;
  /** Create (or reference) a billing customer for a principal. */
  createCustomer(input: { email?: string; name?: string; metadata?: Record<string, string> }): Promise<Customer>;
  /** Start a usage-metered subscription for a customer on a metered price. */
  subscribeMetered(input: { customerId: string; priceId: string }): Promise<Subscription>;
  /** Report usage for billing — one meter event (the value you price on). `at` is an input (reproducible). */
  reportUsage(input: { customerId: string; eventName: string; value: number; at?: number }): Promise<void>;
  /** Open the hosted customer billing portal (manage saved cards + invoices). Optional — not every processor has one. */
  billingPortalUrl?(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Verify + parse a webhook from the raw body + signature. */
  verifyWebhook(rawBody: string, signature: string): WebhookEvent;
}

/** The minimal Stripe surface this package calls — satisfied by the real `stripe` SDK and by test mocks. */
export interface StripeLike {
  customers: { create(params: Record<string, unknown>): Promise<{ id: string }> };
  products: { create(params: Record<string, unknown>): Promise<{ id: string }> };
  prices: { create(params: Record<string, unknown>): Promise<{ id: string }> };
  subscriptions: { create(params: Record<string, unknown>): Promise<{ id: string }> };
  billing: {
    meters: { create(params: Record<string, unknown>): Promise<{ id: string }> };
    meterEvents: { create(params: Record<string, unknown>): Promise<{ identifier?: string }> };
  };
  /** The Billing customer portal. Optional — present on the real SDK + the REST adapter, omitted by minimal mocks. */
  billingPortal?: { sessions: { create(params: Record<string, unknown>): Promise<{ url: string }> } };
  webhooks: { constructEvent(body: string, sig: string, secret: string): { type: string; data: unknown } };
}
