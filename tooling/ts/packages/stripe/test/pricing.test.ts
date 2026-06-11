import { test, expect, describe } from "bun:test";
import {
  subtotal, computeDiscountAmount, validateDiscount, prorateDiscount, orderTotal, verifyAmount,
  cartFingerprint, idempotencyKey, type CartLine, type Discount,
} from "../src/index";

const lines = (xs: [number, number][]): CartLine[] => xs.map(([unitCents, qty], i) => ({ unitCents, qty, id: i + 1 }));

describe("@suluk/stripe money — pure pricing primitives (the trust layer)", () => {
  test("subtotal is integer cents, qty/price clamped non-negative + truncated", () => {
    expect(subtotal(lines([[1000, 2], [250, 3]]))).toBe(2750);
    expect(subtotal([{ unitCents: 100.6, qty: 2.9 }])).toBe(101 * 2); // round price, trunc qty → 101*2
    expect(subtotal([{ unitCents: -5, qty: 3 }, { unitCents: 100, qty: -1 }])).toBe(0); // no negatives
  });

  describe("computeDiscountAmount — rounded + CLAMPED to the subtotal (no over-discount, no negatives)", () => {
    test("percent rounds to a whole cent", () => {
      expect(computeDiscountAmount(999, { type: "percent", value: 10 })).toBe(100); // 99.9 → 100
      expect(computeDiscountAmount(1000, { type: "percent", value: 15 })).toBe(150);
    });
    test("a discount can never exceed the subtotal", () => {
      expect(computeDiscountAmount(500, { type: "fixed", value: 9999 })).toBe(500); // clamped
      expect(computeDiscountAmount(500, { type: "percent", value: 200 })).toBe(500); // clamped (even if pct absurd)
    });
    test("zero subtotal → zero discount", () => {
      expect(computeDiscountAmount(0, { type: "percent", value: 50 })).toBe(0);
    });
  });

  describe("validateDiscount — specific rejection reasons (shopper is told WHY)", () => {
    const sub = 5000;
    test("no discount", () => expect(validateDiscount(sub, null)).toMatchObject({ valid: false, reason: "no-discount", amountCents: 0 }));
    test("non-positive value", () => expect(validateDiscount(sub, { type: "fixed", value: 0 })).toMatchObject({ valid: false, reason: "non-positive-value" }));
    test("percent over 100", () => expect(validateDiscount(sub, { type: "percent", value: 150 })).toMatchObject({ valid: false, reason: "percent-out-of-range" }));
    test("below minimum", () => expect(validateDiscount(1000, { type: "percent", value: 10, minSubtotalCents: 5000 })).toMatchObject({ valid: false, reason: "below-minimum" }));
    test("valid → the computed amount", () => expect(validateDiscount(sub, { type: "percent", value: 10, minSubtotalCents: 5000 })).toMatchObject({ valid: true, amountCents: 500 }));
  });

  describe("prorateDiscount — sums EXACTLY to the order discount (cart drawer can't drift from order summary)", () => {
    test("a discount that doesn't divide evenly still sums exactly, by largest-remainder", () => {
      const ls = lines([[100, 1], [100, 1], [100, 1]]); // 3 lines × $1.00
      const shares = prorateDiscount(ls, 10); // 10¢ over 3 lines = 3,3,4 (or perm), sum = 10
      expect(shares.reduce((a, b) => a + b, 0)).toBe(10);
      expect(shares.every((s) => s >= 0)).toBe(true);
    });
    test("proportional to line totals, exact sum", () => {
      const ls = lines([[1000, 1], [3000, 1]]); // $10 and $30 → 1:3
      const shares = prorateDiscount(ls, 401); // 401¢ → ~100.25 / 300.75 → sums to 401
      expect(shares.reduce((a, b) => a + b, 0)).toBe(401);
      expect(shares[1]).toBeGreaterThan(shares[0]); // the bigger line absorbs more
    });
    test("no line share exceeds its own total", () => {
      const ls = lines([[100, 1], [10000, 1]]);
      const shares = prorateDiscount(ls, 150); // small line is only 100¢
      expect(shares[0]).toBeLessThanOrEqual(100);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(150);
    });
    test("zero/empty cases", () => {
      expect(prorateDiscount(lines([[100, 1]]), 0)).toEqual([0]);
      expect(prorateDiscount([], 50)).toEqual([]);
    });
    test("randomized invariant: proration always sums to min(want, gross) and is non-negative", () => {
      for (let seed = 1; seed <= 200; seed++) {
        const n = (seed % 5) + 1;
        const ls = Array.from({ length: n }, (_, i) => ({ unitCents: ((seed * (i + 7)) % 900) + 1, qty: ((seed + i) % 3) + 1, id: i }));
        const gross = subtotal(ls);
        const want = (seed * 13) % (gross + 50); // sometimes exceeds gross → should clamp
        const shares = prorateDiscount(ls, want);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(Math.min(want, gross));
        expect(shares.every((s, i) => s >= 0 && s <= ls[i].unitCents * ls[i].qty)).toBe(true);
      }
    });
  });

  test("orderTotal composes subtotal − validated discount", () => {
    const ls = lines([[1000, 2], [500, 1]]); // 2500
    expect(orderTotal(ls, { type: "percent", value: 10 })).toEqual({ subtotalCents: 2500, discountCents: 250, totalCents: 2250 });
    expect(orderTotal(ls, { type: "percent", value: 10, minSubtotalCents: 9999 })).toEqual({ subtotalCents: 2500, discountCents: 0, totalCents: 2500 }); // ineligible → no discount
    expect(orderTotal(ls)).toEqual({ subtotalCents: 2500, discountCents: 0, totalCents: 2500 });
  });

  describe("verifyAmount — anti-tampering recompute (never trust the client's amount)", () => {
    const ls = lines([[1999, 2]]); // $39.98
    test("a matching amount passes", () => {
      expect(verifyAmount(ls, null, 3998)).toMatchObject({ ok: true, expectedCents: 3998, deltaCents: 0 });
    });
    test("a tampered (lowered) amount is rejected with the delta", () => {
      const v = verifyAmount(ls, null, 100); // attacker claims $1.00
      expect(v.ok).toBe(false);
      expect(v.reason).toBe("amount-mismatch");
      expect(v.expectedCents).toBe(3998);
      expect(v.deltaCents).toBe(100 - 3998);
    });
    test("the discount is part of the authoritative recompute", () => {
      expect(verifyAmount(ls, { type: "percent", value: 50 }, 1999)).toMatchObject({ ok: true }); // 50% of 3998 = 1999
      expect(verifyAmount(ls, { type: "percent", value: 50 }, 3998).ok).toBe(false); // client ignored the discount? still must match server
    });
    test("tolerance is honored", () => {
      expect(verifyAmount(ls, null, 3999, { toleranceCents: 1 }).ok).toBe(true);
      expect(verifyAmount(ls, null, 4000, { toleranceCents: 1 }).ok).toBe(false);
    });
  });

  describe("idempotency — a stable key for intent-reuse (no double-charge)", () => {
    const a = lines([[1000, 1], [500, 2]]);
    test("the same cart → the same key (a retry reuses one intent)", () => {
      expect(idempotencyKey("user-1", a)).toBe(idempotencyKey("user-1", a));
    });
    test("line order doesn't change the fingerprint", () => {
      expect(cartFingerprint(a)).toBe(cartFingerprint([...a].reverse()));
    });
    test("a changed cart → a different key", () => {
      expect(idempotencyKey("user-1", a)).not.toBe(idempotencyKey("user-1", lines([[1000, 1], [500, 3]])));
      expect(idempotencyKey("user-1", a)).not.toBe(idempotencyKey("user-1", a, { type: "percent", value: 10 }));
    });
    test("a different principal → a different key (no cross-tenant intent reuse)", () => {
      expect(idempotencyKey("user-1", a)).not.toBe(idempotencyKey("user-2", a));
    });
  });
});
