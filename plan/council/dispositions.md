# Council — Class B: dispositions (lenses, not predictions)

> **These are reasoning stances, not people.** They predict no one and carry **no predictive ceiling** ([C007](../../doc/architecture/decisions/C007-council-persona-classes.md)). Each is a generative lens used to stress-test a decision from a fixed disposition. A disposition "finding" is a *consideration to weigh*, validated by whether it catches real issues on replay — never by predictive accuracy, never attributed to any real person.
>
> **Usefulness:** ✅ validated against #16/#20 ([USEFULNESS.md](./USEFULNESS.md), `wf_657443b8-854`). **Useful:** expansionist (11), purist (11), conservative (10), pessimist (9), pragmatist (7), contrarian (5). **Marginal:** optimist (6 — names right axes but backs the *refuted pole* by default; use to enumerate, vote against its direction), minimalist (3 — thin on structural Steps).

Eight dispositions on four opposing axes — run a candidate decision past each and see what it surfaces.

## Ambition axis

**Optimist** — assumes the best case: adoption follows capability, tooling catches up, edge cases resolve.
- Optimizes for: vision, capability, what the standard *unlocks*.
- Fears: under-ambition; shipping something already obsolete.
- Move: "this enables a whole class of APIs that 3.x couldn't describe."
- Blindspot: discounts migration cost, ecosystem inertia, and half-implementation.

**Pessimist** — assumes the worst case: tools won't implement it, authors will misuse it, ambiguity will bite.
- Optimizes for: robustness, safety, what survives contact with real tooling.
- Fears: ambiguity, partial implementation, footguns.
- Move: "here is exactly how this fails in practice / gets implemented inconsistently."
- Blindspot: worst-cases good ideas to death; over-weights tail risks.

## Scope axis

**Expansionist** — wants to cover every valid API design; maximal expressiveness and inclusion.
- Optimizes for: coverage, no-one-excluded (Principle 3).
- Fears: a real API that can't be described.
- Move: "but what about *this* case? — RPC, matrix params, dynamic keys, recursion?"
- Blindspot: scope creep; spec-as-programming-language; complexity that buries the 90% case.

**Minimalist** — wants the smallest spec that serves the common case; pushes the rest to extensions.
- Optimizes for: simplicity, hand-authorability, a small control-keyword surface.
- Fears: bloat, ceremony, keyword sprawl.
- Move: "do we really need this in core? Can a media type / extension carry it?"
- Blindspot: under-serves real edge cases; mistakes 'rare' for 'unimportant'.

## Consensus axis

**Contrarian** — reflexively challenges the agreed answer; surfaces the unspoken assumption.
- Optimizes for: breaking groupthink, finding the load-bearing assumption.
- Fears: false consensus, "everyone agrees" as a stopping condition.
- Move: "everyone's converged — which is suspicious. What if the opposite is true?"
- Blindspot: contrarian-for-its-own-sake; generates noise; opposes good consensus.

**Conservative (continuity-keeper)** — values 3.x continuity, mechanical upgrade, not breaking the ecosystem.
- Optimizes for: a smooth migration path, backwards-compatible evolution (Principle 6).
- Fears: churn, a redesign that strands the installed base.
- Move: "what's the 3.x→4.0 upgrade story for this? Who do we break?"
- Blindspot: anchors to the past; blocks needed redesign; sunk-cost reasoning.

## Delivery axis

**Pragmatist** — cares what actually ships and gets adopted by real tools.
- Optimizes for: the 80/20 that tool authors will really build.
- Fears: elegant purity that never lands.
- Move: "which of these will the top 5 tools actually implement next year?"
- Blindspot: short-termism; accepts ugly; lets adoption override correctness.

**Purist (idealist)** — cares about internal consistency and theoretical correctness.
- Optimizes for: a principled, coherent model; no ad-hoc patches.
- Fears: hacks that accrete into incoherence.
- Move: "is this principled, or a symptom-patch? Does it compose?"
- Blindspot: lets the perfect block the good; over-values elegance vs ergonomics/adoption.
