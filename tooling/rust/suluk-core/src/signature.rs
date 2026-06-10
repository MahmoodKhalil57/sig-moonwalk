//! Canonical signature tuple (C019 §A.2) + three-valued collision predicate (C003 detect-and-tolerate).
//! Mirrors core/src/signature.ts. The path shape erases variable names to `{}`; the body id is the $ref,
//! an `inline:<hash>`, or `*`.

use crate::model::Request;
use crate::template::{compile_template, Segment};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub struct SignatureTuple {
    pub method: String,
    pub path: String,
    pub query: Vec<String>,
    pub content_type: String,
    pub headers: Vec<String>,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CollisionVerdict {
    ProvablyDisjoint,
    ProvableCollision,
    NotStaticallyDeterminable,
}

/// djb2 over canonical (sorted-key) JSON — a stable structural id for an inline body schema.
fn djb2_hex(v: &Value) -> String {
    let canonical = canonical_json(v);
    let mut h: u32 = 5381;
    for b in canonical.bytes() {
        h = (h << 5).wrapping_add(h).wrapping_add(b as u32);
    }
    format!("{:x}", h)
}

/// Serialize JSON with object keys sorted, so structurally-equal schemas hash equally.
fn canonical_json(v: &Value) -> String {
    match v {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let parts: Vec<String> = keys
                .iter()
                .map(|k| format!("{}:{}", serde_json::to_string(k).unwrap(), canonical_json(&map[*k])))
                .collect();
            format!("{{{}}}", parts.join(","))
        }
        Value::Array(arr) => {
            let parts: Vec<String> = arr.iter().map(canonical_json).collect();
            format!("[{}]", parts.join(","))
        }
        other => other.to_string(),
    }
}

fn body_id(req: &Request) -> String {
    match &req.content_schema {
        None => "*".to_string(),
        Some(cs) => {
            if let Some(r) = cs.get("$ref").and_then(|r| r.as_str()) {
                // a $ref in Schema-Object position is the JSON-Schema kind; but at this slot a bare
                // {"$ref": "..."} body is an OpenAPI Reference — use it as the stable id either way.
                r.to_string()
            } else {
                format!("inline:{}", djb2_hex(cs))
            }
        }
    }
}

pub fn compute_signature(uri_template: &str, req: &Request) -> (SignatureTuple, String) {
    let ct = compile_template(uri_template);
    let method = req.method.to_uppercase();
    let path = ct
        .path_segments
        .iter()
        .map(|s| match s {
            Segment::Literal(v) => v.clone(),
            Segment::Var { .. } => "{}".to_string(),
        })
        .collect::<Vec<_>>()
        .join("/");
    let mut query: Vec<String> = ct.query_keys.clone();
    query.sort();
    query.dedup();
    let content_type = req
        .content_type
        .as_ref()
        .map(|c| c.canonical())
        .unwrap_or_else(|| "*".to_string());
    let headers: Vec<String> = Vec::new();
    let body = body_id(req);

    let key = format!(
        "M={}|P={}|Q={}|C={}|H={}|B={}",
        method,
        path,
        if query.is_empty() { "*".to_string() } else { query.join(",") },
        content_type,
        if headers.is_empty() { "*".to_string() } else { headers.join(",") },
        body
    );
    (
        SignatureTuple { method, path, query, content_type, headers, body },
        key,
    )
}

fn is_star(v: &str) -> bool {
    v == "*"
}

/// Pairwise three-valued collision predicate (C003 — NOT a gate).
pub fn collide(a: &SignatureTuple, b: &SignatureTuple) -> CollisionVerdict {
    if a.method != b.method {
        return CollisionVerdict::ProvablyDisjoint;
    }
    if a.path != b.path {
        let as_: Vec<&str> = a.path.split('/').collect();
        let bs: Vec<&str> = b.path.split('/').collect();
        if as_.len() != bs.len() {
            return CollisionVerdict::ProvablyDisjoint;
        }
        for (x, y) in as_.iter().zip(bs.iter()) {
            if *x != "{}" && *y != "{}" && x != y {
                return CollisionVerdict::ProvablyDisjoint;
            }
        }
    }
    if !is_star(&a.content_type) && !is_star(&b.content_type) && a.content_type != b.content_type {
        return CollisionVerdict::ProvablyDisjoint;
    }
    if a.body != b.body || a.query.join(",") != b.query.join(",") {
        return CollisionVerdict::NotStaticallyDeterminable;
    }
    CollisionVerdict::ProvableCollision
}
