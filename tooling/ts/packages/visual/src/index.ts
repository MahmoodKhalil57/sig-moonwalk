/**
 * @suluk/visual — pixel-confidence by construction.
 *
 * Verify each UI PRIMITIVE's pixels ONCE (render it in isolation, screenshot it, approve it). The approval is
 * recorded against the primitive's content hash. Thereafter, every generated UI is pixel-confident *without a
 * new screenshot* iff all its primitives are approved + unchanged — checked by hashing, not rendering. A
 * primitive is re-verified only when ITS source changes (the hash drifts). Confidence propagates up the
 * component → block → section → page tiers exactly like the rest of Suluk: verify the source once, trust the
 * deterministic projection. CANDIDATE tooling — NOT official OAS.
 */
export {
  hash, contentHash, snapshotHash, checkConfidence, pendingVerification, approve, confidenceCoverage,
  type Baseline, type BaselineEntry, type UsedPrimitive, type ConfidenceReport, type Capture,
} from "./baseline";
export { formPrimitives, tablePrimitives, type PrimitiveSources } from "./shadcn";
export { renderPrimitiveHtml, knownWidgets } from "./capture";
