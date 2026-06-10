import { parse as parseYaml } from "yaml";
import type { OpenAPIv4Document } from "./types";

/** Parse a Suluk v4 document from YAML or JSON source text. (YAML is a superset; JSON parses as YAML too.) */
export function parseDocument(source: string): OpenAPIv4Document {
  return parseYaml(source) as OpenAPIv4Document;
}
