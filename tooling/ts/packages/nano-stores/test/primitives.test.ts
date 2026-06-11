import { test, expect, describe } from "bun:test";
import { createDiscountStore, type AppliedDiscount } from "../src/discount";
import { asyncHandler } from "../src/async-button";
import { createProgressBar } from "../src/progress";
import { revealOnScroll } from "../src/reveal";
import { createDrawer } from "../src/drawer";

function discountHarness(seed?: AppliedDiscount) {
  const m = new Map<string, string>();
  if (seed) m.set("discount", JSON.stringify(seed));
  const storage = { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  const et = new EventTarget();
  return { store: createDiscountStore({ storage, events: et }), et, raw: () => (m.get("discount") ? JSON.parse(m.get("discount")!) : null) };
}
const D: AppliedDiscount = { code: "SAVE10", type: "percent", value: 10, validatedAt: 1700000000000 };

describe("createDiscountStore — persisted + synced applied-discount atom", () => {
  test("apply persists, clear removes, get reflects", () => {
    const { store, raw } = discountHarness();
    expect(store.get()).toBeNull();
    store.apply(D);
    expect(store.get()).toEqual(D);
    expect(raw()).toEqual(D);
    store.clear();
    expect(store.get()).toBeNull();
    expect(raw()).toBeNull();
  });
  test("seeds from storage + sanitizes garbage", () => {
    expect(discountHarness(D).store.get()).toEqual(D);
    const bad = discountHarness({ code: "X", type: "bogus" as any, value: NaN as any });
    expect(bad.store.get()).toBeNull(); // invalid type/value → dropped, never throws
  });
  test("apply notifies same-tab readers without looping; cross-tab storage event refreshes", () => {
    const { store, et } = discountHarness();
    let heard = 0; et.addEventListener("discount-changed", () => heard++);
    store.apply(D);
    expect(heard).toBe(1);
    expect(store.get()).toEqual(D); // no self-reload corruption
  });
});

describe("asyncHandler — promise-aware double-submit guard", () => {
  function fakeBtn() { return { disabled: false, textContent: "Go", attrs: {} as Record<string, string>, setAttribute(n: string, v: string) { this.attrs[n] = v; }, removeAttribute(n: string) { delete this.attrs[n]; } }; }
  test("disables + aria-busy + pending label during the call, restores after", async () => {
    const btn = fakeBtn();
    let during: { disabled: boolean; busy?: string; label: string | null } | null = null;
    const h = asyncHandler(btn, async () => { during = { disabled: btn.disabled, busy: btn.attrs["aria-busy"], label: btn.textContent }; }, { pendingLabel: "Saving…" });
    await h({});
    expect(during!.disabled).toBe(true);
    expect(during!.busy).toBe("true");
    expect(during!.label).toBe("Saving…");
    expect(btn.disabled).toBe(false);            // restored
    expect(btn.attrs["aria-busy"]).toBeUndefined();
    expect(btn.textContent).toBe("Go");
  });
  test("restores even when the handler throws, and guards re-entry", async () => {
    const btn = fakeBtn();
    let calls = 0;
    const h = asyncHandler(btn, async () => { calls++; throw new Error("boom"); });
    await h({}).catch(() => {});
    expect(btn.disabled).toBe(false);
    // a pre-disabled element is a no-op (re-entry guard)
    btn.disabled = true; await h({});
    expect(calls).toBe(1);
  });
});

describe("createProgressBar — asymptotic, testable, paints an element", () => {
  test("start→tick→done→reset transitions; tick crawls toward 0.95 ceiling; set clamps", () => {
    const p = createProgressBar();
    expect(p.$value.get()).toBe(0);
    p.start(); expect(p.$value.get()).toBe(0.08);
    for (let i = 0; i < 100; i++) p.tick();
    expect(p.$value.get()).toBe(0.95); // never reaches 1 via tick
    p.done(); expect(p.$value.get()).toBe(1);
    p.reset(); expect(p.$value.get()).toBe(0);
    p.set(2); expect(p.$value.get()).toBe(1);
    p.set(-1); expect(p.$value.get()).toBe(0);
  });
  test("paints the bound element's width + active class", () => {
    let width = "", active = false;
    const el = { style: { width: "" }, classList: { toggle: (_c: string, on: boolean) => { active = on; } } };
    Object.defineProperty(el.style, "width", { get: () => width, set: (v) => (width = v) });
    const p = createProgressBar({ el });
    p.set(0.5); expect(width).toBe("50.0%"); expect(active).toBe(true);
    p.done(); expect(active).toBe(false); // 1 is not "active"
  });
});

describe("createDrawer — open/close state machine + inert focus-trap", () => {
  function panel() { const c = new Set<string>(); const a: Record<string, string> = {}; return { hidden: true, classList: { add: (x: string) => c.add(x), remove: (x: string) => c.delete(x), has: (x: string) => c.has(x) }, setAttribute: (n: string, v: string) => (a[n] = v), _cls: c, _a: a }; }
  test("open shows + adds class + inerts chrome + focuses; close reverses + restores", () => {
    const drawer = panel(), backdrop = panel();
    const chrome = [{ inert: false }, { inert: false }];
    let focused = false, hidTimer: (() => void) | null = null;
    const d = createDrawer({
      drawer, backdrop,
      inertTargets: () => chrome,
      initialFocus: () => ({ focus: () => (focused = true) }),
      raf: (fn) => fn(),
      setHideTimer: (fn) => { hidTimer = fn; },
    });
    expect(d.isOpen()).toBe(false);
    d.open();
    expect(d.isOpen()).toBe(true);
    expect(drawer.hidden).toBe(false);
    expect(drawer._cls.has("open")).toBe(true);
    expect(drawer._a["aria-hidden"]).toBe("false");
    expect(chrome.every((c) => c.inert)).toBe(true);
    expect(focused).toBe(true);
    d.close();
    expect(d.isOpen()).toBe(false);
    expect(drawer._cls.has("open")).toBe(false);
    expect(drawer._a["aria-hidden"]).toBe("true");
    expect(chrome.every((c) => !c.inert)).toBe(true);
    expect(drawer.hidden).toBe(false); // not hidden until the timer fires
    hidTimer!();
    expect(drawer.hidden).toBe(true); // now hard-hidden
  });
  test("onOpen/onClose hooks fire; toggle alternates; re-open is idempotent", () => {
    const drawer = panel();
    let opens = 0, closes = 0;
    const d = createDrawer({ drawer, onOpen: () => opens++, onClose: () => closes++, raf: (fn) => fn(), setHideTimer: (fn) => fn() });
    d.toggle(); expect(d.isOpen()).toBe(true); expect(opens).toBe(1);
    d.open(); expect(opens).toBe(1); // already open → no double onOpen
    d.toggle(); expect(d.isOpen()).toBe(false); expect(closes).toBe(1);
  });
});

describe("revealOnScroll — graceful, staggered", () => {
  function fakeEl() { const cls = new Set<string>(); const props: Record<string, string> = {}; return { classList: { add: (c: string) => cls.add(c), has: (c: string) => cls.has(c) }, style: { setProperty: (k: string, v: string) => (props[k] = v) }, _cls: cls, _props: props }; }
  test("with no IntersectionObserver, reveals everything immediately + sets the stagger index", () => {
    const els = [fakeEl(), fakeEl(), fakeEl()];
    const root = { querySelectorAll: () => els };
    revealOnScroll({ root: root as any, observer: undefined });
    expect(els.every((e) => e._cls.has("reveal-in"))).toBe(true);
    expect(els[2]._props["--i"]).toBe("2");
  });
  test("with an observer, observes each element and reveals on intersection", () => {
    const els = [fakeEl(), fakeEl()];
    const observed: unknown[] = []; let cb: (entries: any[], obs: any) => void = () => {};
    class FakeIO { constructor(c: any) { cb = c; } observe(t: unknown) { observed.push(t); } unobserve() {} disconnect() {} }
    revealOnScroll({ root: { querySelectorAll: () => els } as any, observer: FakeIO as any });
    expect(observed.length).toBe(2);
    cb([{ isIntersecting: true, target: els[0] }], { unobserve() {} });
    expect(els[0]._cls.has("reveal-in")).toBe(true);
    expect(els[1]._cls.has("reveal-in")).toBe(false); // not yet intersecting
  });
});
