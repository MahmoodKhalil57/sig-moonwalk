/** A first-party `billing` module — Invoices and Subscriptions for the host's User. Ships a swappable
 *  `payments` provider slot. Intentionally leaves a couple of operations without a cost facet, so its
 *  conformance grade (B) differs from the fully-costed modules — the registry shows the grade up front. */
import type { SulukModule } from "../module";

export const BILLING: SulukModule = {
  name: "billing",
  version: "0.1.0",
  provides: ["Invoice", "Subscription"],
  requires: ["User"],
  schemas: {
    Invoice: {
      type: "object",
      required: ["amountCents"],
      properties: {
        id: { type: "integer" },
        customer: { $ref: "#/components/schemas/User" },
        amountCents: { type: "integer", minimum: 0 },
        status: { type: "string", enum: ["draft", "open", "paid", "void"] },
      },
      additionalProperties: false,
    },
    Subscription: {
      type: "object",
      required: ["plan"],
      properties: {
        id: { type: "integer" },
        customer: { $ref: "#/components/schemas/User" },
        plan: { type: "string" },
        status: { type: "string", enum: ["active", "past_due", "canceled"] },
      },
      additionalProperties: false,
    },
  },
  cost: {
    // costs the writes + the list reads, leaving the per-id reads uncosted → ~half its ops → a deliberate B grade
    listInvoice: { components: [{ source: "db-read", basis: "per-call", microUsd: 12 }], estimateMicroUsd: 12 },
    createInvoice: { components: [{ source: "third-party", basis: "per-call", microUsd: 500 }], estimateMicroUsd: 500 },
    listSubscription: { components: [{ source: "db-read", basis: "per-call", microUsd: 12 }], estimateMicroUsd: 12 },
    createSubscription: { components: [{ source: "third-party", basis: "per-call", microUsd: 500 }], estimateMicroUsd: 500 },
    updateSubscription: { components: [{ source: "db-write", basis: "per-call", microUsd: 40 }], estimateMicroUsd: 40 },
  },
  providerSlots: { payments: "stripe" },
};
