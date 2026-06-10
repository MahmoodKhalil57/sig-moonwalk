#![doc(html_logo_url = "https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/mark-256.png")]
#![doc(html_favicon_url = "https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/favicon.ico")]
//! suluk-core — performance core for the OpenAPI v4.0 "Suluk" candidate.
//!
//! A Rust counterpart to @suluk/core's portable algorithms: parse a v4 document, compute canonical request
//! signatures, reverse-parse uriTemplates, and match concrete requests to operations (the ADA). Having a
//! second, independent implementation is part of what makes the spec's algorithms a STANDARD rather than a
//! single codebase. CANDIDATE tooling — NOT official OAS, NOT SIG-ratified.

pub mod ada;
pub mod model;
pub mod signature;
pub mod template;

pub use ada::{build_ada, match_request, parse_query, Ada, MatchResult, Operation};
pub use model::{parse_document, Document, PathItem, Request, Response};
pub use signature::{collide, compute_signature, CollisionVerdict, SignatureTuple};
pub use template::{compile_template, match_path, variable_count, CompiledTemplate, Segment};
