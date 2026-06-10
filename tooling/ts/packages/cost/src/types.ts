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

export interface CostModel {
  components: CostComponent[];
  /** Optional typical total for one call (µ$), for display + tests when usage isn't yet known. */
  estimateMicroUsd?: number;
}

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
  /** Per-source breakdown (µ$). */
  breakdown: { source: string; microUsd: number }[];
  /** Total µ$ for the request. */
  totalMicroUsd: number;
}

/** Format micro-USD as a display string (we store raw integers; this is only for humans). */
export function formatMicroUsd(microUsd: number): string {
  return `$${(microUsd / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
}
