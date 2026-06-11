import { test, expect, describe } from "bun:test";
import {
  planPaymentIntent, cardInfoFrom, ownsPaymentMethod, stripeCheckout,
  webhookRouter, STRIPE_EVENTS,
  type StripeCheckoutLike, type PaymentMethodLike, type CartLine,
} from "../src/index";

const lines: CartLine[] = [{ unitCents: 1999, qty: 2, id: "a" }, { unitCents: 500, qty: 1, id: "b" }]; // 4498

describe("planPaymentIntent — the anti-double-charge / anti-tampering core (pure)", () => {
  test("create when there is no existing intent; amount is authoritative; key is deterministic", () => {
    const p = planPaymentIntent({ lines, scope: "u1", currency: "usd" });
    expect(p.action).toBe("create");
    expect(p.amountCents).toBe(4498);
    expect(p.idempotencyKey).toBe(planPaymentIntent({ lines, scope: "u1", currency: "usd" }).idempotencyKey); // deterministic
    expect(p.intentId).toBeUndefined();
  });

  test("reuse when an existing intent already matches the recomputed total (idempotent retry)", () => {
    const p = planPaymentIntent({ lines, scope: "u1", currency: "usd", existingIntent: { id: "pi_1", amountCents: 4498 } });
    expect(p.action).toBe("reuse");
    expect(p.intentId).toBe("pi_1");
  });

  test("update when the cart changed (existing intent amount differs)", () => {
    const p = planPaymentIntent({ lines, scope: "u1", currency: "usd", existingIntent: { id: "pi_1", amountCents: 9999 } });
    expect(p.action).toBe("update");
    expect(p.amountCents).toBe(4498); // re-priced to the authoritative total
  });

  test("NEVER trusts a client amount: the plan uses the recomputed total + flags a tampered claim", () => {
    const tampered = planPaymentIntent({ lines, scope: "u1", currency: "usd", claimedCents: 1 });
    expect(tampered.amountCents).toBe(4498);            // ignores the claimed 1¢
    expect(tampered.amountVerdict?.ok).toBe(false);
    expect(planPaymentIntent({ lines, scope: "u1", currency: "usd", claimedCents: 4498 }).amountVerdict?.ok).toBe(true);
  });

  test("the idempotency key namespaces by scope (two users' identical carts don't collide)", () => {
    expect(planPaymentIntent({ lines, scope: "u1", currency: "usd" }).idempotencyKey)
      .not.toBe(planPaymentIntent({ lines, scope: "u2", currency: "usd" }).idempotencyKey);
  });
});

describe("card vault helpers (pure)", () => {
  const pm: PaymentMethodLike = { id: "pm_1", customer: "cus_1", card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 } };
  test("cardInfoFrom maps a PaymentMethod and flags the default", () => {
    expect(cardInfoFrom(pm, "pm_1")).toEqual({ id: "pm_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030, isDefault: true });
    expect(cardInfoFrom(pm, "pm_other").isDefault).toBe(false);
  });
  test("ownsPaymentMethod guards cross-account ops", () => {
    expect(ownsPaymentMethod(pm, "cus_1")).toBe(true);
    expect(ownsPaymentMethod(pm, "cus_2")).toBe(false);
  });
});

describe("stripeCheckout — the Stripe-backed binding", () => {
  function mockClient(overrides: Partial<StripeCheckoutLike> = {}) {
    const calls: { create: unknown[]; piCreate: [unknown, unknown][]; detached: string[] } = { create: [], piCreate: [], detached: [] };
    const client: StripeCheckoutLike = {
      customers: {
        async create(p) { calls.create.push(p); return { id: "cus_new" }; },
        async list() { return { data: [] }; },
      },
      paymentIntents: {
        async create(p, opts) { calls.piCreate.push([p, opts]); return { id: "pi_new", amount: (p as { amount: number }).amount, currency: "usd" }; },
        async retrieve(id) { return { id, amount: 4498, currency: "usd" }; },
        async update(id, p) { return { id, amount: (p as { amount: number }).amount, currency: "usd" }; },
      },
      setupIntents: { async create() { return { client_secret: "seti_secret" }; } },
      paymentMethods: {
        async list() { return { data: [{ id: "pm_1", customer: "cus_1", card: { brand: "visa", last4: "4242" } }] }; },
        async retrieve(id) { return { id, customer: "cus_1" }; },
        async detach(id) { calls.detached.push(id); return { id }; },
      },
      ...overrides,
    };
    return { client, calls };
  }

  test("getOrCreateCustomer reuses an existing customer by email, else creates", async () => {
    const found = stripeCheckout({ ...mockClient().client, customers: { async create() { return { id: "x" }; }, async list() { return { data: [{ id: "cus_found" }] }; } } });
    expect(await found.getOrCreateCustomer({ email: "a@b.co" })).toEqual({ customerId: "cus_found" });
    const { client } = mockClient();
    expect(await stripeCheckout(client).getOrCreateCustomer({ email: "new@b.co" })).toEqual({ customerId: "cus_new" });
  });

  test("listPaymentMethods maps cards + flags the default; createSetupIntent returns a secret", async () => {
    const co = stripeCheckout(mockClient().client);
    expect(await co.listPaymentMethods("cus_1", "pm_1")).toEqual([{ id: "pm_1", brand: "visa", last4: "4242", expMonth: undefined, expYear: undefined, isDefault: true }]);
    expect(await co.createSetupIntent("cus_1")).toEqual({ clientSecret: "seti_secret" });
  });

  test("detachPaymentMethod detaches an owned card and refuses a foreign one", async () => {
    const { client, calls } = mockClient();
    const co = stripeCheckout(client);
    await co.detachPaymentMethod("cus_1", "pm_1");
    expect(calls.detached).toEqual(["pm_1"]);
    await expect(co.detachPaymentMethod("cus_2", "pm_1")).rejects.toThrow("forbidden");
  });

  test("applyIntentPlan: create threads the idempotency key; reuse retrieves; update re-prices", async () => {
    const { client, calls } = mockClient();
    const co = stripeCheckout(client);
    await co.applyIntentPlan(planPaymentIntent({ lines, scope: "u1", currency: "usd" }));
    expect(calls.piCreate[0][1]).toMatchObject({ idempotencyKey: expect.stringContaining("co_u1_") });
    expect((await co.applyIntentPlan(planPaymentIntent({ lines, scope: "u1", currency: "usd", existingIntent: { id: "pi_1", amountCents: 4498 } }))).id).toBe("pi_1");
    expect((await co.applyIntentPlan(planPaymentIntent({ lines, scope: "u1", currency: "usd", existingIntent: { id: "pi_1", amountCents: 1 } }))).amount).toBe(4498);
  });
});

describe("webhookRouter — typed event dispatch over verifyWebhook", () => {
  test("dispatches to the registered handler; falls back for unknown types", async () => {
    const seen: string[] = [];
    const router = webhookRouter()
      .on(STRIPE_EVENTS.paymentSucceeded, (e) => { seen.push("paid:" + (e.data as { id?: string }).id); })
      .onUnhandled((e) => { seen.push("unhandled:" + e.type); });
    expect(await router.handle({ type: STRIPE_EVENTS.paymentSucceeded, data: { id: "pi_9" } })).toEqual({ type: "payment_intent.succeeded", handled: true });
    expect(await router.handle({ type: "charge.refunded", data: {} })).toEqual({ type: "charge.refunded", handled: false });
    expect(seen).toEqual(["paid:pi_9", "unhandled:charge.refunded"]);
  });

  test("seeded handler map works too", async () => {
    let hit = false;
    const r = webhookRouter({ "invoice.paid": () => { hit = true; } });
    await r.handle({ type: "invoice.paid", data: {} });
    expect(hit).toBe(true);
  });
});
