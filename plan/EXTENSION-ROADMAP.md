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
- **S1 ✓ BUILT (commit de851b7).** Environments axis + contract-drift + live cost. `EnvironmentsProvider` tree
  (prod/local defaults, persisted, health dots); **connect** = fetch `{base}/openapi.json` → cockpit projects
  the live contract; **drift** = `diffContracts(local, deployed)` (pure `@suluk/cockpit` fn, 12 tests); **cost**
  = host-fetch `{base}/cost` → `formatMicroUsd`; one-click `openExternal` to the live app / `/superadmin` /
  `/scalar`. No secrets. Adversarially reviewed (9 findings fixed — incl. the op-keying collision that could
  report "in sync" while prod drifted, and the connect-then-diff self-compare).
- **S2 ✓ BUILT (commit 94635df).** `installModule` contract-merge (the load-bearing modules primitive).
  `@suluk/builder`: `SulukModule` + `installModule(doc, mod)` — merges `schemas`/`paths`, applies cost facets,
  **refuses on collision** (entity/route/operation, incl. webhooks + self-collision), **checks `requires`**,
  **validates the merged doc** (fail-closed), never mutates the manifest; `namespaceModule` resolves collisions
  ($ref + op-name + path + cost rename, single-pass). First-party `ECOMMERCE` (Product, Order → `$ref` User,
  checkout, cost, a `payments` slot). `suluk.installModule` in the extension. Proven: cockpit re-projects every
  layer on install (6 integration tests). Adversarially reviewed (13 findings fixed — incl. the path-key
  collision bypass and the substring double-prefix that desynced cost keys).

### MEDIUM — ceiling ~0.6, the moat + the marketplace mechanics

- **M1 ✓ BUILT (commit af9a4b2).** View-as × Environments cross-cut — the moat. `crossCut(doc, viewers)` projects
  one contract through every viewer and surfaces the scope-gated operations + who can reach each; the extension's
  **Compare viewers** matrix + a status-bar **lens** showing the active {env · viewer}. Adversarially reviewed
  (2 findings fixed — auth-only ops now distinguish authenticated from anonymous; the lens no longer claims a
  stale environment). *Remaining for the richer M1: live role-previews of the app via a preview deployment (never
  header-spoof prod).*
- **M2 ✓ BUILT (commit cfcc43c).** Curated module-registry browser. `FIRST_PARTY_REGISTRY` (ecommerce + crm +
  billing); `gradeModule` (an honest conformance grade — cost-coverage minus a doc-warning penalty, C reachable);
  `previewInstall` (contract-diff-on-install — what a module adds/requires/costs + conflicts, no commit). The
  extension's **Browse modules** command: pick (grade shown) → preview webview → modal confirm → install.
  Adversarially reviewed (6 findings fixed — the grade was structurally inflated; now honest). *Remaining for a
  full M2: a remote-registry fetch (shares L1's plumbing) + `burhan-converge` over the merged contract.*
- **M3 ✓ BUILT (commit 5752de3).** Provider slots. `PROVIDER_CATALOG` (payments/auth/email/storage, each with
  first-party + alternative impls of one duck-typed interface), `readProviders`, `swapProvider` (rebind a slot —
  contract unchanged, only the runtime binding differs); modules record `providerSlots` as `x-suluk-providers`;
  a Providers cockpit layer + a swap command. Adversarially reviewed (5 findings fixed — a second install no
  longer clobbers a deliberate swap; provider drift is now reported; malformed input is inert).

### LONG — ceiling ~0.5, originated / aspirational (honestly low)

- **L1 ✓ BUILT (commit 81f7ee9).** The open/remote registry. `parseRegistry` validates an UNTRUSTED registry
  fetched from a URL (accepts well-formed manifests, surfaces the rejected); the extension's source picker
  (first-party / remote / add-a-URL) shows a third-party provenance banner + contract-diff + grade, and installs
  through `installModule`'s gate. Security-reviewed (5 findings fixed — a prototype-pollution gadget closed with
  own-property checks in installModule AND core `resolveRef`, a dangling-$ref backstop, value-shape validation,
  a stream-counted fetch cap, and codicon-sanitized labels so a hostile name can't forge the trust badge).
- **L2 — Non-dev composition.** Compose a platform from modules; the developer wires only the irreducible 20%
  (cross-module relationships, business rules, money edge-cases, migrations). **Honest pitch:** *a non-developer
  composes ~80% — entities, CRUD UI, pages, usage-billing, deploy-prep; a developer wires the 20% that's
  irreducibly imperative; the contract makes that 20% small, legible, and swappable instead of a rewrite.* Not
  "no developer ever."
- **L3 ✓ SHIPPED (0.1.13)** — Round-trip lifecycle made legible: the ship-readiness checklist (`suluk.shipChecklist`)
  walks authored → coherent → confident → generated → deployed on one screen, each failing gate carrying its
  cheapest-next-action — still bounded by the no-creds charter (deploy stays terminal-gated). See "Beyond the
  roadmap" below for the full entry.

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
- **Built since (S1+S2):** the OBSERVE seam (env-aware connect, contract-drift, live cost) and the load-bearing
  install-time contract-merge (refuse-on-collision + requires + namespacing + validate), both adversarially
  reviewed. A real two-module install (ecommerce + a namespaced copy) composes cleanly — the "no working
  multi-module install" gap the Module-Skeptic flagged is now closed at the primitive level.
- **Still aspiration (the honest frontier):** the *curated registry browser* (M2: contract-diff-on-install +
  conformance grade + burhan-converge), the *View-as × Environments* cross-cut (M1), provider-slot swapping
  (M3), and the *open* marketplace (L1, gated on M2). The merge primitive exists; the distribution + trust layer
  does not.
- **THE ROADMAP IS COMPLETE.** S1 · S2 · M2 · M1 · M3 · L1 are all built, adversarially reviewed, and shipped —
  the entire SHORT → MEDIUM → LONG arc. The product the council designed exists end-to-end: one contract,
  refracted through every viewer × environment, composed from graded modules drawn from curated *or* open
  registries, with swappable providers — all observable and editable from the VS Code extension, bounded by the
  no-credentials charter (C020). 38 adversarial-review findings fixed across the six slices.
- **Beyond the roadmap:**
  - **✓ Signed registries (commit 6ca30f1)** — provenance cryptography for L1. `signRegistry`/`verifyRegistrySignature`
    (Web Crypto ECDSA P-256 over canonical bytes); pin a publisher's public key → verify every fetch (valid →
    "signed", invalid → refuse); a `suluk.signRegistry` publisher command. Security-reviewed (1 finding fixed —
    canonicalization of shared references). The open marketplace now has a real trust root.
  - **✓ L2 non-developer composition (commit 11d6971)** — `planComposition`/`composeModules` topologically
    install a set of modules in dependency order; an `auth` module provides the User every other module
    requires; stack templates (SaaS starter / Storefront / Everything) + a "Compose a platform" command turn a
    fresh contract into a whole working platform, no hand-wiring. Reviewed (6 findings fixed — the planner now
    models install collisions, classifies unmet vs cycle correctly, and reports dropped template names).
  - **✓ Converge — coherence audit (commit 0237f1d)** — the `burhan-converge` pass. `convergeContract(doc)` finds
    the cross-cutting contradictions a clean merge leaves behind (dangling `$ref`, orphan scope, undeclared
    scheme, empty path, unreferenced entity); a Converge command + an automatic check in the Compose panel.
    Reviewed (5 false-positive/negative findings fixed — openIdConnect scopes, deep/escaped `$ref`s, webhooks).
  - **✓ D2 diagrams (commit 64183a6)** — `contractToD2(doc, view)`: a diagram is another projection from the
    one contract. ERD (entities + `$ref` edges), the declarative cycle, the operation surface; a Generate-diagram
    command (D2 source + opt-in kroki.io render). Reviewed against the real d2 CLI (2 syntax findings fixed —
    hub/layer collision, reserved-keyword quoting). Reusable into the docs + generated UI (a natural follow-up).
  - **✓ Diagrams in the generated app + docs (commit f8abdbc, 0c3ab87)** — `generateAppFiles` ships the
    contract's `docs/*.d2`; `@suluk/docs` `packageGraphD2` renders the "how the tools compose" diagram on the
    Architecture page (live docs regenerated). Reviewed (4 findings fixed — incl. mdToHtml had no image rule).
    The D2 idea now spans the extension, the generated app, AND the docs.
  - **✓ Component preview + pixel-confidence (commit 2bd37b1)** — surfaces `@suluk/visual`: decompose generated
    forms/tables into widget primitives, check each vs a committed baseline (confident/drifted/pending), verify
    once. Reviewed (a HIGH false-confident bug fixed — the hash now tracks the REAL `@suluk/shadcn` renderer, not
    an isolated mock). The last built-but-unsurfaced package is now in the cockpit.
  - **✓ L3 ship-readiness checklist (commit 3d28e21, cockpit+vscode 0.1.13)** — the round-trip loop as ONE honest
    view. `contractGates(doc, baseline)` aggregates the gates the cockpit already computes (operations · valid ·
    coherent · pixel-confident); the `suluk.shipChecklist` command appends the host gates only it can see
    (generated-in-sync via fs, deployed-in-sync + `/api/health` via network) and renders them with a clickable
    "→ fix" per gate; `shipSummary` rolls it to "ready / N blockers · M to do". One screen: authored → coherent →
    confident → generated → deployed. Reviewed (4 gate-honesty findings fixed; the command-URI/XSS angle was traced
    and is NOT injectable — `gate.action` is always a fixed first-party literal): the checklist now reads ONLY
    explicitly-saved environments (no silent egress to the demo host, at activation or in the checklist), a
    zero-operation contract can't read "ready", and a stale-served-but-dead deploy reads `warn` not green. A new
    non-blocking `info` gate status surfaces n/a conditions without ever making a clean contract look not-ready.
    **The originated L3 is now shipped — the whole arc, authored → deployed, is legible on one screen.**
  - **✓ Live role-preview (commit pending, builder 0.1.10 · better-auth+deploy 0.1.2 · cockpit+vscode 0.1.14)** —
    the LAST roadmap item, charter-bounded. Open the running app AS any role (anonymous/user/admin/superadmin)
    against an EPHEMERAL preview deployment. The extension holds NO token: `suluk.previewAsRole` deep-links the
    preview deploy's own `/preview/login?role=…` in the BROWSER (pure, unit-tested `previewLaunchUrl`; targets
    ONLY a `kind:"preview"` env, default `"prod"` so all existing envs are fail-closed). The credentialed mint
    happens server-side in `previewLoginHandler`, FAIL-CLOSED behind two independent locks (`SULUK_PREVIEW="1"`
    AND a `PREVIEW_DB` binding), bound to a seeded demo user. A first-party `preview` module carries the op
    (`x-suluk-preview-only`), EXCLUDED from the registry + templates; `previewDeployPlan` is terminal-gated like
    prod; a converge WARN + a ship-gate + a prod-deploy modal keep the backdoor from leaking silently. Designed by
    a 9-agent council/recon/security workflow, then hardened by an 8-dimension adversarial review (22 findings
    examined, 10 fixed — incl. a HIGH supply-chain hole where a remote module could smuggle the op and still read
    "ready to ship"). **The roadmap now has NO items left — every horizon is shipped + reviewed.**
