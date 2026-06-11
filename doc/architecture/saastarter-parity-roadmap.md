# saastarter → Suluk parity roadmap (ecosystem placement)

> **Provenance.** Synthesized 2026-06-11 from a 37-agent workflow (`saastarter-parity-suluk-placement`,
> run `wf_2f16d1c5-b77`): 14 inventory readers over the saastarter rewrite-handoff (`docs/rewrite-handoff/` +
> the 1490-line `PARITY.md`) + the current `@suluk/*` surface + saasuluk's implemented state; 11 per-domain
> gap-analysis passes, each adversarially reviewed; one synthesis. Goal (operator's framing): bring saasuluk to
> saastarter feature-parity **without rush-hardcoding into the app** — decide where each feature belongs in the
> Suluk ecosystem and which package to update or create, contract-first, respecting the L3 line (generators emit
> owned source/projections/host-bindings, never a hosted runtime).

## The headline finding

saasuluk already realizes the contract-first thesis structurally (one entity registry → CRUD, access, cost,
provenance, auth, docs, SDK, conformance, deploy). **The gap to parity is not architectural** — it is (a) a few
trust/correctness holes the advisory-facet model leaves open, and (b) breadth of reusable mechanisms no `@suluk`
package owns yet (email, i18n, theming, the checkout money-path, server-side enforcement).

The reviewers' main correction: a first pass implied ~16 new packages; **only three survive scrutiny**
(`@suluk/email`, `@suluk/i18n`, `@suluk/theme`). Everything else **extends** an existing package or is honestly
app/framework work. Favor extending over creating.

### Verified, calibrated: the analytics exposure

`GET /analytics/{summary,revenue,top-products}` are public (anon → 200 with revenue/order/customer counts). The
workflow called this a "world-readable-despite-admin-facet" hole; **verified against source, the facet declares
`requires: "anyone"`** — so it's a *design choice on demo data*, not a facet-vs-wire divergence (the conformance
suite passes). The genuinely important finding it proves: **custom ops are raw `app.get` handlers that never call
the gate**, so the access facet is *decorative* on them. There is **no reusable server-side enforcement primitive
in any `@suluk` package** — RBAC enforcement lives only in saasuluk's CRUD factory + ad-hoc per-handler. That is
the Phase-0 fix.

## Three new packages (the only ones that survived review)

| Package | Purpose | Priority |
|---|---|---|
| **`@suluk/email`** | The missing `EmailProvider` binding (`builder/providers.ts` declares an email *slot* with no `pkg`). Interface + `resendProvider` + dev `consoleProvider` + a pure `renderEmailHtml(options)→HTML` generator (parallel to `@suluk/shadcn` render-form) with a per-event/per-locale template set (verify/reset/change-email/delete/order-confirmation/order-status/newsletter). Emits content the app **sends** — never a hosted mailer. Consumes `@suluk/env` (key), `@suluk/i18n` (strings), `@suluk/cost` (third-party send cost). | P1 |
| **`@suluk/i18n`** | The locale primitive every content app needs: `SupportedLocale`/direction model, typed `Messages<N>` catalog shape (compile-time key-parity + harden-style completeness grade), a Workers-safe loader (`getMessages` + English fallback + `t()` interpolation + `dirOf`), `Intl` number/currency/date formatting (incl. Eastern-Arabic numerals), server cookie→locale resolution, and an `./astro` subpath for middleware glue. Catalog *content* stays app-authored. Consolidates ≥4 fragmented i18n proposals into one package. | P1 |
| **`@suluk/theme`** | The design-token **contract**: a typed `TokenSpec` (colors/fonts/shadows/radius + type & spacing scales + breakpoints) projecting into CSS vars, the Tailwind v4 `@theme` block, shadcn token maps, and `@suluk/visual` baselines. OKLCH value-type + deterministic generate-dark-from-light; 2–3 reference schemes prove the mechanism (the 40+ curated catalog is meta-product breadth). **No `@suluk/astro`** — the no-flash stamper/toggle/picker is one thin app-layer helper, not a package. | P1 |

## Phase 0 — trust & correctness (smallest code, highest stakes)

Verified holes where the advisory-facet model leaves the server unguarded. **Enforcement must be EXTRACTED into
packages** so every Suluk app inherits it, not patched per-app.

- **`@suluk/hono` — reusable enforcement middleware** `requireScopes`/`requireAdmin` returning 401/403 on the wire
  (today `mount.ts` wires only `zValidator`; `route.scopes` only drives the emitV4 *projection* filter). Route ALL
  custom ops through it; close the analytics exposure. **The single most important architectural fix** — it makes
  the access facet load-bearing on custom ops, not decorative.
- **`@suluk/hono` — rate-limit** `x-suluk-ratelimit` facet + middleware, backed by a swappable durable store
  (the KV/Durable-Object counter is a `@suluk/deploy` binding; the in-memory Map is **not** the default). Enforce
  on public-submission / auth / payment endpoints.
- **`@suluk/hono` — error model** typed-throw→status mapper (401/403/400/404/409/402/429/500) + an RFC-9457
  Problem Details envelope synthesized into emitV4 (today `emit.ts` defaults to 200, synthesizes no error
  responses) + `Retry-After` on 429. Load-bearing for the SDK `isApiError` guard + testgen error-conformance.
- **`@suluk/core`** — shapes/plumbing for the new advisory facets (`x-suluk-ratelimit`, the error-envelope type)
  following the `x-suluk-cost/access/source` precedent; **property-level facet locus** (so `@suluk/drizzle` can
  emit an `x-suluk-i18n` localized-field facet — core's facets are operation-level today).
- **`@suluk/env` — fail-closed startup gate** extend `VarSpec` with validators (pattern/minLength/required-in-
  surface) + `assertEnv()` that throws/exits on a misconfigured secret in prod (today `parse()` only catches
  missing-required; health is display-only). Test-key-in-prod + auth-var-required-in-prod warnings. **The only
  item that fails closed.**
- **`@suluk/stripe` — money correctness** side-effect-free pricing primitives authored once + conformance-tested:
  `verifyAmount` (anti-tampering recompute), intent-reuse + idempotency-key threading (double-charge prevention),
  `computeDiscountAmount`/`validateDiscount`/`prorateDiscount` (so cart-drawer and order-summary can't drift).
  `@suluk/better-auth` scope-aware `verifyApiKey` + `beforeDelete` GDPR cascade. `@suluk/testgen` acceptance tests
  encoding PARITY §2 checkout-resilience.

## Phase 1 — core parity mechanisms

The three new packages + payment/data depth.

- **`@suluk/email`** (full provider + template set); wire order-confirmation/status into the builder ecommerce module.
- **`@suluk/stripe` checkout money-path**: `createCheckout`/PaymentIntent + saved-card vault + `getOrCreateCustomer`
  + typed webhook **event-router** (over the existing `verifyWebhook`).
- **`@suluk/drizzle`**: list query-param synthesis (pagination/filter/sort/`q`), relation/FK projection (single-table
  today), soft-delete/timestamps/anonymize-delete `CrudOptions`, unique-index metadata, discount/redemption junction
  tables.
- **`@suluk/builder`**: flesh the ECOMMERCE module (carts/variants/discounts/reviews/wishlist) from its 2-entity
  exemplar; extend the AUTH module with **Session/Account/Verification** entities (only `User` exists today — this
  blocks the security-tab sessions table) + `emailVerified`/`image`; NEWSLETTER + CMS first-party **modules** (the
  C021 `SulukModule` mechanism — do **not** create `@suluk/cms`; graduate only on demonstrated outgrowth).
- **`@suluk/admin`** per-entity **data-admin mode** (project each schema + its access scope into create/edit forms +
  list tables over the generic CRUD — the strongest contract-first admin item) + a gated analytics dashboard
  (depends on the Phase-0 enforcement fix). **`@suluk/better-auth`** 2FA/passkey/org plugin-ingest + Principal
  extension (or scope-encoding).

## Phase 2 — i18n, theming, generated-UI adoption (parity breadth + thesis proof)

- **`@suluk/i18n`** + **`@suluk/theme`** land here (model/loader/Intl + TokenSpec/OKLCH/emitter); `@suluk/shadcn`
  consumes the TokenSpec (`@theme`/`components.json`) and switches to **logical-property output** (`ps-/pe-/start/
  end`) — *physical props are silently broken under RTL* (P1 correctness, fixes every generated form/table at once).
- **`@suluk/shadcn`** generated-form UX layer (aria-invalid/disabled/spinner/clear-on-change/label-association/
  reset-on-success) + richtext/address/enum/date/file/relation widgets; `@suluk/zod` Lexical-tree typing.
- **Wire `@suluk/sdk` + `@suluk/nano-stores` (with net-new optimistic+rollback) INTO saasuluk's pages**, replacing
  raw `fetch()` — *demonstrate the thesis in the reference app* (surfaces are derived, not hand-authored).
- **`@suluk/deploy`**: push declared secrets into the target (`wrangler secret put`, decrypt-from-PQC) + contract-
  delta → additive migration SQL + provision durable bindings (KV/DO for rate-limit+cost, Queues for jobs, R2).
- **`@suluk/builder` marketing SECTION tier** (landing-as-projection: hero/features/pricing-from-Stripe/testimonials-
  from-Review/faq-from-Faq/footer) + a `seoMeta` field-group module + per-entity JSON-LD.

## Phase 3 — polish & breadth (never gating)

`@suluk/theme` 40+ curated catalog + fonts; `@suluk/shadcn` detail/show views + skeletons; app-layer felt-UX in
saasuluk (no-flash stamper, scheme picker, toasts, command palette, cart drawer, nav-progress — one thin Astro
helper); `@suluk/admin` Recharts; `@suluk/email` audience-sync; media/upload via the `StorageProvider` slot (R2 +
variants); `@suluk/reference` facet panels (env-health/drift/rate-limit) via the plugin seam; branding/seed finalize.

## Genuinely app-specific (saasuluk only)

Branded auth-card CSS; the no-flash hydration **wiring** (the `dirOf` atom + token catalog + font-URL builder come
from the packages; the stamping is framework glue); seed/marketing **content** (`SEED_*`, landing copy, the pricing
matrix, per-locale strings — consumed via the i18n *mechanism*, authored by the app); bespoke domain rules (discount
business logic, review purchase-gate/moderation, recommendation scoring, guest-checkout rule); page shells + felt-UX
(header/footer/cart-drawer/command-palette/toasts/animation polish/PWA/contact-map); graceful-degradation around the
payment path; dev orchestration scripts. (The identicon avatar is a generic FNV→SVG op saasuluk already has.)

## Out of scope (with why)

- **Payload-CMS machinery** (Better-Auth↔Payload sync, auto-admin import-map, Payload REST/GraphQL) — Suluk's
  contract-first single source-of-truth **dissolves** the dual-system sync and the auto-admin rather than porting it.
- **Next-only conveniences** (`generateStaticParams`/`generateMetadata`, `next/image`+sharp, `next/cookies`,
  static-gen auth pages) — moot on the Astro/Cloudflare-Workers stack (Astro prerenders, owns i18n routing, reads
  cookies in middleware; the repo mandates `bun test`). Resolved-by-greenfield, not ported.
- **SaaSignal domain** (full-text/faceted search index, ranking/ML recs, behavior-signal ingestion, real-time pub/sub,
  analytics KV counters) — enterprise/edge-hard runtime services. The Suluk side is at most an `afterChange` write-
  hook trigger or a typed secret; the index/ranking/channel/queue substrate is SaaSignal or a `@suluk/deploy` host
  binding — **never a Suluk-hosted runtime (L3)**.
- **Effect TS service layer** — resolved: saasuluk uses plain Hono deliberately; the portable value (status-mapping)
  is extracted into the `@suluk/hono` error model.

## Open decisions (resolve before the dependent work)

1. **SaaSignal vs Cloudflare primitives** (the largest fork) for search/ranking/jobs/real-time/KV — decide before any
   of those.
2. **Localized-field storage shape** for `x-suluk-i18n` (column-per-locale vs JSON-per-locale vs a localization
   table) — blocks the `@suluk/drizzle` facet emission + seed fan-out.
3. **Lexical/rich-text editor + storage format** — `@suluk/zod` answers the contract side; the editor + migration
   path is unowned.
4. **Rate-limit durable store** — KV vs Durable Object as the default `@suluk/deploy` binding.
5. **Principal model** — extend `Principal` with email/session/tenancy fields, or encode all non-scope state AS
   scopes (`mfa:verified`, `org:123:read`). Caps what 2FA/org projections can express.
6. **Media storage** — confirm R2 as the `StorageProvider` default + image-variant strategy (Cloudflare Images vs
   Sharp — Sharp re-introduces postinstall concerns on Workers).
7. **Cost-sink durability** — which backing (D1/KV/R2) replaces `MemoryCostSink` in production.
