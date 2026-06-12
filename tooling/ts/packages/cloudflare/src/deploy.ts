/**
 * The one-call deploy — provision → migrate → upload assets → deploy worker → push secrets → set cron, in the order
 * that makes each step's output feed the next (D1 id + assets JWT become worker bindings; secrets are set AFTER the
 * script exists and preserved on redeploy via keep_bindings). Pure over an injected CloudflareClient + a resolved
 * PLAN (bytes, not paths), so it's fully unit-testable; a thin disk-reading wrapper lives in the app's deploy script.
 */
import { CloudflareClient, type CloudflareClientOptions } from "./client";
import { provisionD1, provisionKvNamespace, provisionR2Bucket, applyMigrations, putSecrets, type Migration } from "./resources";
import { uploadAssets, type AssetFile } from "./assets";
import { deployWorker, putCronTriggers, type WorkerBinding } from "./worker";

export interface DeployPlan {
  scriptName: string;
  /** the bundled worker ES module. */
  module: string;
  mainModule?: string;
  compatibilityDate: string;
  compatibilityFlags?: string[];
  /** provision + bind a D1 database, applying each migration once (ledger-tracked, baseline-safe). */
  d1?: { binding: string; databaseName: string; migrations?: Migration[] };
  /** provision + bind KV namespaces (binding → title). */
  kv?: { binding: string; title: string }[];
  /** provision + bind R2 buckets (binding → bucketName). */
  r2?: { binding: string; bucketName: string }[];
  /** static assets to serve (uploaded; bound as ASSETS by default). */
  assets?: AssetFile[];
  assetsBinding?: string;
  assetsConfig?: Record<string, unknown>;
  /** plain-text vars. */
  vars?: Record<string, string>;
  /** encrypted secrets (empty values skipped). */
  secrets?: Record<string, string | undefined>;
  /** cron triggers. */
  crons?: string[];
  observability?: boolean;
}

export interface DeployResult {
  accountId: string;
  scriptName: string;
  d1?: { binding: string; id: string };
  kv: { binding: string; id: string }[];
  r2: { binding: string; name: string }[];
  assetsUploaded: number;
  secretsSet: string[];
  crons: string[];
}

export type DeployLog = (msg: string) => void;

/** Orchestrate a full deploy over a client + plan. `log` narrates each step. */
export async function deploy(cf: CloudflareClient, plan: DeployPlan, log: DeployLog = () => {}): Promise<DeployResult> {
  const accountId = await cf.resolveAccountId();
  log(`account ${accountId} · script "${plan.scriptName}"`);
  const bindings: WorkerBinding[] = [];

  let d1: DeployResult["d1"];
  if (plan.d1) {
    const db = await provisionD1(cf, plan.d1.databaseName);
    log(`D1 "${plan.d1.databaseName}" → ${db.uuid}`);
    bindings.push({ type: "d1", name: plan.d1.binding, id: db.uuid });
    d1 = { binding: plan.d1.binding, id: db.uuid };
    if (plan.d1.migrations?.length) {
      const newly = await applyMigrations(cf, db.uuid, plan.d1.migrations);
      log(newly.length ? `  migrations applied/baselined: ${newly.join(", ")}` : `  migrations: all up to date`);
    }
  }

  const kv: DeployResult["kv"] = [];
  for (const k of plan.kv ?? []) { const ns = await provisionKvNamespace(cf, k.title); bindings.push({ type: "kv_namespace", name: k.binding, namespace_id: ns.id }); kv.push({ binding: k.binding, id: ns.id }); log(`KV "${k.title}" → ${ns.id}`); }

  const r2: DeployResult["r2"] = [];
  for (const b of plan.r2 ?? []) { const bk = await provisionR2Bucket(cf, b.bucketName); bindings.push({ type: "r2_bucket", name: b.binding, bucket_name: bk.name }); r2.push({ binding: b.binding, name: bk.name }); log(`R2 "${bk.name}" bound`); }

  let assetsJwt: string | null = null;
  if (plan.assets?.length) { assetsJwt = await uploadAssets(cf, plan.scriptName, plan.assets); log(`assets: ${plan.assets.length} files uploaded`); }

  await deployWorker(cf, {
    name: plan.scriptName, module: plan.module, mainModule: plan.mainModule,
    compatibilityDate: plan.compatibilityDate, compatibilityFlags: plan.compatibilityFlags,
    bindings, vars: plan.vars,
    assets: { jwt: assetsJwt, binding: plan.assetsBinding, config: plan.assetsConfig },
    observability: plan.observability,
  });
  log(`worker "${plan.scriptName}" deployed`);

  const secretsSet = plan.secrets ? await putSecrets(cf, plan.scriptName, plan.secrets) : [];
  if (secretsSet.length) log(`secrets set: ${secretsSet.join(", ")}`);

  if (plan.crons?.length) { await putCronTriggers(cf, plan.scriptName, plan.crons); log(`crons: ${plan.crons.join(" · ")}`); }

  return { accountId, scriptName: plan.scriptName, d1, kv, r2, assetsUploaded: plan.assets?.length ?? 0, secretsSet, crons: plan.crons ?? [] };
}

/** Convenience: build a client from token/account options and run a deploy. */
export async function deployWith(opts: CloudflareClientOptions, plan: DeployPlan, log?: DeployLog): Promise<DeployResult> {
  return deploy(new CloudflareClient(opts), plan, log);
}
