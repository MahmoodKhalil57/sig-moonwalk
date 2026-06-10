/**
 * URL templating for the STATE corner. A RouteContract.path is Hono-style ("/pet/:petId"); v4 uriTemplates
 * are RFC-6570 ("pet/{petId}"). buildUrl accepts BOTH param syntaxes so the same helper works whether the
 * caller hands us a raw contract path or an already-projected v4 template — we substitute ":name" and
 * "{name}" segments from the params bag, then prepend an optional baseUrl.
 *
 * Honest-loss discipline (house pattern): a placeholder with no matching param is NOT silently emptied — it
 * is left verbatim in the URL so the missing binding is visible in the request (and to any test asserting on
 * the URL), rather than producing a plausible-but-wrong path. Callers that want strictness can diff the
 * result against a "no `:`/`{` remains" check.
 */
export function buildUrl(
  path: string,
  params?: Record<string, string | number>,
  baseUrl?: string,
): string {
  const p = params ?? {};
  let out = path;

  // "{name}" (RFC-6570 / v4 uriTemplate) — also tolerates "{+wildcard}".
  out = out.replace(/\{(\+?)([^}]+)\}/g, (whole, _plus: string, raw: string) => {
    const name = raw.trim();
    return name in p ? encodeURIComponent(String(p[name])) : whole; // unbound → left verbatim (honest loss)
  });

  // ":name" (Hono) — a segment token, so stop at the next "/" or "?".
  out = out.replace(/:([A-Za-z0-9_]+)/g, (whole, name: string) =>
    name in p ? encodeURIComponent(String(p[name])) : whole,
  );

  if (!baseUrl) return out;
  // Join without doubling or dropping the slash between base and path.
  const base = baseUrl.replace(/\/+$/, "");
  const tail = out.startsWith("/") ? out : `/${out}`;
  return base + tail;
}
