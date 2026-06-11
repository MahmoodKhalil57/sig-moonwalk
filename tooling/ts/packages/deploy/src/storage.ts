/**
 * The StorageProvider binding (saastarter-parity Phase 3) — the media/upload slot the @suluk/builder `storage`
 * facet declares (r2/s3/gcs) but no package bound. Lives in @suluk/deploy because R2 is a Cloudflare binding and
 * deploy already owns the Cloudflare-binding concern (its `DurableBinding.kind` includes "r2"). Server-side,
 * Workers-native: store / public-URL / delete over a duck-typed R2 bucket binding (the real `R2Bucket` satisfies
 * it; a mock for tests). The `delete` is a first-class GDPR erasure target (pairs with @suluk/better-auth's cascade).
 *
 * DEFERRED (Open-Decision #6): the image-variant strategy (Cloudflare Images vs Sharp — Sharp re-introduces
 * postinstall on Workers) and presigned DIRECT-browser-upload (needs the S3-compat endpoint + signing). The binding
 * ships the server-side path now; variants/presign are a future extension, declared not silently dropped.
 */

/** A stored object — its key + the public URL to reach it. */
export interface StoredObject {
  key: string;
  url: string;
}

/** The swappable storage binding (the builder `storage` slot). Other providers (S3/GCS) implement the same shape. */
export interface StorageProvider {
  /** a stable id (matches the @suluk/builder storage-slot impl id, e.g. "r2"). */
  readonly id: string;
  /** store bytes server-side; returns the key + its public URL. */
  put(key: string, body: ArrayBuffer | Uint8Array | string, opts?: { contentType?: string }): Promise<StoredObject>;
  /** the public/served URL for a key (no I/O). */
  urlFor(key: string): string;
  /** remove an object — the GDPR erasure target for a user's media. */
  delete(key: string): Promise<void>;
}

/** The minimal Workers R2 surface this binding calls — satisfied by the real `R2Bucket` and by a mock. */
export interface R2BucketLike {
  put(key: string, value: ArrayBuffer | Uint8Array | string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
}

const joinUrl = (base: string, key: string) => `${base.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;

/** Cloudflare R2 storage (the reference StorageProvider). `publicBaseUrl` is the bucket's served domain. */
export function r2Storage(bucket: R2BucketLike, opts: { publicBaseUrl: string }): StorageProvider {
  return {
    id: "r2",
    async put(key, body, o) {
      await bucket.put(key, body, o?.contentType ? { httpMetadata: { contentType: o.contentType } } : undefined);
      return { key, url: joinUrl(opts.publicBaseUrl, key) };
    },
    urlFor(key) { return joinUrl(opts.publicBaseUrl, key); },
    async delete(key) { await bucket.delete(key); },
  };
}

/** A DEV in-memory storage (per-process; not durable) — the swap default for local/tests, never production. */
export function memoryStorage(opts: { publicBaseUrl?: string } = {}): StorageProvider & { has(key: string): boolean } {
  const store = new Map<string, { body: ArrayBuffer | Uint8Array | string; contentType?: string }>();
  const base = opts.publicBaseUrl ?? "memory://media";
  return {
    id: "memory",
    async put(key, body, o) { store.set(key, { body, contentType: o?.contentType }); return { key, url: joinUrl(base, key) }; },
    urlFor(key) { return joinUrl(base, key); },
    async delete(key) { store.delete(key); },
    has(key) { return store.has(key); },
  };
}
