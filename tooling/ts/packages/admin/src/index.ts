/**
 * @suluk/admin — the /superadmin web admin panel. The SAME cockpit as the vscode extension (@suluk/cockpit
 * core), rendered as Hono-served web pages and gated to superadmins. One brain, two faces. Mount it on your
 * app: `app.route("/", adminApp({ document, authorize }))`. CANDIDATE tooling — NOT official OAS.
 */
export { adminApp, type AdminOptions } from "./app";
export { layout, renderCycle, renderBuilder, renderChecks, renderDeploy, esc } from "./render";
