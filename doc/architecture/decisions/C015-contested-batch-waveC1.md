# C15. Contested batch (Wave 2C1) — header model, paths/resource, annotations, defaults, servers

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. C010 Wave-2C1: 5 contested items via compact per-item panels. Ledger: [`plan/facts/batch4-waveC1.bn`](../../../plan/facts/batch4-waveC1.bn). Workflow `wf_6906ef33-a70`.

Date: 2026-06-09

## Status

Accepted (candidate-fork), post-refutation ceilings 0.6–0.74. The #108 panel notably caught its candidate conflating the C004 header *slot* with a header *model-reference*, found a 2nd independent voice (arno #22) for the dedicated-property direction, and hardened trailers to @0.42. converge clean.

## Decisions (5)

### #108 — header-model
@0.6. Resolve #108 by inheriting the conceded #108 registry-of-header-models foundation (RFC9110 §5.6 | RFC8941 | another-RFC | custom, housed like the media-type registry; @0.85) and resolving the contested content-vs-style hook by refusing that binary and adopting handrews' own surfaced third option — a DEDICATED registry-keyed header-model reference key (e.g. `fieldModel`, value required to not look like a media-type range) added alongside the existing C004 per-location header slot and the response Header Object, with `style: automatic` demoted to optional DOM→ADA sugar that normalizes to the sam

### ##23/#30 — Simplify paths further / Resource-oriented modeling — paths-resource-orientation
@0.74. #23/#30 — Resolve #23's structural half as already-settled (recursive/nested paths PERMITTED per C011/#119; parseable segment profile per C005/#127; hierarchy-surfacing is a deferred tooling choice) and DEFER #30 resource-oriented modeling as a core construct: this wave keeps paths+method identity-primary (no operation-from-resource decoupling — co-located in C003's KILLED/NON-ADOPTED list @0.8 because decoupling would collapse the signature axis), and the spec exposes only existing primitives (path+method binding, C009 name-keyed maps, the C013/#72 DOCUMENT-level self-identifier) that doc-gen

### ##56 — Context property annotations — context-annotations
@0.7. #56 is RESOLVED at CANDIDATE ceilings (handrews-live-record cap @0.70, SIG-unratified, open since 2023-03-30): context-dependent property semantics are expressed by an object-level OAS annotation vocabulary delivered as a C013 extension vocabulary under the declared 2020-12 dialect — net-new keywords sit on the OBJECT schema (grouped by field, because an annotation can only apply to an instance that exists), validated in two passes (pass-1 a 2020-12 validator emitting annotations + JSON Pointers via unknown-keyword-as-annotation, pass-2 a separate HTTP-aware validator enforcing context-sensiti

### #Suluk #113 — default-value
@0.64. Suluk #113 resolves `default` at the schema-home (Pole 2): the keyword is authored inside the per-location JSON Schema 2020-12 slots fixed by C004, no new OAS-level parameter control keyword is added in this wave, and the parameter-level `default` Parameter Object FIELD is deferred-open to ride the JSON-Schema-upstream missing/defaultProperties/itemDefaults proposal (json-schema-org#867) — adopted later only as a thin reflection of that keyword or a C013 extension vocabulary, never as a bespoke OAS control keyword; intra-location defaults are declarable in 2020-12 today (their operative apply-

### #Suluk #55 — Multiple servers across environments — servers-environments
@0.74. C-#55 (servers-environments): the Candidate decomposes 'multiple servers across environments' into server IDENTITY (a stable named handle, referenced by-name-never-index per C009) and environment URL CONFIGURATION (a deployment-layer responsibility resolved by the Deployments Object's per-deployment `location` field, possibly subsuming a distinct shape-level Server Object), adopts only the thin by-name shape primitive, defers all environment URL mapping out of core per C008's shape-vs-deployment separation (corroborated in-record by handrews' r2 'does the deployments proposal address this?'), 
## Consequences

- **#108 unblocks the header-aspect of the signature (#16)** as a best-effort runtime verdict — a key dependency cleared. Trailers/cookie placement surfaced, not hardened.
- Deferred: trailer region/placement, the parameter-level `default` field (rides JSON-Schema upstream), environment URL mapping (→ deployment layer), the query-string→data-model half of the evaluative mapping (still gated, distinct from headers).
- Resource-orientation (#30) is explicitly NOT a core decoupling — paths+method stay identity-primary (consistent with C003's killed-list); it is a tooling/doc overlay.
