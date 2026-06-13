/**
 * SEED catalog — a small, hand-curated set of headline models so the selector + the agent seam can be built and
 * tested BEFORE the weekly fetcher exists (see REFRESH.md). These cells are illustrative public-knowledge values
 * stamped `asOf`; the real catalog is a generated, content-addressed artifact from OpenRouter (facts) + periodic
 * benchmark tiers (see REFRESH.md). Tiers are coarse and source-cited; UNKNOWN is honest, never imputed.
 */
import type { Cell, ModelCatalog, ModelRecord, Tier, DataRetention } from "./types";

const ASOF = "2026-06-13";
const OR = "openrouter.api";          // decidable facts (price, context, caps, modalities, ops)
const AA = "artificialanalysis.ai";   // single-vendor speed + composite (provider/load-dependent)
const num = (value: number | null, source = OR): Cell<number> => ({ value, source: value === null ? "" : source, asOf: ASOF });
const flag = (value: boolean | null, source = OR): Cell<boolean> => ({ value, source: value === null ? "" : source, asOf: ASOF });
const tier = (value: Tier | null, source: string): Cell<Tier> => ({ value, source: value === null ? "" : source, asOf: ASOF });
const mods = (value: string[] | null): Cell<string[]> => ({ value, source: value === null ? "" : OR, asOf: ASOF });
const str = <T extends string>(value: T | null, source: string): Cell<T> => ({ value, source: value === null ? "" : source, asOf: ASOF });
const U = null; // UNKNOWN shorthand

interface Spec {
  id: string; provider: string; family: string; status?: ModelRecord["status"];
  inP: number; outP: number; cachedP?: number | null;
  win: number; out?: number | null; fidelity?: Tier | null;
  ttft?: Tier | null; tput?: Tier | null;
  tool?: boolean; forced?: boolean; parallel?: boolean; structured?: boolean; strict?: boolean;
  inMod?: string[]; outMod?: string[];
  agentic?: Tier | null; instruct?: Tier | null; reasoning?: Tier | null; coding?: Tier | null; longctx?: Tier | null; knowledge?: Tier | null; humanpref?: Tier | null;
  retention?: DataRetention; region?: string | null; license?: string | null;
  fanout?: number; popularity?: number | null; released?: string | null; volatile?: boolean;
}
const mk = (s: Spec): ModelRecord => ({
  id: s.id, provider: s.provider, family: s.family, status: s.status ?? "active",
  cost: { inputPerMtok: num(s.inP), outputPerMtok: num(s.outP), cachedInputPerMtok: num(s.cachedP ?? U), perRequest: flag(false) },
  context: { maxWindow: num(s.win), maxOutput: num(s.out ?? U), longCtxFidelity: tier(s.fidelity ?? U, "ruler.public") },
  speed: { ttft: tier(s.ttft ?? U, AA), throughput: tier(s.tput ?? U, AA) },
  caps: {
    toolCalling: flag(s.tool ?? false), forcedToolChoice: flag(s.forced ?? false), parallelToolCalls: flag(s.parallel ?? false),
    structuredOutput: flag(s.structured ?? false), jsonSchemaStrict: flag(s.strict ?? false),
    inputModalities: mods(s.inMod ?? ["text"]), outputModalities: mods(s.outMod ?? ["text"]),
  },
  intel: {
    agenticToolUse: tier(s.agentic ?? U, "bfcl+tau-bench"), instructionFollowing: tier(s.instruct ?? U, "ifeval+lmarena-if"),
    reasoning: tier(s.reasoning ?? U, "gpqa+aime"), coding: tier(s.coding ?? U, "swe-bench-verified"),
    longCtxComprehension: tier(s.longctx ?? U, "ruler.public"), knowledge: tier(s.knowledge ?? U, "mmlu-pro"),
    humanPreference: tier(s.humanpref ?? U, "lmarena"),
  },
  gov: { dataRetention: str(s.retention ?? "unknown", s.retention ? "provider.tos" : ""), region: str(s.region ?? U, "openrouter.provider"), license: str(s.license ?? U, "openrouter.license") },
  ops: { providerFanOut: num(s.fanout ?? 1), popularityRank: num(s.popularity ?? U, "openrouter.rankings"), releaseDate: str(s.released ?? U, "provider"), priceVolatile: flag(s.volatile ?? false, "suluk.snapshot-diff") },
});

/** Illustrative seed — NOT the live catalog. Tiers reflect coarse public standing as of asOf; UNKNOWN is honest. */
export const SEED_CATALOG: ModelCatalog = {
  schemaVersion: "0.1.0",
  generatedAt: ASOF,
  snapshotHash: "sha256-seed-0001",
  rows: [
    mk({ id: "anthropic/claude-opus-4", provider: "anthropic", family: "claude", inP: 15, outP: 75, cachedP: 1.5, win: 200000, out: 64000, fidelity: "strong",
      ttft: "mid", tput: "mid", tool: true, forced: true, parallel: true, structured: true, strict: true, inMod: ["text", "image"],
      agentic: "frontier", instruct: "frontier", reasoning: "frontier", coding: "frontier", longctx: "strong", knowledge: "frontier", humanpref: "frontier",
      retention: "ephemeral", region: "us", license: "proprietary", fanout: 2, popularity: 3, released: "2026-05" }),
    mk({ id: "anthropic/claude-sonnet-4-6", provider: "anthropic", family: "claude", inP: 3, outP: 15, cachedP: 0.3, win: 200000, out: 64000, fidelity: "strong",
      ttft: "strong", tput: "strong", tool: true, forced: true, parallel: true, structured: true, strict: true, inMod: ["text", "image"],
      agentic: "frontier", instruct: "frontier", reasoning: "strong", coding: "frontier", longctx: "strong", knowledge: "strong", humanpref: "strong",
      retention: "ephemeral", region: "us", license: "proprietary", fanout: 2, popularity: 1, released: "2026-04" }),
    mk({ id: "google/gemini-2.5-flash", provider: "google", family: "gemini", inP: 0.3, outP: 2.5, cachedP: 0.075, win: 1000000, out: 65000, fidelity: "mid",
      ttft: "frontier", tput: "frontier", tool: true, forced: true, parallel: true, structured: true, strict: true, inMod: ["text", "image", "audio"],
      agentic: "strong", instruct: "strong", reasoning: "mid", coding: "strong", longctx: "mid", knowledge: "strong", humanpref: "strong",
      retention: "logged", region: "us", license: "proprietary", fanout: 1, popularity: 2, released: "2026-03" }),
    mk({ id: "google/gemini-2.5-pro", provider: "google", family: "gemini", inP: 1.25, outP: 10, cachedP: 0.31, win: 1000000, out: 65000, fidelity: "strong",
      ttft: "strong", tput: "strong", tool: true, forced: true, parallel: true, structured: true, strict: true, inMod: ["text", "image", "audio", "pdf"],
      agentic: "strong", instruct: "frontier", reasoning: "frontier", coding: "strong", longctx: "frontier", knowledge: "frontier", humanpref: "frontier",
      retention: "logged", region: "us", license: "proprietary", fanout: 1, popularity: 4, released: "2026-03" }),
    mk({ id: "openai/gpt-5", provider: "openai", family: "gpt", inP: 10, outP: 30, cachedP: 1.25, win: 400000, out: 128000, fidelity: "strong",
      ttft: "mid", tput: "mid", tool: true, forced: true, parallel: true, structured: true, strict: true, inMod: ["text", "image"],
      agentic: "frontier", instruct: "frontier", reasoning: "frontier", coding: "frontier", longctx: "strong", knowledge: "frontier", humanpref: "frontier",
      retention: "logged", region: "us", license: "proprietary", fanout: 2, popularity: 5, released: "2026-02" }),
    mk({ id: "openai/gpt-4o-mini", provider: "openai", family: "gpt", inP: 0.15, outP: 0.6, cachedP: 0.075, win: 128000, out: 16000,
      ttft: "frontier", tput: "frontier", tool: true, forced: true, parallel: true, structured: true, strict: true, inMod: ["text", "image"],
      agentic: "mid", instruct: "strong", reasoning: "mid", coding: "mid", knowledge: "mid", humanpref: "mid",
      retention: "logged", region: "us", license: "proprietary", fanout: 2, popularity: 6, released: "2025-07" }),
    mk({ id: "deepseek/deepseek-v3", provider: "deepseek", family: "deepseek", inP: 0.27, outP: 1.1, cachedP: 0.07, win: 128000, out: 8000,
      ttft: "mid", tput: "strong", tool: true, structured: true, inMod: ["text"],
      agentic: "mid", instruct: "strong", reasoning: "strong", coding: "strong", knowledge: "strong", humanpref: "strong",
      retention: "trains", region: "cn", license: "mit", fanout: 3, popularity: 7, released: "2025-12", volatile: true }),
    mk({ id: "meta-llama/llama-4-maverick", provider: "meta", family: "llama", inP: 0.2, outP: 0.6, win: 1000000, out: 16000, fidelity: U,
      ttft: "strong", tput: "strong", tool: true, structured: true, inMod: ["text", "image"],
      agentic: U /* thin public agentic data */, instruct: "mid", reasoning: "mid", coding: "mid", knowledge: "strong", humanpref: "mid",
      retention: "zero", region: "us", license: "llama-4-community", fanout: 5, popularity: 8, released: "2025-04" }),
  ],
};
