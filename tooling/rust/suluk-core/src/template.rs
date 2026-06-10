//! uriTemplate compile + reverse-parse — the RFC6570 parseable-profile (C005, C019 §A.4).
//! Split path vs query on the first query marker; split path on '/' BEFORE percent-decoding (the §2.4
//! fix); single-segment `{var}` and leading-`+` reserved `{+var}`. Mirrors core/src/template.ts.

#[derive(Debug, Clone, PartialEq)]
pub enum Segment {
    Literal(String),
    Var { name: String, multi: bool },
}

#[derive(Debug, Clone)]
pub struct CompiledTemplate {
    pub raw: String,
    pub path_segments: Vec<Segment>,
    /// Query parameter names present in the template (key-set, order-insensitive).
    pub query_keys: Vec<String>,
}

/// Index of the first query marker (`{?`, `{&`, or a bare `?`) in the template, if any.
fn first_query_marker(t: &str) -> Option<usize> {
    let bytes = t.as_bytes();
    for i in 0..bytes.len() {
        if bytes[i] == b'?' {
            return Some(i);
        }
        if bytes[i] == b'{' && i + 1 < bytes.len() && (bytes[i + 1] == b'?' || bytes[i + 1] == b'&') {
            return Some(i);
        }
    }
    None
}

fn parse_segment(seg: &str) -> Segment {
    if seg.starts_with('{') && seg.ends_with('}') {
        let inner = &seg[1..seg.len() - 1];
        let (multi, name) = if let Some(rest) = inner.strip_prefix('+') {
            (true, rest)
        } else {
            (false, inner)
        };
        return Segment::Var { name: name.to_string(), multi };
    }
    Segment::Literal(seg.to_string())
}

pub fn compile_template(tmpl: &str) -> CompiledTemplate {
    let q = first_query_marker(tmpl);
    let path_part = match q {
        Some(i) => &tmpl[..i],
        None => tmpl,
    };
    let query_part = match q {
        Some(i) => &tmpl[i..],
        None => "",
    };

    // query keys: `{?a,b}` / `{&a}` expansions, plus `?a={a}` / `&a={a}` explicit forms.
    let mut query_keys: Vec<String> = Vec::new();
    let qbytes = query_part.as_bytes();
    let mut i = 0;
    while i < qbytes.len() {
        if qbytes[i] == b'{' && i + 1 < qbytes.len() && (qbytes[i + 1] == b'?' || qbytes[i + 1] == b'&') {
            if let Some(end) = query_part[i..].find('}') {
                let names = &query_part[i + 2..i + end];
                for n in names.split(',') {
                    let n = n.trim();
                    if !n.is_empty() {
                        query_keys.push(n.to_string());
                    }
                }
                i += end + 1;
                continue;
            }
        }
        i += 1;
    }

    let trimmed = path_part.strip_prefix('/').unwrap_or(path_part);
    let path_segments: Vec<Segment> = if trimmed.is_empty() {
        Vec::new()
    } else {
        trimmed
            .split('/')
            .filter(|s| !s.is_empty())
            .map(parse_segment)
            .collect()
    };

    CompiledTemplate {
        raw: tmpl.to_string(),
        path_segments,
        query_keys,
    }
}

/// Number of variable segments (concrete-over-variable precedence ranking).
pub fn variable_count(c: &CompiledTemplate) -> usize {
    c.path_segments
        .iter()
        .filter(|s| matches!(s, Segment::Var { .. }))
        .count()
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Reverse-parse a concrete path against the template; returns captured vars or None.
/// Split on '/' first, then percent-decode captures (RFC3986 §2.1).
pub fn match_path(c: &CompiledTemplate, url_path: &str) -> Option<Vec<(String, String)>> {
    let trimmed = url_path.strip_prefix('/').unwrap_or(url_path);
    let parts: Vec<&str> = if trimmed.is_empty() {
        Vec::new()
    } else {
        trimmed.split('/').filter(|s| !s.is_empty()).collect()
    };

    if c.path_segments.is_empty() {
        return if parts.is_empty() { Some(Vec::new()) } else { None };
    }

    let mut captures: Vec<(String, String)> = Vec::new();
    let mut i = 0;
    for seg in &c.path_segments {
        match seg {
            Segment::Literal(v) => {
                if i >= parts.len() || percent_decode(parts[i]) != *v {
                    return None;
                }
                i += 1;
            }
            Segment::Var { name, multi } if *multi => {
                let rest: Vec<String> = parts[i..].iter().map(|p| percent_decode(p)).collect();
                captures.push((name.clone(), rest.join("/")));
                i = parts.len();
            }
            Segment::Var { name, .. } => {
                if i >= parts.len() {
                    return None;
                }
                captures.push((name.clone(), percent_decode(parts[i])));
                i += 1;
            }
        }
    }
    if i == parts.len() {
        Some(captures)
    } else {
        None
    }
}
