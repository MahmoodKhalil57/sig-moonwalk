/**
 * The checkout money-path (saastarter-parity Phase 1; PARITY §2 trust layer). Distinct from usage billing
 * (stripe.ts): one-time checkout — payment intents, the saved-card vault, customer find-or-create. The TRUST core
 * is PURE and lives here (never charge a client-supplied amount; reuse a matching intent so a retry can't
 * double-charge; re-price on a cart change; thread a deterministic idempotency key) — built on the Phase-0 pricing
 * primitives. The Stripe API calls are a SWAPPABLE binding (`StripeCheckoutLike`), satisfied by the real SDK or a mock.
 */
import {
  orderTotal, verifyAmount, idempotencyKey,
  type CartLine, type Discount, type AmountVerdict,
} from "./pricing";

/** A saved card, surfaced to the account/checkout UI (saastarter CardInfo, services/stripe.ts:13). */
export interface CardInfo {
  id: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
}

/** A Stripe PaymentMethod (the slice we read). */
export interface PaymentMethodLike {
  id: string;
  customer?: string | null;
  card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number } | null;
}

/** A Stripe PaymentIntent (the slice we read). */
export interface PaymentIntentLike {
  id: string;
  amount: number;
  currency: string;
  status?: string;
  client_secret?: string | null;
}

/** The minimal Stripe checkout surface this module calls — satisfied by the real `stripe` SDK and by mocks. */
export interface StripeCheckoutLike {
  customers: {
    create(params: Record<string, unknown>): Promise<{ id: string }>;
    list(params: { email: string; limit?: number }): Promise<{ data: { id: string }[] }>;
  };
  paymentIntents: {
    create(params: Record<string, unknown>, opts?: { idempotencyKey?: string }): Promise<PaymentIntentLike>;
    retrieve(id: string): Promise<PaymentIntentLike>;
    update(id: string, params: Record<string, unknown>): Promise<PaymentIntentLike>;
  };
  setupIntents: { create(params: Record<string, unknown>): Promise<{ client_secret: string | null }> };
  paymentMethods: {
    list(params: { customer: string; type: string }): Promise<{ data: PaymentMethodLike[] }>;
    retrieve(id: string): Promise<PaymentMethodLike>;
    detach(id: string): Promise<PaymentMethodLike>;
  };
}

// ── the PURE trust core ───────────────────────────────────────────────────────────────────────────────

export interface IntentPlan {
  /** create a new intent · reuse the matching one (no charge change) · update an existing one to a new total. */
  action: "create" | "reuse" | "update";
  /** the AUTHORITATIVE amount, recomputed from line prices — never a client-supplied number. */
  amountCents: number;
  currency: string;
  /** deterministic key (cart × scope) — threaded into create so a retry reuses one intent (no double-charge). */
  idempotencyKey: string;
  /** the intent to reuse/update (absent for create). */
  intentId?: string;
  /** when a client claimed an amount, the anti-tampering verdict (the caller MUST reject `ok:false`). */
  amountVerdict?: AmountVerdict;
}

/**
 * Decide what to do with a checkout's payment intent — the anti-double-charge / anti-tampering decision, pure and
 * fully testable. Recomputes the total from authoritative prices; reuses an existing intent iff its amount already
 * matches (idempotent retry); updates it when the cart changed; creates one otherwise. If `claimedCents` is given,
 * attaches the verifyAmount verdict so the caller can reject a tampered amount BEFORE touching Stripe.
 */
export function planPaymentIntent(input: {
  lines: CartLine[];
  discount?: Discount | null;
  /** principal/session id — namespaces the idempotency key so two users' identical carts don't collide. */
  scope: string;
  currency: string;
  existingIntent?: { id: string; amountCents: number } | null;
  claimedCents?: number;
}): IntentPlan {
  const discount = input.discount ?? null;
  const amountCents = orderTotal(input.lines, discount).totalCents;
  const key = idempotencyKey(input.scope, input.lines, discount);
  const amountVerdict = input.claimedCents != null ? verifyAmount(input.lines, discount, input.claimedCents) : undefined;
  let action: IntentPlan["action"] = "create";
  if (input.existingIntent) action = input.existingIntent.amountCents === amountCents ? "reuse" : "update";
  return {
    action, amountCents, currency: input.currency, idempotencyKey: key,
    ...(input.existingIntent ? { intentId: input.existingIntent.id } : {}),
    ...(amountVerdict ? { amountVerdict } : {}),
  };
}

/** Map a Stripe PaymentMethod to a CardInfo (pure). `defaultId` marks the default card. */
export function cardInfoFrom(pm: PaymentMethodLike, defaultId?: string | null): CardInfo {
  return {
    id: pm.id,
    brand: pm.card?.brand,
    last4: pm.card?.last4,
    expMonth: pm.card?.exp_month,
    expYear: pm.card?.exp_year,
    isDefault: pm.id === defaultId,
  };
}

/** Does a payment method belong to this customer? The ownership guard for detach / set-default (no cross-account ops). */
export function ownsPaymentMethod(pm: PaymentMethodLike, customerId: string): boolean {
  return pm.customer === customerId;
}

// ── the Stripe-backed binding ─────────────────────────────────────────────────────────────────────────

export interface CheckoutProvider {
  name: string;
  /** Find a customer by email, else create one (saastarter getOrCreateCustomer, services/stripe.ts:143). */
  getOrCreateCustomer(input: { email: string; name?: string; metadata?: Record<string, string> }): Promise<{ customerId: string }>;
  /** The saved-card vault for a customer (default card flagged). */
  listPaymentMethods(customerId: string, defaultPaymentMethodId?: string | null): Promise<CardInfo[]>;
  /** A SetupIntent client secret — to vault a new card without charging. */
  createSetupIntent(customerId: string): Promise<{ clientSecret: string | null }>;
  /** Detach a saved card — guarded: throws if the card isn't this customer's. */
  detachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
  /** Execute an {@link IntentPlan} against Stripe: create (idempotent) / update / reuse. */
  applyIntentPlan(plan: IntentPlan): Promise<PaymentIntentLike>;
}

/** The Stripe checkout binding (the swap point; another processor implements the same interface). */
export function stripeCheckout(client: StripeCheckoutLike): CheckoutProvider {
  return {
    name: "stripe",
    async getOrCreateCustomer({ email, name, metadata }) {
      const existing = await client.customers.list({ email, limit: 1 });
      if (existing.data[0]) return { customerId: existing.data[0].id };
      const created = await client.customers.create({ email, ...(name ? { name } : {}), ...(metadata ? { metadata } : {}) });
      return { customerId: created.id };
    },
    async listPaymentMethods(customerId, defaultPaymentMethodId) {
      const { data } = await client.paymentMethods.list({ customer: customerId, type: "card" });
      return data.map((pm) => cardInfoFrom(pm, defaultPaymentMethodId));
    },
    async createSetupIntent(customerId) {
      const si = await client.setupIntents.create({ customer: customerId });
      return { clientSecret: si.client_secret };
    },
    async detachPaymentMethod(customerId, paymentMethodId) {
      const pm = await client.paymentMethods.retrieve(paymentMethodId);
      if (!ownsPaymentMethod(pm, customerId)) throw new Error(`forbidden: payment method ${paymentMethodId} does not belong to ${customerId}`);
      await client.paymentMethods.detach(paymentMethodId);
    },
    async applyIntentPlan(plan) {
      if (plan.action === "reuse" && plan.intentId) return client.paymentIntents.retrieve(plan.intentId);
      if (plan.action === "update" && plan.intentId) return client.paymentIntents.update(plan.intentId, { amount: plan.amountCents, currency: plan.currency });
      return client.paymentIntents.create(
        { amount: plan.amountCents, currency: plan.currency },
        { idempotencyKey: plan.idempotencyKey },
      );
    },
  };
}
