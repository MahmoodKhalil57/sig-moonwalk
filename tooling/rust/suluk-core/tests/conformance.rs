//! Cargo tests against the canonical conformance corpus — the SAME petstore the TS core is tested on, so
//! both implementations are checked against one source of truth (cross-implementation agreement).

use std::path::PathBuf;
use suluk_core::{
    build_ada, collide, compute_signature, match_request, parse_document, CollisionVerdict,
};

fn corpus(name: &str) -> String {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("../../../specification/candidate-v4/conformance/valid");
    p.push(name);
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("read {:?}: {}", p, e))
}

fn petstore() -> suluk_core::Document {
    parse_document(&corpus("01-petstore.yaml")).expect("petstore parses")
}

#[test]
fn parses_the_corpus() {
    let doc = petstore();
    assert!(doc.openapi.starts_with("4."));
    assert!(doc.paths.contains_key("pet"));
    assert!(doc.paths.contains_key("pet/{petId}"));
}

#[test]
fn builds_the_ada_with_every_request() {
    let doc = petstore();
    let ada = build_ada(&doc);
    // createPet, listPets, findByStatus, getPet, updatePet, deletePet
    assert!(ada.operations.len() >= 6, "got {} ops", ada.operations.len());
}

#[test]
fn matches_get_pet_by_id_with_captured_param() {
    let doc = petstore();
    let ada = build_ada(&doc);
    let m = match_request(&ada, "GET", "/pet/123").expect("matches");
    assert_eq!(m.operation.name, "getPet");
    assert_eq!(m.path_params, vec![("petId".to_string(), "123".to_string())]);
}

#[test]
fn concrete_over_variable_precedence() {
    let doc = petstore();
    let ada = build_ada(&doc);
    // "/pet" must hit the collection (listPets), never pet/{petId}.
    assert_eq!(match_request(&ada, "GET", "/pet").unwrap().operation.name, "listPets");
    assert_eq!(match_request(&ada, "POST", "/pet").unwrap().operation.name, "createPet");
}

#[test]
fn captures_query_string() {
    let doc = petstore();
    let ada = build_ada(&doc);
    let m = match_request(&ada, "GET", "/pet/findByStatus?status=available").expect("matches");
    assert_eq!(m.operation.name, "findByStatus");
    assert_eq!(m.query, vec![("status".to_string(), "available".to_string())]);
}

#[test]
fn no_match_returns_none() {
    let doc = petstore();
    let ada = build_ada(&doc);
    assert!(match_request(&ada, "GET", "/nonexistent/path").is_none());
}

#[test]
fn signature_is_shape_based_and_deterministic() {
    let doc = petstore();
    // two different variable spellings collapse to the same shape key
    let pi = &doc.paths["pet/{petId}"];
    let get_pet = &pi.requests["getPet"];
    let (_, key_a) = compute_signature("pet/{petId}", get_pet);
    let (_, key_b) = compute_signature("pet/{name}", get_pet);
    assert_eq!(key_a, key_b, "var spelling must not affect the signature shape");
}

#[test]
fn different_methods_are_provably_disjoint() {
    let doc = petstore();
    let pi = &doc.paths["pet"];
    let (post_t, _) = compute_signature("pet", &pi.requests["createPet"]);
    let (get_t, _) = compute_signature("pet", &pi.requests["listPets"]);
    assert_eq!(collide(&post_t, &get_t), CollisionVerdict::ProvablyDisjoint);
}

#[test]
fn other_corpus_docs_parse_and_index() {
    for name in ["02-callbacks-webhooks.yaml", "03-query-and-slots.yaml"] {
        let doc = parse_document(&corpus(name)).unwrap_or_else(|e| panic!("{} parses: {}", name, e));
        let _ = build_ada(&doc); // must not panic
    }
}
