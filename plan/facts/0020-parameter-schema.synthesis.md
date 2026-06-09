# #20 parameter schema — workflow synthesis (evidence behind C004)

> Durable record of the adversarial synthesis behind [C004](../../doc/architecture/decisions/C004-parameter-schema.md) + [`0020-parameter-schema.bn`](./0020-parameter-schema.bn).
> Source: workflow `wf_643fa7fa-215` (17 agents, ~1.1M tokens, 18.5 min: 3 readers → prior-map → 3 candidate structures → 9 adversarial verdicts → synthesis). Provenance, not source of truth.

## Headline: the panel overturned the going-in prediction

Going in, handrews' unified `{body, headers, parameters}` wrapper looked like the winner. **Adversarial verify refuted it as the authoring root** and the synthesis landed on a **hybrid: per-location slots + opt-in cross-cutting construct.** This is the value of the panel over a snap call.

## Frame chosen — per-location slots + opt-in cross-cutting construct

- **Common case:** one plain JSON Schema per location (query / path / header / cookie + body via `contentSchema`); no reserved real-param namespace; no mandatory wrapper.
- **Rare cross-type case:** an *optional* construct over a tooling-materialized `{parameters, headers, body}` envelope (handrews' Position-3 shape grafted **only here**, materialized only when an author writes a cross-type dep).
- Strictly **runtime/evaluative tier ⇒ D1-safe.**

## Candidate ceilings (adversarial verify, 3 lenses each)

| Candidate | consistency-w/-D1 | cross-type+reserved-names | evaluative-feasibility | Fate |
|---|---|---|---|---|
| HTTP-object 3-field wrapper (handrews Pos 3) | 0.45 | 0.42 | 0.32 | **Refuted as root**; envelope shape grafted as opt-in target only |
| `in`-dialect (mkistler Pos 2) | 0.14 | 0.25 | 0.16 | **Killed** (2 fatal refutations + miscitation) |
| Per-location-slots + opt-in (hybrid) | — | — | — | **Won**, hardened by #224 |

## What the panel caught (substrate discipline in action)

- **Miscitation caught:** a sibling candidate's headline citation ("avoids the need to augment JSON Schema") was attributed to arno in #22; the verifier traced it to **mkistler in #100 Body L28** — arno argued the *opposite*. The in-dialect proposal also covers query/header/path/cookie **only — body is not in its namespace**, so it cannot express the forcing `path-ID == body-ID` dep. → D2-20 non-adoption receipt.
- **3-field wrapper refuted on three counts:** cookies/trailers unplaced (#22 L61); path+query wrongly merged into one `parameters` bucket (contra karenetheridge #100 c5); `absent⇒anything` is the wrong axis vs `additionalProperties`-within-a-present-region (#224).
- **Late-record convergence:** #224 (2026-03) independently arrived at separate per-location keys (`pathParams`/`headers`/`query`/`cookies`/`body`), confirming the direction.
- **mizan run on the binding prior:** `mizan_verify_claim(d1_jsonschema_out_of_static_contract)` → recommended cap **0.139** vs declared 0.55 (2 co-located L1 witnesses, independence 0.53). So #16's **D1 is weakly witnessed** — "stay out of the static matcher" is a *soft* guardrail honored by construction, not a hard fact. Recorded as `d1_is_soft_guardrail_cap_0139`.

## D1 verdict — D1-SAFE (runtime-only), tripwire surfaced not fired

The #20 unified-vs-separate axis is **orthogonal** to D1's static-vs-runtime axis. All constructs are runtime validation; none is compiled into the load-time matcher. Value-equality is inherently instance-data-dependent (Relative JSON Pointer resolves against the live instance) → it *reinforces* D1's "not-statically-collision-checked" last-resort. **Live tripwire (recorded, not fired):** README L63/L170 + rpc.yaml's share-method requests frame `parameterSchema` as request-*selection*, pressuring toward promoting the schema into the static matcher — which *would* contest D1. We decline; any future promotion is a deviation-on-a-deviation needing its own receipt.

## Deferred / open dependencies

- **#73** — JSON Schema dialect/version + a Relative-JSON-Pointer vocabulary (greaterThan/equals) for relational + cross-type **value-equality** deps. **Hard:** the forcing case `path-ID == body-ID` is not demonstrable without it; the corpus has **zero** working cross-location value-equality schema. Same dependency under any shape — unification buys nothing extra here.
- **#127** — templating system; gates the query/path instance→data-model mapping into the slots.
- **#108 / #22 / #163** — header data-model registry (OPEN 2026-03), lowercase-normalization MUST (#224), request/response header asymmetry, media-type params. Gates the header slot.
- **Evaluative mapping** — query-string-is-not-JSON (Hudlow #100; repeated keys, always-string, number-hinting), cookies/trailers placement, `query.x`-vs-`x` deserialization. The deepest open technical risk; generative use trivial, evaluative hard.
