/**
 * The cost model — what an operation declares it costs you, and what a single request actually cost.
 *
 * All money is integer **micro-USD** (1 USD = 1_000_000 µ$). Integers avoid float drift and are the rawest
 * possible representation — we display the data AS IT IS and let consumers build pricing on top. A cost has
 * COMPONENTS, each tied to a source (a third party, compute, egress, …) and a basis (per-call vs per-unit),
 * so the actual cost of a request is the fixed components plus the metered usage of the variable ones.
 */

export type CostBasis =
  | "per-call" // a flat cost each time the operation runs
  | "per-unit" // generic metered unit (you report how many)
  | "per-token"
  | "per-1k-tokens"
  | "per-second"
  | "per-request" // to a third party (e.g. one downstream API call)
  | "per-mb";

export interface CostComponent {
  /** Where the money goes: "openai", "compute", "egress", "twilio", … (free-form, your taxonomy). */
  source: string;
  basis: CostBasis;
  /** Cost per one unit of `basis`, in micro-USD. */
  microUsd: number;
  description?: string;
}

/**
 * WHEN/WHAT fires a cost (C024) — a STATIC, locally-decidable enum (the same KIND as {@link CostBasis}). Default
 * "synchronous" ⇒ every existing declaration is unchanged (zero migration). Strictly DESCRIPTIVE: it names where the
 * cost accrues, asserting NO event-channel / delivery-protocol semantics — the fence that keeps it orthogonal to
 * C018's deliberately-deferred async scope. Three axes stay orthogonal: `basis` = HOW it meters, `trigger` = WHEN it
 * fires, `attribution` = WHO pays.
 */
export type CostTrigger =
  | "synchronous"        // accrues when this operation's own route runs (default; backwards-compatible)
  | "webhook-received"   // accrues when an incoming webhook (C018) fires
  | "scheduled"          // accrues when a scheduled / cron job runs
  | "queue-consumed"     // accrues when a queue consumer processes a message
  | "callback-completed"; // accrues when an out-of-band callback (C018) completes

/**
 * WHO is charged when a third party fires the event with no live session (C024) — a declared STRATEGY the runtime
 * resolves a concrete principal from, modeled on `SulukRateLimit.key`. The `expression` is RUNTIME-ONLY: a C018
 * runtime-expression that NEVER enters the static matcher (D1-consistent, exactly as C018 walls its callback keys).
 */
export interface CostAttribution {
  /** session = the live caller (the existing path); event-expression = read the principal from the event payload at
   *  runtime; job-stamped = the job carries its own principal. */
  strategy: "session" | "event-expression" | "job-stamped";
  /** for event-expression: a C018 runtime-expression (e.g. "{$event.body#/customer}"). Runtime-resolved only. */
  expression?: string;
  /** is the attribution input authentic? An event-expression off an UNVERIFIED webhook payload is attacker-controlled
   *  — honor it as authoritative only when "verified" (a signature/secret check the runtime performs). */
  trust?: "verified" | "unverified-payload";
}

export interface CostModel {
  components: CostComponent[];
  /** Optional typical total for one call (µ$), for display + tests when usage isn't yet known. */
  estimateMicroUsd?: number;
  /** WHEN/WHAT fires this cost (C024; default "synchronous"). STATIC — decouples accrual-time from the declaring op. */
  trigger?: CostTrigger;
  /** the by-name handle (C009) of the webhook/callback/op whose firing accrues this cost (for a non-sync trigger). */
  triggerRef?: string;
  /** WHO is charged when there is no live session (runtime strategy; the expression never enters the static matcher). */
  attribution?: CostAttribution;
  /** a runtime-expression yielding a stable id to DEDUPE at-least-once delivery (e.g. "{$event.id}") — prevents
   *  double-counting a cost charged on both the receipt op and the triggered op. Runtime-only. */
  idempotencyKey?: string;
}

/** The principal sentinel for a background cost that resolved to NO principal — billed to nobody, but never silent. */
export const UNATTRIBUTED = "@unattributed" as const;

/** A measured usage report for one variable component during a request (e.g. {source:"openai", units: 1350}). */
export interface UsageReport {
  source: string;
  units: number;
}

/** What a single request actually cost — the rawest record, attributed all the way down. */
export interface CostEvent {
  /** Wall-clock ms (an input, never read ambiently — pass it in, so events are reproducible/testable). */
  at: number;
  /** Who incurred it (the principal/user id), if known. */
  principal?: string;
  /** Which operation (the v4 by-name handle). */
  operation: string;
  /** The frontend action that triggered it (a button-click id), if the client tagged the request. */
  action?: string;
  /** How this cost fired (C024; default "synchronous"). A non-sync value marks a background charge. */
  trigger?: CostTrigger;
  /** Dedupe id for at-least-once event delivery — two events with the same key are the SAME charge (C024). */
  dedupeKey?: string;
  /** Per-source breakdown (µ$). */
  breakdown: { source: string; microUsd: number }[];
  /** Total µ$ for the request. */
  totalMicroUsd: number;
}

/** Format micro-USD as a display string (we store raw integers; this is only for humans). */
export function formatMicroUsd(microUsd: number): string {
  return `$${(microUsd / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
}
