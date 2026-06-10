//! The Abstract Description API: index every request as an operation, compute signatures, detect
//! collisions, and reverse-parse a concrete (method, url) to zero-or-one operation. Mirrors core/src/ada.ts.

use crate::model::Document;
use crate::signature::{collide, compute_signature, CollisionVerdict, SignatureTuple};
use crate::template::{compile_template, match_path, variable_count, CompiledTemplate};

pub struct Operation {
    pub path_template: String,
    pub name: String,
    pub method: String,
    pub tuple: SignatureTuple,
    pub signature_key: String,
    pub compiled: CompiledTemplate,
}

pub struct Collision {
    pub a: usize,
    pub b: usize,
    pub verdict: CollisionVerdict,
}

pub struct Ada {
    pub operations: Vec<Operation>,
    pub collisions: Vec<Collision>,
}

pub fn build_ada(doc: &Document) -> Ada {
    let mut operations: Vec<Operation> = Vec::new();
    for (path_template, pi) in &doc.paths {
        for (name, req) in &pi.requests {
            let (tuple, key) = compute_signature(path_template, req);
            operations.push(Operation {
                path_template: path_template.clone(),
                name: name.clone(),
                method: req.method.to_uppercase(),
                tuple,
                signature_key: key,
                compiled: compile_template(path_template),
            });
        }
    }
    let mut collisions: Vec<Collision> = Vec::new();
    for i in 0..operations.len() {
        for j in (i + 1)..operations.len() {
            let verdict = collide(&operations[i].tuple, &operations[j].tuple);
            if verdict != CollisionVerdict::ProvablyDisjoint {
                collisions.push(Collision { a: i, b: j, verdict });
            }
        }
    }
    Ada { operations, collisions }
}

pub struct MatchResult<'a> {
    pub operation: &'a Operation,
    pub path_params: Vec<(String, String)>,
    pub query: Vec<(String, String)>,
}

/// Match a concrete request (method + url) to zero-or-one operation; concrete-over-variable tiebreak.
pub fn match_request<'a>(ada: &'a Ada, method: &str, url: &str) -> Option<MatchResult<'a>> {
    let (path, qs) = match url.find('?') {
        Some(i) => (&url[..i], &url[i + 1..]),
        None => (url, ""),
    };
    let m = method.to_uppercase();

    let mut candidates: Vec<(&Operation, Vec<(String, String)>)> = Vec::new();
    for op in &ada.operations {
        if op.method != m {
            continue;
        }
        if let Some(params) = match_path(&op.compiled, path) {
            candidates.push((op, params));
        }
    }
    if candidates.is_empty() {
        return None;
    }
    // fewest path variables wins (concrete-over-variable).
    candidates.sort_by_key(|(op, _)| variable_count(&op.compiled));
    let (operation, path_params) = candidates.into_iter().next().unwrap();
    Some(MatchResult { operation, path_params, query: parse_query(qs) })
}

/// Form-style query parse: key→value pairs (repeated keys kept in order).
pub fn parse_query(qs: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    if qs.is_empty() {
        return out;
    }
    for pair in qs.split('&') {
        if pair.is_empty() {
            continue;
        }
        match pair.find('=') {
            Some(i) => out.push((pair[..i].to_string(), pair[i + 1..].replace('+', " "))),
            None => out.push((pair.to_string(), String::new())),
        }
    }
    out
}
