# Council calibration record

Backtest results for the Suluk persona council ([C006](../../doc/architecture/decisions/C006-backtested-persona-council.md)).
Built+backtested by workflow `wf_1046b106-ba2` (blind: builder saw only train, predictor saw only held-out prompts, judge scored against the real export). **Hit-rate sets the ceiling.**

## Verdict: the mechanism VALIDATED ✅

Out-of-sample blind prediction works. On the three voices with adequate test items, blind hit-rates were **0.875–1.0**, and the judge verified every actual statement against the exported record (not just the prediction pairs). The mechanism earns its place as a guide — at honestly-capped ceilings (small `n` ⇒ ≤0.78), never as a prophet.

| Persona | Split | n | Hit-rate | Ceiling | Status |
|---|---|---|---|---|---|
| [hudlow](./hudlow.md) | leave-one-out | 4 | **1.00** | 0.78 | ✅ calibrated (most predictable — formal-systems purist) |
| [handrews](./handrews.md) | leave-one-out | 4 | 0.875 | 0.70 | ✅ calibrated (misses were near-verbatim "partial"s) |
| [rafalkrupinski](./rafalkrupinski.md) | leave-one-out | 4 | 0.875 | 0.70 | ✅ calibrated (tooling-economics pragmatist) |
| [mikekistler](./mikekistler.md) | leave-one-out | 1 | 0.50 | 0.45 | ⚠️ built, **uncalibrated** (n=1 too small) |

## Caveats (honest)

- **Small samples.** All splits were leave-one-out at n≤4; ceilings are capped accordingly. A larger backtest (temporal split on the high-volume voices) would tighten these — re-runnable as the record grows.
- **Predictability ≠ correctness.** A high hit-rate means we can anticipate what the person *would say*, not that they're *right*. The council surfaces likely objections; it does not adjudicate them.

## Pending (rate-limited, need a resume)

The build+backtest hit a transient server rate limit (two big workflows ran concurrently). These were not completed and are **not** yet council members:

- **earth2marsh** (build failed) — SIG facilitator; design opinions must be filtered from meeting agendas.
- **darrelmiller** (predict failed) — initial-proposal author; high value, worth completing.
- **karenetheridge** (build failed) — JSON Schema edge-case specialist.
- **arno-di-loreto** (build failed) — reserved-name / header-placement voice.

Resume via `Workflow({scriptPath: ".../build-and-backtest-persona-council-wf_1046b106-ba2.js", resumeFromRunId: "wf_1046b106-ba2"})` — **as a single workflow, not concurrent with another** (concurrency caused the throttle).
