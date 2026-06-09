# Usefulness-replay record — dispositions + roles (Class B/C)

Validation of the non-predictive council lenses ([C007](../../doc/architecture/decisions/C007-council-persona-classes.md)) by **usefulness-replay**: each lens generated its considerations **blind** (forbidden from reading our decisions), then a judge scored them against the real #16/#20 synthesis record. Workflow `wf_657443b8-854` (32 agents).

## Verdict: the lenses validated — **13 useful · 3 marginal · 0 drop**

Replayed blind against #16/#20, the lenses surfaced considerations that genuinely mattered, often with record-specific *unique catches* a generic analysis would miss. The judge graded on quality, not hit-count (it downgraded the optimist despite enough hits — see below).

| Lens | Class | Hits | Verdict | Standout catch |
|---|---|---|---|---|
| expansionist | disposition | 11 | ✅ useful | RPC/body-encoded ops forcing method-non-mandatory + body-shape as a signature aspect |
| purist | disposition | 11 | ✅ useful | **independently found the one "fixed inconsistency"** — concrete-over-variable must be runtime-only |
| conservative | disposition | 10 | ✅ useful | generative-vs-evaluative split: evaluative promotion collides with existing tooling |
| tech-writer | role | 10 | ✅ useful | three-valued collision verdict implies docs need an explicit "X and Y collide" surface |
| pessimist | disposition | 9 | ✅ useful | the PUT path-ID==body-ID forcing case needs a dependency *language* absent from basic schema |
| ai-llm-consumer | role | 9 | ✅ useful | reserved-name collision (`id`/`headers`/`body` as both params and structural keys) |
| codegen-author | role | 8 | ✅ useful | **named #20's overturn** — per-location over unified — *and* the merging reason |
| pragmatist | disposition | 7 | ✅ useful | cost-of-conformance decides mandatory-vs-best-effort collision analysis (matches D3) |
| platform-architect | role | 7 | ✅ useful | WHATWG URLPattern parseability/portability problem (matches deferred #127) |
| hand-author-dev | role | 7 | ✅ useful | reserved-name collision = Position 1's killing defect |
| security-reviewer | role | 7 | ✅ useful | the exact `/users/{id}` vs `/users/me` precedence-collision + determinism concern |
| enterprise-integrator | role | 6 | ✅ useful | reserved-name collision as load-bearing (Position 1 defect @0.85) |
| contrarian | disposition | 5 | ✅ useful | **anticipated deviation D2** — the lowest-ceiling/riskiest sub-decision — with its exact rationale |
| optimist | disposition | 6 | ⚠️ marginal | names the right axes (ADA boundary) but backs the **refuted pole** on nearly every contested question |
| minimalist | disposition | 3 | ⚠️ marginal | got the declared-vs-implicit direction right, but thin overall |
| devex-pm | role | 3 | ⚠️ marginal | reserved-name collision, but few/generic hits on these structural Steps |

## How to weight them (honest caveats)

- **The optimist is a known-biased lens.** It reliably expands the option space (what *could* be unlocked) but its built-in "maximal expressiveness / make-it-first-class" bias lands it on the side the adversarial synthesis *refuted* — it wanted collision-analysis as a hard MUST (we chose best-effort/D3), unified parameterSchema (panel overturned it for per-location), and reframed the reserved-name **defect** as a feature. **Use it to enumerate possibilities; vote against its direction by default; pair it with the pessimist/skeptic.**
- **minimalist / devex-pm are thin on structural Steps.** Both surfaced ≤3 real considerations; they may earn more on Steps about ergonomics/adoption (e.g. mechanical upgrade, tiers) than on deep structural ones. Kept, not dropped — re-assess on a fitting Step.
- **0 drops is not a free pass.** #16/#20 are unusually rich foundational Steps; a narrower Step will likely expose lenses with no purchase. Re-replay on the next structural Step to keep the verdicts honest.
- **Predictability ≠ correctness.** A lens that surfaces a real consideration has done its job; whether to *act* on it is the decision's call, not the lens's.

## Surprises (vs my going-in guess)

I predicted tech-writer would be marginal — it scored **10 (useful)** (it anticipated the docs-consequence of the three-valued verdict). I predicted optimist marginal (✓) but didn't predict minimalist/devex-pm marginal. The judge decided against the record, not my prior — which is the point.
