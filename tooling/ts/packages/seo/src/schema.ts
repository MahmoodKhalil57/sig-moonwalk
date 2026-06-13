/** schema.org JSON-LD builders — the ecommerce-relevant graph (Organization, WebSite+SearchAction, Breadcrumb,
 *  Product+Offer+AggregateRating, FAQPage, BlogPosting, ItemList). Compose with `graph()` into one @graph script. */
import { clean } from "./util";

type Node = Record<string, unknown>;
const CONTEXT = "https://schema.org";

export function organization(i: { name: string; url: string; logo?: string; sameAs?: string[]; description?: string }): Node {
  return clean({ "@type": "Organization", name: i.name, url: i.url, logo: i.logo, sameAs: i.sameAs, description: i.description });
}

export function website(i: { name: string; url: string; searchUrl?: string; description?: string; publisher?: Node }): Node {
  return clean({
    "@type": "WebSite", name: i.name, url: i.url, description: i.description, publisher: i.publisher,
    potentialAction: i.searchUrl
      ? { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: i.searchUrl }, "query-input": "required name=search_term_string" }
      : undefined,
  });
}

export function breadcrumb(items: { name: string; url: string }[]): Node {
  return { "@type": "BreadcrumbList", itemListElement: items.map((it, idx) => ({ "@type": "ListItem", position: idx + 1, name: it.name, item: it.url })) };
}

export interface OfferInput { price: number | string; currency?: string; availability?: string; url?: string; priceValidUntil?: string }
export function offer(i: OfferInput): Node {
  return clean({
    "@type": "Offer", price: typeof i.price === "number" ? i.price.toFixed(2) : i.price, priceCurrency: i.currency ?? "USD",
    availability: `https://schema.org/${i.availability ?? "InStock"}`, url: i.url, priceValidUntil: i.priceValidUntil,
  });
}

export function aggregateRating(i: { ratingValue: number; reviewCount: number; best?: number }): Node {
  return clean({ "@type": "AggregateRating", ratingValue: i.ratingValue, reviewCount: i.reviewCount, bestRating: i.best ?? 5 });
}

export interface ProductInput {
  name: string; description?: string; image?: string | string[]; sku?: string; brand?: string; url?: string;
  category?: string; offers?: OfferInput | OfferInput[]; rating?: { ratingValue: number; reviewCount: number };
}
export function product(i: ProductInput): Node {
  return clean({
    "@type": "Product", name: i.name, description: i.description, image: i.image, sku: i.sku, category: i.category, url: i.url,
    brand: i.brand ? { "@type": "Brand", name: i.brand } : undefined,
    offers: i.offers ? (Array.isArray(i.offers) ? i.offers.map(offer) : offer(i.offers)) : undefined,
    aggregateRating: i.rating ? aggregateRating(i.rating) : undefined,
  });
}

export function faqPage(faqs: { question: string; answer: string }[]): Node {
  return { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) };
}

export interface ArticleInput { headline: string; description?: string; image?: string; author?: string; datePublished?: string; dateModified?: string; url?: string; publisher?: Node }
export function article(i: ArticleInput): Node {
  return clean({
    "@type": "BlogPosting", headline: i.headline, description: i.description, image: i.image, url: i.url,
    author: i.author ? { "@type": "Person", name: i.author } : undefined,
    datePublished: i.datePublished, dateModified: i.dateModified ?? i.datePublished, publisher: i.publisher,
  });
}

export function itemList(items: { name: string; url: string }[]): Node {
  return { "@type": "ItemList", itemListElement: items.map((it, idx) => ({ "@type": "ListItem", position: idx + 1, name: it.name, url: it.url })) };
}

/** Compose nodes into ONE @graph document — the recommended single-script form (de-duplicates @context). */
export function graph(...nodes: Node[]): Node {
  return { "@context": CONTEXT, "@graph": nodes };
}

/** Wrap a single node with @context for a standalone <script type="application/ld+json">. */
export function ld(node: Node): Node {
  return { "@context": CONTEXT, ...node };
}
