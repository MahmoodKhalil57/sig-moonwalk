# Horizons — short / medium / long

The walk is one loop ([C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md)); the horizons sequence *which* frontier
it resolves, ordered by prior-richness (cheapest, highest-ceiling decisions first). Because scope is
monolithic ([C001](../doc/architecture/decisions/C001-candidate-fork-charter.md)), these are phases toward **one** document — not separate deliverables.

---

## SHORT — bootstrap + richest-prior core

**Goal:** get the loop demonstrably turning on solid ground.

- [x] Wire the apparatus: spine, frontier, burhan ledger, daftar receipts, ADR provenance namespace.
- [ ] Ingest+classify the **API-shapes** frontier block: each question → Concern + prior-richness + adopt/contest/defer (the prior-map). Reading is from `github-export/discussions/`.
- [ ] Resolve the foundational core, in order: **#16 signature mechanism → request-selection algorithm → #20 parameterSchema split → #17 precedence → #83 response shape → path-templating / URL→template ambiguity**. Each → Inherited or Deviation + `Cxxx` ADR.
- [ ] Begin the document projection (`specification/`) for the resolved core.

**Exit criterion:** core structural model decided + projected; the loop survives ≥1 session boundary (resume from `plan/STATE.md` alone, nothing lost).

---

## MEDIUM — walk the high/medium-prior frontier

**Goal:** resolve everything that has real priors; reach a coherent document across the well-trodden Concerns.

- [ ] Resolve the remaining **API-shapes** questions (inheritance/recursive paths, interdependencies, discriminator, shorthands, HTTP fields, links, refs, examples, …).
- [ ] Resolve the **content-schema-format** Concern (JSON Schema dialect/referencing, SHACL/XSD alternatives).
- [ ] Harden Inherited-prior ceilings with burhan witnesses; run `burhan-converge` / `burhan-perturb` over `plan/facts/` to surface cross-decision contradictions and fix them.
- [ ] Document projection covers all high/medium-prior Concerns coherently.

**Exit criterion:** every richly-priored question RESOLVED; document coherent across API-shapes + content-schema; zero unresolved contradictions in the ledger.

---

## LONG — Originated Concerns + whole-document coherence

**Goal:** Completion — the monolithic criterion.

- [ ] Derive the **Originated** Concerns from principles, each with explicit low ceilings + witness-building: deployment configuration, foundational interfaces, mechanical 3.x→4.0 upgrade.
- [ ] Design the **mechanical upgrade** path (Principle 6) — the credibility keystone of any real v4.0 candidate.
- [ ] Whole-document coherence pass: re-project from the complete ledger, resolve cross-Concern tensions, verify no Originated section masquerades as settled (confidence map stays honest and exposed).

**Exit criterion = Completion:** one unified document, every Concern covered, per-section confidence map honest, **frontier empty, contradictions empty.**

---

### Calibration note

Per the Adam-Eve calibration heuristic (CLAUDE.md blindspot #2: Adam under-estimates own throughput), do **not** quote this in weeks. Each step is "read one discussion + reason + write one ledger claim + project one section" — minutes-to-hours, not weeks. The binding constraint is decision *count* (~53 frontier + Originated derivations), not engineering effort. Let daftar receipts of estimate-vs-actual recalibrate the horizon sizes as the walk proceeds.
