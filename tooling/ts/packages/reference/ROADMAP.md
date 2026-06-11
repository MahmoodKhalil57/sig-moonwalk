# @suluk/reference — Platform Roadmap & Architecture

> **Status:** DRAFT for ratification. This document is the contract we build against. It defines the renderer as a
> *product platform* (not a spec-to-HTML function), the layered architecture (a versioned semantic IR + adapters +
> extension seams), the competitive feature matrix in MVP / Parity / Differentiator tiers, and a phased plan.

## 0. Thesis

A v4 reference is not a renderer of a static document — it is a **projection viewer over a live contract-function**.
Scalar proves the broader lesson: a serious OpenAPI viewer is a *platform* (parser → semantic model → renderer →
execution → plugins → portal), not a pretty Swagger UI. The architectural rule we adopt:

> **Extend the UI, build the core.** The moat is the v4 *semantic core* — the normalized model + the cost / access /
> signature / projection facets + the execution model. The chrome (sidebar, schema tree, search) is commodity.

**Honest current state.** `referenceHtml(doc)` is a **monolith**: it couples parsing, the semantic model, rendering,
and (eventually) execution into one function that emits HTML+CSS+JS in one string. It works and is live, but it is
exactly the coupling the Moonwalk guidance warns against. This roadmap's first structural act is to cut it into
layers around a versioned IR, so OAS-4 shape changes touch *one translator*, and try-it / code-samples / curl all
consume *one normalized request object*.

---

## 1. Competitive feature matrix

### Tier 1 — MVP (a credible renderer) — **shipped**
Named-request cards · schema tree with `$ref` + cycle guard · sidebar search (⌘K) · scroll-spy · deep-linking ·
collapse / expand-all · dark mode · copy-as-curl · generated request/response examples · auth panel · Models section.
Plus two early differentiators already live: **View-as access lens + reachability matrix**, **cost badges + coverage + drift**.

### Tier 2 — Parity with Scalar (the platform surface we lack)

| Area | Gap | Source |
|---|---|---|
| **Execution** | Interactive **try-it** (browser fetch + proxy + mock adapters), auth persistence, server override, pre-request + request-mutation hooks — all consuming **one normalized request object** | platform analysis |
| **Code samples** | Multi-language matrix (curl ✓ / JS-fetch / Python / Go), default-client + hidden-clients controls, honor `x-codeSamples` | review F9 |
| **Auth flows** | API-key/basic/bearer ✓ display, but no **OAuth2/PKCE** flows, prefill, scope presets, token-location overrides | analysis |
| **Schema constraints** | `minLength`/`maximum`/`pattern`/`multipleOf`/`uniqueItems`/`readOnly`/`writeOnly`/`nullable`/field-`deprecated` are **dropped entirely** | review F2 (HIGH) |
| **Composition (C012)** | Renderer shows the **authored** request, not the **effective** one (`shared.parameterSchema`, `pathResponses`, `apiResponses` ignored) — a correctness gap against our own petstore example | review F1 (HIGH) |
| **Servers** | `servers[0]` hardcoded — no selector for prod/staging/sandbox; per-path/per-op `servers` overrides ignored | review F4 |
| **Tags** | `doc.tags[t]` (summary/description/type/order, C009) never read — group headings are raw strings | review F3 |
| **Markdown** | Only inline code + bold; block descriptions render run-together | review F5 |
| **Portal** | Single document only — no multi-document / multi-config portal, models search | analysis, review F7 |
| **Extensibility** | No **plugin API / lifecycle events** (the thing you must not retrofit) | analysis |
| **A11y** | Op cards mouse-only (no role/tabindex/keyboard/aria); matrix glyphs no text alt | review (a11y bug) |
| **Perf** | No large-spec guards (lazy/virtualized model rendering) | analysis |

### Tier 3 — Differentiators (the moat — v4-only; structurally impossible in a 3.x tool)

| Facet | Element | State |
|---|---|---|
| **Cost** | badge + source breakdown ✓ · coverage rollup ✓ · **declared-vs-actual drift** ✓ · cost **Explorer** (sort/filter by source) · **Workflow Cost Calculator** (sum a sequence → per-flow µ$) | partly shipped |
| **Access** | **View-as lens** + **reachability matrix** ✓ · owner-scope as a distinct state (◐) · env axis | shipped (scope fix pending) |
| **Dispatch** | **signature collision diagnostic** (3-valued) ✓ · **ADA resolution playground** ("which op does this request resolve to?") | partly shipped |
| **Projection** | **Projection panel** — one contract → Drizzle table / schema / typed client / UI / cost / deploy secrets | not built |
| **Composition** | authored↔effective toggle (depends on the C012 fix above) | not built |
| **Agent** | **"ask the contract" AI** + expose the contract as **MCP** (Scalar has AI/MCP; ours rides the whole Suluk substrate) | not built |

---

## 2. The layered architecture

```
 ┌── ingest ─────────  fetch · parse · validate · dereference            (mostly @suluk/core)
 │
 ├── semantic IR ─────  normalize(doc) → RefDoc                           ★ THE CORE — build this
 │                      versioned: one parse-adapter per spec generation  one translator per OAS gen
 │                      produces a NORMALIZED REQUEST object              try-it + samples + curl share it
 │
 ├── UI adapters ─────  sidebar · op page · schema browser · code samples · auth modal · search · matrix
 │
 ├── execution ───────  browser-fetch · proxy · mock                      (separate from UI)
 │
 └── plugins ─────────  slug · sort · route · fetch-override · request-mutation · events · render-slots
```

### 2.1 The semantic IR (the heart — "build the core")

`normalize(doc, { dialect }) → RefDoc`. Never throws; lossy/dangling inputs become `diagnostics`, not exceptions.

```ts
interface RefDoc {
  spec: { dialect: "suluk-v4" | "oas-3.1" | "oas-3.0" | "swagger-2"; version: string };
  info: { title: string; version: string; description?: string };
  servers: ServerEntry[];
  tags: TagEntry[];                       // resolved from doc.tags map (summary/description/type/order)
  operations: NormalizedOperation[];      // FLAT, each with a path-scoped stable id
  models: ModelEntry[];                   // components.schemas (lazy-resolved)
  security: SecuritySchemeEntry[];
  diagnostics: Diagnostic[];              // dangling refs, collisions, lossy upgrades — surfaced, never thrown
}

interface NormalizedOperation {
  id: string;                             // `${slug(path)}__${slug(name)}` — fixes the duplicate-name collision
  name: string;                           // the v4 by-name handle (C009)
  method: string; path: string; tag?: string;
  summary?: string; description?: string; deprecated?: boolean;
  request: NormalizedRequest;             // the EFFECTIVE (C012-composed) request — the shared object
  responses: NormalizedResponse[];        // effective: request > pathResponses > apiResponses, by name+status
  security: string[];                     // referenced by name (C014)
  servers?: ServerEntry[];                // per-op override (else path, else doc)
  cost?: CostFacet;                       // x-suluk-cost (estimate + components by source)
  access?: AccessFacet;                   // x-suluk-access (requires + scope)
  signature: { tuple: SignatureTuple; collisions: CollisionNote[] };  // ADA identity + verdicts
  inherited: { params: string[]; responses: string[] };              // provenance for the authored↔effective toggle
}

interface NormalizedRequest {             // consumed by try-it, curl, code-samples, AND the renderer — one source
  method: string; path: string;
  slots: { in: "path" | "query" | "header" | "cookie"; params: NormalizedParam[] }[];
  body?: { contentType: string; schema: unknown; example: unknown };
}
interface NormalizedParam { name: string; required: boolean; schema: unknown; example: unknown; description?: string }
```

### 2.2 Adapter interfaces

```ts
interface RenderAdapter { render(ir: RefDoc, opts: RenderOptions): string }          // HTML-string (default); a React adapter later
interface ExecutionAdapter { send(req: ResolvedRequest): Promise<ResolvedResponse> } // browser-fetch | proxy | mock
```
A `ResolvedRequest` is a `NormalizedRequest` with the user-supplied parameter values + auth applied — the SAME object
the code-sample generators stringify, so try-it and "copy as curl/JS/Python" can never drift.

### 2.3 Plugin API (lock the seams before v1)

```ts
interface ReferencePlugin {
  name: string;
  onNormalize?(ir: RefDoc): RefDoc | void;            // mutate the IR (add facets, hide ops, …)
  slug?(op: NormalizedOperation): string;             // custom anchors / routing
  sortOperations?(a: NormalizedOperation, b: NormalizedOperation): number;
  sortTags?(a: TagEntry, b: TagEntry): number;
  beforeRequest?(req: ResolvedRequest): ResolvedRequest;   // try-it hook
  afterResponse?(res: ResolvedResponse): void;             // observability
  codeSample?(op: NormalizedOperation, lang: string): string | undefined;
  slots?: { heroAfter?: (ir: RefDoc) => string; opCardAfter?: (op: NormalizedOperation) => string };
}
```

### 2.4 The OAS-4 upgrade hedge
`normalize()` is a **versioned parse adapter** per dialect (`suluk-v4`, `oas-3.1`, …) all producing one `RefDoc`. When
OAS-4 shifts an object shape (e.g. deployment/server modeling), we update one translator — UI, execution, samples,
and facets are untouched. This is the Moonwalk separation-of-concerns lesson, applied now.

---

## 3. Phase 0 — Hardening (from the completeness review; do before/with the IR cut)

| # | Issue | Sev | Effort |
|---|---|---|---|
| H1 | A dangling `$ref` (typo/renamed/removed component) **throws and crashes the whole page** — `deref()` unguarded in `schemaHtml`/`sampleOf`. Fix: try/catch → degrade to the existing dangling-ref chip / `{}`. | HIGH | S |
| H2 | **Duplicate DOM ids** — `op-${name}` collides when a name (`create`/`list`) recurs across paths (legal in v4). Breaks anchors, scroll-spy, View-as. Fix: path-scoped id everywhere. | MED | M |
| H3 | **Op cards mouse-only** (no role/tabindex/keyboard/aria; matrix glyphs no alt). Fix: real buttons + aria + skip-link + lens radiogroup. | MED | M |
| H4 | **Owner-scope reachability is cosmetic** — `reachable()` ignores `scope`; an owner-scoped op shows the same ● as a plain authenticated one. Fix: distinct ◐ state + thread `scope` into `data-reach`/legend. (Honesty: violates our own "contract refracted per viewer".) | MED | M |
| H5 | **Drift never fires for a declared-$0 op** (`!declared` short-circuit). Fix: distinguish "no cost" from "declared 0"; show absolute delta. | LOW | S |
| C1 | **Effective-vs-authored composition (C012)** — renderer shows authored, not effective (ignores `shared`/`pathResponses`/`apiResponses`). Correctness, not polish. (Lands naturally in the IR's `request`/`responses` normalization.) | HIGH | M |
| C2 | **Schema constraints dropped** — `min/max/pattern/format/nullable/readOnly/...` not rendered. (Lands in the IR's schema view.) | HIGH | M |

Quick wins (effort-S, batchable): H1, H5, tag-descriptions, response-content-type, models-searchable.

---

## 4. Phased build plan

- **Phase 0 — Harden** (above). Ship the bug fixes + the two correctness gaps. The renderer stops failing closed.
- **Phase 1 — Cut the core.** Extract `normalize(doc) → RefDoc` (the IR), move rendering to a `RenderAdapter` that
  consumes `RefDoc`. C012 composition + schema constraints + tag descriptions + server selector fall out of the IR
  naturally. *Deliverable:* same HTML, now from the IR; `diagnostics` surfaced; one path-scoped id source.
- **Phase 2 — Execution.** The `NormalizedRequest` → `ExecutionAdapter` (browser-fetch first; proxy/mock seams).
  Interactive **try-it**, auth prefill (incl. OAuth2/PKCE), **multi-language code samples** all consume the same
  request object. *Deliverable:* send a request; copy it as curl/JS/Python from one source.
- **Phase 3 — Platform.** Plugin API + lifecycle events; multi-document / multi-config **portal**; sorters / slug /
  routing; large-spec perf guards. *Deliverable:* one portal for many APIs/versions; third-party extensions.
- **Phase 4 — Differentiators.** Cost **Explorer** + **Workflow Calculator**; **ADA resolution playground**;
  **Projection panel** (one contract → every layer); authored↔effective toggle; **"ask-the-contract" AI / MCP**.
  *Deliverable:* the moat — the things no 3.x tool can copy.

---

## 5. Build-vs-borrow
**Build the core** (IR + facets + execution model + plugin seams) — it is the differentiator and the OAS-4 hedge.
**Borrow nothing structural.** The design brief's conclusion stands: owning the shell is cheaper than wrapping
Scalar's Vue once we re-derive per viewer; the only borrow worth considering is a leaf JSON-Schema tree component,
and even that is small. Scalar/Swagger remain available as the labeled **3.1 compatibility view** (`/scalar`).

## 6. Ratification — what "v1 platform" means
1. `normalize()` is the only place that reads raw spec shapes; everything downstream consumes `RefDoc`. ✔ testable.
2. try-it, curl, and every code-sample stringify the *same* `ResolvedRequest`. ✔ no drift by construction.
3. The plugin API + events exist and are covered by a real third-party-style plugin in tests.
4. A dangling ref, a duplicate name, a multi-server doc, and a composed (C012) operation all render correctly.
5. The five Tier-3 facets render from the IR, not bolted on.

*Sign-off here ratifies the architecture; Phase 0 begins immediately on ratification.*
