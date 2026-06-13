/**
 * The Class-B TIER OVERLAY — patches `intel.*` coarse tiers onto the facts-only catalog. Tiers are ADOPTED PUBLIC
 * PRIORS (cited + asOf-stamped), never our measured facts — we do not self-test. The real pass curates them from
 * BFCL/IFEval/SWE-bench/GPQA/RULER/MMLU-Pro/LMArena snapshots through `applyBucketing` (see REFRESH.md); this file
 * also ships a SMALL, conservative seed of well-established frontier standings so the catalog's intelligence
 * dimension isn't entirely UNKNOWN. UNKNOWN axes are left absent (NEVER imputed to worst).
 */
import type { ModelCatalog, Tier } from "./types";
import { catalogFrom } from "./normalize";

export type IntelAxis = "agenticToolUse" | "instructionFollowing" | "reasoning" | "coding" | "longCtxComprehension" | "knowledge" | "humanPreference";

/** Overlay coarse tiers onto matching rows' intel cells, then re-hash (selection now depends on these tiers). */
export function applyTierOverlay(catalog: ModelCatalog, tiers: Record<string, Partial<Record<IntelAxis, Tier>>>, opts: { source: string; asOf: string }): ModelCatalog {
  const rows = catalog.rows.map((r) => {
    const t = tiers[r.id];
    if (!t) return r;
    const intel = { ...r.intel };
    for (const axis of Object.keys(t) as IntelAxis[]) {
      const v = t[axis];
      if (v) intel[axis] = { value: v, source: opts.source, asOf: opts.asOf };
    }
    return { ...r, intel };
  });
  return catalogFrom(rows, catalog.generatedAt);
}

/**
 * A SMALL, conservatively-CITED seed of coarse public standings for headline frontier models (the bootstrap until
 * the full Class-B curation lands). These are adopted public-consensus priors at a LOW ceiling — verify at source;
 * tune at review. Absent axes stay UNKNOWN. Source stamped `public-leaderboard-consensus`.
 */
export const KNOWN_TIERS: Record<string, Partial<Record<IntelAxis, Tier>>> = {
  "anthropic/claude-opus-4.1": { agenticToolUse: "frontier", instructionFollowing: "frontier", reasoning: "frontier", coding: "frontier", knowledge: "frontier", humanPreference: "frontier" },
  "anthropic/claude-opus-4": { agenticToolUse: "frontier", instructionFollowing: "frontier", reasoning: "frontier", coding: "frontier", knowledge: "frontier", humanPreference: "frontier" },
  "anthropic/claude-sonnet-4.5": { agenticToolUse: "frontier", instructionFollowing: "frontier", reasoning: "strong", coding: "frontier", knowledge: "strong", humanPreference: "strong" },
  "google/gemini-2.5-pro": { agenticToolUse: "strong", instructionFollowing: "frontier", reasoning: "frontier", coding: "strong", longCtxComprehension: "frontier", knowledge: "frontier", humanPreference: "frontier" },
  "google/gemini-2.5-flash": { agenticToolUse: "strong", instructionFollowing: "strong", reasoning: "mid", coding: "strong", knowledge: "strong", humanPreference: "strong" },
  "openai/gpt-5": { agenticToolUse: "frontier", instructionFollowing: "frontier", reasoning: "frontier", coding: "frontier", knowledge: "frontier", humanPreference: "frontier" },
  "deepseek/deepseek-chat-v3.1": { agenticToolUse: "mid", instructionFollowing: "strong", reasoning: "strong", coding: "strong", knowledge: "strong", humanPreference: "strong" },
  "x-ai/grok-4.3": { agenticToolUse: "strong", instructionFollowing: "strong", reasoning: "frontier", coding: "strong", knowledge: "frontier", humanPreference: "strong" },
  "meta-llama/llama-4-maverick": { instructionFollowing: "mid", reasoning: "mid", coding: "mid", knowledge: "strong", humanPreference: "mid" },
};
