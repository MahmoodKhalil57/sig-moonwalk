/** A first-party `crm` module — Contacts and a Deal pipeline. Deal references the host's User (owner) and the
 *  module's own Contact, showing both a cross-module require and an intra-module reference. */
import type { SulukModule } from "../module";

export const CRM: SulukModule = {
  name: "crm",
  version: "0.1.0",
  provides: ["Contact", "Deal"],
  requires: ["User"], // Deal.owner references the host's User
  schemas: {
    Contact: {
      type: "object",
      required: ["name"],
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
      },
      additionalProperties: false,
    },
    Deal: {
      type: "object",
      required: ["title"],
      properties: {
        id: { type: "integer" },
        title: { type: "string" },
        contact: { $ref: "#/components/schemas/Contact" }, // intra-module reference
        owner: { $ref: "#/components/schemas/User" }, // cross-module require
        valueCents: { type: "integer", minimum: 0 },
        stage: { type: "string", enum: ["lead", "qualified", "won", "lost"] },
      },
      additionalProperties: false,
    },
  },
  cost: {
    listContact: { components: [{ source: "db-read", basis: "per-call", microUsd: 10 }], estimateMicroUsd: 10 },
    createContact: { components: [{ source: "db-write", basis: "per-call", microUsd: 30 }], estimateMicroUsd: 30 },
    getContact: { components: [{ source: "db-read", basis: "per-call", microUsd: 8 }], estimateMicroUsd: 8 },
    updateContact: { components: [{ source: "db-write", basis: "per-call", microUsd: 30 }], estimateMicroUsd: 30 },
    deleteContact: { components: [{ source: "db-write", basis: "per-call", microUsd: 20 }], estimateMicroUsd: 20 },
    listDeal: { components: [{ source: "db-read", basis: "per-call", microUsd: 12 }], estimateMicroUsd: 12 },
    createDeal: { components: [{ source: "db-write", basis: "per-call", microUsd: 35 }], estimateMicroUsd: 35 },
    getDeal: { components: [{ source: "db-read", basis: "per-call", microUsd: 8 }], estimateMicroUsd: 8 },
    updateDeal: { components: [{ source: "db-write", basis: "per-call", microUsd: 35 }], estimateMicroUsd: 35 },
    deleteDeal: { components: [{ source: "db-write", basis: "per-call", microUsd: 20 }], estimateMicroUsd: 20 },
  },
};
