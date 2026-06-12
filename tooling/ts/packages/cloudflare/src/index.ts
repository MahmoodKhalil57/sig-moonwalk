/**
 * @suluk/cloudflare — API-driven provisioning + deployment for a Suluk app on Cloudflare, no wrangler CLI. A typed
 * REST client, idempotent provisioners (D1 / KV / R2 / secrets), the Workers module-script + static-assets upload
 * flow, and a one-call `deploy()` that wires them in dependency order. The platform that ships itself, shipping
 * itself — readable, testable, and the same contract-first discipline as the rest of the suite. CANDIDATE tooling.
 */
export { CloudflareClient, CloudflareError, type CloudflareClientOptions, type RequestOptions } from "./client";
export { provisionD1, queryD1, provisionKvNamespace, provisionR2Bucket, putSecret, putSecrets, type D1Database, type KvNamespace } from "./resources";
export { uploadAssets, assetHash, type AssetFile, type UploadSession } from "./assets";
export { deployWorker, putCronTriggers, type DeployWorkerOptions, type WorkerBinding } from "./worker";
export { deploy, deployWith, type DeployPlan, type DeployResult, type DeployLog } from "./deploy";
