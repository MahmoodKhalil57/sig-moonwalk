import { test, expect, describe } from "bun:test";
import { createCartStore, type CartLine } from "../src/cart";

/** A minimal in-memory Storage + EventTarget so the cart store is fully testable headless. */
function harness(seed?: CartLine[]) {
  const m = new Map<string, string>();
  if (seed) m.set("cart", JSON.stringify(seed));
  const storage = { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => void m.set(k, v) };
  const et = new EventTarget();
  const store = createCartStore({ storage, events: et });
  return { store, et, raw: () => (m.get("cart") ? JSON.parse(m.get("cart")!) : []) };
}

const A: CartLine = { productId: "p1", qty: 1, priceCents: 1000, name: "Widget" };
const B: CartLine = { productId: 2, qty: 3, priceCents: 250, name: "Gadget" };

describe("@suluk/nano-stores createCartStore — framework-agnostic, persisted, synced cart", () => {
  test("add merges by productId (qty accumulates), computed count + subtotal track it", () => {
    const { store, raw } = harness();
    store.add(A);
    store.add({ ...A, qty: 2 }); // same productId → merge
    store.add(B);
    expect(store.$count.get()).toBe(3 /*p1*/ + 3 /*p2*/);
    expect(store.$subtotalCents.get()).toBe(3 * 1000 + 3 * 250);
    expect(store.lines().length).toBe(2);
    // persisted as the legacy ARRAY wire-format
    expect(raw()).toEqual([{ productId: "p1", qty: 3, priceCents: 1000, name: "Widget" }, { productId: 2, qty: 3, priceCents: 250, name: "Gadget" }]);
  });

  test("setQty updates; setQty<=0 and remove drop the line; clear empties", () => {
    const { store } = harness([A, B]);
    expect(store.$count.get()).toBe(4);
    store.setQty("p1", 5);
    expect(store.get("p1")!.qty).toBe(5);
    store.setQty("p1", 0); // removes
    expect(store.get("p1")).toBeUndefined();
    store.remove(2);
    expect(store.lines().length).toBe(0);
    store.add(A);
    store.clear();
    expect(store.$count.get()).toBe(0);
  });

  test("seeds from existing storage (interops with hand-written localStorage carts)", () => {
    const { store } = harness([B]);
    expect(store.$count.get()).toBe(3);
    expect(store.$subtotalCents.get()).toBe(750);
  });

  test("malformed/legacy rows are sanitized, never throw (honest-loss)", () => {
    const { store } = harness([{ productId: "ok", qty: 2, priceCents: 500, name: "OK" }, { qty: 1 } as any, null as any, { productId: "x", qty: -4, priceCents: NaN } as any]);
    const lines = store.lines();
    expect(lines.length).toBe(2); // the no-productId row and the null are dropped
    const x = store.get("x")!;
    expect(x.qty).toBe(1); // negative qty clamped to 1
    expect(x.priceCents).toBe(0); // NaN price → 0
    expect(x.name).toBe("x"); // missing name → String(productId)
  });

  test("a store write NOTIFIES other same-tab readers (dispatches changeEvent) without looping on itself", () => {
    const { store, et } = harness();
    let heard = 0;
    et.addEventListener("cart-changed", () => { heard++; });
    store.add(A);            // one store-initiated write
    store.setQty("p1", 4);   // another
    expect(heard).toBe(2);   // each write notified external listeners exactly once
    expect(store.$count.get()).toBe(4); // and the store itself did NOT double-reload into a wrong state
  });

  test("same-tab change event reloads from storage (a hand-writer mutated the key)", () => {
    const { store, et } = harness();
    store.add(A);
    expect(store.$count.get()).toBe(1);
    // simulate an inline page writing the key directly, then signalling
    et.dispatchEvent(new Event("cart-changed")); // no external write → still 1 (idempotent)
    expect(store.$count.get()).toBe(1);
  });

  test("cross-tab storage event refreshes; the store's OWN writes don't loop", () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => void m.set(k, v) };
    const et = new EventTarget();
    const store = createCartStore({ storage, events: et });
    store.add(A); // writes storage; `writing` guard means our own change handler is a no-op
    // another tab adds a line directly to the shared storage, then the browser fires `storage`
    m.set("cart", JSON.stringify([A, B]));
    et.dispatchEvent(Object.assign(new Event("storage"), { key: "cart" }));
    expect(store.$count.get()).toBe(4); // picked up the other tab's write
  });

  test("destroy detaches listeners", () => {
    const { store, et } = harness([A]);
    store.destroy();
    const m2 = JSON.stringify([A, B]);
    // after destroy, a storage event should NOT change the store
    et.dispatchEvent(Object.assign(new Event("storage"), { key: "cart" }));
    expect(store.$count.get()).toBe(1);
  });
});
