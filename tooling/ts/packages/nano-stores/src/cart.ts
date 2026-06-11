/**
 * createCartStore — the STATE corner's commerce primitive: a framework-agnostic shopping cart over vanilla
 * Nano Stores. No React, no framework binding — usable from a plain bundled `<script>` (an Astro island OR an
 * inline module), a Svelte/Vue file, or a worker. The store is the SINGLE source of cart truth on the client;
 * it persists to `localStorage` and stays consistent across tabs (the native `storage` event) AND within a tab
 * (a small custom event the non-store writers dispatch), so a starter that already mutates `localStorage` by
 * hand can adopt the store incrementally without a big-bang rewrite.
 *
 * Persistence shape is an ARRAY of lines — the de-facto starter convention (`[{ productId, qty, priceCents,
 * name }]`) — so the store interops with code that reads/writes the same key directly. Internally it keys lines
 * by `productId` for O(1) merge; the array is the wire format.
 *
 * Server-authoritative discounts/checkout are deliberately NOT baked in here (they need the app's RouteContracts
 * + endpoints — that's createApiStores' job). This store owns the optimistic client cart; the app layers the
 * contract-typed mutators (discount validate, checkout) on top and reconciles totals from the server response.
 */
import { map, atom, computed, type MapStore, type ReadableAtom } from "nanostores";

/** One cart line. `productId` is the merge key; `priceCents` is the unit price at add-time. */
export interface CartLine {
  productId: string | number;
  qty: number;
  priceCents: number;
  name: string;
}

export interface CartStoreOptions {
  /** localStorage key (default "cart"). */
  storageKey?: string;
  /**
   * Persistence backend. Defaults to `globalThis.localStorage` when present, else an in-memory shim (so the
   * store is usable in SSR/build/tests without throwing). Pass a mock in tests.
   */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /**
   * Event target for cross-tab + same-tab sync (default `globalThis`). The store LISTENS for the native
   * `storage` event (fires in OTHER tabs) and for `changeEvent` (same tab). Pass `null` to disable syncing.
   */
  events?: Pick<EventTarget, "addEventListener" | "removeEventListener" | "dispatchEvent"> | null;
  /**
   * Same-tab change-notification event name (default "cart-changed"). Non-store writers that mutate the same
   * localStorage key by hand should `dispatchEvent(new Event(changeEvent))` after writing, so the store (and the
   * UI it drives) refresh without a reload — the native `storage` event does NOT fire in the writing tab.
   */
  changeEvent?: string;
}

export interface CartStore {
  /**
   * lines keyed by an OPAQUE prefixed id — subscribe for reactive UI, but render from `lines()` (insertion
   * order) and look lines up with `get(productId)`. (Keys are prefixed so the JS engine preserves insertion
   * order even for numeric product ids, which it would otherwise hoist ahead of string ids.)
   */
  $items: MapStore<Record<string, CartLine>>;
  /** total quantity across all lines. */
  $count: ReadableAtom<number>;
  /** Σ qty·priceCents — the cart subtotal in cents (pre-discount, pre-tax). */
  $subtotalCents: ReadableAtom<number>;
  /** the lines as an array, in insertion order — the canonical render source. */
  lines(): CartLine[];
  /** the line for a product, or undefined. */
  get(productId: string | number): CartLine | undefined;
  /** add `item.qty` of a product (merges onto an existing line by productId; refreshes name/price). */
  add(item: CartLine): void;
  /** set a line's quantity; `qty <= 0` removes the line. */
  setQty(productId: string | number, qty: number): void;
  /** remove a line entirely. */
  remove(productId: string | number): void;
  /** empty the cart. */
  clear(): void;
  /** re-read from storage (auto-invoked on the storage/change events; exposed for manual refresh). */
  reload(): void;
  /** detach the sync listeners (for teardown/tests). */
  destroy(): void;
}

/** An in-memory Storage shim so the store never throws when localStorage is absent (SSR/build/tests). */
function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const m = new Map<string, string>();
  return { getItem: (k) => (m.has(k) ? m.get(k)! : null), setItem: (k, v) => void m.set(k, String(v)) };
}

/** Coerce arbitrary parsed JSON into a clean CartLine[] — drop anything malformed (honest, never throws). */
function sanitize(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (o.productId == null) continue;
    const qty = Number(o.qty);
    const priceCents = Number(o.priceCents);
    out.push({
      productId: o.productId as string | number,
      qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
      priceCents: Number.isFinite(priceCents) ? priceCents : 0,
      name: typeof o.name === "string" ? o.name : String(o.productId),
    });
  }
  return out;
}

// Prefix the map key so the JS engine keeps INSERTION order: integer-like keys ("2") are otherwise enumerated
// before string keys ("p1"), which would silently reorder a cart of numeric product ids. "#" forces all-string.
const keyOf = (id: string | number) => "#" + String(id);

export function createCartStore(opts: CartStoreOptions = {}): CartStore {
  const storageKey = opts.storageKey ?? "cart";
  const changeEvent = opts.changeEvent ?? "cart-changed";
  const storage: Pick<Storage, "getItem" | "setItem"> =
    opts.storage === null ? memoryStorage() : (opts.storage ?? (typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : memoryStorage()));
  const events: CartStoreOptions["events"] =
    opts.events === null ? null : (opts.events ?? (typeof globalThis.addEventListener === "function" ? globalThis : null));

  const $items = map<Record<string, CartLine>>({});

  // ---- read/write the array wire-format -------------------------------------------------------------------
  const read = (): CartLine[] => {
    try {
      const raw = storage.getItem(storageKey);
      return raw ? sanitize(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  };
  const toMap = (arr: CartLine[]): Record<string, CartLine> => {
    const o: Record<string, CartLine> = {};
    for (const l of arr) o[keyOf(l.productId)] = l;
    return o;
  };
  let writing = false; // guard: our own storage write must not feed back through the change listener
  const persist = (next: Record<string, CartLine>): void => {
    $items.set(next);
    writing = true;
    try {
      storage.setItem(storageKey, JSON.stringify(Object.values(next)));
      // Notify OTHER same-tab readers (hand-written localStorage consumers, a checkout page rendering its own
      // cart table) so they refresh too. We dispatch while `writing` is still true, so our OWN onChange no-ops
      // (cannot loop); cross-tab readers are covered separately by the native `storage` event.
      events?.dispatchEvent(new Event(changeEvent));
    } catch {
      /* quota / disabled storage — the in-memory map is still authoritative for this session */
    } finally {
      writing = false;
    }
  };

  const reload = (): void => {
    $items.set(toMap(read()));
  };

  // ---- derived stores -------------------------------------------------------------------------------------
  const $count = computed($items, (it) => Object.values(it).reduce((n, l) => n + l.qty, 0));
  const $subtotalCents = computed($items, (it) => Object.values(it).reduce((n, l) => n + l.qty * l.priceCents, 0));

  // ---- actions --------------------------------------------------------------------------------------------
  const add = (item: CartLine): void => {
    const k = keyOf(item.productId);
    const cur = { ...$items.get() };
    const qty = Number.isFinite(item.qty) && item.qty > 0 ? Math.floor(item.qty) : 1;
    const prev = cur[k];
    cur[k] = prev
      ? { ...prev, qty: prev.qty + qty, priceCents: item.priceCents, name: item.name }
      : { productId: item.productId, qty, priceCents: item.priceCents, name: item.name };
    persist(cur);
  };
  const setQty = (productId: string | number, qty: number): void => {
    const k = keyOf(productId);
    const cur = { ...$items.get() };
    if (!cur[k]) return;
    if (qty <= 0) delete cur[k];
    else cur[k] = { ...cur[k], qty: Math.floor(qty) };
    persist(cur);
  };
  const remove = (productId: string | number): void => {
    const k = keyOf(productId);
    if (!$items.get()[k]) return;
    const cur = { ...$items.get() };
    delete cur[k];
    persist(cur);
  };
  const clear = (): void => persist({});

  // ---- sync: cross-tab (storage) + same-tab (custom event) ------------------------------------------------
  const onStorage = (e: Event): void => {
    // native StorageEvent fires in OTHER tabs only; refresh when it's our key (or a clear, key === null)
    const se = e as StorageEvent;
    if (se.key == null || se.key === storageKey) reload();
  };
  const onChange = (): void => {
    if (!writing) reload(); // a same-tab hand-writer changed the key; ignore our own writes
  };
  if (events) {
    events.addEventListener("storage", onStorage);
    events.addEventListener(changeEvent, onChange);
  }
  const destroy = (): void => {
    if (!events) return;
    events.removeEventListener("storage", onStorage);
    events.removeEventListener(changeEvent, onChange);
  };

  // seed from storage now
  reload();

  return {
    $items,
    $count,
    $subtotalCents,
    lines: () => Object.values($items.get()),
    get: (productId) => $items.get()[keyOf(productId)],
    add,
    setQty,
    remove,
    clear,
    reload,
    destroy,
  };
}
