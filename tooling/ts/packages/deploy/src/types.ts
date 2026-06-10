/**
 * The deployment abstraction — SWAPPABLE by design. A provider turns a Suluk app into the files + the ordered
 * steps that ship it. Cloudflare is the first provider; the interface is the contract every future target
 * (Vercel, Fly, a self-hosted Node box) implements. The user's CLAUDE-stated wish — "good standards we can
 * swap out in the future" — is exactly this interface.
 */
import type { SchemaOrRef } from "@suluk/core";

export interface DeployEntity {
  name: string;
  schema: SchemaOrRef;
}

export interface DeployInput {
  /** App name (slugified by the provider for resource names). */
  name: string;
  /** The data entities (for the database schema). */
  entities: DeployEntity[];
  /** Path, in the user's project, to the module exporting the Hono `app` (default "./src/app"). */
  appModule?: string;
  /** Built frontend assets directory served as static files (default "./dist/client"). */
  assetsDir?: string;
  /** Worker runtime compatibility date (default DEFAULT_COMPAT_DATE). Pass today's date in production. */
  compatibilityDate?: string;
}

/** A file the provider wants written into the project. */
export interface DeployFile {
  path: string;
  content: string;
}

/** One ordered shell step the host (the vscode extension) runs in a terminal AFTER the user authenticates. */
export interface DeployStep {
  cmd: string;
  note: string;
}

export interface DeployPlan {
  provider: string;
  files: DeployFile[];
  steps: DeployStep[];
  /** Human-facing notes (auth, manual fill-ins, caveats). */
  notes: string[];
}

/** A deployment target. Pure: it produces the plan; the host executes the steps (with the user's credentials). */
export interface DeployProvider {
  name: string;
  generate(input: DeployInput): DeployPlan;
}
