/**
 * Audience-sync (saastarter-parity Phase 3). The newsletter signup stores a subscriber (the MARKETING module's
 * `Newsletter` entity) AND mirrors it to the email provider's AUDIENCE/list (saastarter POSTs to Resend
 * `/audiences/{id}/contacts`, src/app/api/newsletter/route.ts:35-41). This is that mirror as a swappable binding:
 * a duck-typed `AudienceProvider` (consoleAudience for dev; a Workers-safe resendAudience over the REST API, no SDK)
 * + a `syncNewsletter` reconciler that drives the audience from the `Newsletter` rows (subscribed → upsert,
 * unsubscribed → remove). Content the app SENDS to a provider — never a hosted list.
 */

export interface AudienceContact {
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
}

export interface AudienceResult {
  ok: boolean;
  /** the provider's contact id, when upserted. */
  id?: string;
  error?: string;
}

/** The swappable audience binding — mirror contacts to an email-provider audience/list. */
export interface AudienceProvider {
  /** a stable id (e.g. "resend", "console"). */
  readonly id: string;
  /** add or update a contact in the audience (idempotent upsert). */
  upsert(audienceId: string, contact: AudienceContact): Promise<AudienceResult>;
  /** remove (or unsubscribe) a contact from the audience. */
  remove(audienceId: string, email: string): Promise<AudienceResult>;
}

export interface ConsoleAudienceOptions {
  log?: (line: string) => void;
}

/** DEV audience — logs, never calls the network. */
export function consoleAudience(opts: ConsoleAudienceOptions = {}): AudienceProvider {
  const log = opts.log ?? ((l) => console.log(l));
  return {
    id: "console",
    async upsert(audienceId, contact) { log(`👥 [DEV AUDIENCE] upsert ${contact.email} → ${audienceId}`); return { ok: true }; },
    async remove(audienceId, email) { log(`👥 [DEV AUDIENCE] remove ${email} ← ${audienceId}`); return { ok: true }; },
  };
}

export interface ResendAudienceOptions {
  /** the Resend API key (the app pulls it from @suluk/env). */
  apiKey: string;
  /** inject a fetch (default: global fetch) — for testing / a custom transport. */
  fetch?: typeof fetch;
}

/** Resend Audiences via the REST API (https://api.resend.com/audiences/{id}/contacts) over `fetch` — no SDK; never throws. */
export function resendAudience(opts: ResendAudienceOptions): AudienceProvider {
  const doFetch = opts.fetch ?? fetch;
  const headers = { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" };
  const fail = async (res: Response): Promise<AudienceResult> => ({ ok: false, error: `resend ${res.status}: ${await res.text().catch(() => "")}`.trim() });
  return {
    id: "resend",
    async upsert(audienceId, contact) {
      try {
        const res = await doFetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: "POST",
          headers,
          body: JSON.stringify({ email: contact.email, unsubscribed: contact.unsubscribed ?? false, ...(contact.firstName ? { first_name: contact.firstName } : {}), ...(contact.lastName ? { last_name: contact.lastName } : {}) }),
        });
        if (!res.ok) return fail(res);
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: body.id };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    async remove(audienceId, email) {
      try {
        const res = await doFetch(`https://api.resend.com/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`, { method: "DELETE", headers });
        return res.ok ? { ok: true } : fail(res);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

/** One newsletter subscriber row (the shape of the MARKETING module's `Newsletter` entity). */
export interface NewsletterRow {
  email: string;
  status?: "subscribed" | "unsubscribed";
}

export interface SyncResult {
  upserted: number;
  removed: number;
  failed: number;
}

/**
 * Reconcile the `Newsletter` rows to an email-provider audience: a `subscribed` row is upserted, an `unsubscribed`
 * row is removed. Drives the audience from your DB (the source of truth), so the two never drift. Returns the tally.
 */
export async function syncNewsletter(provider: AudienceProvider, audienceId: string, rows: NewsletterRow[]): Promise<SyncResult> {
  let upserted = 0, removed = 0, failed = 0;
  for (const row of rows) {
    const res = row.status === "unsubscribed"
      ? await provider.remove(audienceId, row.email)
      : await provider.upsert(audienceId, { email: row.email, unsubscribed: false });
    if (!res.ok) failed++;
    else if (row.status === "unsubscribed") removed++;
    else upserted++;
  }
  return { upserted, removed, failed };
}
