import { test, expect, describe } from "bun:test";
import { applyBucketing, normalizeOpenRouterModel, normalizeOpenRouter, catalogFrom, snapshotHash, type ORModel } from "../src/index";

describe("@suluk/models — tier bucketing rules (the red-line)", () => {
  test("scores bucket per the committed boundaries; null / unknown-axis ⇒ unknown", () => {
    expect(applyBucketing("agenticToolUse", 0.9)).toBe("frontier");
    expect(applyBucketing("agenticToolUse", 0.72)).toBe("strong");
    expect(applyBucketing("agenticToolUse", 0.55)).toBe("mid");
    expect(applyBucketing("agenticToolUse", 0.2)).toBe("basic");
    expect(applyBucketing("agenticToolUse", null)).toBe("unknown");
    expect(applyBucketing("not-an-axis", 0.9)).toBe("unknown");
    expect(applyBucketing("humanPreference", 1400)).toBe("frontier"); // Elo scale, not [0,1]
  });
});

describe("@suluk/models — normalizeOpenRouter (the weekly facts spine)", () => {
  const m: ORModel = {
    id: "anthropic/claude-opus-4", created: 1746057600, context_length: 200000,
    pricing: { prompt: "0.000015", completion: "0.000075", input_cache_read: "0.0000015" },
    top_provider: { max_completion_tokens: 64000 },
    architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
    supported_parameters: ["tools", "tool_choice", "structured_outputs", "response_format"],
  };
  const rec = normalizeOpenRouterModel(m, "2026-06-13");

  test("prices convert per-token → per-Mtok; context + modalities + caps from supported_parameters", () => {
    expect(rec.cost.inputPerMtok.value).toBe(15);
    expect(rec.cost.outputPerMtok.value).toBe(75);
    expect(rec.cost.cachedInputPerMtok.value).toBe(1.5);
    expect(rec.context.maxWindow.value).toBe(200000);
    expect(rec.context.maxOutput.value).toBe(64000);
    expect(rec.caps.toolCalling.value).toBe(true);
    expect(rec.caps.structuredOutput.value).toBe(true);
    expect(rec.caps.inputModalities.value).toEqual(["text", "image"]);
    expect(rec.provider).toBe("anthropic");
    expect(rec.cost.inputPerMtok.source).toBe("openrouter.api");
  });

  test("benchmark TIER cells are UNKNOWN here (filled by the Class-B pass), never imputed", () => {
    expect(rec.intel.agenticToolUse.value).toBeNull();
    expect(rec.intel.reasoning.value).toBeNull();
    expect(rec.context.longCtxFidelity.value).toBeNull();
    expect(rec.speed.ttft.value).toBeNull();
  });

  test("catalogFrom is content-addressed + deterministic", () => {
    const rows = normalizeOpenRouter([m], "2026-06-13");
    expect(catalogFrom(rows, "2026-06-13").snapshotHash).toBe(catalogFrom(rows, "2026-06-13").snapshotHash);
    expect(snapshotHash(rows)).toStartWith("sha256-");
  });
});
