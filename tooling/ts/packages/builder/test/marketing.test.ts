import { test, expect, describe } from "bun:test";
import { buildMarketing, marketingPage, seoMeta, jsonLd, MARKETING, gradeModule, type MarketingSpec } from "../src/index";

const spec: MarketingSpec = {
  hero: { titleKey: "home.heroTitle", subtitleKey: "home.heroSub", ctaKey: "home.getStarted", ctaHref: "/signup" },
  features: { featureKeys: ["home.f1", "home.f2", "home.f3"] },
  pricing: { plans: [{ id: "pro", nameKey: "plans.pro", priceCents: 2900, featureKeys: ["plans.f1"], ctaKey: "plans.cta", stripePriceId: "price_123" }] },
  testimonials: {},
  faq: {},
  cta: { titleKey: "cta.title", buttonKey: "cta.button", buttonHref: "/signup", newsletter: true },
  footer: { builtWith: ["Bun", "Hono"], newsletterLabelKey: "footer.subscribe" },
};

describe("marketing SECTION tier — landing-as-projection (Phase 2)", () => {
  const built = buildMarketing(spec);

  test("composes a valid landing: sections + blocks + page, no DSL contract errors", () => {
    expect(built.errors).toEqual([]); // validateAll over the whole tier is clean
    expect(built.sections.map((s) => s.name)).toEqual(["Hero", "Features", "Pricing", "Testimonials", "Faq", "Cta", "Footer"]);
    expect(built.page.name).toBe("Landing");
  });

  test("tier rule respected: each section composes its block; each block a registered leaf component", () => {
    const hero = built.sections.find((s) => s.name === "Hero")!;
    expect(hero.tier).toBe("sections");
    expect(hero.root.type).toBe("HeroBlock");                 // section → block
    const heroBlock = built.blocks.find((b) => b.name === "HeroBlock")!;
    expect(heroBlock.tier).toBe("blocks");
    expect(heroBlock.root.type).toBe("MarketingHero");        // block → leaf component
    expect([...built.registry.components]).toContain("MarketingHero");
  });

  test("content is i18n message KEYS baked on the leaf (locale-safe), not literal copy", () => {
    const heroBlock = built.blocks.find((b) => b.name === "HeroBlock")!;
    expect(heroBlock.root.props).toMatchObject({ titleKey: "home.heroTitle", ctaHref: "/signup", tone: { $bind: "tone" } });
  });

  test("a data-driven section carries a declarative `source` projection (app resolves; no fetch)", () => {
    const testimonials = built.blocks.find((b) => b.name === "TestimonialsBlock")!;
    expect(testimonials.root.props?.source).toEqual({ entity: "Review", where: { status: "approved" }, limit: 6 });
    const faq = built.blocks.find((b) => b.name === "FaqBlock")!;
    expect(faq.root.props?.source).toEqual({ entity: "Faq", where: { active: true }, sort: "order", limit: 50 });
  });

  test("the section exposes only `tone` upward — the page can reorder/hide sections, not rewrite content", () => {
    const hero = built.sections.find((s) => s.name === "Hero")!;
    expect(Object.keys(hero.params ?? {})).toEqual(["tone"]); // content (titleKey, plans) is NOT page-settable
    expect(Object.keys(built.page.params ?? {}).sort()).toEqual(["sections", "tone"]);
  });

  test("optional sections are omitted when not configured", () => {
    const minimal = buildMarketing({ hero: spec.hero });
    expect(minimal.sections.map((s) => s.name)).toEqual(["Hero"]);
    expect(minimal.errors).toEqual([]);
  });

  test("pricing carries the static PlanSpec (with stripePriceId) untouched — no live matrix claimed", () => {
    const pricing = built.blocks.find((b) => b.name === "PricingBlock")!;
    expect((pricing.root.props?.plans as { stripePriceId?: string }[])[0].stripePriceId).toBe("price_123");
  });
});

describe("seoMeta + JSON-LD (originated)", () => {
  test("seoMeta defaults og* from title/description and sets card/type/locale", () => {
    const m = seoMeta({ title: "Acme", description: "The app." });
    expect(m).toMatchObject({ ogTitle: "Acme", ogDescription: "The app.", ogType: "website", twitterCard: "summary_large_image", locale: "en", keywords: [] });
    expect(seoMeta({ title: "A", description: "d", ogTitle: "Custom" }).ogTitle).toBe("Custom"); // override wins
  });

  test("jsonLd emits schema.org for Organization / Product / FAQPage", () => {
    expect(jsonLd("Organization", { name: "Acme", url: "https://acme.test" })).toMatchObject({ "@context": "https://schema.org", "@type": "Organization", name: "Acme" });
    expect(jsonLd("Product", { name: "Pro", price: 29, currency: "USD" })).toMatchObject({ "@type": "Product", offers: { "@type": "Offer", price: 29, priceCurrency: "USD" } });
    const faq = jsonLd("FAQPage", { faqs: [{ question: "Q?", answer: "A." }] });
    expect((faq.mainEntity as unknown[])[0]).toMatchObject({ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } });
  });
});

describe("MARKETING module — the Faq/Newsletter content entities", () => {
  test("provides Faq + Newsletter and grades A", () => {
    expect(MARKETING.provides).toEqual(["Faq", "Newsletter"]);
    expect(gradeModule(MARKETING).grade).toBe("A");
  });
});
