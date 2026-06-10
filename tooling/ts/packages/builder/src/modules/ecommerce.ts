/**
 * A first-party `ecommerce` module — the proof that a module is a mergeable contract fragment. It OWNS Product
 * and Order, REQUIRES the host's User (Order.customer is a $ref to it — the cross-module reference that makes
 * the modules compose), ships an extra `checkout` operation, declares per-operation cost, and a swappable
 * `payments` provider slot. installModule(appDoc, ECOMMERCE) lights up the whole cockpit for these entities.
 */
import type { SulukModule } from "../module";

export const ECOMMERCE: SulukModule = {
  name: "ecommerce",
  version: "0.1.0",
  provides: ["Product", "Order"],
  requires: ["User"], // Order.customer references the host's User
  schemas: {
    Product: {
      type: "object",
      required: ["name", "priceCents"],
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        sku: { type: "string" },
        priceCents: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
    Order: {
      type: "object",
      required: ["items"],
      properties: {
        id: { type: "integer" },
        customer: { $ref: "#/components/schemas/User" }, // ← the cross-module reference (requires: User)
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["productId", "qty"],
            properties: { productId: { type: "integer" }, qty: { type: "integer", minimum: 1 } },
          },
        },
        status: { type: "string", enum: ["pending", "paid", "shipped"] },
        totalCents: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
  },
  paths: {
    "order/{id}/checkout": {
      requests: {
        checkoutOrder: {
          method: "post",
          summary: "Take payment for an order",
          tags: ["Order"],
          parameterSchema: { path: { type: "object", properties: { id: { type: "string" } } } },
          responses: {
            ok: { status: 200, description: "paid", contentType: "application/json", contentSchema: { $ref: "#/components/schemas/Order" } },
            paymentRequired: { status: 402, description: "payment failed" },
          },
        },
      },
    },
  },
  cost: {
    // the exemplar module declares cost for EVERY operation — it grades A in the registry
    listProduct: { components: [{ source: "db-read", basis: "per-call", microUsd: 10 }], estimateMicroUsd: 10 },
    createProduct: { components: [{ source: "db-write", basis: "per-call", microUsd: 30 }], estimateMicroUsd: 30 },
    getProduct: { components: [{ source: "db-read", basis: "per-call", microUsd: 8 }], estimateMicroUsd: 8 },
    updateProduct: { components: [{ source: "db-write", basis: "per-call", microUsd: 30 }], estimateMicroUsd: 30 },
    deleteProduct: { components: [{ source: "db-write", basis: "per-call", microUsd: 20 }], estimateMicroUsd: 20 },
    listOrder: { components: [{ source: "db-read", basis: "per-call", microUsd: 12 }], estimateMicroUsd: 12 },
    createOrder: { components: [{ source: "compute", basis: "per-call", microUsd: 100 }, { source: "db-write", basis: "per-call", microUsd: 40 }], estimateMicroUsd: 140 },
    getOrder: { components: [{ source: "db-read", basis: "per-call", microUsd: 8 }], estimateMicroUsd: 8 },
    updateOrder: { components: [{ source: "db-write", basis: "per-call", microUsd: 40 }], estimateMicroUsd: 40 },
    deleteOrder: { components: [{ source: "db-write", basis: "per-call", microUsd: 20 }], estimateMicroUsd: 20 },
    checkoutOrder: { components: [{ source: "third-party", basis: "per-call", microUsd: 2900 }], estimateMicroUsd: 2900 }, // the payments provider
  },
  providerSlots: { payments: "stripe" },
};
