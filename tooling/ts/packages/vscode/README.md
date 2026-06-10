# Suluk — OpenAPI v4 (Candidate)

The unifying cockpit for the **Suluk** declarative cycle: author one OpenAPI v4 "Suluk"
candidate source and drive the whole loop from inside VS Code.

> **CANDIDATE tooling — not official OpenAPI.** Suluk is a single-contributor candidate-v4.0
> fork of the OpenAPI "Moonwalk" (v4) work, not a ratified specification.

## Features

- **Validate** a v4 document against the candidate meta-schema.
- **Audit** documentation coverage.
- **Preview** the contract rendered with Scalar or Swagger UI.
- **View as** different principal scopes (per-viewer docs).
- **Generate** a shadcn form/table, a Nano Stores client, or a full app (backend + frontend)
  from one v4 source.
- **Run contract checks**, export the v4 document, export the shadcn registry.
- **Deploy to Cloudflare** (Workers + D1 + static assets).

## Commands

Open the Command Palette and type **Suluk:** to see all commands, or use the **Suluk**
activity-bar container (Cycle + Builder views).

## Requirements

VS Code `^1.85.0`.
