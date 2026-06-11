/**
 * Auth-flow UX helpers (saastarter parity: "auth preserves where you came from", "frictionless activation").
 * Two concerns, both library-owned so every builder's auth pages inherit them instead of re-deriving:
 *   - redirect preservation with an OPEN-REDIRECT guard (a `redirectTo` is honored only when it's a same-origin
 *     relative path), threaded into social/magic-link callbackURL + the post-sign-in redirect + sign-out return;
 *   - a Better Auth emailVerification block with frictionless defaults (verify-on-sign-up + auto-sign-in after).
 * Pure + dependency-free.
 */

/** A path is safe to redirect to iff it's a SINGLE-leading-slash relative path (rejects "//host", "http(s)://…",
 *  backslash tricks, and protocol-relative URLs) — defends against open-redirect. */
export function isSafeRelativePath(p: string | null | undefined): p is string {
  return !!p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") && !p.includes("://") && !p.includes("\\");
}

/** Read `redirectTo` from a query string / URLSearchParams; return it only if same-origin-relative, else `fallback`. */
export function resolveRedirectTo(search: string | URLSearchParams, fallback = "/"): string {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const raw = params.get("redirectTo");
  return isSafeRelativePath(raw) ? raw : fallback;
}

/** Append a (guarded) `redirectTo` to an href — e.g. point "/login" at the page the user was on, so post-auth
 *  returns there. A non-safe target is dropped (the href is returned unchanged). */
export function withRedirectTo(href: string, redirectTo: string | null | undefined): string {
  if (!isSafeRelativePath(redirectTo)) return href;
  return href + (href.includes("?") ? "&" : "?") + "redirectTo=" + encodeURIComponent(redirectTo);
}

export interface EmailVerificationOptions {
  /** send the verification email — bind to your branded-email builder. */
  sendVerificationEmail: (data: { user: { email: string }; url: string; token?: string }) => Promise<void> | void;
  /** sign the user in automatically after they click the verification link (default true — frictionless). */
  autoSignIn?: boolean;
  /** send a verification email on sign-up (default true). */
  sendOnSignUp?: boolean;
}

/** A Better Auth `emailVerification` block with frictionless-activation defaults. Spread into
 *  `betterAuth({ emailVerification: emailVerificationConfig({ sendVerificationEmail }) })`. */
export function emailVerificationConfig(opts: EmailVerificationOptions) {
  return {
    sendOnSignUp: opts.sendOnSignUp ?? true,
    autoSignInAfterVerification: opts.autoSignIn ?? true,
    sendVerificationEmail: opts.sendVerificationEmail,
  };
}
