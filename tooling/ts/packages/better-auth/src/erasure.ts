/**
 * GDPR erasure cascade (saastarter-parity Phase 0). Closes the account-deletion hole: when a user is deleted their
 * owned rows + external records (Stripe customer, addresses, …) must be erased too. Ported from saastarter's
 * `user.deleteUser.beforeDelete` hook (src/lib/auth/options.ts:127) — but made a REUSABLE primitive: the package
 * ORCHESTRATES an ordered cascade and the app supplies the concrete steps + PICKS the posture.
 *
 * Posture is the app's choice (the reviewer's hard fork): the package ships BOTH hard-DELETE (cascade-remove) and
 * ANONYMIZE (keep the row, scrub PII — the FK-safe right-to-be-forgotten posture, the recommended default) as thin
 * labeled step constructors, and imposes NEITHER. Recovery-WITHIN-a-step (e.g. saastarter's Stripe-already-deleted →
 * delete-by-email fallback, options.ts:147-167) lives inside the step's `run`, never in this orchestrator.
 */

/** One step of the erasure cascade — the erasure of one subsystem for one user. */
export interface CascadeStep<U> {
  /** a label for logs/diagnostics. */
  name: string;
  /** perform the erasure. Put any in-step recovery (already-deleted → fallback) HERE, not in the orchestrator. */
  run: (user: U) => Promise<void> | void;
}

export interface CascadeOptions {
  /** if a step throws: log + continue (true), or ABORT the whole cascade (false — the fail-closed default, so a
   *  failed cleanup never silently half-erases and then deletes the user). */
  continueOnError?: boolean;
  /** diagnostics sink (default console.error). */
  log?: (step: string, error: unknown) => void;
}

/** A generic cascade step. */
export function step<U>(name: string, run: (user: U) => Promise<void> | void): CascadeStep<U> {
  return { name, run };
}

/** An ANONYMIZE step — keep the row, scrub its PII (the FK-safe posture; recommended default). */
export function anonymizeStep<U>(name: string, run: (user: U) => Promise<void> | void): CascadeStep<U> {
  return { name: `anonymize:${name}`, run };
}

/** A hard-DELETE step — cascade-remove a subsystem's rows for the user. */
export function deleteStep<U>(name: string, run: (user: U) => Promise<void> | void): CascadeStep<U> {
  return { name: `delete:${name}`, run };
}

/**
 * Build the Better Auth `user.deleteUser.beforeDelete` hook (options.ts:127) from an ordered erasure cascade.
 * Runs each step in order; on a step error it logs and — unless `continueOnError` — rethrows to ABORT (so the user
 * is NOT deleted when cleanup failed, never orphaning their external records).
 */
export function beforeDeleteCascade<U>(
  steps: CascadeStep<U>[],
  opts: CascadeOptions = {},
): (user: U) => Promise<void> {
  const log = opts.log ?? ((s, e) => console.error(`erasure step "${s}" failed:`, e));
  return async (user: U) => {
    for (const s of steps) {
      try {
        await s.run(user);
      } catch (e) {
        log(s.name, e);
        if (!opts.continueOnError) throw e; // fail-closed: abort rather than half-erase
      }
    }
  };
}
