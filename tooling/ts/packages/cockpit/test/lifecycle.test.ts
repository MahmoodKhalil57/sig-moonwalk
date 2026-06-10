import { test, expect, describe } from "bun:test";
import { parseDocument } from "@suluk/core";
import type { Baseline } from "@suluk/visual";
import { componentReport, approveComponents } from "../src/visual";
import { contractGates, shipSummary } from "../src/lifecycle";

const good = () => parseDocument(`openapi: 4.0.0-candidate
info: { title: Shop, version: 1.0.0 }
paths:
  "pet":
    requests:
      listPets: { method: get, responses: { ok: { status: 200, contentSchema: { $ref: "#/components/schemas/Pet" } } } }
components: { schemas: { Pet: { type: object, properties: { name: { type: string } } } } }`);

const gate = (gates: ReturnType<typeof contractGates>, id: string) => gates.find((g) => g.id === id)!;

describe("contractGates — the contract-level ship gates", () => {
  test("a valid, coherent contract passes valid + coherent; confidence is 'todo' against an empty baseline", () => {
    const gates = contractGates(good(), {});
    expect(gate(gates, "valid").status).toBe("ok");
    expect(gate(gates, "coherent").status).toBe("ok");
    expect(gate(gates, "confident").status).toBe("todo"); // never verified
    expect(gate(gates, "confident").action).toBe("suluk.previewComponents");
  });
  test("a contradiction (a dangling $ref) makes the coherent gate an error with a fix action", () => {
    const broken = parseDocument(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "p": { requests: { g: { method: get, responses: { ok: { status: 200, contentSchema: { $ref: "#/components/schemas/Ghost" } } } } } } }
components: { schemas: {} }`);
    const g = gate(contractGates(broken, {}), "coherent");
    expect(g.status).toBe("error");
    expect(g.action).toBe("suluk.convergeContract");
  });
  test("after approving the components, the confidence gate passes", () => {
    const doc = good();
    const baseline: Baseline = approveComponents(componentReport(doc, {}), {}, 1);
    expect(gate(contractGates(doc, baseline), "confident").status).toBe("ok");
  });
  test("an empty contract (zero operations) is NOT ship-ready — the operations gate is 'todo'", () => {
    const empty = parseDocument(`openapi: 4.0.0-candidate
info: { title: Empty, version: 1.0.0 }
paths: {}`);
    const gates = contractGates(empty, {});
    expect(gate(gates, "operations").status).toBe("todo"); // nothing to ship
    expect(shipSummary(gates).ready).toBe(false); // even though valid + coherent are clean
  });
});

describe("shipSummary", () => {
  test("all-ok gates ⇒ ready", () => {
    const r = shipSummary([{ id: "a", title: "A", status: "ok", detail: "" }, { id: "b", title: "B", status: "ok", detail: "" }]);
    expect(r.ready).toBe(true);
    expect(r.line).toContain("ready to ship");
  });
  test("an error gate ⇒ NOT ready, counted as a blocker", () => {
    const r = shipSummary([{ id: "a", title: "A", status: "ok", detail: "" }, { id: "b", title: "B", status: "error", detail: "" }, { id: "c", title: "C", status: "todo", detail: "" }]);
    expect(r.ready).toBe(false);
    expect(r.line).toContain("1 blocker");
    expect(r.line).toContain("1 to do");
  });
  test("an 'info' gate is non-blocking — it never makes a clean contract read as not-ready", () => {
    const r = shipSummary([{ id: "a", title: "A", status: "ok", detail: "" }, { id: "b", title: "B", status: "info", detail: "n/a — no environment configured" }]);
    expect(r.ready).toBe(true);
    expect(r.line).toContain("ready to ship");
    expect(r.line).toContain("1 n/a"); // surfaced for transparency, but not counted against ready
  });
});
