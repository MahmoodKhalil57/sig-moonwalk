/** The curated first-party module registry (M2) + stack templates (L2). A registry is a named list of
 *  installable modules; a template is a named SET of modules that compose into a working platform. */
import type { ModuleRegistry, SulukModule } from "../module";
import { AUTH } from "./auth";
import { ECOMMERCE } from "./ecommerce";
import { CRM } from "./crm";
import { BILLING } from "./billing";

export { AUTH } from "./auth";
export { ECOMMERCE } from "./ecommerce";
export { CRM } from "./crm";
export { BILLING } from "./billing";
// `preview` is a session-establishing fragment — exported so a deploy flow can install it DELIBERATELY, but
// intentionally ABSENT from FIRST_PARTY_REGISTRY.modules and every STACK_TEMPLATE below: it must never be
// marketplace-browsable (suluk.installModule) or auto-composed (suluk.composePlatform). Supply-chain discipline.
export { PREVIEW, PREVIEW_ONLY_MARKER } from "./preview";

export const FIRST_PARTY_REGISTRY: ModuleRegistry = {
  name: "Suluk first-party modules",
  homepage: "https://mahmoodkhalil57.github.io/suluk/",
  modules: [
    { title: "Auth", description: "Users + sessions — the entity every other module requires.", module: AUTH },
    { title: "Ecommerce", description: "Products, orders, checkout — billed per operation; a swappable payments slot.", module: ECOMMERCE },
    { title: "CRM", description: "Contacts and a deal pipeline, owned by your users.", module: CRM },
    { title: "Billing", description: "Invoices and subscriptions for your users; swappable payments.", module: BILLING },
  ],
};

/** A named set of modules that compose into a working platform (L2 — the non-developer flow). */
export interface StackTemplate {
  name: string;
  description: string;
  /** module names, resolved against a registry */
  modules: string[];
}
export const STACK_TEMPLATES: StackTemplate[] = [
  { name: "SaaS starter", description: "Users + billing + a CRM pipeline.", modules: ["auth", "billing", "crm"] },
  { name: "Storefront", description: "Users + products, orders, and checkout.", modules: ["auth", "ecommerce"] },
  { name: "Everything", description: "Every first-party module, composed together.", modules: ["auth", "ecommerce", "crm", "billing"] },
];

/** Resolve a template's module names to actual modules from a registry — REPORTING any name that doesn't resolve
 *  (a typo or a module missing from this registry) rather than silently dropping it. */
export function resolveTemplate(t: StackTemplate, registry: ModuleRegistry = FIRST_PARTY_REGISTRY): { modules: SulukModule[]; missing: string[] } {
  const modules: SulukModule[] = [];
  const missing: string[] = [];
  for (const name of t.modules) {
    const m = registry.modules.find((e) => e.module.name === name)?.module;
    if (m) modules.push(m);
    else missing.push(name);
  }
  return { modules, missing };
}
