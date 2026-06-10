# C20. The extension is the cockpit — the EDIT / OBSERVE / WRITE seam + the no-credentials charter

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Decides what the VS Code extension *is* as a
> product: a single pane of glass over the declarative cycle, bounded by a hard seam between authoring (local,
> file-based, reversible) and operating (the live Worker, read-only) — never an IDE into production. Decided by a
> 6-lens product council (2026-06-10). Roadmap: [`plan/EXTENSION-ROADMAP.md`](../../../plan/EXTENSION-ROADMAP.md).
> Sibling: [C021](./C021-modules-contract-merge-marketplace.md) (modules + marketplace).

Date: 2026-06-10

## Status

Accepted (candidate-fork). The **seam** and the **no-credentials charter** are load-bearing and hard-to-reverse
(they shape every future surface) — ceiling **0.82** on the architecture (Architect lens), discounted by the
unbuilt credentialed/iframe surfaces. The cockpit *interactivity* slice (S0) is shipped (0.1.1); the OBSERVE
surfaces (S1+) are decided but not yet built.

## Context

The operator's vision: the extension should let you "view and manage local/preview/production environments,
change UI/UX/business logic, manage users, check logs/status, see Scalar docs, the superadmin/admin/user
panels, component previews — do and manage everything from the extension." Taken literally, "manage everything
live" pushes the extension toward holding production credentials and mutating a running system from the IDE —
which breaks the no-credentials invariant the current design has (it generates files and writes a deploy plan,
but **never runs `wrangler`** and never holds a token).

The live example (saasuluk) already exposes every "manage" surface as HTTP: `/openapi.json`, `/cost` (durable
ledger), `/api/health`, `/superadmin` (the `@suluk/admin` cockpit, auth-gated), `/scalar`, CRUD, Better Auth.
So the question is not "build these" but "where is the line between the extension *observing* them and the
extension *becoming* them."

## Decision

**One seam, three modes:**

- **EDIT** = local, file-based, re-project. Authoring the v4 contract (or a Drizzle/Zod source) and re-deriving
  projections (`generate*`, `deployPlan`). Offline, no network, no credentials, reversible (it's your repo).
- **OBSERVE** = talk to the live Worker, **read-only by default**. The extension is a *client* of the Worker's
  endpoints, never a reimplementation. All credentialed calls happen in the **extension host** (Node `fetch` +
  `vscode.SecretStorage`); only rendered results cross into a webview (`postMessage`). Webviews never hold
  tokens and never header-spoof a role onto a cross-origin iframe.
- **WRITE-to-prod** = a **deploy**, which is file-generation followed by `wrangler` in the user's own terminal
  (creds via `wrangler login`, never via Suluk). Every irreversible/live action exits to a gated surface.

**Charter line:** *the extension authors contracts and renders projections; it does not operate infrastructure.*

**Free load-bearing capability:** the deployed Worker emits its own `/openapi.json` from the same builder, so
the extension can **diff local-contract vs deployed-contract** — the canonical "what's drifted in prod" view, at
the cost of one fetch.

**Decline / link-out** (the better tool exists): logs/status/deploy-history → Cloudflare dashboard +
`wrangler tail`; user-CRUD-on-prod → the existing `/superadmin`; docs portal → Scalar; live-app/role previews of
prod → the browser (or a preview deployment); interactive component gallery → `@suluk/visual`.

## Consequences

- **(+)** Preserves the no-credentials safety property; a misclick can never mutate prod from the authoring
  surface. Concentrates effort on the moat (contract × environment × viewer) instead of reskinning CF/Postman.
- **(+)** The drift diff and live-cost/health reads are buildable now with no secrets (slice S1).
- **(−)** "Manage everything live from the IDE" is explicitly *not* delivered — role/user/infra operations exit
  to `/superadmin`, the browser, or the terminal. Accepted: that is the correct host for those, and the IDE's
  win is authoring + projection, which it does better than a web panel.
- **Revisit if** a credentialed-but-safe pattern (host-side `SecretStorage` + audited write endpoints on the
  Worker) proves out — then *bounded* OBSERVE-with-writes could extend the seam without holding infra creds.
