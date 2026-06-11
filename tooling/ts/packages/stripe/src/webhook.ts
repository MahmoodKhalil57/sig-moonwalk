/**
 * A typed webhook event-router (saastarter-parity Phase 1) layered over the existing `verifyWebhook` (stripe.ts).
 * `verifyWebhook` proves a payload is authentic; this dispatches it to a per-event-type handler — the structured
 * alternative to one giant `switch (event.type)`. Pure routing: no Stripe calls, no network.
 */
import type { WebhookEvent } from "./types";

export type WebhookHandler = (event: WebhookEvent) => void | Promise<void>;

export interface HandleResult {
  type: string;
  /** a registered handler ran (false ⇒ the unhandled fallback ran, or nothing matched). */
  handled: boolean;
}

export interface WebhookRouter {
  /** register (or replace) the handler for an event type; chainable. */
  on(type: string, handler: WebhookHandler): WebhookRouter;
  /** register a fallback for types with no specific handler; chainable. */
  onUnhandled(handler: WebhookHandler): WebhookRouter;
  /** dispatch one verified event to its handler. */
  handle(event: WebhookEvent): Promise<HandleResult>;
}

/** Build a router, optionally seeded with a `{ type → handler }` map. */
export function webhookRouter(handlers: Record<string, WebhookHandler> = {}): WebhookRouter {
  const map = new Map<string, WebhookHandler>(Object.entries(handlers));
  let fallback: WebhookHandler | undefined;
  const router: WebhookRouter = {
    on(type, handler) { map.set(type, handler); return router; },
    onUnhandled(handler) { fallback = handler; return router; },
    async handle(event) {
      const handler = map.get(event.type);
      if (handler) { await handler(event); return { type: event.type, handled: true }; }
      if (fallback) await fallback(event);
      return { type: event.type, handled: false };
    },
  };
  return router;
}

/** The common Stripe checkout/billing event types (for discoverability + typo-safe registration). */
export const STRIPE_EVENTS = {
  paymentSucceeded: "payment_intent.succeeded",
  paymentFailed: "payment_intent.payment_failed",
  chargeRefunded: "charge.refunded",
  setupSucceeded: "setup_intent.succeeded",
  subscriptionUpdated: "customer.subscription.updated",
  subscriptionDeleted: "customer.subscription.deleted",
  invoicePaid: "invoice.paid",
} as const;
