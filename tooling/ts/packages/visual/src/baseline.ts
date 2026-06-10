/**
 * The pixel-confidence core. You verify a UI primitive's PIXELS once (a human/tool looks at the rendered
 * widget and approves it). That approval is recorded against the primitive's CONTENT HASH — a hash of the
 * exact source that produced those pixels. Thereafter, any generated UI is "pixel-confident by construction"
 * iff every primitive it uses is approved AND its content hash is unchanged. So you never re-screenshot the
 * whole UI — you only re-verify a primitive when ITS source actually changes (the hash drifts).
 *
 * This is the same discipline as the rest of Suluk: verify the SOURCE once; trust the deterministic
 * projection. Pure + dependency-free; the screenshot/approval gate lives in ./capture.
 */

/** Stable, fast, non-cryptographic hash (djb2) of source text or raw bytes — for change detection only. */
export function hash(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let h = 5381;
  for (let i = 0; i < bytes.length; i++) h = ((h << 5) + h + bytes[i]) >>> 0;
  return h.toString(16).padStart(8, "0");
}
/** Hash of the render-affecting source of a primitive (its component code, variant, tokens). */
export const contentHash = hash;
/** Hash of an approved screenshot's bytes — the recorded identity of "what was verified". */
export const snapshotHash = hash;

export interface BaselineEntry {
  key: string;
  /** Content hash of the source that produced the approved pixels. */
  contentHash: string;
  /** Hash of the approved screenshot (set by the verify-once gate). */
  snapshotHash: string;
  /** Wall-clock ms of approval (an input — pass it in, so the baseline is reproducible). */
  approvedAt: number;
  label?: string;
}

/** The approved baseline — primitive key → its verified entry. Persist as JSON; commit it. */
export type Baseline = Record<string, BaselineEntry>;

/** A primitive USED by a generated UI: its key + the CURRENT content hash of its source. */
export interface UsedPrimitive {
  key: string;
  contentHash: string;
  label?: string;
}

export interface ConfidenceReport {
  /** True ⇒ every used primitive is approved + unchanged → the UI is pixel-confident without a new screenshot. */
  confident: boolean;
  /** Used primitives that are approved at the current content hash. */
  approved: string[];
  /** Used primitives never pixel-verified — must be verified once. */
  missing: UsedPrimitive[];
  /** Used primitives approved BEFORE but whose source changed (hash drifted) — must be re-verified. */
  drifted: UsedPrimitive[];
}

/** Decide, WITHOUT rendering, whether a UI built from `used` primitives is pixel-confident given the baseline. */
export function checkConfidence(used: readonly UsedPrimitive[], baseline: Baseline): ConfidenceReport {
  const approved: string[] = [];
  const missing: UsedPrimitive[] = [];
  const drifted: UsedPrimitive[] = [];
  for (const u of used) {
    const b = baseline[u.key];
    if (!b || !b.snapshotHash) missing.push(u);
    else if (b.contentHash !== u.contentHash) drifted.push(u);
    else approved.push(u.key);
  }
  return { confident: missing.length === 0 && drifted.length === 0, approved, missing, drifted };
}

/** Exactly the primitives that need a (one-time) pixel verification right now: the missing + the drifted. */
export function pendingVerification(used: readonly UsedPrimitive[], baseline: Baseline): UsedPrimitive[] {
  const r = checkConfidence(used, baseline);
  return [...r.missing, ...r.drifted];
}

/** A capture from the verify-once gate: the primitive, its content hash, and its approved screenshot's hash. */
export interface Capture {
  key: string;
  contentHash: string;
  snapshotHash: string;
  label?: string;
}

/** Record approvals into the baseline (the "verify once"): each capture marks its primitive verified-at-hash. */
export function approve(captures: readonly Capture[], baseline: Baseline, at: number): Baseline {
  const out: Baseline = { ...baseline };
  for (const c of captures) out[c.key] = { key: c.key, contentHash: c.contentHash, snapshotHash: c.snapshotHash, approvedAt: at, label: c.label ?? out[c.key]?.label };
  return out;
}

/** Coverage = fraction of used primitives that are approved + unchanged. 1 ⇒ fully pixel-confident. */
export function confidenceCoverage(used: readonly UsedPrimitive[], baseline: Baseline): number {
  if (used.length === 0) return 1;
  return checkConfidence(used, baseline).approved.length / new Set(used.map((u) => u.key)).size;
}
