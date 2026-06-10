/** The curated first-party module registry (M2). A registry is just a named list of installable modules; this
 *  one ships with Suluk. A remote/community registry (L1) is the same shape fetched from a URL. */
import type { ModuleRegistry } from "../module";
import { ECOMMERCE } from "./ecommerce";
import { CRM } from "./crm";
import { BILLING } from "./billing";

export { ECOMMERCE } from "./ecommerce";
export { CRM } from "./crm";
export { BILLING } from "./billing";

export const FIRST_PARTY_REGISTRY: ModuleRegistry = {
  name: "Suluk first-party modules",
  homepage: "https://mahmoodkhalil57.github.io/suluk/",
  modules: [
    { title: "Ecommerce", description: "Products, orders, checkout — billed per operation; a swappable payments slot.", module: ECOMMERCE },
    { title: "CRM", description: "Contacts and a deal pipeline, owned by your users.", module: CRM },
    { title: "Billing", description: "Invoices and subscriptions for your users; swappable payments.", module: BILLING },
  ],
};
