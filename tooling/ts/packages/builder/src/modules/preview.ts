/**
 * The first-party `preview` module (the LAST roadmap slice — live role-preview, charter-bounded by C020).
 *
 * It is a mergeable contract FRAGMENT that adds ONE operation — `GET preview/login?role=…` — the deploy's own
 * role-login route. The extension never mints or holds a session: it deep-links this route in the system
 * browser (vscode.env.openExternal), and the credentialed act happens server-side, inside the generated
 * PREVIEW Worker's Better Auth, behind a fail-closed gate (env.SULUK_PREVIEW === "1" AND a PREVIEW_DB binding;
 * see @suluk/better-auth previewLoginHandler). The op carries `x-suluk-preview-only: true` so converge WARNs if
 * this backdoor ever shows up in a contract — it must only be reachable in a preview deployment.
 *
 * DELIBERATELY: no security scheme. The gate is a DEPLOY-TIME runtime flag, not a credential the client sends —
 * modelling `role` as an apiKey would misrepresent the op as authenticating when it merely SELECTS a seeded
 * demo identity behind a server gate. The op is public at the contract level + honestly marked preview-only.
 *
 * It REQUIRES the host's User (so a composition that has auth knows the roles), PROVIDES no entity, and is
 * EXCLUDED from FIRST_PARTY_REGISTRY.modules and every stack template (see ./index.ts): a session-establishing
 * module must never be marketplace/compose-installable — that is the textbook supply-chain credential hole. It
 * is a deploy-flavor fragment, installed deliberately, not browsed.
 */
import type { SulukModule } from "../module";
import type { PathItem, Request } from "@suluk/core";

/** The marker every preview-only operation carries; converge keys on it to surface the backdoor. */
export const PREVIEW_ONLY_MARKER = "x-suluk-preview-only" as const;

const previewLoginPaths: Record<string, PathItem> = {
  "preview/login": {
    requests: {
      previewLogin: {
        method: "get",
        summary: "Log in as a seeded demo principal (PREVIEW DEPLOYMENTS ONLY)",
        description:
          "Establishes a role-scoped session for a seeded throwaway demo user and redirects to the app. " +
          "404 unless the deployment is a preview (env.SULUK_PREVIEW === \"1\" AND a PREVIEW_DB binding). " +
          "Never bound to a real user; the role must be one the contract's User.role enum declares.",
        tags: ["Preview"],
        parameterSchema: {
          query: {
            type: "object",
            properties: { role: { type: "string", description: "the seeded demo role to assume (e.g. admin)" } },
            required: ["role"],
          },
        },
        responses: {
          found: { status: 302, description: "redirect to the app as the selected role" },
          forbidden: { status: 403, description: "role is not a declared preview role" },
          notFound: { status: 404, description: "preview is not enabled on this deployment" },
        },
        [PREVIEW_ONLY_MARKER]: true,
      } as Request,
    },
  },
};

export const PREVIEW: SulukModule = {
  name: "preview",
  version: "0.1.0",
  provides: [],
  requires: ["User"], // it previews the roles the host's User declares
  crud: false,
  schemas: {},
  paths: previewLoginPaths,
  cost: {
    // a redirect + a single seeded-user lookup + session write
    previewLogin: { components: [{ source: "db-read", basis: "per-call", microUsd: 8 }], estimateMicroUsd: 8 },
  },
};
