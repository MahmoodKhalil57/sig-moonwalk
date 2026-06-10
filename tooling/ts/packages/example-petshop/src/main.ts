/**
 * Runnable entry — `bun run start`. Serves the contract-derived CRUD API + Scalar docs on :3000.
 * (Bun.serve per the repo convention; the same `app` deploys to a Cloudflare Worker unchanged.)
 */
import { app } from "./app";

const port = Number(process.env.PORT ?? 3000);
Bun.serve({ port, fetch: app.fetch });
// eslint-disable-next-line no-console
console.log(`Petshop on http://localhost:${port}  —  /scalar · /openapi.json · /pet · /category`);
