/**
 * The TIER BUCKETING RULES (metrics-council red-line `wf_729cde52-cc7`) — a DOCUMENTED, COMMITTED mapping from a
 * published leaderboard metric to a coarse tier, per INTEL axis. Without this the tiers are un-auditable and not
 * weekly-maintainable (the minimalist red-line). The VALUE is that the mapping is EXPLICIT + CITED + reproducible —
 * not that a boundary is exact (tune at review). `applyBucketing` is a pure function the Class-B tier pass calls.
 *
 * Scores are the published metric normalized to [0,1] (accuracy/pass-rate), EXCEPT human-preference which is raw
 * LMArena Elo. A null/absent score ⇒ `unknown` (NEVER imputed to worst — that would kill new models).
 */
import type { Tier } from "./types";

export interface AxisRule {
  /** the public leaderboard(s) this axis is bucketed from (cited in every cell's `source`). */
  source: string;
  /** what the score means (so a reviewer can reproduce the bucketing). */
  metric: string;
  /** score >= frontier ⇒ frontier; >= strong ⇒ strong; >= mid ⇒ mid; else basic. */
  boundaries: { frontier: number; strong: number; mid: number };
}

export const BUCKETING_RULES: Record<string, AxisRule> = {
  agenticToolUse: { source: "bfcl-v3 + tau-bench", metric: "BFCL overall accuracy (tau-bench corroborates)", boundaries: { frontier: 0.85, strong: 0.70, mid: 0.50 } },
  instructionFollowing: { source: "ifeval", metric: "IFEval strict prompt+instruction accuracy", boundaries: { frontier: 0.88, strong: 0.78, mid: 0.65 } },
  reasoning: { source: "gpqa-diamond + aime", metric: "GPQA-Diamond accuracy (AIME corroborates)", boundaries: { frontier: 0.70, strong: 0.55, mid: 0.40 } },
  coding: { source: "swe-bench-verified", metric: "SWE-bench-Verified resolved % (HumanEval secondary)", boundaries: { frontier: 0.60, strong: 0.45, mid: 0.30 } },
  longCtxComprehension: { source: "ruler-128k", metric: "RULER avg accuracy @128k (needle corroborates)", boundaries: { frontier: 0.90, strong: 0.80, mid: 0.65 } },
  knowledge: { source: "mmlu-pro", metric: "MMLU-Pro accuracy (saturation-flagged)", boundaries: { frontier: 0.80, strong: 0.70, mid: 0.55 } },
  humanPreference: { source: "lmarena", metric: "LMArena overall Elo (style-confounded — cross-witness only)", boundaries: { frontier: 1350, strong: 1250, mid: 1150 } },
};

/** Bucket a raw leaderboard score into a coarse tier per the committed rule. Null/absent/unknown-axis ⇒ `unknown`. */
export function applyBucketing(axis: string, score: number | null | undefined): Tier {
  const rule = BUCKETING_RULES[axis];
  if (!rule || score === null || score === undefined || Number.isNaN(score)) return "unknown";
  if (score >= rule.boundaries.frontier) return "frontier";
  if (score >= rule.boundaries.strong) return "strong";
  if (score >= rule.boundaries.mid) return "mid";
  return "basic";
}
