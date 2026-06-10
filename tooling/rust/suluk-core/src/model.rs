//! The v4 "Suluk" document model (the structural parts; Schema Objects stay as opaque JSON since they are
//! JSON Schema 2020-12, SPEC C013). Mirrors tooling/ts/packages/core/src/types.ts.

use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Deserialize)]
pub struct Document {
    pub openapi: String,
    #[serde(default)]
    pub info: Value,
    #[serde(default)]
    pub servers: Vec<Value>,
    /// Keyed by uriTemplate (C005). BTreeMap keeps a deterministic order.
    #[serde(default)]
    pub paths: BTreeMap<String, PathItem>,
    #[serde(default, rename = "apiResponses")]
    pub api_responses: BTreeMap<String, Response>,
    #[serde(default)]
    pub components: Option<Components>,
}

#[derive(Debug, Deserialize)]
pub struct PathItem {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub shared: Option<Shared>,
    /// Name-keyed operations (C009). Each Request IS an operation.
    #[serde(default)]
    pub requests: BTreeMap<String, Request>,
    #[serde(default, rename = "pathResponses")]
    pub path_responses: BTreeMap<String, Response>,
}

#[derive(Debug, Deserialize)]
pub struct Shared {
    #[serde(default, rename = "parameterSchema")]
    pub parameter_schema: Option<ParameterSchema>,
}

#[derive(Debug, Deserialize)]
pub struct Request {
    pub method: String,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default, rename = "contentType")]
    pub content_type: Option<ContentType>,
    #[serde(default, rename = "contentSchema")]
    pub content_schema: Option<Value>,
    #[serde(default, rename = "parameterSchema")]
    pub parameter_schema: Option<ParameterSchema>,
    #[serde(default)]
    pub responses: BTreeMap<String, Response>,
}

/// A media type may be a single string or a list (C016 equivalent-media-type lists).
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum ContentType {
    One(String),
    Many(Vec<String>),
}

impl ContentType {
    /// Canonical first media type (sorted) lowercased — matches the TS signature normalization.
    pub fn canonical(&self) -> String {
        match self {
            ContentType::One(s) => s.trim().to_lowercase(),
            ContentType::Many(v) => {
                let mut sorted = v.clone();
                sorted.sort();
                sorted.first().map(|s| s.trim().to_lowercase()).unwrap_or_else(|| "*".into())
            }
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ParameterSchema {
    #[serde(default)]
    pub query: Option<Value>,
    #[serde(default)]
    pub path: Option<Value>,
    #[serde(default)]
    pub header: Option<Value>,
    #[serde(default)]
    pub cookie: Option<Value>,
    #[serde(default)]
    pub body: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct Response {
    pub status: Value,
    #[serde(default, rename = "contentType")]
    pub content_type: Option<ContentType>,
    #[serde(default, rename = "contentSchema")]
    pub content_schema: Option<Value>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Components {
    #[serde(default)]
    pub schemas: BTreeMap<String, Value>,
    #[serde(default)]
    pub requests: BTreeMap<String, Value>,
    #[serde(default)]
    pub responses: BTreeMap<String, Value>,
}

/// Parse a v4 document from YAML or JSON source.
pub fn parse_document(source: &str) -> Result<Document, String> {
    serde_yaml::from_str(source).map_err(|e| e.to_string())
}
