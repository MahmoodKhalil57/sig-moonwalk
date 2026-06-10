# EXTENSION-ROADMAP — Suluk as the cockpit + the module marketplace

> The **product** spine (sibling to [`STATE.md`](./STATE.md), which is the *spec-walk* spine). It records the
> decided direction for the VS Code extension and the module ecosystem, the horizons, and the recursive state
> that survives session-mortality. Decided by a 6-lens product council (2026-06-10); guides below carry honest
> ceilings. ADRs: [C020](../doc/architecture/decisions/C020-extension-cockpit-charter.md) (cockpit charter),
> [C021](../doc/architecture/decisions/C021-modules-contract-merge-marketplace.md) (modules + marketplace).

## The thesis (two axes, one source)

Everything Suluk derives — data, API, docs, typed client, UI, cost, auth, tests, deploy — is a **projection of
one v4 contract**. The product is the place where you compose that contract and watch every projection move:

1. **The cockpit axis** — the extension is a *single pane of glass* over a living app: the one contract,
   refracted through all 9 layers, for a given **viewer** (View-as scopes) and a given **environment**
   (local / preview / prod). Not "manage everything live" — see [the seam](#the-decided-architecture).
2. **The module axis** — a platform is *composed* from installable building blocks (ecommerce, crm, auth,
   billing…). A module = **a contract fragment + its projections + swappable provider bindings**. Because Suluk
   owns the contract, modules genuinely *interoperate* (a shared entity is one schema, not two copies). The
   distribution layer is the **shadcn registry protocol Suluk already emits** — the marketplace rides on it.

The moat (Skeptic + Visionary agreed): **no other tool can show one contract refracted through every layer for a
given viewer × environment, then let you compose more of it from modules that compose** — because no other tool
owns the derivation. CF dashboard, Postman, Scalar, Storybook each see one slice. Concentrate there; link out
for the rest.

## The decided architecture (C020) — the EDIT / OBSERVE / WRITE seam

| Mode | Where it runs | Reversible? | Creds? |
|---|---|---|---|
| **EDIT** — author the contract, re-derive projections, land files | local, file-based | yes (it's your repo) | none |
| **OBSERVE** — read the live Worker (`/openapi.json`, `/cost`, `/api/health`, `/superadmin`, `/scalar`) | extension host `fetch` | n/a (read-only) | host-only (`SecretStorage`), never in a webview |
| **WRITE-to-prod** — change the running system | a **deploy** (file-gen → `wrangler` in *your* terminal) | gated | your terminal, never the extension |

**Charter line (do not cross):** *the extension authors contracts and renders projections; it does not operate
infrastructure.* Every irreversible/live action exits to a gated surface (the existing `/superadmin`, or the
terminal). This keeps the no-credentials invariant the current design already has — the load-bearing safety
property the "manage everything live" framing would have broken.

**The free, load-bearing move (Architect):** the deployed Worker emits its *own* `/openapi.json` from the *same*
builder — so the extension can fetch it and **diff local-contract vs deployed-contract**. That diff *is* the
"what's drifted in prod" view, and it's essentially free (`openFromUrl` already fetches a remote doc).

## Horizons

### SHORT — high ceiling (~0.8), invariant to the vision still forming

- **S0 ✓ SHIPPED (0.1.1)** — the cockpit became *interactive*: every Cycle/Builder row is an action (reveal in
  source · validate · run checks · Scalar/Swagger preview · generate stores/form/table). Onboarding welcome
  (Open a sample / Load from URL). `saasuluk/openapi.json` committed so the demo lights up on open. The last v4
  doc is **pinned** so generating an artifact no longer blanks the trees.
- **S1 — Environments axis + contract-drift + live cost.** `EnvironmentsProvider` tree (local / preview / prod
  base URLs, persisted in `workspaceState`); **connect** = fetch `{base}/openapi.json` → pin → cockpit projects
  the *live* contract; **drift** = `diffContracts(local, deployed)` (NEW pure fn in `@suluk/cockpit`, tested) →
  added/removed/changed ops+schemas; **cost** = host-fetch `{base}/cost` → render `@suluk/cost` `summarize`;
  **health** dot from `{base}/api/health`; one-click `openExternal` to the live app / `/superadmin` / `/scalar`.
  No secrets. ~200 LoC. *Reuses: cockpit, cost, deploy. Ceiling 0.82.* **← cheapest-next-move.**
- **S2 — `installModule` contract-merge** (the load-bearing modules primitive). `@suluk/builder`: a
  `SulukModule` manifest type + `installModule(doc, mod)` that merges `schemas`/`paths`, applies cost/auth
  facets, **namespaces entities, rewrites `$ref`s, refuses on collision, checks `requires`** — plus ONE
  first-party `ecommerce` manifest (`Product`, `Order → $ref User`, a checkout op + `x-suluk-cost`, a `payments`
  slot, seed) + tests. `suluk.installModule` merges into the active doc → the cockpit lights up the new
  entities/ops/cost for free. *Reuses: builder registry, stripe provider pattern. Ceiling 0.72 — but this is THE
  product; build the merge discipline carefully (see C021).*

### MEDIUM — ceiling ~0.6, the moat + the marketplace mechanics

- **M1 — View-as × Environments cross-cut.** Project all 9 layers for {principal} × {env} at once; live
  role-previews of the app via a **preview deployment with a real session** (never header-spoof prod). Host
  fetches, webview renders via `postMessage`.
- **M2 — Module registry browser (curated).** Install from a shadcn-registry-compatible URL (reuse the protocol
  Suluk already emits). **Contract-diff-on-install** (show exactly what schemas/routes/tables a module
  adds/touches) + a **conformance grade** (reuse `@suluk/hono` `audit`) + **`burhan-converge` over the merged
  contract** to catch cross-module contradiction. First-party registry first: ecommerce / crm / auth / billing.
- **M3 — Provider-slot generalization.** Lift `@suluk/stripe`'s duck-typed `PaymentProvider` to a per-facet
  **slot** concept `{ payments, auth, email, storage }`; "swap a provider" UX in the extension. The slot
  interface is the visible seam a developer reads to understand *why* — exactly the user's intent.

### LONG — ceiling ~0.5, originated / aspirational (honestly low)

- **L1 — Open marketplace.** *Any* user contributes modules. Gated behind everything in M2 (namespacing
  enforced, contract-diff review, conformance gate, trust/signing). **Curated earns the right to open** — an
  open marketplace before the merge-discipline is "npm with a nicer icon" and a supply-chain hole.
- **L2 — Non-dev composition.** Compose a platform from modules; the developer wires only the irreducible 20%
  (cross-module relationships, business rules, money edge-cases, migrations). **Honest pitch:** *a non-developer
  composes ~80% — entities, CRUD UI, pages, usage-billing, deploy-prep; a developer wires the 20% that's
  irreducibly imperative; the contract makes that 20% small, legible, and swappable instead of a rewrite.* Not
  "no developer ever."
- **L3 — Round-trip lifecycle.** Edit contract → re-project → deploy; environment lifecycle management — all
  still bounded by the no-creds charter (deploy stays terminal-gated).

## DECLINE / link-out (do not build — the better tool exists)

- Live **logs / status / deploy-history** → the **Cloudflare dashboard** + `wrangler tail` (don't reskin a
  console CF maintains + authenticates).
- **User-CRUD on prod data** → the existing **`/superadmin`** (`@suluk/admin`, web, auth-gated) — the IDE is the
  wrong host for operating on live rows.
- **Docs portal** → **Scalar/Swagger** (you generate them; a preview is for the authoring loop, not a portal).
- **Live-app proxy / role previews of prod** → the **browser** (session/cookie hazards; preview-deploy for roles).
- **Interactive component gallery** → **`@suluk/visual`** (hash-based pixel-confidence, build-time) — not a
  worse Storybook.

## Council scorecard (2026-06-10, 6 lenses, ceilings)

| Lens | Verdict in one line | Ceiling |
|---|---|---|
| Pragmatist | The live Worker already exposes every surface as HTTP — the unlock is *wiring*, not building | 0.75 |
| Visionary | "Flight controls for your product": contract × env × role, every dial a read-out *and* a lever | 0.62 |
| Architect | The EDIT/OBSERVE/WRITE seam is sound; drift is free; risk is the credentialed/iframe surfaces | **0.82** |
| Skeptic | Concentrate on the moat; link out for CF/Scalar/browser; keep the no-creds invariant | 0.72 |
| Module-Architect | A module = a mergeable contract fragment; reuse registry + provider-slot; merge is mechanical | 0.72 |
| Module-Skeptic | The product IS the install-time contract-merge (namespace/ref-rewrite/refuse); curate before open | 0.62 |

## Recursive state (the digest that survives session-mortality)

- **Shipped:** Suluk framework 0.1.1 live on npm (18 `@suluk/*`), crates.io (`suluk-core`), Marketplace
  (`MahmoodKhalil.suluk-vscode`). The cockpit is interactive; saasuluk is deployed + has a committed contract.
- **Decided:** the cockpit charter (C020) + the modules/marketplace architecture (C021). The seam and the
  decline-list are settled; the horizons are sequenced.
- **Not yet built (the gap):** *every* OBSERVE surface (env-aware fetch, drift, live cost) and the *entire*
  module-merge layer. The "complete interacting platform" is currently aspiration — **no working multi-module
  install exists in the repo yet** (Module-Skeptic, capped 0.62). That is the honest frontier.
- **Cheapest-next-move:** **S1** (Environments + drift + cost) — invariant to the vision, no secrets, proves the
  OBSERVE seam end-to-end. Then **S2** (`installModule`) — the load-bearing modules primitive; do the
  namespacing + collision-refuse discipline *first*, prove it with the `ecommerce` module, *then* the registry
  browser (M2), *then* open the marketplace (L1).
