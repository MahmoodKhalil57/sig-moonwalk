/**
 * createDiscountStore — the cart's companion: a persisted, cross/same-tab-synced applied-discount atom, so a code
 * the customer entered survives navigation + refresh + a second tab (saastarter parity: "discount persists across
 * pages and tabs"). Framework-agnostic vanilla Nano Stores, same injectable storage/events + write-guard pattern as
 * createCartStore. The store holds the VALIDATED discount shape ({code,type,value}) — the app owns validation (it
 * POSTs to its discount endpoint and calls apply() with the result); the store owns persistence + reconciliation.
 */
import { atom, type ReadableAtom } from "nanostores";

/** A validated, applied discount. `type`/`value` mirror @suluk/stripe's Discount so the money core can consume it. */
export interface AppliedDiscount {
  code: string;
  type: "percent" | "fixed";
  value: number;
  /** epoch ms when it was validated — lets the app re-validate stale discounts. */
  validatedAt?: number;
}

export interface DiscountStoreOptions {
  /** localStorage key (default "discount"). */
  storageKey?: string;
  /** persistence backend (default globalThis.localStorage, else in-memory; null → in-memory). */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  /** sync event target (default globalThis; null disables). */
  events?: Pick<EventTarget, "addEventListener" | "removeEventListener" | "dispatchEvent"> | null;
  /** same-tab change-event name (default "discount-changed"). */
  changeEvent?: string;
}

export interface DiscountStore {
  $discount: ReadableAtom<AppliedDiscount | null>;
  get(): AppliedDiscount | null;
  /** set the applied discount (after the app validated it). */
  apply(d: AppliedDiscount): void;
  /** remove the applied discount. */
  clear(): void;
  /** re-read from storage. */
  reload(): void;
  /** detach sync listeners. */
  destroy(): void;
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const m = new Map<string, string>();
  return { getItem: (k) => (m.has(k) ? m.get(k)! : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
}

function sanitize(raw: unknown): AppliedDiscount | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.code !== "string" || !o.code) return null;
  if (o.type !== "percent" && o.type !== "fixed") return null;
  const value = Number(o.value);
  if (!Number.isFinite(value)) return null;
  return { code: o.code, type: o.type, value, ...(Number.isFinite(Number(o.validatedAt)) ? { validatedAt: Number(o.validatedAt) } : {}) };
}

export function createDiscountStore(opts: DiscountStoreOptions = {}): DiscountStore {
  const storageKey = opts.storageKey ?? "discount";
  const changeEvent = opts.changeEvent ?? "discount-changed";
  const storage =
    opts.storage === null ? memoryStorage() : (opts.storage ?? (typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : memoryStorage()));
  const events =
    opts.events === null ? null : (opts.events ?? (typeof globalThis.addEventListener === "function" ? globalThis : null));

  const $discount = atom<AppliedDiscount | null>(null);

  const read = (): AppliedDiscount | null => {
    try {
      const raw = storage.getItem(storageKey);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  };
  const reload = () => $discount.set(read());

  let writing = false;
  const persist = (next: AppliedDiscount | null): void => {
    $discount.set(next);
    writing = true;
    try {
      if (next) storage.setItem(storageKey, JSON.stringify(next));
      else storage.removeItem(storageKey);
      events?.dispatchEvent(new Event(changeEvent)); // notify same-tab readers (guarded: our own onChange no-ops)
    } catch {
      /* storage disabled — the atom is still authoritative this session */
    } finally {
      writing = false;
    }
  };

  const onStorage = (e: Event) => { const se = e as StorageEvent; if (se.key == null || se.key === storageKey) reload(); };
  const onChange = () => { if (!writing) reload(); };
  if (events) {
    events.addEventListener("storage", onStorage);
    events.addEventListener(changeEvent, onChange);
  }

  reload();

  return {
    $discount,
    get: () => $discount.get(),
    apply: (d) => persist({ ...d }),
    clear: () => persist(null),
    reload,
    destroy: () => { if (events) { events.removeEventListener("storage", onStorage); events.removeEventListener(changeEvent, onChange); } },
  };
}
