# @suluk/models — the weekly refresh spec

The catalog is a **generated, content-addressed artifact**, not a live call. This package ships the schema + selector + a small SEED catalog; the ~200-row catalog is produced by the fetcher below. Council `wf_729cde52-cc7`.

## The honest split — two derivability classes (the verifier's correction)

The naive "everything weekly from public data" is false. Derivability splits in two:

**(A) WEEKLY-DERIVABLE from a live API — the automatable spine (build first).** Pure facts from the OpenRouter `/models` + `/endpoints` API: per-token `input`/`output`/`cached` price, `context_length`, `max_completion_tokens`, `supported_parameters` (→ `tool_calling` / `forced_tool_choice` / `parallel_tool_calls` / `structured_output` / `json_schema_strict` — **declared, not verified**), `architecture.input/output_modalities`, provider fan-out, usage rankings, region/data-policy. These refresh cleanly every week. Our **own** signal: a week-over-week snapshot diff → `priceVolatile` and the `status` deprecation delta.

**(B) PERIODIC, lower-cadence, human-reviewable — the benchmark TIERS (second pass).** BFCL / τ-bench (agentic-tool-use), IFEval + LMArena (instruction-following), GPQA/AIME (reasoning), SWE-bench-Verified (coding), RULER (long-context), MMLU-Pro (knowledge), LMArena Elo (human-preference). These are **periodic publications, not APIs** — they cannot be claimed "weekly." They are mapped to coarse tiers by a committed **bucketing rules file** (which leaderboard snapshot → which tier boundary) so the tiers are auditable and reproducible. Coverage is **sparse** — most rows are `unknown` on the agentic + long-context axes; we **surface the gap, never impute**.

## Honesty rules (council-unanimous)

1. **Coarse tiers over scores** — `frontier|strong|mid|basic|unknown`; the raw cited number lives in `source`, never as the sortable value.
2. **Cite per metric** — every `Cell` carries `{source, asOf}`; an unsourced cell is MISSING (fail-closed in hard filters, soft-penalty in ranks), never a confident value. A tier is an **adopted public prior at a low ceiling**, never our measured fact — we do **not** self-test.
3. **Name contamination/saturation** — MMLU + HumanEval are demoted (MMLU-Pro gate; HumanEval secondary to SWE-bench-Verified); cross-witness a benchmark tier against LMArena (≥2 sources to agree on `frontier`).
4. **Staleness visible** — per-cell `asOf`; a not-seen-this-week row is STALE; the catalog is pinned by `snapshotHash` so a selection is reproducible (a re-pick with no author edit is otherwise un-auditable).
5. **Disclosed blindspots we cannot close without self-testing** — `supported_parameters` is decidable-as-DECLARED not as-true (a model can advertise tools and emit malformed calls → the CAP filter and the agentic-RELIABILITY tier are SEPARATE fields); AA latency/throughput are single-vendor + route/load-dependent (tag the provider, never a guarantee); provider quantization can drop quality with no version bump — disclosed, not solved; popularity is selection-bias (tiebreak only).

## Open sub-question (deferred to a micro-panel)

Key a row by **model** or by **(model, provider-endpoint)**? Governance/price/region attach to the *endpoint actually served* (structurally sounder), but that 3–5×'s the row count and the author UX. To resolve with a receipt + ceiling before hardening. The seed catalog currently keys by model with a single `provider`.

## Pipeline

```
weekly:   OpenRouter /models  ──▶  normalizeOpenRouter (A) facts cells  ─┐   [BUILT: normalize.ts + fetch.ts]
periodic: leaderboard snapshots + BUCKETING_RULES ─▶ applyBucketing (B) tier cells ─┤  [BUILT: bucketing.ts; the live overlay is TODO]
                                                                                   ▼
                                              catalogFrom ▶ ModelRecord rows ▶ snapshotHash ▶ ModelCatalog (committed, versioned)
```

**BUILT (no-network spine, unit-tested):** `bucketing.ts` (`BUCKETING_RULES` + `applyBucketing` — the committed,
cited tier-boundary rules per axis, the red-line), `normalize.ts` (`normalizeOpenRouterModel`/`normalizeOpenRouter` —
the OpenRouter `/models` → fact-cells transform; `snapshotHash`/`catalogFrom` — content-addressed catalog), and
`fetch.ts` (`fetchOpenRouterCatalog` — the thin live wrapper). The selector (`selectModel`) and the agent seam
(`deriveRequirements`/`resolveSkillModels`, having replaced `SulukSkillRef.model[]` + the analyzer's `DEFAULT_WINDOWS`)
are wired against these.

**TODO:** run `fetchOpenRouterCatalog` weekly (CI) to commit the ~200-row fact catalog; build the Class-B overlay that
maps leaderboard snapshots through `applyBucketing` onto `intel.*` (human-reviewed, lower cadence); then retire the seed.
