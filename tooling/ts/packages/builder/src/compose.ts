/**
 * Composition (L2) — the non-developer flow: assemble a whole platform from modules without hand-wiring them.
 * planComposition topologically orders a set of modules so each one's `requires` are satisfied by the base
 * document or an earlier module (providers before requirers), and reports requirements NOTHING provides.
 * composeModules then installs them in that order through the SAME installModule gate (refuse-on-collision +
 * dangling-ref backstop), returning the merged platform contract + a per-step trace. The developer's only job
 * is the irreducible 20% (custom business rules) — the 80% (entities, CRUD, cost, auth, providers) composes.
 * Pure (no host) → unit-tested.
 */
import type { OpenAPIv4Document, SchemaOrRef } from "@suluk/core";
import { installModule, type SulukModule } from "./module";

export interface CompositionPlan {
  /** modules in install order — each one's requires are met by the base or an earlier entry */
  order: SulukModule[];
  /** requirements neither the base nor ANOTHER selected module provides (a self-provide cannot bootstrap) */
  unmet: { module: string; requires: string }[];
  /** clashes installModule would refuse even with names satisfied: duplicate module, two providers of one
   *  entity (incl. the base), or two entity names mapping to one lowercased path resource */
  collisions: string[];
  /** modules that could not be ordered — they require each other, or sit behind a cycle */
  unresolved: string[];
  /** true ⇒ the whole set installs in `order` with every requirement met and no collision (matches composeModules) */
  ok: boolean;
}

const lowerName = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Topologically order modules by `requires`/`provides`, modelling the collision invariants installModule enforces. */
export function planComposition(base: OpenAPIv4Document, modules: SulukModule[]): CompositionPlan {
  const baseProvided = new Set(Object.keys((base.components?.schemas ?? {}) as Record<string, SchemaOrRef>));

  // unmet: a requirement neither the base nor ANOTHER module provides (a module can't satisfy its own require)
  const unmet: { module: string; requires: string }[] = [];
  for (const m of modules) for (const r of m.requires ?? []) {
    if (!baseProvided.has(r) && !modules.some((o) => o !== m && o.provides.includes(r))) unmet.push({ module: m.name, requires: r });
  }

  // collisions: the entity/resource/dup clashes installModule refuses on (which name-only ordering can't see)
  const collisions: string[] = [];
  const nameOwner = new Map<string, string>();
  const resourceOwner = new Map<string, string>();
  for (const e of baseProvided) { nameOwner.set(e, "the base"); resourceOwner.set(lowerName(e), e); }
  const seenModule = new Set<string>();
  for (const m of modules) {
    if (seenModule.has(m.name)) collisions.push(`module "${m.name}" is selected more than once`);
    seenModule.add(m.name);
    for (const p of m.provides) {
      const owner = nameOwner.get(p);
      if (owner) collisions.push(`entity "${p}" is provided by both ${owner} and ${m.name}`);
      else nameOwner.set(p, m.name);
      const res = lowerName(p);
      const resOwner = resourceOwner.get(res);
      if (resOwner && resOwner !== p) collisions.push(`entities "${resOwner}" and "${p}" map to the same resource "${res}"`);
      else resourceOwner.set(res, p);
    }
  }

  // Kahn-style: repeatedly take any module whose requires are all provided-so-far
  const provided = new Set(baseProvided);
  const remaining = [...modules];
  const order: SulukModule[] = [];
  for (let progress = true; remaining.length && progress; ) {
    progress = false;
    for (let i = 0; i < remaining.length; i++) {
      const m = remaining[i];
      if ((m.requires ?? []).every((r) => provided.has(r))) {
        order.push(m);
        m.provides.forEach((p) => provided.add(p));
        remaining.splice(i, 1);
        progress = true;
        break;
      }
    }
  }
  // whatever's left that isn't already flagged unmet is in (or behind) a require-cycle
  const unmetNames = new Set(unmet.map((u) => u.module));
  const unresolved = remaining.map((m) => m.name).filter((n) => !unmetNames.has(n));

  return { order, unmet, collisions, unresolved, ok: unmet.length === 0 && collisions.length === 0 && unresolved.length === 0 && order.length === modules.length };
}

export interface ComposeStep {
  module: string;
  installed: boolean;
  conflicts: string[];
  added: { schemas: string[]; operations: string[] };
}
export interface ComposeResult {
  doc: OpenAPIv4Document;
  steps: ComposeStep[];
  plan: CompositionPlan;
  /** true ⇒ the plan was complete AND every step installed cleanly */
  ok: boolean;
}

/** Install a set of modules in dependency order, returning the merged platform contract + a per-step trace. */
export function composeModules(base: OpenAPIv4Document, modules: SulukModule[]): ComposeResult {
  const plan = planComposition(base, modules);
  let doc = base;
  const steps: ComposeStep[] = [];
  for (const m of plan.order) {
    const r = installModule(doc, m);
    steps.push({ module: m.name, installed: r.installed, conflicts: r.conflicts, added: r.added });
    if (r.installed) doc = r.doc; // a failed step leaves the platform at the last good state; later steps still try
  }
  return { doc, steps, plan, ok: plan.ok && steps.every((s) => s.installed) };
}
