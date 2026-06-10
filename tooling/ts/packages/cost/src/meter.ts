/**
 * The runtime meter — records what each request ACTUALLY cost, attributed all the way down: the frontend
 * action (a header the client sets) → the operation → the per-source breakdown (declared model + the
 * third-party usage the handler reported). Records go to a pluggable sink; we display them raw.
 */
import type { Context, MiddlewareHandler } from "hono";
import type { CostModel, CostEvent, UsageReport } from "./types";
import { computeCost } from "./contract";

export interface CostSink {
  record(event: CostEvent): void | Promise<void>;
}

/** A simple in-memory sink (for the demo / tests). Production swaps in D1, a queue, etc. */
export class MemoryCostSink implements CostSink {
  private _events: CostEvent[] = [];
  record(e: CostEvent): void { this._events.push(e); }
  events(): CostEvent[] { return this._events.slice(); }
  clear(): void { this._events = []; }
}

const USAGE_KEY = "suluk-cost-usage";

/** A handler calls this to report MEASURED third-party usage for the current request (e.g. tokens used). */
export function recordUsage(c: Context, source: string, units: number): void {
  const arr = (c.get(USAGE_KEY) as UsageReport[] | undefined) ?? [];
  arr.push({ source, units });
  c.set(USAGE_KEY, arr);
}

export interface CostMeterOptions {
  sink: CostSink;
  /** operation name → its declared cost model. */
  costs: Record<string, CostModel>;
  /** Resolve the operation name for a request (e.g. c.get("operation"), or a matcher). */
  operationOf: (c: Context) => string | undefined;
  /** Resolve the principal/user id (default: none). */
  principalOf?: (c: Context) => string | undefined;
  /** Header carrying the frontend action id (default "x-suluk-action"). */
  actionHeader?: string;
  /** Wall-clock now (ms). Pass `() => Date.now()` in production; a fixed fn in tests for reproducibility. */
  now?: () => number;
}

/** Hono middleware: after the handler runs, record what the request cost (declared model + reported usage). */
export function costMeter(opts: CostMeterOptions): MiddlewareHandler {
  const actionHeader = opts.actionHeader ?? "x-suluk-action";
  const now = opts.now ?? (() => Date.now());
  return async (c, next) => {
    await next();
    const operation = opts.operationOf(c);
    if (!operation) return;
    const usage = (c.get(USAGE_KEY) as UsageReport[] | undefined) ?? [];
    const { breakdown, totalMicroUsd } = computeCost(opts.costs[operation], usage);
    const event: CostEvent = {
      at: now(),
      operation,
      principal: opts.principalOf?.(c),
      action: c.req.header(actionHeader) || undefined,
      breakdown,
      totalMicroUsd,
    };
    await opts.sink.record(event);
  };
}
