/** A first-party `auth` module — the one that PROVIDES User. Every other module requires it, so a composition
 *  starts here: install auth, then ecommerce/crm/billing all resolve their `requires: ["User"]` against it.
 *  Ships the securitySchemes (session + bearer) and a swappable `auth` provider slot. */
import type { SulukModule } from "../module";

export const AUTH: SulukModule = {
  name: "auth",
  version: "0.1.0",
  provides: ["User"],
  schemas: {
    User: {
      type: "object",
      required: ["email"],
      properties: {
        id: { type: "integer" },
        email: { type: "string" },
        name: { type: "string" },
        role: { type: "string", enum: ["user", "admin", "superadmin"] },
      },
      additionalProperties: false,
    },
  },
  securitySchemes: {
    sessionCookie: { type: "apiKey", name: "session", in: "cookie" },
    bearerAuth: { type: "http", scheme: "bearer" },
  },
  cost: {
    listUser: { components: [{ source: "db-read", basis: "per-call", microUsd: 10 }], estimateMicroUsd: 10 },
    createUser: { components: [{ source: "db-write", basis: "per-call", microUsd: 30 }], estimateMicroUsd: 30 },
    getUser: { components: [{ source: "db-read", basis: "per-call", microUsd: 8 }], estimateMicroUsd: 8 },
    updateUser: { components: [{ source: "db-write", basis: "per-call", microUsd: 30 }], estimateMicroUsd: 30 },
    deleteUser: { components: [{ source: "db-write", basis: "per-call", microUsd: 20 }], estimateMicroUsd: 20 },
  },
  providerSlots: { auth: "better-auth" },
};
