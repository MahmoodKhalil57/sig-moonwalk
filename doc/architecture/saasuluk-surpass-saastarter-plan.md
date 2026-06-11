# saasuluk → surpass saastarter — improvement plan

> **Provenance.** Synthesized 2026-06-11 from a 9-agent assessment workflow (`surpass-saastarter-plan`, run
> `wf_78ab6b49-222`): 8 domain agents each read the saastarter rewrite-handoff (`docs/rewrite-handoff/` + the
> 184-item `PARITY.md`) **and** saasuluk's current `src/` **and** the `@suluk/*` ecosystem, judged on four axes
> (feature-complete · modern · intuitive · performant); one synthesis. Every "verified" claim cites a saasuluk path.
> Companion to [saastarter-parity-roadmap.md](./saastarter-parity-roadmap.md). Goal (operator): make our template
> (saasuluk) **surpass** saastarter, not just match it.

## The verdict (honest)

saasuluk is **structurally more modern** than saastarter (Astro islands + Cloudflare Workers edge + a single
contract that projects API / OpenAPI-v4 docs / typed SDK / conformance tests / cost-ledger / access-as-facet — vs
Next.js + Payload). **But it ships its own ecosystem unplugged:** the `server/` layer imports `@suluk/*` mostly for
doc-surface helpers, and the **frontend consumes ZERO `@suluk` packages** (verified — every page is hand-rolled
inline `<script>` hitting raw CRUD). The thesis to surpass saastarter is therefore **not to build new features — it
is to WIRE IN the already-built-and-tested `@suluk` packages**, which closes every parity gap AND yields the
differentiators in one move.

**Already BEATS saastarter** — *modern:* edge/Workers, single-contract projection, cost-as-facet metered per-op,
wire-enforced access-as-facet, server-authoritative checkout pricing (can't be under-paid by spoofing `priceCents`),
idempotent CAS orders/usage-billing. *Performant:* ~189KB island JS (vs Next RSC+client), 605KB gzip worker.

**Still TRAILS** — *feature-complete:* the persistent-shell cart drawer + live cross-tab discount (entirely absent —
`Layout.astro` has no cart at all), multi-step checkout with saved-card vault + PaymentIntent reuse, scoped API keys
+ GDPR delete-cascade, soft-delete/pagination, media upload. *Intuitive:* full page-body i18n (only ~19 chrome keys
translate). *Felt-UX:* no toasts, no nav-progress, no skeletons, ~2 aria-labels total, 1 color scheme vs 43.

## 🔴 Live bug to fix first (not just a gap)

`account.astro` reads other users' data: it does `fetch('/order').filter(o => o.customerId === USER)` — an
**unscoped fetch filtered client-side**, so any authenticated user can read **every** user's orders + API-token
metadata. Same pattern on `/wishlistItem`, `/apiToken`. **Owner-scope these list endpoints server-side** (the
access layer's `scoped()` owner-filter + drop the spoofable `x-user` header) before anything else.

## The biggest lever

Wire the built `@suluk` ecosystem into the layers that ignore it. **Three packages ≈ 70% of the value:**
1. **`@suluk/stripe`** trust core — `operations.ts` imports only 3 usage-billing param helpers and re-derives
   *weaker* money math by hand; adopt `validateDiscount`/`computeDiscountAmount`/`orderTotal`/`prorateDiscount`/
   `verifyAmount`/`planPaymentIntent`/`stripeCheckout`/`webhookRouter` (mostly DELETION of duplicate code).
2. **`@suluk/drizzle`** — `crud.ts` + the worker `d1Crud` do bare `select().all()` full-table dumps; adopt
   `parseListQuery` (pagination/sort/filter/q) + `softDelete`/`touchTimestamps`/`anonymize` — and because they
   project into the v4 contract, they light up in docs + SDK + UI at once across all 17 entities.
3. **`@suluk/better-auth`** — replace identity-only `principal()` with `principalFromSession` (scoped keys) + wire
   `beforeDeleteCascade` (deleting a user currently orphans their Stripe customer — verified, no `deleteUser` block).

## Quick wins (high-impact / low-effort — do first)

- **Fix the `account.astro` data leak** (owner-scope the list endpoints; drop the `x-user` token header). 🔴
- **Wire `@suluk/stripe` pricing into `operations.ts`** — mostly deletion; yields exact per-line proration + anti-tamper.
- **`--minify` the worker build** — shrink 3.2MB raw / 605KB gzip for cold-start + headroom under the 1MB free-tier cap.
- **Wire `beforeDeleteCascade`** into a `user.deleteUser` block (GDPR; ~30–50 LoC, package already present).
- **Route money through `@suluk/i18n` `formatCurrency`/`formatNumber`** — Eastern-Arabic numerals + locale currency from cents.
- **Ship trilingual seed content** (Faq/Post/testimonial/feature-matrix) so `/faqs` `/blogs` `/products` demo out of the box.

## Sequenced waves

- **Wave 0 — stop the bleeding + free wins** (days, all S): owner-scope the leak · wire `@suluk/stripe` pricing core
  · `--minify` · `beforeDeleteCascade` · money via `@suluk/i18n`.
- **Wave 1 — contract-layer projection** (lights up all 17 entities at once): `@suluk/drizzle` `parseListQuery` +
  soft-delete/timestamps/anonymize into `crud.ts` AND the worker; `@suluk/better-auth` `principalFromSession`
  (scoped keys); mount `@suluk/stripe` `webhookRouter` behind `verifyWebhook`.
- **Wave 2 — frontend ecosystem foundation** (prove `@suluk`-on-frontend): `@suluk/i18n` `./astro` middleware for
  server-side lang/dir + page-body catalogs; `@suluk/theme` single TokenSpec source + scheme catalog + system mode;
  `@suluk/nano-stores` (deps already present) for a typed, optimistic, server-authoritative **cart+discount store**
  → a header cart button + slide-out drawer in `Layout.astro` (restores saastarter's two continuity principles).
- **Wave 3 — generated UI + checkout resilience** (the L-effort surface, now unblocked): `@suluk/shadcn`-generated
  product/cart/checkout/account/auth UI with skeletons + a11y baseline; multi-step checkout with saved-card vault +
  PaymentIntent reuse via `@suluk/stripe`.
- **Wave 4 — meta-product polish + the sell**: Astro `<ClientRouter>` view-transitions + prefetch + a nav-progress +
  a toast island; `@suluk/builder` marketing SECTION tier + `seoMeta` + JSON-LD + sitemap/robots; the live-ledger
  landing; `@suluk/deploy` as the actual source of `wrangler.jsonc` (built but never imported — verified).

## The differentiators (the sell — *ahead* of saastarter, not parity)

- **Cost-as-facet** — every op carries a metered cost model → a durable D1 ledger, per-principal at `/cost`, bridged
  to Stripe Billing Meters; plus **background-event cost** (C024/C025/C026: the charge accrues on the webhook, attributed).
- **One contract projects every layer** (API + v4 docs + SDK + conformance suite + cost map + access-as-facet + UI +
  deploy) from one 17-entity registry — provably can't drift.
- **Server-authoritative checkout** that can't be under-paid by spoofing + idempotent CAS + webhook-verified confirm.
- **Wire-enforced fail-closed access-as-facet** + a "View-as" lens; scope channel encodes `mfa:verified` / `org:<id>:<scope>`.
- **Edge-native everything** — server-side locale/dir/theme injection correct on the first byte (no client flash).
- **Per-locale completeness GRADING** + Eastern-Arabic numerals + RTL money/date everywhere (saastarter has compile-time
  key-parity only).
- **A self-tearing-down role-preview deploy lane** (`@suluk/deploy`) — no saastarter analogue.

## Risks (from the assessment)

- `@suluk/*` are consumed via a **tsconfig path alias** into `../sig-moonwalk/.../src`, **not npm deps** — each
  newly-wired package must build + run on Workers (bundle, no postinstall).
- The frontend is **100% hand-rolled inline `<script>`, zero `.tsx`** despite `@astrojs/react` — introducing
  `@suluk/shadcn` (React) is a real (worthwhile) shift, not a drop-in.
- Worker is **605KB gzip under the 1MB free-tier cap with no `--minify` headroom** — minify FIRST before wiring
  shadcn/builder/theme/i18n catalogs.
- **Soft-delete + pagination change list semantics across all 17 entities at once** — ship sane defaults (exclude
  soft-deleted; bounded page) and audit every page/SDK consumer that expects the full array.
- The leak fix must **audit every unscoped-fetch+client-filter consumer** (account, possibly dashboard) before flipping.
- Per-package **conformance on the WIRED path**, not just the package's own unit tests.
