/**
 * Derive v4 securitySchemes (C014) from a declarative description of the Better Auth methods in use.
 * Better Auth's standard mechanisms map onto OpenAPI security schemes as:
 *   - session   → an apiKey-in-cookie (default cookie "better-auth.session_token")
 *   - bearer    → http bearer (Authorization: Bearer <token>; the bearer plugin)
 *   - apiKey    → apiKey-in-header (default "x-api-key"; the apiKey plugin)
 * The exact names are Better Auth conventions and are overridable.
 */
import type { SecurityScheme } from "@suluk/core";

export interface AuthMethods {
  /** Session cookie (default). `true` ⇒ default cookie name; or pass a custom cookie name. */
  session?: boolean | { cookieName?: string };
  /** Bearer token (the bearer plugin). */
  bearer?: boolean;
  /** API key (the apiKey plugin). `true` ⇒ default "x-api-key" header; or pass a custom header. */
  apiKey?: boolean | { header?: string };
}

export interface AuthSecurity {
  /** v4 components.securitySchemes entries, keyed by scheme name. */
  securitySchemes: Record<string, SecurityScheme>;
  /** Convenience: the scheme names, to build by-name security requirements. */
  names: string[];
}

const DEFAULT_SESSION_COOKIE = "better-auth.session_token";
const DEFAULT_APIKEY_HEADER = "x-api-key";

/** Build v4 securitySchemes from the enabled Better Auth methods. */
export function authSecuritySchemes(methods: AuthMethods): AuthSecurity {
  const securitySchemes: Record<string, SecurityScheme> = {};
  if (methods.session) {
    const cookieName = typeof methods.session === "object" ? methods.session.cookieName ?? DEFAULT_SESSION_COOKIE : DEFAULT_SESSION_COOKIE;
    securitySchemes.sessionCookie = { type: "apiKey", in: "cookie", name: cookieName };
  }
  if (methods.bearer) {
    securitySchemes.bearerAuth = { type: "http", scheme: "bearer" };
  }
  if (methods.apiKey) {
    const header = typeof methods.apiKey === "object" ? methods.apiKey.header ?? DEFAULT_APIKEY_HEADER : DEFAULT_APIKEY_HEADER;
    securitySchemes.apiKey = { type: "apiKey", in: "header", name: header };
  }
  return { securitySchemes, names: Object.keys(securitySchemes) };
}
