/**
 * Runnable entry — `bun run build:frontend && bun run start`. Serves the generated frontend (static) AND the
 * contract-derived API + Scalar docs + /superadmin on :3000. (Same `app` deploys to a Cloudflare Worker; the
 * static assets become the Worker's `assets` binding.)
 */
import { app } from "./app";

const port = Number(process.env.PORT ?? 3000);
const FRONTEND = new URL("../dist/client", import.meta.url).pathname;
const isAsset = (p: string) => p === "/" || /\.(js|css|map|ico|png|svg|woff2?)$/.test(p);

Bun.serve({
  port,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (req.method === "GET" && isAsset(path)) {
      const file = Bun.file(FRONTEND + (path === "/" ? "/index.html" : path));
      if (await file.exists()) return new Response(file);
    }
    return app.fetch(req); // API · docs · /superadmin
  },
});
// eslint-disable-next-line no-console
console.log(`Petshop on http://localhost:${port}  —  the generated UI at /, plus /scalar · /superadmin · /pet · /category`);
