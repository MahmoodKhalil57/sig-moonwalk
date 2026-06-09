# The council — persona guides (three classes)

Used as a **"what would they object to / who does this hurt?"** guide when resolving a Step. Three classes, each with its own epistemic gate ([C006](../../doc/architecture/decisions/C006-backtested-persona-council.md) + [C007](../../doc/architecture/decisions/C007-council-persona-classes.md)) — never mix them:

- **A — Individuals** (real people, *predictively backtested*; ceiling = hit-rate) → below + one file each.
- **B — Dispositions** (optimist/pessimist/contrarian/… — *lenses, no predictive ceiling*) → [dispositions.md](./dispositions.md).
- **C — Roles** (codegen author, platform architect, security reviewer, … — *synthetic stakeholders*) → [roles.md](./roles.md).

B and C are validated by **usefulness-replay** (do they catch real considerations on resolved Steps?), not by predicting a person — ⏳ pending. Calibration of A: [CALIBRATION.md](./CALIBRATION.md).

## Class A members (calibrated)

| Voice | Ceiling | One-line |
|---|---|---|
| [hudlow](./hudlow.md) | 0.78 | Formal-systems purist — static analyzability, local decidability, "a query string is not JSON". |
| [handrews](./handrews.md) | 0.70 | JSON Schema elder — separate schema's job from OpenAPI's, distrust control-keyword sprawl, fix holistically in 4.0. |
| [rafalkrupinski](./rafalkrupinski.md) | 0.70 | Tooling-economics pragmatist — the spec is a contract for code generators; pave the cowpaths. |

(mikekistler is built but uncalibrated; earth2marsh / darrelmiller / karenetheridge / arno-di-loreto are pending — see CALIBRATION.md.)

## How to use it (guides, not prophets)

1. **Before designing candidates in a Step**, ask each calibrated persona: *given their recurring positions/objections, what would they say about this question?* Record predictions as **hypotheses at the persona's ceiling**, in the prior-map — never as fact, never attributed to the real person.
2. **As an adversarial lens during verify**, run the persona's "recurring objections" checklist against a candidate. (hudlow will ask "is it statically decidable and local?"; handrews "whose job is this — schema's or OpenAPI's? — and is it a 3.x patch or a 4.0 redesign?".)
3. **Always check against the real record.** Where the person actually spoke on the topic, the export wins over the persona. A persona prediction never raises a decision's own confidence ceiling.
4. **The ceiling is the trust.** A prediction from hudlow (0.78) carries more weight than mikekistler (uncalibrated, ≤0.45) — but none is decisive.

## Why this works (and where it doesn't)

The backtest showed these voices are *predictable* because they argue from consistent first principles. That is exactly why they make good guides — and exactly why we cap the ceiling: predictability is not correctness, and a small backtest (n≤4) can't license more.
