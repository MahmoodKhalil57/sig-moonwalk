/**
 * Background-event cost (C024 runtime counterpart). The request meter (meter.ts) is Hono-Context-bound —
 * `principalOf(c: Context)` reads a live caller. A FIRED event (a Stripe webhook, a cron tick, a queue message)
 * has NO such Context, so this is the separate Context-free path the council flagged: given the fired event payload
 * + the operation's declared cost model (with its `trigger` / `attribution` / `idempotencyKey`), it resolves WHO
 * pays (the runtime attribution expression — never the static matcher) and a DEDUPE key, and builds the CostEvent.
 *
 * Pure + reproducible: `at` is passed in, the event payload is the only input, nothing reads ambient state.
 */
import { computeCost } from "./contract";
import { UNATTRIBUTED, type CostModel, type CostEvent, type UsageReport } from "./types";
import type { CostSink } from "./meter";

/**
 * Resolve a C018 runtime-expression against a fired event. Supports `{$event.id}`, `{$event.<key>}`, and a
 * JSON-Pointer tail `{$event.body#/customer}` / `{$event.body#/data/object/customer}`. Returns the stringified
 * value, or undefined when it doesn't resolve. Pure; never throws (an unresolvable expression is undefined, not an error).
 */
export function resolveEventExpression(expression: string, event: Record<string, unknown>): string | undefined {
  const m = /^\{\$event\.([^}]+)\}$/.exec(expression.trim());
  if (!m) return undefined;
  const [base, pointer] = m[1].split("#");
  let node: unknown = base ? (event as Record<string, unknown>)[base] : event;
  if (pointer) {
    for (const raw of pointer.split("/").filter(Boolean)) {
      const seg = raw.replace(/~1/g, "/").replace(/~0/g, "~"); // JSON-Pointer unescape
      if (node && typeof node === "object") node = (node as Record<string, unknown>)[seg];
      else return undefined;
    }
  }
  return node == null ? undefined : String(node);
}

/**
 * Resolve the principal charged for a fired event per the model's attribution strategy. Returns the `@unattributed`
 * sentinel (never silent) when nothing resolves: `session`/`job-stamped` use the supplied principal; `event-expression`
 * reads it from the payload. NOTE: an `event-expression` with `trust !== "verified"` is attacker-controllable — the
 * caller MUST gate it behind a verified webhook signature before trusting the result for billing.
 */
export function attributePrincipal(model: CostModel, event: Record<string, unknown>, suppliedPrincipal?: string): string {
  const attr = model.attribution;
  if (!attr || attr.strategy === "session" || attr.strategy === "job-stamped") return suppliedPrincipal ?? UNATTRIBUTED;
  if (attr.strategy === "event-expression" && attr.expression) return resolveEventExpression(attr.expression, event) ?? UNATTRIBUTED;
  return UNATTRIBUTED;
}

export interface EventCostInput {
  /** the operation name whose cost fired (the webhook/op by-name handle). */
  operation: string;
  /** its declared cost model (carrying trigger / attribution / idempotencyKey). */
  model: CostModel;
  /** the fired event payload. */
  event: Record<string, unknown>;
  /** wall-clock ms (passed in — reproducible). */
  at: number;
  /** any metered third-party usage the handler measured. */
  usage?: UsageReport[];
  /** for `session`/`job-stamped` attribution: the principal the job/session carries. */
  suppliedPrincipal?: string;
}

/**
 * Resolve the ACTUAL charged amount (in µ$) from the event when the model is `payload-reconciled` (C026), else
 * undefined. Reads the runtime amount-expression (e.g. the Stripe event amount) and converts from its declared unit
 * — so the recorded cost is the third party's real invoice line, not the operator's declared estimate.
 */
export function reconciledAmount(model: CostModel, event: Record<string, unknown>): number | undefined {
  if (model.reconciliationBasis !== "payload-reconciled" || !model.amountExpression) return undefined;
  const raw = resolveEventExpression(model.amountExpression, event);
  const n = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const unit = model.amountUnit ?? "micro-usd";
  return Math.round(unit === "cents" ? n * 10_000 : unit === "usd" ? n * 1_000_000 : n);
}

/** Build the CostEvent for a FIRED background event — pure. Stamps the trigger, resolves principal + dedupeKey,
 *  and (C026) uses the payload-reconciled amount as the authoritative total when the model declares one. */
export function eventCostEvent(input: EventCostInput): CostEvent {
  let { breakdown, totalMicroUsd } = computeCost(input.model, input.usage ?? []);
  const reconciled = reconciledAmount(input.model, input.event);
  if (reconciled !== undefined) {
    const source = input.model.components[0]?.source ?? "reconciled";
    breakdown = [{ source, microUsd: reconciled }]; // the actual charge replaces the estimate
    totalMicroUsd = reconciled;
  }
  const dedupeKey = input.model.idempotencyKey ? resolveEventExpression(input.model.idempotencyKey, input.event) : undefined;
  return {
    at: input.at,
    operation: input.operation,
    principal: attributePrincipal(input.model, input.event, input.suppliedPrincipal),
    trigger: input.model.trigger ?? "synchronous",
    ...(dedupeKey ? { dedupeKey } : {}),
    ...(reconciled !== undefined ? { reconciled: true } : {}),
    breakdown,
    totalMicroUsd,
  };
}

/**
 * Record a fired event's cost into a sink, deduped by its `dedupeKey` against `seen` (so at-least-once delivery
 * can't double-charge). Returns the recorded event, or null when it was a duplicate. `seen` is the app's dedup
 * store (an in-memory Set for dev; a durable KV/DO for prod).
 */
export async function recordEventCost(sink: CostSink, input: EventCostInput, seen?: Set<string>): Promise<CostEvent | null> {
  const event = eventCostEvent(input);
  if (event.dedupeKey && seen) {
    if (seen.has(event.dedupeKey)) return null; // already recorded — at-least-once delivery
    seen.add(event.dedupeKey);
  }
  await sink.record(event);
  return event;
}
