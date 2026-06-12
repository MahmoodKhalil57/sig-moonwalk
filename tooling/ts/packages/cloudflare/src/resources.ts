/**
 * Idempotent resource provisioners — create-OR-get, so `deploy` can run repeatedly without "already exists" errors.
 * Each resolves the account id off the client and uses the Cloudflare API's list-then-create pattern.
 */
import type { CloudflareClient } from "./client";

export interface D1Database {
  uuid: string;
  name: string;
}

/** Create-or-get a D1 database by name. */
export async function provisionD1(cf: CloudflareClient, name: string): Promise<D1Database> {
  const acct = await cf.resolveAccountId();
  const existing = await cf.request<D1Database[]>("GET", `/accounts/${acct}/d1/database`, { query: { name } });
  const hit = (existing ?? []).find((d) => d.name === name);
  if (hit) return hit;
  return cf.request<D1Database>("POST", `/accounts/${acct}/d1/database`, { json: { name } });
}

/** Run SQL against a D1 database (a migration — D1 accepts multiple `;`-separated statements per call). */
export async function queryD1(cf: CloudflareClient, databaseId: string, sql: string): Promise<unknown> {
  const acct = await cf.resolveAccountId();
  return cf.request("POST", `/accounts/${acct}/d1/database/${databaseId}/query`, { json: { sql } });
}

export interface KvNamespace {
  id: string;
  title: string;
}

/** Create-or-get a Workers KV namespace by title (e.g. a sessions or rate-limit store). */
export async function provisionKvNamespace(cf: CloudflareClient, title: string): Promise<KvNamespace> {
  const acct = await cf.resolveAccountId();
  const list = await cf.request<KvNamespace[]>("GET", `/accounts/${acct}/storage/kv/namespaces`, { query: { per_page: 100 } });
  const hit = (list ?? []).find((n) => n.title === title);
  if (hit) return hit;
  return cf.request<KvNamespace>("POST", `/accounts/${acct}/storage/kv/namespaces`, { json: { title } });
}

/** Create-or-get an R2 bucket by name (e.g. media/upload storage). */
export async function provisionR2Bucket(cf: CloudflareClient, name: string): Promise<{ name: string }> {
  const acct = await cf.resolveAccountId();
  const res = await cf.request<{ buckets?: { name: string }[] }>("GET", `/accounts/${acct}/r2/buckets`);
  const hit = (res?.buckets ?? []).find((b) => b.name === name);
  if (hit) return hit;
  return cf.request<{ name: string }>("POST", `/accounts/${acct}/r2/buckets`, { json: { name } });
}

/** Set ONE Worker secret (an encrypted `secret_text` binding). The script must already exist. */
export async function putSecret(cf: CloudflareClient, scriptName: string, name: string, value: string): Promise<void> {
  const acct = await cf.resolveAccountId();
  await cf.request("PUT", `/accounts/${acct}/workers/scripts/${scriptName}/secrets`, { json: { name, text: value, type: "secret_text" } });
}

/** Set many secrets, skipping empty/undefined values; returns the names actually set. */
export async function putSecrets(cf: CloudflareClient, scriptName: string, secrets: Record<string, string | undefined>): Promise<string[]> {
  const set: string[] = [];
  for (const [name, value] of Object.entries(secrets)) {
    if (value) { await putSecret(cf, scriptName, name, value); set.push(name); }
  }
  return set;
}
