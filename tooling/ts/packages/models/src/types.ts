/**
 * @suluk/models — the catalog schema (council wf_729cde52-cc7). A row is one model+provider endpoint. Decidable
 * OpenRouter facts are NUMBERS/BOOLS; noisy third-party benchmarks are COARSE TIERS (frontier/strong/mid/basic/
 * unknown) — never a 2-decimal score (that launders noisy/contaminated public data as precision). Every cell carries
 * {source, asOf}; an unsourced cell is MISSING, never a confident value, and a missing tier is NEVER imputed to
 * worst (that would kill new models). The catalog stores NO cross-axis composite — blending is the selector's job
 * at query time under explicit operator weights (storing a blend launders preference as fact).
 */

export type Tier = "frontier" | "strong" | "mid" | "basic" | "unknown";

/** One catalog value with provenance. `value: null` ⇒ UNKNOWN (and `source` is ""); never imputed. */
export interface Cell<T> { value: T | null; source: string; asOf: string }

export type DataRetention = "zero" | "ephemeral" | "logged" | "trains" | "unknown";

export interface ModelRecord {
  /** the OpenRouter id the selector compiles against (stable wire id). */
  id: string;
  provider: string;
  family: string;
  status: "active" | "deprecated" | "sunset" | "preview";
  cost: {
    inputPerMtok: Cell<number>;
    outputPerMtok: Cell<number>;
    cachedInputPerMtok: Cell<number>;
    perRequest: Cell<boolean>;
  };
  context: {
    maxWindow: Cell<number>;
    maxOutput: Cell<number>;
    /** RULER/needle — does the big window actually hold quality? sparse public data ⇒ mostly unknown; NEVER inferred from size. */
    longCtxFidelity: Cell<Tier>;
  };
  /** Artificial-Analysis single-vendor, provider/route/load-dependent — their measurement, not a guarantee. */
  speed: { ttft: Cell<Tier>; throughput: Cell<Tier> };
  /** capabilities are DECLARED-not-verified (provider self-report; we do not self-test). */
  caps: {
    toolCalling: Cell<boolean>;
    forcedToolChoice: Cell<boolean>;
    parallelToolCalls: Cell<boolean>;
    structuredOutput: Cell<boolean>;
    jsonSchemaStrict: Cell<boolean>;
    inputModalities: Cell<string[]>;
    outputModalities: Cell<string[]>;
  };
  /** "intelligence" split into 6 orthogonal-ish, source-separated dimensions (ranked by relevance to tool-using agents). */
  intel: {
    agenticToolUse: Cell<Tier>;       // BFCL + tau-bench — rank 1 for suluk agents; thinnest coverage
    instructionFollowing: Cell<Tier>; // IFEval
    reasoning: Cell<Tier>;            // GPQA-Diamond + AIME
    coding: Cell<Tier>;               // SWE-bench-Verified (HumanEval secondary)
    longCtxComprehension: Cell<Tier>; // RULER (same datum as context.longCtxFidelity)
    knowledge: Cell<Tier>;            // MMLU-Pro (saturation-flagged)
    humanPreference: Cell<Tier>;      // LMArena — a SEPARATE cross-witness axis, never summed into a capability tier
  };
  gov: { dataRetention: Cell<DataRetention>; region: Cell<string>; license: Cell<string> };
  ops: { providerFanOut: Cell<number>; popularityRank: Cell<number>; releaseDate: Cell<string>; priceVolatile: Cell<boolean> };
}

export interface ModelCatalog {
  schemaVersion: string;
  generatedAt: string;
  /** content-addressed so a selection is reproducible week-over-week (ties C027 contentHash). */
  snapshotHash: string;
  rows: ModelRecord[];
}

/** Hard requirements — these FILTER (can empty the set ⇒ fail-loud), never rank. */
export interface HardFilters {
  needsTools?: boolean;
  needsForcedToolChoice?: boolean;
  needsStructured?: boolean;
  strictSchema?: boolean;
  inputModalities?: string[];
  outputModalities?: string[];
  /** the analyzer's per-agent minWindowRequired (context.ts) becomes the hard min-context gate. */
  minWindowRequired?: number;
  minOutputTokens?: number;
  fidelityFloor?: Tier;
  maxInputPrice?: number;
  maxOutputPrice?: number;
  /** C028 governance/allowlist — the TERMINAL, non-overridable MEET (a preference can NEVER widen these). */
  policy?: { modelAllowlist?: string[]; allowedRegions?: string[]; allowedLicenses?: string[]; allowedRetention?: DataRetention[] };
}

export type Profile = "tool-reliable" | "cheap-fast" | "balanced" | "max-reasoning" | "long-context" | "vision";

/** Preference — RANKS the survivors. A named profile is the 90% case; the escape hatch is ≤4 small int weights. */
export interface Preferences {
  profile?: Profile;
  prefer?: { intelligence?: 0 | 1 | 2 | 3; cost?: 0 | 1 | 2 | 3; speed?: 0 | 1 | 2 | 3; context?: 0 | 1 | 2 | 3 };
  /** routes the single "intelligence" knob to the ONE relevant INTEL sub-tier. */
  taskShape?: "agentic" | "coding" | "reasoning";
}

export interface RankedModel {
  id: string;
  provider: string;
  score: number;
  why: {
    passedFilters: string[];
    decidingPreference: string;
    tierByAxis: Record<string, { tier: Tier | string; source: string; asOf: string }>;
  };
}

export interface SelectResult {
  /** ranked best-first; empty when no model satisfies the hard filters. */
  ranked: RankedModel[];
  /** the count after hard filtering. */
  candidateCount: number;
  /** present when the requirements emptied the set — names the unsatisfiable filter(s). */
  unsatisfiable?: string[];
  /** UNKNOWN-coverage warning: soft axes with no data on the winner (honesty surface). */
  coverageGaps: string[];
}
