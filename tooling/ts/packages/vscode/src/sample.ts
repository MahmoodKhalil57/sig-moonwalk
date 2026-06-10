/**
 * A self-contained OpenAPI v4 "Suluk" sample, opened by "Suluk: Open a sample API" so the cockpit lights up
 * immediately on first use — no project of your own required. It exercises every layer: entities, scope-gated
 * operations (the "View as" axis), security schemes, declared cost (x-suluk-cost → the Cost layer + Scalar),
 * and responses — so the empty trees fill with something to explore.
 */
export const SAMPLE_V4 = `openapi: 4.0.0-candidate
info:
  title: Petshop (Suluk sample)
  version: 1.0.0
paths:
  "pet":
    requests:
      listPets:
        method: get
        summary: List pets
        x-suluk-cost: { components: [ { source: db-read, basis: per-call, microUsd: 12 } ], estimateMicroUsd: 12 }
        responses:
          ok: { status: 200, contentType: application/json, contentSchema: { type: array, items: { $ref: "#/components/schemas/Pet" } } }
      createPet:
        method: post
        summary: Create a pet
        security: [ { petstore_auth: [ "write:pets" ] } ]      # scope-gated — try "View as" with/without write:pets
        contentType: application/json
        contentSchema: { $ref: "#/components/schemas/Pet" }
        x-suluk-cost: { components: [ { source: compute, basis: per-call, microUsd: 100 }, { source: db-write, basis: per-call, microUsd: 30 } ], estimateMicroUsd: 130 }
        responses:
          created: { status: 201, description: created, contentType: application/json, contentSchema: { $ref: "#/components/schemas/Pet" } }
          failCreate: { status: 400, description: invalid input }
  "pet/{petId}":
    requests:
      getPet:
        method: get
        summary: Get a pet by id
        parameterSchema: { path: { type: object, properties: { petId: { type: string } } } }
        x-suluk-cost: { components: [ { source: db-read, basis: per-call, microUsd: 8 } ], estimateMicroUsd: 8 }
        responses:
          ok: { status: 200, contentType: application/json, contentSchema: { $ref: "#/components/schemas/Pet" } }
          notFound: { status: 404, description: not found }
      deletePet:
        method: delete
        summary: Delete a pet
        security: [ { petstore_auth: [ "write:pets" ] } ]
        parameterSchema: { path: { type: object, properties: { petId: { type: string } } } }
        responses:
          deleted: { status: 204, description: deleted }
components:
  schemas:
    Pet:
      type: object
      required: [ name ]
      properties:
        id: { type: integer, format: int64 }
        name: { type: string }
        status: { type: string, enum: [ available, pending, sold ] }
    Category:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
  securitySchemes:
    petstore_auth: { type: oauth2, flows: { implicit: { authorizationUrl: "https://petstore.example/oauth", scopes: { "write:pets": "modify pets" } } } }
    api_key: { type: apiKey, name: api_key, in: header }
`;
