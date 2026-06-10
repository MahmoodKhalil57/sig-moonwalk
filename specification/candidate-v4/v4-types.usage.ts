import type { OpenAPIv4Document } from "./v4-types";
import { isReference } from "./v4-types";

const doc: OpenAPIv4Document = {
  openapi: "4.0.0-candidate",
  info: { title: "Petstore", version: "1.0.0" },
  paths: {
    "pet/{petId}": {
      shared: { parameterSchema: { path: { type: "object", properties: { petId: { type: "string" } } } } },
      requests: {
        getPet: {
          method: "get",
          responses: { ok: { status: 200, contentType: "application/json", contentSchema: { $ref: "#/components/schemas/Pet" } } },
        },
      },
      pathResponses: { notFound: { status: 404 } },
    },
  },
  components: { schemas: { Pet: { type: "object", required: ["name"] } } },
};

const cs = doc.paths["pet/{petId}"].requests.getPet.responses.ok.contentSchema;
const ref: string | null = isReference(cs) ? cs.$ref : null;   // type guard narrows to Reference
console.log(doc.info.title, ref);
