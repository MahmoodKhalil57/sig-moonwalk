import { test, expect, describe } from "bun:test";
import {
  robotsTxt, sitemapXml, sitemapIndex,
  organization, website, breadcrumb, product, faqPage, article, itemList, graph,
  seoTags, renderTags, resolveTitle, llmsTxt, ogImageSvg, webManifest,
  deploymentMeta, skewGuardScript,
} from "../src/index";

describe("robots.txt", () => {
  test("default group + sitemap + host", () => {
    const r = robotsTxt({ sitemaps: ["https://x.dev/sitemap.xml"], host: "x.dev" });
    expect(r).toContain("User-agent: *");
    expect(r).toContain("Allow: /");
    expect(r).toContain("Host: x.dev");
    expect(r).toContain("Sitemap: https://x.dev/sitemap.xml");
  });
  test("custom groups with disallow + crawl-delay", () => {
    const r = robotsTxt({ groups: [{ userAgent: ["Googlebot", "Bingbot"], disallow: ["/account", "/api/"], crawlDelay: 2 }] });
    expect(r).toContain("User-agent: Googlebot");
    expect(r).toContain("User-agent: Bingbot");
    expect(r).toContain("Disallow: /account");
    expect(r).toContain("Crawl-delay: 2");
  });
});

describe("sitemap", () => {
  test("urls with lastmod/changefreq/priority, images + hreflang declare the right namespaces", () => {
    const xml = sitemapXml([
      { loc: "https://x.dev/p/1", lastmod: "2026-01-01", changefreq: "daily", priority: 0.9, images: [{ loc: "https://x.dev/i/1.jpg", title: "One" }], alternates: [{ hreflang: "es", href: "https://x.dev/es/p/1" }] },
    ]);
    expect(xml).toContain("<loc>https://x.dev/p/1</loc>");
    expect(xml).toContain("<lastmod>2026-01-01T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
    expect(xml).toContain("<priority>0.9</priority>");
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain("<image:loc>https://x.dev/i/1.jpg</image:loc>");
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="es" href="https://x.dev/es/p/1"/>');
  });
  test("priority clamps + ampersands escape", () => {
    const xml = sitemapXml([{ loc: "https://x.dev/?a=1&b=2", priority: 5 }]);
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml).toContain("https://x.dev/?a=1&amp;b=2");
  });
  test("sitemap index", () => {
    const xml = sitemapIndex([{ loc: "https://x.dev/sitemap-products.xml", lastmod: new Date("2026-02-02T00:00:00Z") }]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<loc>https://x.dev/sitemap-products.xml</loc>");
    expect(xml).toContain("2026-02-02T00:00:00.000Z");
  });
});

describe("schema.org JSON-LD", () => {
  test("website carries a SearchAction when searchUrl is given", () => {
    const w = website({ name: "X", url: "https://x.dev", searchUrl: "https://x.dev/search?q={search_term_string}" }) as any;
    expect(w["@type"]).toBe("WebSite");
    expect(w.potentialAction["@type"]).toBe("SearchAction");
    expect(w.potentialAction["query-input"]).toContain("search_term_string");
  });
  test("product with offer + rating, omitting empty fields", () => {
    const p = product({ name: "Tee", price: undefined as never, offers: { price: 29 }, rating: { ratingValue: 4.6, reviewCount: 12 }, brand: "Acme" }) as any;
    expect(p["@type"]).toBe("Product");
    expect(p.offers.price).toBe("29.00");
    expect(p.offers.availability).toBe("https://schema.org/InStock");
    expect(p.aggregateRating.reviewCount).toBe(12);
    expect(p.brand.name).toBe("Acme");
    expect("sku" in p).toBe(false); // undefined dropped
  });
  test("breadcrumb positions + faqPage + graph compose", () => {
    const bc = breadcrumb([{ name: "Home", url: "/" }, { name: "Store", url: "/products" }]) as any;
    expect(bc.itemListElement[1].position).toBe(2);
    const faq = faqPage([{ question: "Q?", answer: "A." }]) as any;
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe("A.");
    const g = graph(organization({ name: "X", url: "https://x.dev" }), bc) as any;
    expect(g["@context"]).toBe("https://schema.org");
    expect(g["@graph"]).toHaveLength(2);
  });
  test("article defaults dateModified to datePublished", () => {
    const a = article({ headline: "Hi", datePublished: "2026-01-01", author: "Ada" }) as any;
    expect(a.dateModified).toBe("2026-01-01");
    expect(a.author.name).toBe("Ada");
    expect(itemList([{ name: "A", url: "/a" }]) as any).toMatchObject({ "@type": "ItemList" });
  });
});

describe("head meta", () => {
  test("title template + canonical + og + twitter + robots", () => {
    const tags = seoTags({ title: "Store", titleTemplate: "%s — saasuluk", description: "Shop", canonical: "https://x.dev/products", image: "https://x.dev/og.png", siteName: "saasuluk", noindex: false, robots: { maxImagePreview: "large" } });
    const html = renderTags(tags);
    expect(html).toContain("<title>Store — saasuluk</title>");
    expect(html).toContain('rel="canonical" href="https://x.dev/products"');
    expect(html).toContain('property="og:title" content="Store — saasuluk"');
    expect(html).toContain('property="og:image" content="https://x.dev/og.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain("max-image-preview:large");
  });
  test("noindex forces noindex,nofollow + hreflang links", () => {
    const tags = seoTags({ title: "T", noindex: true, alternates: [{ hreflang: "ar", href: "https://x.dev/ar" }] });
    const html = renderTags(tags);
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).toContain('rel="alternate" hreflang="ar" href="https://x.dev/ar"');
  });
  test("resolveTitle", () => {
    expect(resolveTitle("A", "%s — B")).toBe("A — B");
    expect(resolveTitle(undefined, "%s — B")).toBe("B");
    expect(resolveTitle("A")).toBe("A");
  });
});

describe("llms.txt + manifest + og + skew", () => {
  test("llms.txt structure", () => {
    const t = llmsTxt({ title: "saasuluk", summary: "An ecommerce template.", sections: [{ title: "Docs", links: [{ title: "API", url: "/reference", description: "v4 contract" }] }] });
    expect(t).toContain("# saasuluk");
    expect(t).toContain("> An ecommerce template.");
    expect(t).toContain("## Docs");
    expect(t).toContain("- [API](/reference): v4 contract");
  });
  test("web manifest defaults", () => {
    const m = JSON.parse(webManifest({ name: "saasuluk", themeColor: "#6366f1", icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }] }));
    expect(m.name).toBe("saasuluk");
    expect(m.short_name).toBe("saasuluk");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#6366f1");
    expect(m.icons[0].sizes).toBe("512x512");
  });
  test("og image svg has dimensions + wrapped title + brand", () => {
    const svg = ogImageSvg({ title: "A fairly long product title that should wrap onto multiple lines nicely", brand: "saasuluk", eyebrow: "Store" });
    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain("saasuluk");
    expect(svg).toContain("STORE");
    expect(svg.match(/<text/g)!.length).toBeGreaterThan(2); // eyebrow + multiple title lines + brand
  });
  test("skew protection meta + guard script", () => {
    expect(deploymentMeta('abc"123')).toBe('<meta name="x-deployment-id" content="abc123">');
    const s = skewGuardScript({ endpoint: "/api/health" });
    expect(s).toContain("/api/health");
    expect(s).toContain("x-deployment-id");
    expect(s).toContain("location.href");
  });
});
