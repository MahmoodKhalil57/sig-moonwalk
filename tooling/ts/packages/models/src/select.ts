/**
 * selectModel — requirements FILTER first (capabilities + context + governance + the C028 allowlist MEET; can empty
 * the set ⇒ FAIL LOUD naming the unsatisfiable filter), then preferences RANK the survivors over coarse tiers.
 * A preference can NEVER widen a hard filter (the operator/C028 set is terminal). UNKNOWN is a soft penalty, never
 * worst. Output carries a "why this model" explainer — adoption dies if selection is a black box.
 */
import type { Cell, HardFilters, ModelCatalog, ModelRecord, Preferences, RankedModel, SelectResult, Tier } from "./types";
import { PROFILES } from "./profiles";

const TIER_SCORE: Record<Tier, number> = { frontier: 4, strong: 3, mid: 2, basic: 1, unknown: 1.5 };
const TIER_RANK: Record<Exclude<Tier, "unknown">, number> = { frontier: 4, strong: 3, mid: 2, basic: 1 };
const scoreTier = (c: Cell<Tier>): number => TIER_SCORE[c.value ?? "unknown"];
const isTrue = (c: Cell<boolean>): boolean => c.value === true; // fail-closed: unknown/false does not satisfy
const supersetOf = (have: Cell<string[]>, need: string[]): boolean => !!have.value && need.every((m) => have.value!.includes(m));

/** Resolve a profile + escape-hatch into concrete weights + implied filters + taskShape. */
function resolvePrefs(prefs: Preferences): { w: { intelligence: number; cost: number; speed: number; context: number }; taskShape?: Preferences["taskShape"]; implied: Partial<HardFilters> } {
  const base = prefs.profile ? PROFILES[prefs.profile] : { prefer: { intelligence: 2, cost: 2, speed: 1, context: 1 }, impliedFilters: {}, taskShape: undefined as Preferences["taskShape"] };
  const w = { ...base.prefer, ...(prefs.prefer ?? {}) };
  return { w, taskShape: prefs.taskShape ?? base.taskShape, implied: base.impliedFilters };
}

/** Merge author requirements with a profile's implied filters (author can ADD but the operator policy is terminal). */
function mergeFilters(reqs: HardFilters, implied: Partial<HardFilters>): HardFilters {
  return { ...implied, ...reqs, policy: reqs.policy ?? implied.policy };
}

interface FilterTrace { passed: string[]; failed: string | null }
function checkFilters(m: ModelRecord, f: HardFilters): FilterTrace {
  const passed: string[] = [];
  const need = (ok: boolean, label: string): string | null => { if (ok) { passed.push(label); return null; } return label; };
  // capabilities (declared-not-verified; fail-closed on unknown)
  const checks: Array<[boolean | undefined, () => boolean, string]> = [
    [f.needsTools, () => isTrue(m.caps.toolCalling), "tool-calling"],
    [f.needsForcedToolChoice, () => isTrue(m.caps.forcedToolChoice), "forced-tool-choice"],
    [f.needsStructured, () => isTrue(m.caps.structuredOutput), "structured-output"],
    [f.strictSchema, () => isTrue(m.caps.jsonSchemaStrict), "strict-schema"],
  ];
  for (const [req, test, label] of checks) if (req) { const fail = need(test(), label); if (fail) return { passed, failed: fail }; }
  if (f.inputModalities?.length) { const fail = need(supersetOf(m.caps.inputModalities, f.inputModalities), `input-modalities[${f.inputModalities.join(",")}]`); if (fail) return { passed, failed: fail }; }
  if (f.outputModalities?.length) { const fail = need(supersetOf(m.caps.outputModalities, f.outputModalities), `output-modalities[${f.outputModalities.join(",")}]`); if (fail) return { passed, failed: fail }; }
  // context — minWindow fail-closed on unknown (don't claim a fit we can't prove)
  if (f.minWindowRequired !== undefined) { const fail = need(m.context.maxWindow.value !== null && m.context.maxWindow.value >= f.minWindowRequired, `min-window>=${f.minWindowRequired}`); if (fail) return { passed, failed: fail }; }
  if (f.minOutputTokens !== undefined && m.context.maxOutput.value !== null) { const fail = need(m.context.maxOutput.value >= f.minOutputTokens, `min-output>=${f.minOutputTokens}`); if (fail) return { passed, failed: fail }; }
  if (f.fidelityFloor && m.context.longCtxFidelity.value && m.context.longCtxFidelity.value !== "unknown") { const fail = need(TIER_RANK[m.context.longCtxFidelity.value] >= TIER_RANK[f.fidelityFloor as Exclude<Tier, "unknown">], `fidelity>=${f.fidelityFloor}`); if (fail) return { passed, failed: fail }; }
  // price caps (price is always known from OpenRouter)
  if (f.maxInputPrice !== undefined) { const fail = need(m.cost.inputPerMtok.value !== null && m.cost.inputPerMtok.value <= f.maxInputPrice, `input-price<=${f.maxInputPrice}`); if (fail) return { passed, failed: fail }; }
  if (f.maxOutputPrice !== undefined) { const fail = need(m.cost.outputPerMtok.value !== null && m.cost.outputPerMtok.value <= f.maxOutputPrice, `output-price<=${f.maxOutputPrice}`); if (fail) return { passed, failed: fail }; }
  // governance — FAIL-CLOSED (unknown excluded), C028
  const p = f.policy;
  if (p?.allowedRegions?.length) { const fail = need(!!m.gov.region.value && p.allowedRegions.includes(m.gov.region.value), "region"); if (fail) return { passed, failed: fail }; }
  if (p?.allowedLicenses?.length) { const fail = need(!!m.gov.license.value && p.allowedLicenses.includes(m.gov.license.value), "license"); if (fail) return { passed, failed: fail }; }
  if (p?.allowedRetention?.length) { const fail = need(m.gov.dataRetention.value !== null && p.allowedRetention.includes(m.gov.dataRetention.value), "data-retention"); if (fail) return { passed, failed: fail }; }
  // the TERMINAL allowlist MEET (a model outside a non-empty allowlist is excluded on ANY grounds)
  if (p?.modelAllowlist?.length) { const fail = need(p.modelAllowlist.includes(m.id), "policy-allowlist"); if (fail) return { passed, failed: fail }; }
  // liveness
  { const fail = need(m.status === "active", "status-active"); if (fail) return { passed, failed: fail }; }
  return { passed, failed: null };
}

/** The intelligence sub-tier the preference points at (taskShape routes the single knob; default = agentic for agents). */
function intelCell(m: ModelRecord, taskShape?: Preferences["taskShape"]): Cell<Tier> {
  if (taskShape === "coding") return m.intel.coding;
  if (taskShape === "reasoning") return m.intel.reasoning;
  if (taskShape === "agentic") return m.intel.agenticToolUse;
  // default: prefer the agentic tier, fall back to instruction-following then reasoning
  return m.intel.agenticToolUse.value !== null ? m.intel.agenticToolUse : m.intel.instructionFollowing.value !== null ? m.intel.instructionFollowing : m.intel.reasoning;
}

const blendedPrice = (m: ModelRecord): number => (m.cost.inputPerMtok.value ?? 0) * 0.75 + (m.cost.outputPerMtok.value ?? 0) * 0.25;
/** Normalize a raw numeric across the candidate pool into [1,4]; `higherBetter=false` inverts (cheaper→higher). */
function norm(values: number[], v: number, higherBetter: boolean): number {
  const min = Math.min(...values), max = Math.max(...values);
  if (max === min) return 2.5;
  const t = (v - min) / (max - min);
  return 1 + 3 * (higherBetter ? t : 1 - t);
}

export function selectModel(reqs: HardFilters, prefs: Preferences, catalog: ModelCatalog): SelectResult {
  const { w, taskShape, implied } = resolvePrefs(prefs);
  const filters = mergeFilters(reqs, implied);

  const survivors: { m: ModelRecord; passed: string[] }[] = [];
  const excludedBy = new Map<string, number>();
  for (const m of catalog.rows) {
    const t = checkFilters(m, filters);
    if (t.failed) excludedBy.set(t.failed, (excludedBy.get(t.failed) ?? 0) + 1);
    else survivors.push({ m, passed: t.passed });
  }

  if (survivors.length === 0) {
    const unsatisfiable = [...excludedBy.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (excluded ${n})`);
    return { ranked: [], candidateCount: 0, unsatisfiable, coverageGaps: [] };
  }

  const prices = survivors.map((s) => blendedPrice(s.m));
  const headrooms = survivors.map((s) => (s.m.context.maxWindow.value ?? 0) - (filters.minWindowRequired ?? 0));

  const ranked: RankedModel[] = survivors.map((s, i) => {
    const intel = intelCell(s.m, taskShape);
    const g = {
      intelligence: scoreTier(intel),
      cost: norm(prices, prices[i], false),
      speed: scoreTier(s.m.speed.ttft),
      context: norm(headrooms, headrooms[i], true),
    };
    const score = w.intelligence * g.intelligence + w.cost * g.cost + w.speed * g.speed + w.context * g.context;
    const tierByAxis: RankedModel["why"]["tierByAxis"] = {
      intelligence: { tier: intel.value ?? "unknown", source: intel.source, asOf: intel.asOf },
      latency: { tier: s.m.speed.ttft.value ?? "unknown", source: s.m.speed.ttft.source, asOf: s.m.speed.ttft.asOf },
      cost: { tier: `${blendedPrice(s.m).toFixed(2)} $/Mtok blended`, source: s.m.cost.inputPerMtok.source, asOf: s.m.cost.inputPerMtok.asOf },
    };
    const decidingPreference = (["intelligence", "cost", "speed", "context"] as Array<keyof typeof w>).sort((a, b) => w[b] - w[a])[0];
    return { id: s.m.id, provider: s.m.provider, score, why: { passedFilters: s.passed, decidingPreference: `${decidingPreference} (weight ${w[decidingPreference]})`, tierByAxis } };
  }).sort((a, b) => b.score - a.score);

  // coverage gaps on the winner — soft axes with no data (honesty surface)
  const winner = survivors.find((s) => s.m.id === ranked[0].id)!.m;
  const coverageGaps: string[] = [];
  if (intelCell(winner, taskShape).value === null) coverageGaps.push("intelligence (no public tier for this taskShape)");
  if (winner.speed.ttft.value === null) coverageGaps.push("latency");
  if (winner.context.longCtxFidelity.value === null && (filters.minWindowRequired ?? 0) > 200000) coverageGaps.push("long-context-fidelity (large window, unverified)");

  return { ranked, candidateCount: survivors.length, coverageGaps };
}

/** Derive HardFilters from an agent/skill's declared needs + the analyzer's load (the C027 seam). */
export function deriveRequirements(input: { minWindowRequired?: number; hasRoutes?: boolean; needsStructured?: boolean; inputModalities?: string[]; policy?: HardFilters["policy"] }): HardFilters {
  return {
    ...(input.hasRoutes ? { needsTools: true } : {}),
    ...(input.minWindowRequired !== undefined ? { minWindowRequired: input.minWindowRequired } : {}),
    ...(input.needsStructured ? { needsStructured: true } : {}),
    ...(input.inputModalities?.length ? { inputModalities: input.inputModalities } : {}),
    ...(input.policy ? { policy: input.policy } : {}),
  };
}
