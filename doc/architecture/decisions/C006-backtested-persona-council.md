# C6. A backtested persona council — calibrated SIG-voice models as guides, not prophets

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. A methodology/mechanism decision (same class as [C002](./C002-recursive-state-mechanism.md)), not a frontier-question decision. (`C005` is reserved for the in-flight #127 resolution.)

Date: 2026-06-09

## Status

Accepted (candidate-fork) — **VALIDATED & COMPLETE** (council resume 2026-06-10). The blind backtest works and **discriminates**: of 8 voices built, **5 calibrated** (hudlow 0.78, handrews/rafalkrupinski/karenetheridge 0.70, arno-di-loreto 0.60) and **3 not** — mikekistler (n=1), and crucially **earth2marsh (0.375) + darrelmiller (0.214)**, whose harder *temporal* split correctly refused to certify two genuinely-unpredictable voices (the "lots of options" author + the facilitator). The judge cross-checks actuals against the real export; ceilings are honestly capped. handrews scored 2 in-the-wild hits during the walk. Full results + the temporal-split finding: `plan/council/CALIBRATION.md`. A persona that fails its backtest is kept but flagged uncalibrated and excluded from the calibrated council.

## Context

The walk resolves frontier questions against the SIG record. Recurring voices (handrews, darrelmiller, earth2marsh, mikekistler, hudlow, karenetheridge, …) raise *predictable* objections — handrews on parseability/analyzability, hudlow "a query string is not JSON", karenetheridge on edge cases. We keep re-discovering these by re-reading discussions. A calibrated model of each voice would let us ask "what would they object to?" *proactively* — but modeling real people risks (a) putting words in their mouths and (b) false confidence. The user's framing fixes both: **blind-backtest the personas before trusting them, and use them as example guides, never prophets.**

## Decision

Build a **council** of personas under `plan/council/`, one file per modelled voice, each carrying a backtest-derived confidence ceiling.

1. **Source.** Personas are built ONLY from public statements in the exported SIG record (`github-export/`). Predictions are explicitly model-guesses, never attributed to the real person as fact, and used internally as a reasoning aid — never published as "X says Y."
2. **Blind backtest (the validation gate).** For each voice, a held-out split is enforced *structurally* in a workflow: one agent extracts + splits the statements; the **builder sees only the train slice**; the **predictor sees only the held-out prompts, not the answers**; a **judge scores predicted-vs-actual**. Split method is adaptive: temporal for high-volume voices, leave-one-out for sparse ones, and a data floor below which a persona is built but flagged *uncalibrated*.
3. **Hit-rate is the ceiling.** A persona's backtest hit-rate sets its confidence ceiling (mizan-style). High scorers join the council; low scorers are flagged and excluded.
4. **Guides, not prophets.** A council prediction on a *new* question is an explicit hypothesis at the persona's ceiling, to be checked against the real record wherever it exists. It feeds a Step's prior-map as a *hypothesis* and serves as an adversarial "who would object, and why?" lens — it never substitutes for the actual SIG record and never raises a decision's own ceiling.

## Consequences

- New plan area `plan/council/` (persona files + `CALIBRATION.md`); a new prior-*source* (hypotheses), distinct from priors (the real record).
- Future Step workflows gain an optional **council phase** (predict positions before designing) and a **council verify lens** (would member X refute this?).
- Risk: a well-calibrated persona invites over-trust. Mitigation: ceilings are explicit, predictions are hypotheses, and the backtest is re-runnable as the record grows.
- Risk/ethics: modelling named real people. Mitigation: public statements only, internal use only, explicit model-guess labelling, no publication.
- Candidate khazīna atom: *backtested predictive personas of real forum participants, calibrated out-of-sample, used as a confidence-ceilinged adversarial council* — assess after validation lands.
