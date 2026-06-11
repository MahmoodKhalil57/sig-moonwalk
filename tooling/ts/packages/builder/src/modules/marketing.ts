/** A first-party `marketing` module (saastarter-parity Phase 1/2) — the CMS-ish content entities a landing
 *  projects from: Faq (the FAQ section's source) + Newsletter (the footer/CTA subscribe source). Standalone (no
 *  requires). The roadmap's NEWSLETTER + CMS modules, graduated only on demonstrated need — Faq unblocks the
 *  marketing SECTION tier's faqSection, which had no entity to project from. */
import type { SulukModule } from "../module";
import { crudCost } from "./cost";

export const MARKETING: SulukModule = {
  name: "marketing",
  version: "0.1.0",
  provides: ["Faq", "Newsletter"],
  schemas: {
    // a localized FAQ entry — the FAQ section projects the active ones, ordered.
    Faq: {
      type: "object",
      required: ["question", "answer"],
      properties: {
        id: { type: "integer" },
        question: { type: "string", maxLength: 300 },
        answer: { type: "string", maxLength: 2000 },
        order: { type: "integer", minimum: 0 },
        active: { type: "boolean" },
        locale: { type: "string" },
      },
      additionalProperties: false,
    },
    // a newsletter subscriber — the footer/CTA subscribe form's target.
    Newsletter: {
      type: "object",
      required: ["email"],
      properties: {
        id: { type: "integer" },
        email: { type: "string", format: "email" },
        status: { type: "string", enum: ["subscribed", "unsubscribed"] },
        subscribedAt: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
  },
  cost: {
    ...crudCost("Faq", 8, 20),
    ...crudCost("Newsletter", 6, 15),
  },
};
