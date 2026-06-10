/**
 * @suluk/openapi-compat — convert between the OpenAPI v4 "Suluk" candidate and OpenAPI 3.1.
 *
 * downgrade(v4) → 3.1 is the lever for Scalar & Swagger UI (they consume 3.x). upgrade(3.1) → v4 is the
 * reverse. The pair is lossless for documents that fit 3.1's expressivity; where v4 exceeds 3.1 (notably
 * multiple requests per method on one path, C003), downgrade() reports it in `diagnostics` rather than
 * losing it silently. Schema Objects are shared verbatim (both are JSON Schema 2020-12). CANDIDATE tooling.
 */
export { downgrade, type DowngradeResult, type Diagnostic } from "./downgrade";
export { upgrade } from "./upgrade";
export { validate31, type Validation31 } from "./validate31";
