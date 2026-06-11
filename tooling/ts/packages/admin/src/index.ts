/**
 * @suluk/admin — the /superadmin web admin panel. The SAME cockpit as the vscode extension (@suluk/cockpit
 * core), rendered as Hono-served web pages and gated to superadmins. One brain, two faces. Mount it on your
 * app: `app.route("/", adminApp({ document, authorize }))`. CANDIDATE tooling — NOT official OAS.
 */
export { adminApp, type AdminOptions } from "./app";
export { layout, renderCycle, renderBuilder, renderChecks, renderDeploy, esc } from "./render";
// data-admin mode (Phase 1): per-entity list table + create/edit form projected from the contract.
export {
  entityModels, renderEntityForm, renderEntityTable, renderDataIndex, renderEntityAdmin,
  type EntityModel, type EntityField, type EntityAccess,
} from "./render-data";
// analytics dashboard (Phase 3): inline-SVG charts over the contract's cost facets.
export { renderAnalytics } from "./analytics";
