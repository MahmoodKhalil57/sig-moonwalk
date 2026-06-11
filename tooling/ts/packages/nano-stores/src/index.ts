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
