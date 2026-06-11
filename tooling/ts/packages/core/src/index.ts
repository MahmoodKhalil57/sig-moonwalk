/**
 * @suluk/core — the foundation library for the OpenAPI v4.0 "Suluk" candidate.
 *
 * parse → validate (meta-schema) → resolve references (by-name) → compute signatures → build the ADA →
 * match requests. Implements the structural + behavioral contract in
 * specification/candidate-v4/conformance/CONFORMANCE.md and the buildable grammars in SPEC Appendix A (C019).
 * CANDIDATE tooling — provisional; the soft points (CONFIDENCE.md) are isolated here.
 */
export type {
  OpenAPIv4Document, Info, Server, Tag, PathItem, Shared, Request, HttpMethod,
  ParameterSchema, Response, Callback, Components, SecurityRequirement, SecurityScheme,
  Reference, Schema, SchemaOrRef, SulukSource,
  SulukRateLimit, SchemaProperty, PropertyFacets, SulukJob,
} from "./types";

export { parseDocument } from "./parse";
export { validateDocument, isValidDocument, type ValidationResult, type ValidationIssue } from "./validate";
export { isReference, resolveRef, deref } from "./reference";
export { sourceIndex, sourceCoverage, scrubSource, sourceKey, type SourceGroup, type SourceRef } from "./source";
export { RATELIMIT_EXT, rateLimitOf, rateLimitIndex, rateLimitCoverage, retryAfterSeconds, type RateLimitGroup } from "./ratelimit";
export {
  PROBLEM_CONTENT_TYPE, PROBLEM_STATUS_TABLE, TITLE_BY_TAG, PROBLEM_DETAILS_SCHEMA,
  isProblemDetails, toProblemDetails,
  type ProblemDetails, type ProblemStatus, type ErrorTag,
} from "./errors";
export { compileTemplate, matchPath, variableCount, type CompiledTemplate, type PathSegment } from "./template";
export { computeSignature, collide, type SignatureTuple, type CollisionVerdict } from "./signature";
export {
  buildAda, matchRequest, parseQuery,
  type Ada, type Operation, type Collision, type MatchResult,
} from "./ada";
