/**
 * mountAuth — the thin Hono adapter for Better Auth (the documented integration:
 * app.on(["POST","GET"], "/api/auth/*", c => auth.handler(c.req.raw))). Duck-typed so it needs neither a
 * hard better-auth nor hono import — it only relies on app.on(...) and auth.handler(Request).
 */

export interface AuthHandlerLike {
  handler(request: Request): Response | Promise<Response>;
}

export interface HonoLike {
  on(methods: string[], path: string, handler: (c: { req: { raw: Request } }) => unknown): unknown;
}

export interface MountAuthOptions {
  /** Base path Better Auth is mounted at (default "/api/auth"). */
  basePath?: string;
  /** HTTP methods to route (default ["POST","GET"]). */
  methods?: string[];
}

/** Mount the Better Auth handler onto a Hono app under basePath/* (default /api/auth/*). */
export function mountAuth<T extends HonoLike>(app: T, auth: AuthHandlerLike, opts: MountAuthOptions = {}): T {
  const basePath = (opts.basePath ?? "/api/auth").replace(/\/$/, "");
  const methods = opts.methods ?? ["POST", "GET"];
  app.on(methods, `${basePath}/*`, (c) => auth.handler(c.req.raw));
  return app;
}
