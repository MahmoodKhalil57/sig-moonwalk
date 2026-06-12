/**
 * The Cloudflare REST client — a thin, typed wrapper over `https://api.cloudflare.com/client/v4` with Bearer-token
 * auth, the standard `{ success, errors, result }` envelope, and a CloudflareError that surfaces the API's own error
 * codes (so a failed deploy says WHY). `fetch` is injectable so the whole library is unit-testable without a network.
 */
export interface CloudflareError_t {
  code: number;
  message: string;
}

export class CloudflareError extends Error {
  constructor(
    public readonly status: number,
    public readonly errors: CloudflareError_t[],
    public readonly path: string,
  ) {
    super(`Cloudflare API ${status} on ${path}: ${errors.map((e) => `[${e.code}] ${e.message}`).join("; ") || "request failed"}`);
    this.name = "CloudflareError";
  }
}

export interface CloudflareClientOptions {
  /** an API token (Bearer). Account-scoped: Workers Scripts + D1 (+ KV/R2) Edit, Account Settings Read. */
  apiToken: string;
  /** the account id; resolved from the token's first account when omitted. */
  accountId?: string;
  /** injected fetch (tests pass a recorder); defaults to the global. */
  fetch?: typeof fetch;
  /** API base (default the public Cloudflare API). */
  baseUrl?: string;
}

export interface RequestOptions {
  /** a JSON body (sets content-type + serializes). */
  json?: unknown;
  /** a raw body (e.g. FormData / multipart) — takes precedence over `json`. */
  body?: BodyInit;
  /** extra headers. */
  headers?: Record<string, string>;
  /** query params. */
  query?: Record<string, string | number | boolean | undefined>;
  /** override the Bearer token (e.g. an assets-upload JWT). */
  token?: string;
}

const API = "https://api.cloudflare.com/client/v4";

export class CloudflareClient {
  private readonly token: string;
  private readonly doFetch: typeof fetch;
  private readonly base: string;
  accountId: string | undefined;

  constructor(opts: CloudflareClientOptions) {
    if (!opts.apiToken) throw new Error("@suluk/cloudflare: apiToken is required");
    this.token = opts.apiToken;
    this.accountId = opts.accountId;
    this.doFetch = opts.fetch ?? globalThis.fetch;
    this.base = opts.baseUrl ?? API;
  }

  /** Make a request and return the unwrapped `result`, throwing a CloudflareError when `success` is false. */
  async request<T = unknown>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const qs = opts.query
      ? "?" + Object.entries(opts.query).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
      : "";
    const headers: Record<string, string> = { authorization: `Bearer ${opts.token ?? this.token}`, ...opts.headers };
    let body = opts.body;
    if (body === undefined && opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
    const res = await this.doFetch(`${this.base}${path}${qs}`, { method, headers, body });
    const text = await res.text();
    let env: { success?: boolean; errors?: CloudflareError_t[]; result?: T } = {};
    try { env = text ? JSON.parse(text) : {}; } catch { /* non-JSON (e.g. an asset upload 200) */ }
    if (!res.ok || env.success === false) throw new CloudflareError(res.status, env.errors?.length ? env.errors : [{ code: res.status, message: text.slice(0, 200) || res.statusText }], path);
    return env.result as T;
  }

  /** Resolve (and cache) the account id — the first account the token can see, unless one was supplied. */
  async resolveAccountId(): Promise<string> {
    if (this.accountId) return this.accountId;
    const accounts = await this.request<{ id: string; name: string }[]>("GET", "/accounts");
    if (!accounts?.length) throw new Error("@suluk/cloudflare: the token can see no accounts (grant Account Settings: Read)");
    this.accountId = accounts[0].id;
    return this.accountId;
  }
}
