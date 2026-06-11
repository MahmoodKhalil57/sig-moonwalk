/**
 * The MARKETING SECTION tier (saastarter-parity Phase 2) — landing-as-projection. The saastarter landing is a
 * fixed stack of sections (hero/features/pricing/testimonials/faq/cta/footer); this authors that stack as Suluk DSL
 * documents in the EXACT shape of fullstack.ts's crudSection/appPage. Each section composes a marketing BLOCK (the
 * tier rule: sections compose blocks, blocks compose leaf components) and exposes only `tone` upward — its CONTENT
 * is baked as literals on the leaf component, so the page can reorder/hide sections but not rewrite their content.
 *
 * Two L3-safe choices (verified by the grounding pass): copy is carried as i18n message KEYS (the app resolves them
 * per locale, like saastarter swaps the whole copy set) — never literal copy frozen at author-time; and a
 * data-driven section (testimonials/faq) carries a declarative `source` projection ({entity, where, sort, limit})
 * that the APP's renderer resolves into a query — never an author-time fetch. The package emits DSL docs + plain
 * projection data only; no runtime, no I/O. seoMeta + jsonLd are ORIGINATED (no saastarter equivalent; honest ceiling).
 */
import type { DslDocument, DslNode, ParamSpec } from "./dsl";
import { registry, type Registry } from "./registry";
import { validateAll, type DslError } from "./validate";

const TONE: ParamSpec = { type: "enum", options: ["default", "compact"], default: "default" };

/** The leaf marketing components (app-provided UI). Registered so a section's block may reference them. */
export const MARKETING_COMPONENTS = [
  "MarketingHero", "MarketingFeatures", "MarketingPricing",
  "MarketingTestimonials", "MarketingFaq", "MarketingCta", "MarketingFooter",
] as const;

/** A pricing plan — static config (no live Stripe matrix); `stripePriceId` is carried for the app to resolve. */
export interface PlanSpec {
  id: string;
  nameKey: string;
  priceCents: number;
  featureKeys: string[];
  ctaKey: string;
  ctaHref?: string;
  featured?: boolean;
  /** the app resolves the live price/checkout from this, if set. */
  stripePriceId?: string;
}

/** A declarative projection a data-driven section reads from — the app's renderer turns it into a query. */
export interface ProjectionSource {
  entity: string;
  where?: Record<string, unknown>;
  sort?: string;
  limit?: number;
}

/** Build a marketing block (wraps a leaf component, baking the section's content as literal props) + its section. */
function marketingPair(name: string, component: string, props: Record<string, unknown>): { block: DslDocument; section: DslDocument } {
  const blockName = `${name}Block`;
  const block: DslDocument = {
    name: blockName,
    tier: "blocks",
    params: { tone: TONE },
    root: { type: component, props: { tone: { $bind: "tone" }, ...props } },
  };
  const section: DslDocument = {
    name,
    tier: "sections",
    params: { tone: TONE },
    root: { type: blockName, props: { tone: { $bind: "tone" } } },
  };
  return { block, section };
}

/** A landing page composing the given marketing sections — mirrors appPage (exposes only { tone, sections }). */
export function marketingPage(name: string, sectionNames: string[]): DslDocument {
  const catalog: Record<string, DslNode> = {};
  for (const s of sectionNames) catalog[s] = { type: s, props: { tone: { $bind: "tone" } } };
  return {
    name,
    tier: "pages",
    params: {
      tone: TONE,
      sections: { type: "list", options: sectionNames, controls: ["include", "hide", "reorder"], default: sectionNames },
    },
    catalog,
    root: { type: "Stack", children: [{ $each: "sections" }] },
  };
}

export interface MarketingSpec {
  hero: { titleKey: string; subtitleKey?: string; ctaKey: string; ctaHref: string };
  features?: { featureKeys: string[] };
  pricing?: { plans: PlanSpec[]; currency?: string };
  /** present (even {}) ⇒ include the testimonials section; default source = approved Reviews. */
  testimonials?: { source?: ProjectionSource };
  /** present (even {}) ⇒ include the FAQ section; default source = active Faqs, ordered. */
  faq?: { source?: ProjectionSource };
  cta?: { titleKey: string; buttonKey: string; buttonHref: string; newsletter?: boolean };
  footer?: { builtWith?: string[]; newsletterLabelKey?: string };
  /** explicit section order; default = every configured section, canonical order. */
  order?: string[];
}

export interface BuiltMarketing {
  registry: Registry;
  blocks: DslDocument[];
  sections: DslDocument[];
  page: DslDocument;
  /** DSL contract violations (empty ⇒ the landing composition is sound). */
  errors: DslError[];
}

/** Build the marketing landing — sections + blocks + a page — from one spec. Synchronous: no fetch, no runtime. */
export function buildMarketing(spec: MarketingSpec): BuiltMarketing {
  const pairs: { block: DslDocument; section: DslDocument }[] = [];
  pairs.push(marketingPair("Hero", "MarketingHero", {
    titleKey: spec.hero.titleKey, ...(spec.hero.subtitleKey ? { subtitleKey: spec.hero.subtitleKey } : {}),
    ctaKey: spec.hero.ctaKey, ctaHref: spec.hero.ctaHref,
  }));
  if (spec.features) pairs.push(marketingPair("Features", "MarketingFeatures", { featureKeys: spec.features.featureKeys }));
  if (spec.pricing) pairs.push(marketingPair("Pricing", "MarketingPricing", { plans: spec.pricing.plans, currency: spec.pricing.currency ?? "USD" }));
  if (spec.testimonials !== undefined) pairs.push(marketingPair("Testimonials", "MarketingTestimonials", {
    source: spec.testimonials.source ?? { entity: "Review", where: { status: "approved" }, limit: 6 },
  }));
  if (spec.faq !== undefined) pairs.push(marketingPair("Faq", "MarketingFaq", {
    source: spec.faq.source ?? { entity: "Faq", where: { active: true }, sort: "order", limit: 50 },
  }));
  if (spec.cta) pairs.push(marketingPair("Cta", "MarketingCta", {
    titleKey: spec.cta.titleKey, buttonKey: spec.cta.buttonKey, buttonHref: spec.cta.buttonHref, newsletter: !!spec.cta.newsletter,
  }));
  if (spec.footer) pairs.push(marketingPair("Footer", "MarketingFooter", {
    builtWith: spec.footer.builtWith ?? [], ...(spec.footer.newsletterLabelKey ? { newsletterLabelKey: spec.footer.newsletterLabelKey } : {}),
  }));

  const blocks = pairs.map((p) => p.block);
  const sections = pairs.map((p) => p.section);
  const order = spec.order ?? sections.map((s) => s.name);
  const page = marketingPage("Landing", order);
  const reg = registry({ components: [...MARKETING_COMPONENTS], blocks, sections, pages: [page] });
  return { registry: reg, blocks, sections, page, errors: validateAll(reg) };
}

// ── SEO meta + JSON-LD (originated — no saastarter equivalent; the app renders these into <head>) ─────────────

export interface SeoMetaInput {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  locale?: string;
  /** locale → URL alternates (hreflang). */
  alternates?: Record<string, string>;
}

export interface SeoMeta {
  title: string;
  description: string;
  keywords: string[];
  canonical?: string;
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  ogType: string;
  twitterCard: string;
  locale: string;
  alternates: Record<string, string>;
}

/** Resolve a seoMeta field-group: og* default to title/description, sensible card/type/locale defaults. */
export function seoMeta(input: SeoMetaInput): SeoMeta {
  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords ?? [],
    ...(input.canonical ? { canonical: input.canonical } : {}),
    ogTitle: input.ogTitle ?? input.title,
    ogDescription: input.ogDescription ?? input.description,
    ...(input.ogImage ? { ogImage: input.ogImage } : {}),
    ogType: input.ogType ?? "website",
    twitterCard: input.twitterCard ?? "summary_large_image",
    locale: input.locale ?? "en",
    alternates: input.alternates ?? {},
  };
}

export type JsonLdKind = "Organization" | "WebSite" | "Product" | "Review" | "FAQPage";

/** Emit a schema.org JSON-LD object for an entity/page — drop it into a <script type="application/ld+json">. */
export function jsonLd(kind: JsonLdKind, data: Record<string, unknown>): Record<string, unknown> {
  const base = { "@context": "https://schema.org", "@type": kind };
  switch (kind) {
    case "Organization":
      return { ...base, name: data.name, url: data.url, ...(data.logo ? { logo: data.logo } : {}) };
    case "WebSite":
      return { ...base, name: data.name, url: data.url };
    case "Product":
      return { ...base, name: data.name, ...(data.description ? { description: data.description } : {}), offers: { "@type": "Offer", price: data.price, priceCurrency: data.currency ?? "USD" } };
    case "Review":
      return { ...base, reviewRating: { "@type": "Rating", ratingValue: data.rating }, reviewBody: data.body, author: { "@type": "Person", name: data.author } };
    case "FAQPage":
      return { ...base, mainEntity: ((data.faqs as { question: string; answer: string }[]) ?? []).map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) };
  }
}
