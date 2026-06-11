/**
 * @suluk/sdk — generate a complete, intuitive TypeScript SDK from a v4 "Suluk" contract. ofetch-based,
 * entity-grouped, fully typed, auth wired, and the v4 superpowers (declared cost + access) surfaced as typed
 * metadata on each method. A library a developer downloads and uses straight away — not a bag of functions.
 *
 *   import { generateSdk } from "@suluk/sdk";
 *   const tsSource = generateSdk(v4Document, { baseURL: "https://api.example.com" }); // a self-contained .ts file
 */
export { generateSdk, tsType, type SdkOptions } from "./generate";
