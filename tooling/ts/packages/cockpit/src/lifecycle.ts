/**
 * Lifecycle / ship-readiness (L3) — the round-trip loop made legible. One contract walks: authored → coherent →
 * pixel-confident → generated → deployed. contractGates computes the CONTRACT-level gates here (pure: valid /
 * coherent / confident), each with a status + the cheapest next action; the extension adds the host gates
 * (generated-in-sync, deployed-in-sync, health) it can only see with fs + network. The whole thing is one
 * "are you ready to ship?" checklist that aggregates the cockpit's own audits. Pure (no host) → unit-tested.
 */
import { validateDocument, buildAda, type OpenAPIv4Document } from "@suluk/core";
import { convergeContract } from "./converge";
import { componentReport } from "./visual";
import type { Baseline } from "@suluk/visual";

// "info" is the non-blocking status: a gate that is honestly n/a (no env configured, no workspace open) — it
// is shown for transparency but NEVER counts against readiness. Distinct from "warn"/"todo", which DO block.
export type GateStatus = "ok" | "warn" | "error" | "todo" | "info";
export interface Gate {
  id: string;
  title: string;
  status: GateStatus;
  detail: string;
  /** the command to run to advance this gate (undefined ⇒ nothing to do) */
  action?: string;
}

/** The CONTRACT-level ship gates — everything decidable from the document itself (no host needed). */
export function contractGates(doc: OpenAPIv4Document, baseline: Baseline): Gate[] {
  const gates: Gate[] = [];

  // 0. non-empty — a contract with zero operations has nothing to ship, however valid/coherent it is in isolation.
  const ops = buildAda(doc).operations.length;
  gates.push({
    id: "operations", title: "Has operations",
    status: ops ? "ok" : "todo",
    detail: ops ? `${ops} operation${ops === 1 ? "" : "s"}` : "no operations — nothing to ship",
  });

  // 1. valid v4
  const v = validateDocument(doc);
  gates.push({
    id: "valid", title: "Valid v4 contract",
    status: v.valid ? "ok" : "error",
    detail: v.valid ? "passes the meta-schema" : `${v.errors.length} schema error${v.errors.length === 1 ? "" : "s"}`,
    action: v.valid ? undefined : "suluk.validate",
  });

  // 2. coherent (converge)
  const conv = convergeContract(doc);
  const errs = conv.findings.filter((f) => f.severity === "error").length;
  gates.push({
    id: "coherent", title: "Coherent (no contradictions)",
    status: errs ? "error" : "ok",
    detail: errs ? `${errs} contradiction${errs === 1 ? "" : "s"} (dangling ref / orphan scope / …)` : "converges clean",
    action: errs ? "suluk.convergeContract" : undefined,
  });

  // 2b. no preview backdoor — a contract carrying an x-suluk-preview-only op (a role-login backdoor) must be
  // deployed ONLY as a preview, never prod. WARN-status so it counts against ready (shipSummary blocks on warn):
  // a clean contract reads ready; one with the backdoor reads NOT ready until the user confirms it is a preview.
  // (Fixes the supply-chain hole where a smuggled preview op was hard-filtered out of the error-only coherent gate.)
  const previewOps = conv.findings.filter((f) => f.code === "preview-op-exposed");
  gates.push({
    id: "noBackdoor", title: "No preview backdoor in prod",
    status: previewOps.length ? "warn" : "ok",
    detail: previewOps.length ? `${previewOps.length} preview-only op${previewOps.length === 1 ? "" : "s"} (${previewOps.map((f) => f.where).filter(Boolean).join(", ")}) — deploy ONLY as a preview, never to production` : "no preview-only operations",
    action: previewOps.length ? "suluk.convergeContract" : undefined,
  });

  // 3. pixel-confident components
  const cr = componentReport(doc, baseline);
  const pending = cr.confidence.missing.length + cr.confidence.drifted.length;
  gates.push({
    id: "confident", title: "Components pixel-confident",
    status: cr.used.length === 0 ? "ok" : pending ? "todo" : "ok",
    detail: cr.used.length === 0 ? "no generated components" : pending ? `${pending} primitive${pending === 1 ? "" : "s"} to verify once` : "every primitive approved + unchanged",
    action: pending ? "suluk.previewComponents" : undefined,
  });

  return gates;
}

/** A one-line readiness summary over a set of gates (contract + host). "info" gates never count against ready. */
export function shipSummary(gates: Gate[]): { ready: boolean; line: string } {
  const errors = gates.filter((g) => g.status === "error").length;
  const todos = gates.filter((g) => g.status === "todo" || g.status === "warn").length;
  const ok = gates.filter((g) => g.status === "ok").length;
  const info = gates.filter((g) => g.status === "info").length;
  const ready = errors === 0 && todos === 0;
  return {
    ready,
    line: ready
      ? `ready to ship — ${ok} gate${ok === 1 ? "" : "s"} pass${info ? ` · ${info} n/a` : ""}`
      : `${errors} blocker${errors === 1 ? "" : "s"} · ${todos} to do · ${ok}/${gates.length} pass`,
  };
}
