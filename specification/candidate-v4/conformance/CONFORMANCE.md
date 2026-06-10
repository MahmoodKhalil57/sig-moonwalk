# OpenAPI v4.0 "Suluk" Candidate — Conformance & the ADA Contract

> What a conformant v4 tool MUST do. CANDIDATE, not official OAS; provisional ceilings (0.5–0.65). The
> structural rules are machine-checked by [`../v4-meta-schema.json`](../v4-meta-schema.json) + this corpus;
> the behavioral rules (signatures, references, deserialization) follow [SPEC Appendix A](../SPEC.md) (C019).

## How to use this

- **Structural validator** (a vscode extension, a linter): validate documents against `../v4-meta-schema.json`. Your verdicts MUST match this corpus: every `valid/*.yaml` MUST validate; every `invalid/*.yaml` MUST be rejected. Run `python3 run.py` (or port it) to check.
- **Parser / matcher / codegen**: implement the behavioral contract below.
- **TS library**: use [`../v4-types.ts`](../v4-types.ts) as the parsed-document model.

## A. Structural contract (meta-schema)

A conformant tool MUST treat a document as a v4 Suluk document only if it validates against the meta-schema. Key invariants (SPEC §1, C009):

1. `openapi` matches `4.0.x`; `info.title` + `info.version` and `paths` are present.
2. `paths` is a **map** keyed by uriTemplate; each pathItem has a non-empty `requests` **map**; each request has a `method` and a non-empty `responses` map. (Corpus: `invalid/01`, `02`, `03`.)
3. All user-keyed collections (requests, responses, apiResponses, tags, components.*) are **name-keyed maps**; identity is by **stable name**, never array index or insertion order.
4. `status` is an HTTP code, a wildcard (`5XX`), or `default`. (Corpus: `invalid/04`.)

## B. Behavioral contract (the ADA)

A tool that *consumes* a document for routing/validation/codegen MUST expose an **ADA** (Abstract Description API) computed from the DOM, per SPEC §3/§13 + Appendix A:

1. **Reference resolution** (C013/C019 §A.1): resolve `{"$ref": "#/components/<type>/<name>"}` **by the map key `<name>`** (O(1) by-name; MUST fail if absent; MUST NOT fall back to positional lookup). Distinguish an OpenAPI Reference Object from a JSON-Schema `$ref` by the **slot+token** rule (a `$ref` lexically inside a Schema Object is the JSON-Schema kind).
2. **Signature computation** (C003/C019 §A.2): compute each request's canonical **signature tuple** `(method, pathPattern, query-key-set, content-type, header-aspects, body-shape-id)` and its deterministic key string, applying the normalization rules so two independent tools produce **identical keys**. The signature is the matcher key — it is **not** a DOM field and is never authored.
3. **Matching** (request → zero-or-one operation): route an incoming request by the signature; this is the recognition direction (the uriTemplate reverse-parse, Appendix A §A.4). Concrete-over-variable precedence is a **runtime** tiebreak only.
4. **Collision** (C003): expose the three-valued verdict `provably-disjoint | provable-collision | not-statically-determinable`. It is a **detect-and-tolerate** signal, **not** a validation gate — a tool MAY refuse a colliding description but MUST NOT be required to.
5. **Parameter validation** (C004): validate the parsed per-location instances against the `parameterSchema` slots; `shared.parameterSchema` is `allOf`-composed into each request (C012). JSON-Schema-based discrimination is a **runtime** last resort (D1) — it is **not** part of the static matcher.
6. **Deserialization** (C019 §A.3): map a raw request into the slot instances by the form-style default (string values typed-coerced by the slot schema; repeated keys → array; headers lowercase-normalized). The query/header evaluative mapping is provisional (#100/#108).

## C. Honest limits a tool MUST surface

A conformant tool MUST NOT present provisional defaults as ratified, and SHOULD flag the deferred areas: the exact reference fragment grammar, signature encoding, and query/header deserialization are **provisional buildable defaults** (C019), revisable. Constructs with **no v4 home** (3.x `xml` schema metadata; `style`/`explode` serialization; multi-environment server URLs) are out of scope and MUST be reported, not silently dropped (C017).

## Corpus

| Dir | Contract | Must |
|---|---|---|
| `valid/` | structurally valid v4 documents | validate against the meta-schema |
| `invalid/` | structurally invalid documents | be rejected by the meta-schema |

Run: `python3 run.py` → `ALL CONFORMANCE CHECKS PASS`. (Requires `pyyaml`, `jsonschema`; port to your stack as needed.)
