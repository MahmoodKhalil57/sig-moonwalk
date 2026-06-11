/**
 * The EmailProvider binding (saastarter-parity Phase 1). @suluk/builder declares an `email` provider SLOT
 * (providers.ts PROVIDER_CATALOG: resend/sendgrid/ses) but no package bound it — RESEND had no `pkg`. This is that
 * binding: a duck-typed `EmailProvider` interface (the same swappable-binding pattern as @suluk/stripe's
 * PaymentProvider) with a DEV `consoleProvider` and a Workers-safe `resendProvider`.
 *
 * L3 line: the package emits content the app SENDS. `resendProvider` is a thin BINDING to an external service (like
 * the rate-limit KV binding), not a Suluk-hosted mailer — and it uses the Resend REST API over `fetch`, so it needs
 * no `resend` SDK and runs on Workers. The dev default sends nothing (saastarter resend.ts:21-32).
 */

/** The rendered CONTENT of an email (no addressing) — the output of a template; spread into a send with `to`. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text?: string;
}

/** A sendable message — a {@link RenderedEmail} plus addressing. The input to a provider. */
export interface EmailMessage extends RenderedEmail {
  to: string | string[];
  /** override the provider's default From. */
  from?: string;
  replyTo?: string;
}

export interface SendResult {
  ok: boolean;
  /** the provider's message id, when sent. */
  id?: string;
  error?: string;
  /** the third-party send cost in µ$, for @suluk/cost metering (advisory). */
  costMicroUsd?: number;
}

/** The swappable binding. An app picks one impl; the template set is provider-agnostic. */
export interface EmailProvider {
  /** a stable id (e.g. "resend", "console") — matches the @suluk/builder provider-slot impl id. */
  readonly id: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export interface ConsoleProviderOptions {
  /** sink (default console.log) — receives a one-line summary, never sends. */
  log?: (line: string, message: EmailMessage) => void;
}

/** DEV provider — logs a summary instead of sending (saastarter resend.ts:21-32). Never touches the network. */
export function consoleProvider(opts: ConsoleProviderOptions = {}): EmailProvider {
  const log = opts.log ?? ((line) => console.log(line));
  return {
    id: "console",
    async send(message) {
      const to = Array.isArray(message.to) ? message.to.join(", ") : message.to;
      log(`📧 [DEV EMAIL] to=${to} · subject=${message.subject}`, message);
      return { ok: true, costMicroUsd: 0 };
    },
  };
}

export interface ResendProviderOptions {
  /** the Resend API key (the app pulls it from @suluk/env). */
  apiKey: string;
  /** default From, e.g. "Acme <noreply@acme.com>" — must be a verified Resend domain. */
  from: string;
  /** inject a fetch (default: global fetch) — for testing / a custom transport. */
  fetch?: typeof fetch;
  /** advisory per-send cost in µ$ for @suluk/cost metering. */
  costMicroUsd?: number;
}

/**
 * Resend binding via the REST API (https://api.resend.com/emails) over `fetch` — Workers-safe, no `resend` SDK.
 * Returns `{ ok:false, error }` on a non-2xx or a transport error (the caller decides whether a send failure is
 * fatal); never throws.
 */
export function resendProvider(opts: ResendProviderOptions): EmailProvider {
  const doFetch = opts.fetch ?? fetch;
  return {
    id: "resend",
    async send(message) {
      try {
        const res = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            from: message.from ?? opts.from,
            to: Array.isArray(message.to) ? message.to : [message.to],
            subject: message.subject,
            html: message.html,
            ...(message.text ? { text: message.text } : {}),
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
        });
        if (!res.ok) return { ok: false, error: `resend ${res.status}: ${await res.text().catch(() => "")}`.trim() };
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: body.id, costMicroUsd: opts.costMicroUsd };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

/** Pick the provider the way saastarter's `isLocal` switch does: dev ⇒ console, prod ⇒ resend. */
export function pickProvider(opts: { dev: boolean; apiKey?: string; from?: string; costMicroUsd?: number }): EmailProvider {
  if (opts.dev || !opts.apiKey || !opts.from) return consoleProvider();
  return resendProvider({ apiKey: opts.apiKey, from: opts.from, costMicroUsd: opts.costMicroUsd });
}
