/**
 * normalizeOpenRouter — the WEEKLY-DERIVABLE spine (Class A in REFRESH.md): the OpenRouter `/models` API → the
 * DECIDABLE fact cells of a ModelRecord (cost, context, capabilities-as-DECLARED, modalities, recency). PURE +
 * unit-tested; the live `fetch` is a thin wrapper (fetch.ts). The noisy benchmark TIER cells (intel.*) are left
 * `unknown` here — they come from the periodic Class-B pass via `applyBucketing`, not this API. We do NOT impute.
 */
import { createHash } from "node:crypto";
import type { Cell, DataRetention, ModelCatalog, ModelRecord } from "./types";

/** The subset of an OpenRouter `/models` row we rely on (all public facts). */
export interface ORModel {
  id: string;
  name?: string;
  created?: number; // unix seconds
  context_length?: number;
  pricing?: { prompt?: string; completion?: string; request?: string; input_cache_read?: string };
  top_provider?: { max_completion_tokens?: number | null };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  supported_parameters?: string[];
}

const c = <T,>(value: T | null, source: string, asOf: string): Cell<T> => ({ value, source: value === null ? "" : source, asOf });
const perMtok = (s?: string): number | null => (s === undefined ? null : Math.round(parseFloat(s) * 1_000_000 * 1000) / 1000);
const has = (params: string[] | undefined, k: string) => !!params?.includes(k);
const OR = "openrouter.api";

/** One OpenRouter model → its decidable fact cells (intel/gov tiers stay UNKNOWN; filled by the Class-B pass). */
export function normalizeOpenRouterModel(m: ORModel, asOf: string): ModelRecord {
  const provider = m.id.split("/")[0] ?? "unknown";
  const family = (m.id.split("/")[1] ?? "").replace(/[:@-].*$/, "") || provider;
  const sp = m.supported_parameters;
  const U = <T,>(): Cell<T> => ({ value: null, source: "", asOf });
  return {
    id: m.id, provider, family, status: "active",
    cost: {
      inputPerMtok: c(perMtok(m.pricing?.prompt), OR, asOf),
      outputPerMtok: c(perMtok(m.pricing?.completion), OR, asOf),
      cachedInputPerMtok: c(perMtok(m.pricing?.input_cache_read), OR, asOf),
      perRequest: c(m.pricing?.request !== undefined ? parseFloat(m.pricing.request) > 0 : null, OR, asOf),
    },
    context: {
      maxWindow: c(m.context_length ?? null, OR, asOf),
      maxOutput: c(m.top_provider?.max_completion_tokens ?? null, OR, asOf),
      longCtxFidelity: U(), // RULER — not in this API; Class-B pass
    },
    speed: { ttft: U(), throughput: U() }, // Artificial Analysis — not in this API
    caps: {
      toolCalling: c(sp ? has(sp, "tools") : null, OR, asOf),
      forcedToolChoice: c(sp ? has(sp, "tool_choice") : null, OR, asOf),
      parallelToolCalls: c(sp ? has(sp, "parallel_tool_calls") : null, OR, asOf),
      structuredOutput: c(sp ? has(sp, "structured_outputs") || has(sp, "response_format") : null, OR, asOf),
      jsonSchemaStrict: c(sp ? has(sp, "structured_outputs") : null, OR, asOf),
      inputModalities: c(m.architecture?.input_modalities ?? null, OR, asOf),
      outputModalities: c(m.architecture?.output_modalities ?? null, OR, asOf),
    },
    intel: { agenticToolUse: U(), instructionFollowing: U(), reasoning: U(), coding: U(), longCtxComprehension: U(), knowledge: U(), humanPreference: U() },
    gov: { dataRetention: U<DataRetention>(), region: U(), license: U() },
    ops: {
      providerFanOut: c(1, OR, asOf),
      popularityRank: U(),
      releaseDate: c(m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : null, "openrouter.created", asOf),
      priceVolatile: c(false, "suluk.snapshot-diff", asOf),
    },
  };
}

export function normalizeOpenRouter(models: ORModel[], asOf: string): ModelRecord[] {
  return models.map((m) => normalizeOpenRouterModel(m, asOf)).sort((a, b) => a.id.localeCompare(b.id));
}

/** A content-addressed hash over the rows' load-bearing FACT cells (reproducible pin; ties C027 contentHash). */
export function snapshotHash(rows: ModelRecord[]): string {
  const facts = rows.map((r) => [r.id, r.cost.inputPerMtok.value, r.cost.outputPerMtok.value, r.context.maxWindow.value, r.caps.toolCalling.value]);
  return "sha256-" + createHash("sha256").update(JSON.stringify(facts), "utf8").digest("hex").slice(0, 16);
}

export function catalogFrom(rows: ModelRecord[], asOf: string): ModelCatalog {
  return { schemaVersion: "0.1.0", generatedAt: asOf, snapshotHash: snapshotHash(rows), rows };
}
