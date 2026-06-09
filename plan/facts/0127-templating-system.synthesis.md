# #127 templating system — workflow synthesis (evidence behind C005)

> Durable record behind [C005](../../doc/architecture/decisions/C005-templating-system.md) + [`0127-templating-system.bn`](./0127-templating-system.bn).
> Source: workflow `wf_dc8e3394-6d2` (21 agents; readers + RFC6570/URLPattern WebFetch, prior-map, 4 candidates, 12 adversarial verdicts, synthesis — verify+synthesis resumed after a transient rate limit). Provenance, not source of truth.

## Frame chosen — RFC6570 parseable profile

Keep the RFC6570 `{var}` **surface** (3.x continuity, lowest-receipt upgrade), constrain it with a normative **matching profile** (injective operator subset in path-identity position), and **require two artifacts RFC6570 omits**: a normative observable-behavior **grammar** and a normative **reverse-parse algorithm**.

**Operator tiering:** MATCH-SAFE (literal, single-segment `{var}`, leading-slash var, name-bearing matrix) · QUERY-ONLY (form-query, order/repetition-insensitive) · FORBIDDEN-in-identity (explode, multi-segment, reserved `{+}`, fragment `{#}`, label `{.}`, lossy prefix `:N`, list/composite var → these force `not-statically-determinable` and drop from the static matcher).

## Candidate ceilings (3 verify lenses)

| Candidate | parseability | expressiveness | standards-align | Fate |
|---|---|---|---|---|
| **RFC6570 parseable profile** | — | — | — | **Won** (constraint-intersection: REQ-1/REQ-2 ∧ continuity ∧ grammar) |
| Full RFC6570 (default) | 0.30 | 0.35 | 0.18 | Refuted — prefix-truncation lossy; reserved/fragment recognizers unsound; amputates its own multi-segment claim |
| WHATWG URLPattern | 0.55 | — | 0.18 | Refuted — fabricates cross-pattern precedence URLPattern doesn't define; "compile to RegExp" *is* handrews' grammar objection; breaks `{var}` continuity |
| EMT (own grammar) | — | — | — | Refuted as a *language* (zero installed base) — but its **two artifacts grafted** |

## Grafts & the matrix correction

- **EMT's two artifacts → requirements:** the normative grammar (answers handrews #127 c2) + the reverse-parse algorithm (the mechanism RFC6570 names-but-omits), atop the inherited surface.
- **URLPattern's four-part taxonomy** (fixed-text / segment-wildcard / multi-segment-wildcard / opaque-regex-as-NSD) = the family-agnostic literal-vs-variable structure #16 consumes.
- **Matrix correction:** two adversaries showed name-bearing matrix is fully delimited + injective (nschejtman #105: the param *name* is in the path, so two never collide) → admitted MATCH-SAFE at zero parseability cost. Unbounded matrix-list stays forbidden.

## How it resolves the named URL→template ambiguity

Split the historically-conflated problem: **(a) parse-ambiguity** eliminated at the grammar level (forbidden operators can't enter path-identity → every path is segment-aligned → URL→template is single-valued); **(b) operation-collision** (`/users/{name}` vs `/users/me`) exposed via #16's three-valued verdict + the inherited concrete-over-variable runtime tiebreak — *not* a parse failure. Collision policy stays open exactly as #16 leaves it.

## Deviations (receipted)

D1-127 forbid richer operators in identity · D2-127 add grammar + reverse algorithm · D3-127 query order-insensitive · D4-127 matrix correction. Headline verdict @0.62; inherited recognition/expansion facts @0.85; runtime tiebreak @0.80.

## Honest cost

Slash-bearing single-value path params (which need the forbidden reserved operator) become **inexpressible** — a real expressiveness regression vs full RFC6570, the deliberate price of parseability. Noted, not hidden.

## Council cross-check (first use of the calibrated personas — C006)

Applied the two most-relevant Class-A personas as a *guide* (not a gate):

- **[hudlow](../council/hudlow.md)** (ceiling 0.78, formal-systems purist — "statically analyzable + locally decidable"): **strong align.** The profile makes path matching injective + decidable, and routes the undecidable operators to `not-statically-determinable` — exactly his disposition. No predicted objection.
- **[handrews](../council/handrews.md)** (ceiling 0.70 — RFC6570 expressiveness, but *demanded an observable-behavior grammar*, #127 c2): **align, with one predicted objection.** The profile directly satisfies his grammar demand and keeps the RFC6570 base. But his persona's recurring position ("plenty of cases 6570 enables that others don't") predicts he'd **object to forbidding richer operators** as an expressiveness loss. That objection is **already surfaced and accepted** in C005's honest-cost section (slash-bearing path params inexpressible). The council caught the real tension before he could.

This is a guide, not a ratification: handrews' actual view is unknown; the persona (calibrated @0.70) is a hypothesis that flagged a real cost we then exposed.
