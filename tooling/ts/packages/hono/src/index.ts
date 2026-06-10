/**
 * @suluk/hono — the derivation engine. The user authors minimal RouteContracts (Hono + Zod); everything
 * else is derived: the v4 document (dynamic per principal + time), request validation, contract tests, and
 * a documentation-coverage audit. See tooling/ARCHITECTURE.md. CANDIDATE tooling.
 */
export { contract, responseList, type RouteContract, type RouteRequest, type RouteResponse, type Method } from "./contract";
export { emitV4, type EmitContext, type EmitResult, type EmitDiagnostic } from "./emit";
export { audit, coverage, autofill, type Finding } from "./audit";
export { contractChecks, runContractChecks, type Check, type CheckRun } from "./checks";
export { validateSchema2020, type SchemaCheck } from "./schema-check";
export { mount } from "./mount";
