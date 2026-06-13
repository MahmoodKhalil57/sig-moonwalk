/** Deploy skew-protection — pin a client to the deployment it loaded, and force a full reload after a new deploy
 *  (so a long-lived tab never runs old HTML against freshly-rotated chunks / a changed contract).
 *
 *  Server: stamp `deploymentMeta(id)` into <head>, and return the same id in the `x-deployment-id` response header
 *  from a light endpoint (e.g. /api/health). Client: include `skewGuardScript()` once — it polls that header and,
 *  on a mismatch, does a hard navigation on the next same-origin link click. */

export const DEPLOYMENT_HEADER = "x-deployment-id";

/** A <meta> stamping the build/deployment id into the page. */
export function deploymentMeta(id: string): string {
  return `<meta name="x-deployment-id" content="${String(id).replace(/["<>]/g, "")}">`;
}

export interface SkewGuardOptions {
  /** Endpoint that echoes the current deployment id in the header (default "/api/health"). */
  endpoint?: string;
  /** Response header carrying the id (default "x-deployment-id"). */
  header?: string;
  /** Poll interval ms (default 60000). */
  intervalMs?: number;
}

/** Inline client guard (drop into a <script>). Detects a newer deploy and converts the next same-origin link
 *  click into a full page load so the user lands on the new version cleanly. */
export function skewGuardScript(opts: SkewGuardOptions = {}): string {
  const ep = JSON.stringify(opts.endpoint ?? "/api/health");
  const hdr = JSON.stringify((opts.header ?? DEPLOYMENT_HEADER).toLowerCase());
  const iv = opts.intervalMs ?? 60000;
  return `(function(){try{var m=document.querySelector('meta[name="x-deployment-id"]');var cur=m&&m.getAttribute('content');if(!cur)return;var stale=false;function check(){fetch(${ep},{method:'GET',cache:'no-store'}).then(function(r){var v=r.headers.get(${hdr});if(v&&v!==cur)stale=true;}).catch(function(){});}document.addEventListener('visibilitychange',function(){if(!document.hidden)check();});document.addEventListener('click',function(e){if(!stale)return;var a=e.target.closest&&e.target.closest('a[href]');if(a&&a.href&&a.origin===location.origin&&!a.target){e.preventDefault();location.href=a.href;}},true);setInterval(check,${iv});check();}catch(e){}})();`;
}
