/**
 * The error model (saastarter-parity Phase 0) — the portable value extracted from saastarter's dropped Effect
 * route-handler (src/lib/effect/route-handler.ts): a closed set of typed throws, each mapped to an HTTP status +
 * an RFC-9457 Problem Details body. In plain Hono the idiom is throw-a-typed-error → an `onError` handler maps it
 * to the wire (see on-error.ts). The status/title/code mapping is the SHARED core table (@suluk/core errors.ts),
 * so the SDK's `isApiError`, testgen's error-conformance, and enforce.ts's deny body all agree on one envelope.
 */
import {
  PROBLEM_STATUS_TABLE, TITLE_BY_TAG, toProblemDetails, retryAfterSeconds,
  type ErrorTag, type ProblemDetails, type ProblemStatus,
} from "@suluk/core";

export interface SulukHttpErrorInit {
  /** the human-readable explanation (RFC-9457 `detail`). */
  detail?: string;
  /** a URI reference identifying the specific occurrence (RFC-9457 `instance`). */
  instance?: string;
  /** structured validation errors (saastarter's `details`). */
  errors?: Record<string, unknown>;
  /** override the `type` URI (default "about:blank"). */
  type?: string;
  /** RateLimitedError: ms until the window resets — drives the Retry-After header (route-handler.ts:75). */
  retryAfterMs?: number;
  /** server-only diagnostic context (cause/service/op) — LOGGED by onError, never sent on the wire. */
  logContext?: unknown;
}

/**
 * A typed, throwable HTTP error. `tag` selects the status + title from the frozen core tables; the instance
 * renders to a Problem Details body via {@link toProblem}. Throw one from a handler; `onError()` maps it.
 */
export class SulukHttpError extends Error {
  readonly tag: ErrorTag;
  readonly instance?: string;
  readonly errors?: Record<string, unknown>;
  readonly problemType?: string;
  readonly retryAfterMs?: number;
  readonly logContext?: unknown;

  constructor(tag: ErrorTag, init: SulukHttpErrorInit = {}) {
    super(init.detail ?? TITLE_BY_TAG[tag]);
    this.name = tag;
    this.tag = tag;
    if (init.detail !== undefined) this.detail = init.detail;
    this.instance = init.instance;
    this.errors = init.errors;
    this.problemType = init.type;
    this.retryAfterMs = init.retryAfterMs;
    this.logContext = init.logContext;
  }

  /** the human `detail` (distinct from Error.message, which mirrors it for stack-trace readability). */
  readonly detail?: string;

  /** the HTTP status this error renders as (the frozen core mapping). */
  get status(): ProblemStatus {
    return PROBLEM_STATUS_TABLE[this.tag];
  }

  /** seconds for the Retry-After header (RateLimitedError only) — `ceil(retryAfterMs/1000)`, else undefined. */
  get retryAfterSeconds(): number | undefined {
    return this.retryAfterMs == null ? undefined : retryAfterSeconds({ windowMs: this.retryAfterMs });
  }

  /** render to the canonical RFC-9457 Problem Details body. */
  toProblem(): ProblemDetails {
    return toProblemDetails({
      tag: this.tag,
      detail: this.detail,
      instance: this.instance,
      errors: this.errors,
      type: this.problemType,
    });
  }
}

/**
 * Factory helpers mirroring saastarter's TaggedError set (errors.ts) with the SAME field semantics the route-handler
 * rendered (route-handler.ts:24-86). `externalService`/`internal` keep their detail GENERIC on the wire and stash
 * the cause in `logContext` (route-handler.ts:63,81 log it server-side, never leak it).
 */
export const HttpErrors = {
  /** 401 (route-handler.ts:26-30). */
  unauthorized: (detail?: string) => new SulukHttpError("UnauthorizedError", { detail }),
  /** 403 (route-handler.ts:32-36); `resource` becomes the instance. */
  forbidden: (detail?: string, resource?: string) =>
    new SulukHttpError("ForbiddenError", { detail, instance: resource }),
  /** 401 (route-handler.ts:38-39); the key reason is the detail. */
  invalidApiKey: (reason: string) => new SulukHttpError("InvalidApiKeyError", { detail: reason }),
  /** 400 (route-handler.ts:41-45); `details` → `errors`. */
  validation: (message: string, details?: Record<string, unknown>) =>
    new SulukHttpError("ValidationError", { detail: message, errors: details }),
  /** 404 (route-handler.ts:47-51); detail is `${resource} not found`, id → instance. */
  notFound: (resource: string, id?: string) =>
    new SulukHttpError("NotFoundError", { detail: `${resource} not found`, instance: id ? `${resource}/${id}` : undefined }),
  /** 409 (route-handler.ts:53-54). */
  conflict: (message: string) => new SulukHttpError("ConflictError", { detail: message }),
  /** 402 (route-handler.ts:56-57); optional Stripe-style `code` → errors. */
  payment: (message: string, code?: string) =>
    new SulukHttpError("PaymentError", { detail: message, errors: code ? { code } : undefined }),
  /** 400 (route-handler.ts:59-60); the discount code → errors, reason → detail. */
  invalidDiscount: (code: string, reason: string) =>
    new SulukHttpError("InvalidDiscountError", { detail: reason, errors: { code } }),
  /** 502 (route-handler.ts:62-67); GENERIC wire detail, cause logged only. */
  externalService: (service: string, operation: string, cause?: unknown) =>
    new SulukHttpError("ExternalServiceError", { logContext: { service, operation, cause } }),
  /** 429 (route-handler.ts:69-78); retryAfterMs drives the Retry-After header. */
  rateLimited: (retryAfterMs: number) =>
    new SulukHttpError("RateLimitedError", { retryAfterMs }),
  /** 500 (route-handler.ts:80-85); GENERIC wire detail, cause logged only. */
  internal: (message?: string, cause?: unknown) =>
    new SulukHttpError("PayloadOperationError", { logContext: message || cause ? { message, cause } : undefined }),
};
