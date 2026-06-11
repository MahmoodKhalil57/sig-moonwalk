/**
 * @suluk/nano-stores — the STATE corner. Projects v4 "Suluk" RouteContracts (the same ones @suluk/hono
 * derives a server from) into a typed Nano Stores client: GET → @nanostores/query fetcher stores, the rest →
 * mutator stores, with the contract's Zod schemas guarding both request and response edges. One contract,
 * two projections (server + client state). CANDIDATE tooling — NOT official OAS.
 */
export { buildUrl } from "./url";
export {
  createApiStores,
  SchemaViolationError,
  type ApiStores,
  type CreateApiStoresOptions,
  type FetcherFactory,
  type MutatorInvoker,
  type MutatorInput,
} from "./stores";
// commerce primitive: a framework-agnostic, localStorage-persisted, cross-tab-synced shopping cart.
export { createCartStore, type CartStore, type CartLine, type CartStoreOptions } from "./cart";
// the cart's companion: a persisted, synced applied-discount atom.
export { createDiscountStore, type DiscountStore, type AppliedDiscount, type DiscountStoreOptions } from "./discount";
// interaction primitives (saastarter felt-UX parity): promise-aware buttons, nav progress, scroll-reveal.
export { asyncHandler, bindAsyncButton, type AsyncBindOptions } from "./async-button";
export { createProgressBar, type ProgressBar, type ProgressBarOptions, type ProgressElement } from "./progress";
export { revealOnScroll, type RevealOptions } from "./reveal";
// the reusable slide-in panel controller (cart, mobile nav, sheet) — open/close + inert focus-trap + restore.
export { createDrawer, type Drawer, type DrawerOptions, type PanelEl } from "./drawer";
