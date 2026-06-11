/**
 * adminApp — the /superadmin web panel. It mounts a small Hono app whose routes render the SAME @suluk/cockpit
 * models the vscode extension shows: the cycle, the builder tree (with contract-narrowing), the docs (Scalar),
 * the contract checks, and the deploy plan. Gated by a pluggable `authorize` (wire it to @suluk/better-auth's
 * principalFromSession → role === "superadmin"); default is DENY, because /superadmin is privileged.
 */
import { Hono, type Context } from "hono";
import type { OpenAPIv4Document } from "@suluk/core";
import {
  buildCycle, buildBuilderModel, docChecks, deployPlan, previewHtml,
} from "@suluk/cockpit";
import { layout, renderCycle, renderBuilder, renderChecks, renderDeploy } from "./render";
import { renderDataIndex, renderEntityAdmin } from "./render-data";

export interface AdminOptions {
  /** The hub v4 document — a value, or a function (so the panel reflects live state per request). */
  document: OpenAPIv4Document | ((c: Context) => OpenAPIv4Document | Promise<OpenAPIv4Document>);
  /** Mount path (default "/superadmin"). */
  basePath?: string;
  /** Gate: return true to allow. Wire to your auth (superadmin only). DEFAULT: deny everything. */
  authorize?: (c: Context) => boolean | Promise<boolean>;
  /** Page title. */
  title?: string;
}

async function resolveDoc(opts: AdminOptions, c: Context): Promise<OpenAPIv4Document> {
  return typeof opts.document === "function" ? opts.document(c) : opts.document;
}

/** Build the /superadmin Hono app. Mount it on your server: `app.route("/", adminApp({...}))`. */
export function adminApp(opts: AdminOptions): Hono {
  const base = (opts.basePath ?? "/superadmin").replace(/\/$/, "");
  const title = opts.title ?? "App";
  const authorize = opts.authorize ?? (() => false); // privileged by default
  const app = new Hono();

  // the gate — every admin route is superadmin-only
  app.use(`${base}`, gate);
  app.use(`${base}/*`, gate);
  async function gate(c: Context, next: () => Promise<void>) {
    if (!(await authorize(c))) return c.text("403 — superadmin only", 403);
    await next();
  }

  const page = (active: string, body: string) => layout(title, base, active, body);

  app.get(base, async (c) => c.html(page("", renderCycle(buildCycle(await resolveDoc(opts, c))))));
  app.get(`${base}/builder`, async (c) => c.html(page("builder", renderBuilder(buildBuilderModel(await resolveDoc(opts, c)).tree))));
  // data-admin: an entity index + per-entity list/create page, projected from components.schemas.
  app.get(`${base}/data`, async (c) => c.html(page("data", renderDataIndex(await resolveDoc(opts, c), base))));
  app.get(`${base}/data/:entity`, async (c) => c.html(page("data", renderEntityAdmin(await resolveDoc(opts, c), c.req.param("entity"), base))));
  app.get(`${base}/checks`, async (c) => c.html(page("checks", renderChecks(docChecks(await resolveDoc(opts, c))))));
  app.get(`${base}/deploy`, async (c) => c.html(page("deploy", renderDeploy(deployPlan(await resolveDoc(opts, c))))));
  app.get(`${base}/docs`, async (c) => {
    const doc = await resolveDoc(opts, c);
    return c.html(previewHtml(JSON.stringify(doc), "scalar").html);
  });
  return app;
}
