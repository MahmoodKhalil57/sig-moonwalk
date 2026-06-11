/**
 * @suluk/deploy — ship a Suluk app behind a SWAPPABLE target interface. A DeployProvider turns the app into
 * the files + ordered steps that deploy it; the host (the vscode extension) runs the steps in a terminal
 * after the user authenticates. Cloudflare is the first provider (Workers + D1 + static assets) — an adapter,
 * since the stack is already Cloudflare-native (Hono=Workers, sqlite-core=D1, frontend=assets). CANDIDATE.
 */
export type { DeployProvider, DeployPlan, DeployInput, DeployEntity, DeployFile, DeployStep } from "./types";
export { cloudflare, DEFAULT_COMPAT_DATE } from "./cloudflare";
export { schemaToSql, createTable, entityColumns, columnDdl, tableName, type ColumnDef } from "./sql";
// contract-delta → additive migration SQL (Phase 2).
export { migrationSql } from "./migrate";
// secret-push + facet-derived durable-binding provisioning (Phase 2).
export {
  secretPushPlan, durableBindings,
  type SecretPushPlan, type BindingPlan, type DurableBinding,
} from "./secrets";

import { cloudflare } from "./cloudflare";
import type { DeployProvider } from "./types";

/** The provider registry. Add new targets here; the interface is the contract. */
export const providers: Record<string, DeployProvider> = {
  cloudflare,
};
