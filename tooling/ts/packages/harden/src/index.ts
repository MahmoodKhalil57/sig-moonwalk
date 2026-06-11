/**
 * @suluk/harden — schema hardening as a derived, scored contract facet. Audit a v4 'Suluk' document's INPUT
 * schemas for the validations that keep malformed/oversized input from breaking the system, grade them A–F,
 * surface the grade to incentivise the author, and gate CI on a minimum.
 *
 *   import { auditDocument, assertGrade } from "@suluk/harden";
 *   const report = auditDocument(doc);   // { grade, score, byOperation, findings, bySeverity }
 *   assertGrade(doc, "B");               // throws if the contract is too weak (the hard incentive)
 */
export {
  auditDocument, auditOperation, assertGrade, grade,
  type Audit, type OpAudit, type DocAudit, type Finding, type Severity, type Grade,
} from "./audit";
