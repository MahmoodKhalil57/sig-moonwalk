/**
 * @suluk/stripe — first-class Stripe behind a swappable PaymentProvider. Usage-based billing via the modern
 * Billing Meters API (meters + meter events + metered prices), customers, subscriptions, and webhooks — plus
 * a bridge that turns @suluk/cost events into the usage you bill on. Stripe is the reference processor; the
 * PaymentProvider interface is the swap point for the others that follow it. CANDIDATE tooling.
 */
export type { PaymentProvider, StripeLike, Customer, Subscription, WebhookEvent } from "./types";
export {
  customerParams, productParams, meterParams, meteredPriceParams, subscriptionParams, meterEventParams,
  billingPortalSessionParams, setupUsageBilling, stripeProvider, usageEventsFromCost, reportCostUsage,
  type UsageBillingConfig, type CostBillingConfig,
} from "./stripe";
export {
  subtotal, computeDiscountAmount, validateDiscount, prorateDiscount, orderTotal, verifyAmount,
  cartFingerprint, idempotencyKey,
  type CartLine, type Discount, type DiscountResult, type DiscountRejection, type OrderTotal, type AmountVerdict,
} from "./pricing";
// the checkout money-path (Phase 1): the pure anti-double-charge / anti-tampering core + the Stripe binding.
export {
  planPaymentIntent, cardInfoFrom, ownsPaymentMethod, stripeCheckout,
  type IntentPlan, type CardInfo, type CheckoutProvider,
  type StripeCheckoutLike, type PaymentMethodLike, type PaymentIntentLike,
} from "./checkout";
export { webhookRouter, STRIPE_EVENTS, type WebhookRouter, type WebhookHandler, type HandleResult } from "./webhook";
