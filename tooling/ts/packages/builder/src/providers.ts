/**
 * Provider SLOTS (M3) — "swap out a provider you chose." A module declares `providerSlots` (e.g.
 * `{ payments: "stripe" }`); installModule records them into the document as `x-suluk-providers`. Each facet
 * (payments / auth / email / storage) is a SLOT bound to one implementation of a duck-typed interface — exactly
 * the pattern @suluk/stripe's `PaymentProvider` and @suluk/deploy's `DeployProvider` already prove. Swapping
 * rebinds the slot to another implementation of the SAME interface; the contract (the operations, their cost)
 * is unchanged — only the runtime binding differs. Pure (no host) → unit-tested.
 */
export interface ProviderImpl {
  id: string;
  facet: string;
  title: string;
  /** the @suluk package (or ecosystem source) that implements this binding, if any */
  pkg?: string;
  description: string;
}

/** The catalog of swappable implementations per facet. First-party bindings carry their @suluk package. */
export const PROVIDER_CATALOG: Record<string, ProviderImpl[]> = {
  payments: [
    { id: "stripe", facet: "payments", title: "Stripe", pkg: "@suluk/stripe", description: "Cards + Billing Meters; the reference PaymentProvider." },
    { id: "paddle", facet: "payments", title: "Paddle", description: "Merchant-of-record (handles sales tax); same PaymentProvider interface." },
    { id: "lemonsqueezy", facet: "payments", title: "Lemon Squeezy", description: "MoR for digital goods; same PaymentProvider interface." },
  ],
  auth: [
    { id: "better-auth", facet: "auth", title: "Better Auth", pkg: "@suluk/better-auth", description: "Sessions + scopes → securitySchemes; the reference auth binding." },
    { id: "clerk", facet: "auth", title: "Clerk", description: "Hosted auth + user management; same session→principal shape." },
    { id: "auth0", facet: "auth", title: "Auth0", description: "Enterprise SSO/OIDC; same session→principal shape." },
  ],
  email: [
    { id: "resend", facet: "email", title: "Resend", pkg: "@suluk/email", description: "Transactional email; the reference EmailProvider (@suluk/email resendProvider)." },
    { id: "sendgrid", facet: "email", title: "SendGrid", description: "Transactional + marketing; same EmailProvider interface." },
    { id: "ses", facet: "email", title: "Amazon SES", description: "Low-cost bulk email; same EmailProvider interface." },
  ],
  storage: [
    { id: "r2", facet: "storage", title: "Cloudflare R2", pkg: "@suluk/deploy", description: "S3-compatible, zero egress; the reference StorageProvider (@suluk/deploy r2Storage)." },
    { id: "s3", facet: "storage", title: "Amazon S3", description: "Object storage; same StorageProvider interface." },
    { id: "gcs", facet: "storage", title: "Google Cloud Storage", description: "Object storage; same StorageProvider interface." },
  ],
};

/** The facets the catalog knows about (payments, auth, email, storage). */
export function providerFacets(): string[] {
  return Object.keys(PROVIDER_CATALOG);
}

export interface ProviderBinding {
  facet: string;
  /** the currently-bound implementation id */
  impl: string;
  title: string;
  /** is `impl` a known implementation for this facet? (false ⇒ a custom binding) */
  known: boolean;
  /** the other implementations this slot could swap to */
  alternatives: ProviderImpl[];
}

function slotsOf(doc: unknown): Record<string, string> {
  // only a plain object is a valid slot map — a hand-corrupted string/array must collapse to {} (not become
  // per-character/per-index "bindings"), so the Providers surface never fabricates rows from a mangled doc.
  const v = (doc as { "x-suluk-providers"?: unknown })?.["x-suluk-providers"];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
}

/** The active provider bindings recorded in the document (from installed modules' providerSlots). */
export function readProviders(doc: unknown): ProviderBinding[] {
  return Object.entries(slotsOf(doc)).map(([facet, impl]) => {
    const cat = PROVIDER_CATALOG[facet] ?? [];
    const found = cat.find((c) => c.id === impl);
    return { facet, impl, title: found?.title ?? impl, known: !!found, alternatives: cat.filter((c) => c.id !== impl) };
  });
}

export interface SwapResult<T> {
  doc: T;
  error?: string;
}

/** Rebind a facet's slot to another implementation of the same interface. Returns the unchanged doc on error. */
export function swapProvider<T>(doc: T, facet: string, impl: string): SwapResult<T> {
  const cat = PROVIDER_CATALOG[facet];
  if (!cat) return { doc, error: `unknown provider facet "${facet}"` };
  if (!cat.some((c) => c.id === impl)) return { doc, error: `"${impl}" is not a known ${facet} provider (try: ${cat.map((c) => c.id).join(", ")})` };
  const next = structuredClone(doc) as T & { "x-suluk-providers"?: Record<string, string> };
  next["x-suluk-providers"] = { ...slotsOf(doc), [facet]: impl };
  return { doc: next };
}
