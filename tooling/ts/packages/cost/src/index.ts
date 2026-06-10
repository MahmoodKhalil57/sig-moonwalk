/**
 * @suluk/cost — cost as a contract facet + runtime metering. You can't price a user without knowing what
 * they cost you. So: declare per-operation cost (incl. third-party usage) on the contract — it bubbles into
 * the v4 doc, Scalar, and the audit; meter the ACTUAL cost per request at runtime, traced from the frontend
 * action down to each third party; and read the raw per-user picture from the ledger. We display the data as
 * it is and let you build pricing on top (Stripe via @suluk/stripe). CANDIDATE tooling — NOT official OAS.
 */
export {
  type CostBasis, type CostComponent, type CostModel, type UsageReport, type CostEvent, formatMicroUsd,
} from "./types";
export {
  COST_EXT, annotateCosts, costOf, costAudit, costTable, computeCost, type CostFinding,
} from "./contract";
export {
  costMeter, recordUsage, MemoryCostSink, type CostSink, type CostMeterOptions,
} from "./meter";
export { summarize, principalCost, type CostSummary } from "./ledger";
