/**
 * Error-envelope shapes (saastarter-parity Phase 0) — an RFC-9457 Problem Details body + the closed
 * typed-throw→HTTP-status table, as PURE DATA. Shared in core because the envelope is read ACROSS packages:
 * @suluk/hono renders + synthesizes it, @suluk/sdk's `isApiError` guard discriminates it, @suluk/testgen
 * asserts error-conformance against it, @suluk/reference panels display it. No throwing, no HTTP, no I/O here.
 *
 * The status table is ported verbatim from saastarter's Effect route-handler (src/lib/effect/route-handler.ts:24-86)
 * — the portable value extracted from the dropped Effect layer (roadmap Phase 0). The body is UPGRADED from
 * saastarter's ad-hoc `{ error, details }` to RFC-9457 (the roadmap's intentional improvement), retaining a
 * legacy `error` machine-code member during Phase 0 so the existing SDK + the @suluk/hono `deny()` body keep working.
 */

/** The closed set of domain-error tags that map to an HTTP status (saastarter src/lib/effect/errors.ts). */
export type ErrorTag =
  | "UnauthorizedError" | "ForbiddenError" | "InvalidApiKeyError" | "ValidationError"
  | "NotFoundError" | "ConflictError" | "PaymentError" | "InvalidDiscountError"
  | "ExternalServiceError" | "RateLimitedError" | "PayloadOperationError";

/** The HTTP statuses the error model can produce. */
export type ProblemStatus = 400 | 401 | 402 | 403 | 404 | 409 | 429 | 500 | 502;

/** RFC-9457 media type for a Problem Details body. */
export const PROBLEM_CONTENT_TYPE = "application/problem+json" as const;

/**
 * typed-throw → HTTP status, ported verbatim from saastarter route-handler.ts:24-86. Frozen — the single
 * source of the mapping every package shares. Note `ExternalServiceError` → 502 (route-handler.ts:62-67):
 * the roadmap's Phase-0 list abbreviated the codes and omitted it; the faithful port keeps it.
 */
export const PROBLEM_STATUS_TABLE: Readonly<Record<ErrorTag, ProblemStatus>> = Object.freeze({
  UnauthorizedError: 401,    // route-handler.ts:26-30
  ForbiddenError: 403,       // route-handler.ts:32-36
  InvalidApiKeyError: 401,   // route-handler.ts:38-39
  ValidationError: 400,      // route-handler.ts:41-45
  NotFoundError: 404,        // route-handler.ts:47-51
  ConflictError: 409,        // route-handler.ts:53-54
  PaymentError: 402,         // route-handler.ts:56-57
  InvalidDiscountError: 400, // route-handler.ts:59-60
  ExternalServiceError: 502, // route-handler.ts:62-67
  RateLimitedError: 429,     // route-handler.ts:69-78
  PayloadOperationError: 500, // route-handler.ts:80-85
});

/**
 * Human-readable `title` per tag (RFC-9457 §3.1.1: `title` is human, `type` is the machine id). The STATIC
 * saastarter strings are ported verbatim where one exists; the rest derive a sensible title (saastarter built
 * those messages from dynamic data — e.g. `${resource} not found` — so there is no static string to port).
 */
export const TITLE_BY_TAG: Readonly<Record<ErrorTag, string>> = Object.freeze({
  UnauthorizedError: "Unauthorized",                    // route-handler.ts:28 (verbatim)
  ForbiddenError: "Forbidden",                          // route-handler.ts:34 (verbatim)
  InvalidApiKeyError: "Unauthorized",                   // 401; the key reason is supplied as `detail`
  ValidationError: "Validation failed",
  NotFoundError: "Not found",
  ConflictError: "Conflict",
  PaymentError: "Payment failed",
  InvalidDiscountError: "Invalid discount",
  ExternalServiceError: "External service unavailable", // route-handler.ts:66 (verbatim)
  RateLimitedError: "Too many requests",                // route-handler.ts:71 (verbatim)
  PayloadOperationError: "Internal server error",       // route-handler.ts:83 (verbatim)
});

/**
 * An RFC-9457 Problem Details object. `type` is the machine identifier (a URI reference; default `"about:blank"`),
 * `title` is human-readable, `status` is the HTTP status. `detail` is the human explanation; `errors` carries
 * structured validation details (what saastarter put in `details`). `error` is a LEGACY machine-code member kept
 * for Phase 0 (the existing SDK + the @suluk/hono `deny()` body read it) — deprecated in favor of `type`/`detail`.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: ProblemStatus;
  detail?: string;
  instance?: string;
  /** structured validation errors (saastarter's `details`). */
  errors?: Record<string, unknown>;
  /** @deprecated legacy machine code (Phase-0 bridge); prefer `type`/`detail`. */
  error?: string;
  [ext: `x-${string}`]: unknown;
}

/**
 * The canonical JSON Schema (2020-12) form of {@link ProblemDetails} — the `$ref` target @suluk/hono's emit
 * injects into `components.schemas.ProblemDetails`, so the SDK's `isApiError` typing and testgen's
 * error-conformance validate against ONE shared schema. Frozen; mirrors the type above.
 */
export const PROBLEM_DETAILS_SCHEMA = Object.freeze({
  type: "object",
  title: "ProblemDetails",
  description: "RFC-9457 Problem Details (application/problem+json).",
  properties: {
    type: { type: "string", format: "uri-reference", default: "about:blank" },
    title: { type: "string" },
    status: { type: "integer" },
    detail: { type: "string" },
    instance: { type: "string", format: "uri-reference" },
    errors: { type: "object", additionalProperties: true },
    error: { type: "string", deprecated: true },
  },
  required: ["type", "title", "status"],
});

/**
 * Structural guard — discriminates a Problem Details body (parallel to saastarter's `isApiError` and core's
 * `isReference`). Checks the two always-present RFC-9457 members `title` (string) + `status` (number).
 */
export function isProblemDetails(body: unknown): body is ProblemDetails {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.title === "string" && typeof b.status === "number";
}

/** The legacy `error` machine code for a tag: snake_case of the tag minus its `Error` suffix (e.g. `rate_limited`). */
function legacyCode(tag: ErrorTag): string {
  return tag.replace(/Error$/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Pure constructor: a tag (+ optional detail/instance/errors/type) → the canonical Problem Details body.
 * Fills `status` + `title` from the frozen tables and a stable legacy `error` code. No I/O, no throwing.
 */
export function toProblemDetails(args: {
  tag: ErrorTag;
  detail?: string;
  instance?: string;
  errors?: Record<string, unknown>;
  type?: string;
}): ProblemDetails {
  const pd: ProblemDetails = {
    type: args.type ?? "about:blank",
    title: TITLE_BY_TAG[args.tag],
    status: PROBLEM_STATUS_TABLE[args.tag],
    error: legacyCode(args.tag),
  };
  if (args.detail !== undefined) pd.detail = args.detail;
  if (args.instance !== undefined) pd.instance = args.instance;
  if (args.errors !== undefined) pd.errors = args.errors;
  return pd;
}
