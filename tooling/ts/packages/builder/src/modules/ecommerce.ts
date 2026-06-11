/**
 * A first-party `ecommerce` module — fleshed from the 2-entity exemplar into the storefront surface a SaaS
 * template ships: Product + Variant, Order (+ checkout), Cart, Discount, Review, Wishlist. It OWNS these and
 * REQUIRES the host's User (Order.customer / Cart.userId / Review.userId / Wishlist.userId reference it — the
 * cross-module references that make the modules compose). Declares per-operation cost (grades A) and a swappable
 * `payments` provider slot. installModule(appDoc, ECOMMERCE) lights up the whole cockpit for these entities.
 */
import type { SulukModule } from "../module";
import { crudCost } from "./cost";

const userRef = { $ref: "#/components/schemas/User" };

export const ECOMMERCE: SulukModule = {
  name: "ecommerce",
  version: "0.2.0",
  provides: ["Product", "Variant", "Order", "Cart", "Discount", "Review", "Wishlist"],
  requires: ["User"],
  schemas: {
    Product: {
      type: "object",
      required: ["name", "priceCents"],
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        sku: { type: "string" },
        priceCents: { type: "integer", minimum: 0 },
        description: { type: "string" },
      },
      additionalProperties: false,
    },
    // a purchasable variation of a product (size/color), with its own SKU + price.
    Variant: {
      type: "object",
      required: ["productId", "name", "priceCents"],
      properties: {
        id: { type: "integer" },
        productId: { type: "integer" }, // FK → Product
        name: { type: "string" },
        sku: { type: "string" },
        priceCents: { type: "integer", minimum: 0 },
        inStock: { type: "boolean" },
      },
      additionalProperties: false,
    },
    Order: {
      type: "object",
      required: ["items"],
      properties: {
        id: { type: "integer" },
        customer: userRef, // ← cross-module reference (requires: User)
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["productId", "qty"],
            properties: { productId: { type: "integer" }, variantId: { type: "integer" }, qty: { type: "integer", minimum: 1 } },
          },
        },
        status: { type: "string", enum: ["pending", "paid", "shipped"] },
        totalCents: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
    // a user's (or guest's) working cart — the source the checkout money-path prices.
    Cart: {
      type: "object",
      required: ["items"],
      properties: {
        id: { type: "integer" },
        userId: { type: "integer" }, // FK → User (null/absent for a guest cart, keyed by sessionId)
        sessionId: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["productId", "qty"],
            properties: { productId: { type: "integer" }, variantId: { type: "integer" }, qty: { type: "integer", minimum: 1 } },
          },
        },
        discountCode: { type: "string" },
        updatedAt: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
    // a discount code — its MATH shape mirrors @suluk/stripe's Discount (the app layers eligibility on top).
    Discount: {
      type: "object",
      required: ["code", "type", "value"],
      properties: {
        id: { type: "integer" },
        code: { type: "string" },
        type: { type: "string", enum: ["percent", "fixed"] },
        value: { type: "number", minimum: 0 },
        minSubtotalCents: { type: "integer", minimum: 0 },
        active: { type: "boolean" },
        usageLimit: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
    // a product review (moderated: a purchase-gated rating + body).
    Review: {
      type: "object",
      required: ["productId", "rating"],
      properties: {
        id: { type: "integer" },
        productId: { type: "integer" }, // FK → Product
        userId: { type: "integer" },    // FK → User
        rating: { type: "integer", minimum: 1, maximum: 5 },
        body: { type: "string" },
        status: { type: "string", enum: ["pending", "approved", "rejected"] },
        createdAt: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
    // a user's saved products.
    Wishlist: {
      type: "object",
      required: ["userId"],
      properties: {
        id: { type: "integer" },
        userId: { type: "integer" }, // FK → User
        productIds: { type: "array", items: { type: "integer" } },
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
    ...crudCost("Product"),
    ...crudCost("Variant"),
    listOrder: { components: [{ source: "db-read", basis: "per-call", microUsd: 12 }], estimateMicroUsd: 12 },
    getOrder: { components: [{ source: "db-read", basis: "per-call", microUsd: 8 }], estimateMicroUsd: 8 },
    createOrder: { components: [{ source: "compute", basis: "per-call", microUsd: 100 }, { source: "db-write", basis: "per-call", microUsd: 40 }], estimateMicroUsd: 140 },
    updateOrder: { components: [{ source: "db-write", basis: "per-call", microUsd: 40 }], estimateMicroUsd: 40 },
    deleteOrder: { components: [{ source: "db-write", basis: "per-call", microUsd: 20 }], estimateMicroUsd: 20 },
    checkoutOrder: { components: [{ source: "third-party", basis: "per-call", microUsd: 2900 }], estimateMicroUsd: 2900 }, // the payments provider
    ...crudCost("Cart", 10, 25),
    ...crudCost("Discount", 8, 25),
    ...crudCost("Review", 10, 25),
    ...crudCost("Wishlist", 8, 20),
  },
  providerSlots: { payments: "stripe" },
};
