import { test, expect, describe } from "bun:test";
import { beforeDeleteCascade, step, anonymizeStep, deleteStep } from "../src/index";

type User = { id: string; email: string };
const user: User = { id: "u1", email: "a@b.co" };

describe("beforeDeleteCascade — the GDPR erasure orchestrator (ported from saastarter options.ts:127)", () => {
  test("runs every step in order", async () => {
    const order: string[] = [];
    const hook = beforeDeleteCascade<User>([
      step("stripe", () => { order.push("stripe"); }),
      anonymizeStep("profile", () => { order.push("profile"); }),
      deleteStep("addresses", () => { order.push("addresses"); }),
    ]);
    await hook(user);
    expect(order).toEqual(["stripe", "profile", "addresses"]);
  });

  test("fail-closed by default: a throwing step ABORTS — later steps don't run, the hook rejects", async () => {
    const order: string[] = [];
    const hook = beforeDeleteCascade<User>([
      step("ok", () => { order.push("ok"); }),
      step("boom", () => { throw new Error("stripe down"); }),
      step("never", () => { order.push("never"); }),
    ], { log: () => {} });
    await expect(hook(user)).rejects.toThrow("stripe down");
    expect(order).toEqual(["ok"]); // "never" did not run; the user is NOT deleted
  });

  test("continueOnError logs + proceeds; the hook resolves", async () => {
    const order: string[] = [];
    const logged: string[] = [];
    const hook = beforeDeleteCascade<User>([
      step("boom", () => { throw new Error("already gone"); }),
      step("addresses", () => { order.push("addresses"); }),
    ], { continueOnError: true, log: (s) => logged.push(s) });
    await hook(user);
    expect(order).toEqual(["addresses"]);
    expect(logged).toEqual(["boom"]);
  });

  test("recovery-within-a-step keeps the cascade clean (the saastarter Stripe-already-deleted → email fallback)", async () => {
    const calls: string[] = [];
    const deleteStripeCustomer = async (u: User) => {
      try { calls.push("del-by-id"); throw new Error("no such customer"); }
      catch { calls.push(`del-by-email:${u.email}`); } // recovery lives in the step, not the orchestrator
    };
    const hook = beforeDeleteCascade<User>([deleteStep("stripe", deleteStripeCustomer)]);
    await hook(user); // resolves — the step handled its own recovery
    expect(calls).toEqual(["del-by-id", "del-by-email:a@b.co"]);
  });
});
