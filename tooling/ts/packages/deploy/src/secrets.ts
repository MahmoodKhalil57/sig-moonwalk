/**
 * Secret-push + durable-binding provisioning (saastarter-parity Phase 2). Both stay on the right side of the L3
 * line: they emit the wrangler STEPS + binding config the host runs — they never hold or transmit a secret value,
 * never execute. `wrangler secret put` prompts interactively, so the secret never lands on a command line or in a
 * generated file. Durable bindings are DERIVED from the contract's advisory facets (a rate-limit budget needs a
 * counter store; a declared cost needs a sink), so the infra a Suluk app needs falls out of the contract.
 */
import { rateLimitCoverage } from "@suluk/core";
import type { OpenAPIv4Document } from "@suluk/core";
import type { DeployStep } from "./types";

export interface SecretPushPlan {
  steps: DeployStep[];
  notes: string[];
}

/**
 * The steps to push the named secrets to a Worker. Default: one interactive `wrangler secret put NAME` per secret
 * (the value is typed at the prompt — never on the command line). `bulk` instead emits a single
 * `wrangler secret bulk` step + a note to generate the JSON from the DECRYPTED env (@suluk/env decrypt-from-PQC).
 */
export function secretPushPlan(
  secretNames: string[],
  opts: { workerName: string; bulk?: boolean } = { workerName: "app" },
): SecretPushPlan {
  const worker = opts.workerName;
  const names = [...new Set(secretNames)].filter(Boolean);
  if (names.length === 0) return { steps: [], notes: ["No secrets declared — nothing to push."] };

  if (opts.bulk) {
    return {
      steps: [{ cmd: `wrangler secret bulk .dev.vars.json --name ${worker}`, note: `Push ${names.length} secrets in bulk: ${names.join(", ")}` }],
      notes: [
        "Generate `.dev.vars.json` from your DECRYPTED env (e.g. @suluk/env decryptContent) — never commit it.",
        "wrangler reads the values from the file; they never touch this generated plan.",
      ],
    };
  }
  return {
    steps: names.map((name) => ({ cmd: `wrangler secret put ${name} --name ${worker}`, note: `Set the ${name} secret (you'll be prompted for the value).` })),
    notes: ["Each `secret put` prompts for the value interactively — secrets never appear on a command line or in a file."],
  };
}

export interface DurableBinding {
  kind: "kv" | "do" | "r2" | "queue";
  /** the binding name the Worker code reads (e.g. RATE_LIMIT). */
  binding: string;
  /** the resource name to create. */
  resource: string;
  /** why the contract needs it. */
  reason: string;
}

export interface BindingPlan {
  bindings: DurableBinding[];
  steps: DeployStep[];
  notes: string[];
}

/** Does any operation declare an x-suluk-cost facet? (the cost sink trigger). */
function hasCostFacet(doc: OpenAPIv4Document): boolean {
  for (const pi of Object.values(doc.paths ?? {})) {
    const requests = (pi as unknown as { requests?: Record<string, Record<string, unknown>> }).requests ?? {};
    for (const op of Object.values(requests)) if (op["x-suluk-cost"]) return true;
  }
  return false;
}

/**
 * The durable bindings a contract needs, derived from its facets: a rate-limit budget (x-suluk-ratelimit) needs a
 * KV counter store; a declared cost (x-suluk-cost) needs a KV sink. Emits the binding list + the
 * `wrangler kv namespace create` steps (the host runs them, then fills the ids into wrangler.jsonc).
 */
export function durableBindings(doc: OpenAPIv4Document, appName = "app"): BindingPlan {
  const bindings: DurableBinding[] = [];
  if (rateLimitCoverage(doc).limited > 0) {
    bindings.push({ kind: "kv", binding: "RATE_LIMIT", resource: `${appName}-ratelimit`, reason: "x-suluk-ratelimit needs a durable counter (the @suluk/hono RateLimitStore default is dev-only)." });
  }
  if (hasCostFacet(doc)) {
    bindings.push({ kind: "kv", binding: "COST_SINK", resource: `${appName}-cost`, reason: "x-suluk-cost needs a durable sink (MemoryCostSink is dev-only)." });
  }
  const steps: DeployStep[] = bindings
    .filter((b) => b.kind === "kv")
    .map((b) => ({ cmd: `wrangler kv namespace create ${b.resource}`, note: `Create the ${b.binding} KV namespace, then put its id in wrangler.jsonc.` }));
  const notes = bindings.length
    ? ["Add each binding to wrangler.jsonc under kv_namespaces (binding → id from the create step)."]
    : ["No durable bindings required by the contract's facets."];
  return { bindings, steps, notes };
}
