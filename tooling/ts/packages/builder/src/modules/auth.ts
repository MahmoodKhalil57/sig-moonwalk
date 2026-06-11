/** A first-party `auth` module — the one that PROVIDES User. Every other module requires it, so a composition
 *  starts here: install auth, then ecommerce/crm/billing all resolve their `requires: ["User"]` against it.
 *  Ships the Better Auth core entities (User + Session/Account/Verification — the latter three unblock the
 *  security-tab sessions table + the account-deletion cascade's real targets), the securitySchemes (session +
 *  bearer), and a swappable `auth` provider slot. */
import type { SulukModule } from "../module";
import { crudCost } from "./cost";

export const AUTH: SulukModule = {
  name: "auth",
  version: "0.2.0",
  provides: ["User", "Session", "Account", "Verification"],
  schemas: {
    User: {
      type: "object",
      required: ["email"],
      properties: {
        id: { type: "integer" },
        email: { type: "string" },
        name: { type: "string" },
        role: { type: "string", enum: ["user", "admin", "superadmin"] },
        emailVerified: { type: "boolean" }, // Better Auth core field
        image: { type: "string" },          // avatar URL
      },
      additionalProperties: false,
    },
    // an active login session — the security tab lists these and revokes (deletes) them.
    Session: {
      type: "object",
      required: ["userId", "token", "expiresAt"],
      properties: {
        id: { type: "integer" },
        userId: { type: "integer" }, // FK → User
        token: { type: "string" },
        expiresAt: { type: "string", format: "date-time" },
        ipAddress: { type: "string" },
        userAgent: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
    // a linked credential / OAuth account for a user.
    Account: {
      type: "object",
      required: ["userId", "providerId", "accountId"],
      properties: {
        id: { type: "integer" },
        userId: { type: "integer" }, // FK → User
        providerId: { type: "string" },
        accountId: { type: "string" },
        scope: { type: "string" },
      },
      additionalProperties: false,
    },
    // an email-verification / password-reset / delete-account token.
    Verification: {
      type: "object",
      required: ["identifier", "value", "expiresAt"],
      properties: {
        id: { type: "integer" },
        identifier: { type: "string" },
        value: { type: "string" },
        expiresAt: { type: "string", format: "date-time" },
        createdAt: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
  },
  securitySchemes: {
    sessionCookie: { type: "apiKey", name: "session", in: "cookie" },
    bearerAuth: { type: "http", scheme: "bearer" },
  },
  cost: {
    ...crudCost("User"),
    ...crudCost("Session", 8, 20),       // sessions are list/revoke-heavy, cheap writes
    ...crudCost("Account", 8, 20),
    ...crudCost("Verification", 6, 15),
  },
  providerSlots: { auth: "better-auth" },
};
