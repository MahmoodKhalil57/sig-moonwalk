/** panelApp — mount a contract-first admin at `basePath` (default /panel). Dashboard + per-entity list + create/
 *  edit form, all projected from the document. Pass a PROJECTED document (per role) to get a per-role panel for
 *  free: entities/ops the role lacks simply don't appear. Gated by `authorize`; theme via `headHtml`. */
import { Hono, type Context } from "hono";
import type { OpenAPIv4Document } from "@suluk/core";
import { entityModels, type EntityModel } from "./model";
import { renderShell } from "./shell";
import { renderList } from "./list";
import { renderForm } from "./form";

export interface PanelOptions {
  /** The v4 document — a value, or a per-request function (e.g. return projectDocument(doc, roleOf(c))). */
  document: OpenAPIv4Document | ((c: Context) => OpenAPIv4Document | Promise<OpenAPIv4Document>);
  basePath?: string;
  /** Brand shown in the sidebar + titles. */
  title?: string;
  /** Gate — return true to allow. Default: deny everything. */
  authorize?: (c: Context) => boolean | Promise<boolean>;
  /** Injected into <head> after the default theme (link a color-scheme sheet + stamper to follow the host theme). */
  headHtml?: string | ((c: Context) => string);
  /** Field names to omit from every entity. */
  hide?: string[];
}

export function panelApp(opts: PanelOptions): Hono {
  const base = (opts.basePath ?? "/panel").replace(/\/$/, "");
  const brand = opts.title ?? "Panel";
  const authorize = opts.authorize ?? (() => false);
  const app = new Hono();

  app.use(base, gate); app.use(`${base}/*`, gate);
  async function gate(c: Context, next: () => Promise<void>) { if (!(await authorize(c))) return c.text("403 — not authorized", 403); await next(); }

  const head = (c: Context) => (typeof opts.headHtml === "function" ? opts.headHtml(c) : (opts.headHtml ?? ""));
  const list = (ms: EntityModel[]) => ms.map((m) => ({ name: m.name }));
  const rels = (ms: EntityModel[]) => Object.fromEntries(ms.map((m) => [m.name, m.path]));
  async function models(c: Context): Promise<EntityModel[]> {
    const doc = typeof opts.document === "function" ? await opts.document(c) : opts.document;
    return entityModels(doc as never, { hide: opts.hide });
  }

  app.get(base, async (c) => {
    const ms = await models(c);
    const cards = ms.map((m) => {
      const ops = [m.access.create ? "create" : "", m.access.update ? "edit" : "", m.access.delete ? "delete" : ""].filter(Boolean).join(" · ") || "read-only";
      return `<a class="pf-card" href="${base}/${m.name}"><b>${m.name}</b><p>${m.fields.length} fields · ${ops}</p></a>`;
    }).join("");
    return c.html(renderShell({ title: brand, brand, basePath: base, entities: list(ms), active: "", heading: "Dashboard",
      body: ms.length ? `<div class="pf-cards">${cards}</div>` : `<p class="pf-muted">No managed entities in this contract.</p>`, headHtml: head(c) }));
  });

  app.get(`${base}/:entity`, async (c) => {
    const ms = await models(c); const m = ms.find((x) => x.name === c.req.param("entity")); if (!m) return c.notFound();
    return c.html(renderShell({ title: brand, brand, basePath: base, entities: list(ms), active: m.name, heading: m.name,
      crumbs: [{ label: "Dashboard", href: base }, { label: m.name }], body: renderList(m, { basePath: base }), headHtml: head(c) }));
  });

  app.get(`${base}/:entity/:action`, async (c) => {
    const ms = await models(c); const m = ms.find((x) => x.name === c.req.param("entity")); if (!m) return c.notFound();
    const editing = c.req.param("action") === "edit";
    if (editing ? !m.access.update : !m.access.create) return c.text("403 — not allowed", 403);
    return c.html(renderShell({ title: brand, brand, basePath: base, entities: list(ms), active: m.name, heading: editing ? `Edit ${m.name}` : `New ${m.name}`,
      crumbs: [{ label: "Dashboard", href: base }, { label: m.name, href: `${base}/${m.name}` }, { label: editing ? "Edit" : "New" }],
      body: renderForm(m, { basePath: base, relPaths: rels(ms), canDelete: editing && m.access.delete }), headHtml: head(c) }));
  });

  return app;
}
