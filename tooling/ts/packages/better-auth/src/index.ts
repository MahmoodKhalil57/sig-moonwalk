/**
 * @suluk/better-auth — official Better-Auth-on-Hono support for the Suluk derivation engine.
 *
 * Better Auth is a Contract input (auth settings). This package: (1) derives v4 securitySchemes from the
 * enabled auth methods; (2) ingests Better Auth's own OpenAPI 3.0 output (normalizing it to 2020-12) and
 * lifts it to v4 via @suluk/openapi-compat, then merges it into the app doc — so the auth surface is
 * documented without re-typing; (3) maps a Better Auth session to a { scopes } principal that feeds
 * @suluk/hono's per-viewer emitV4; (4) mounts the auth handler on Hono. CANDIDATE tooling.
 */
export { authSecuritySchemes, type AuthMethods, type AuthSecurity } from "./security";
export { normalizeOas30, ingestAuthOpenAPI, mergeAuth, type IngestOptions } from "./ingest";
export { principalFromSession, type Principal, type SessionLike, type PrincipalOptions } from "./principal";
export { mountAuth, type AuthHandlerLike, type HonoLike, type MountAuthOptions } from "./mount";
// live role-preview (charter-bounded by C020): the fail-closed, deploy-gated role-login handler. The extension
// holds NO token — it deep-links this route in the browser; the credentialed mint happens here, server-side.
export { previewLoginHandler, isPreviewRuntime, type PreviewRequestLike, type PreviewEnvLike, type MintedSession, type PreviewLoginOptions } from "./preview";
