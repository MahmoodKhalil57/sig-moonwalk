/**
 * onError — the Hono error handler that bridges a thrown typed error to the wire as RFC-9457 Problem Details.
 * The plain-Hono counterpart of saastarter's `handleRoute` catchAll/catchAllDefect (route-handler.ts:109-125):
 * a {@link SulukHttpError} maps to its declared status + body; ANY other throw is a defect → 500 internal (the
 * cause logged, never leaked). Wire it once with `app.onError(onError())`.
 */
import { PROBLEM_CONTENT_TYPE, toProblemDetails } from "@suluk/core";
import type { Context } from "hono";
import { SulukHttpError } from "./errors";

export interface OnErrorOptions {
  /** sink for server-only diagnostics (defaults to console.error). Receives (message, context). */
  log?: (message: string, context: unknown) => void;
}

type ErrorHandler = (err: Error, c: Context) => Response;

/** Build the Hono error handler. Every response carries `content-type: application/problem+json`. */
export function onError(opts: OnErrorOptions = {}): ErrorHandler {
  const log = opts.log ?? ((m, ctx) => console.error(m, ctx));
  return (err, c) => {
    if (err instanceof SulukHttpError) {
      if (err.logContext !== undefined) log(`${err.tag}:`, err.logContext); // external/internal causes (route-handler.ts:63,81)
      const headers: Record<string, string> = { "content-type": PROBLEM_CONTENT_TYPE };
      const retry = err.retryAfterSeconds;
      if (retry !== undefined) headers["retry-after"] = String(retry); // route-handler.ts:74-76
      return c.json(err.toProblem(), err.status, headers);
    }
    // an untyped throw is a defect — never leak it (route-handler.ts:117-122).
    log("Unhandled error in handler:", err);
    const body = toProblemDetails({ tag: "PayloadOperationError" });
    return c.json(body, body.status, { "content-type": PROBLEM_CONTENT_TYPE });
  };
}
