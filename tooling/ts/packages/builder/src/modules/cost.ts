/** Shared cost helper for first-party modules — the five CRUD cost entries for an entity, so a fleshed-out
 *  module (many entities) still declares cost on every operation and grades A in the registry. */
import type { ModuleCost } from "../module";

const rd = (n: number): ModuleCost => ({ components: [{ source: "db-read", basis: "per-call", microUsd: n }], estimateMicroUsd: n });
const wr = (n: number): ModuleCost => ({ components: [{ source: "db-write", basis: "per-call", microUsd: n }], estimateMicroUsd: n });

/** CRUD cost for `entity` (PascalCase): list/get at the read tier, create/update/delete at the write tier. */
export function crudCost(entity: string, read = 10, write = 30): Record<string, ModuleCost> {
  return {
    [`list${entity}`]: rd(read),
    [`get${entity}`]: rd(Math.round(read * 0.8)),
    [`create${entity}`]: wr(write),
    [`update${entity}`]: wr(write),
    [`delete${entity}`]: wr(Math.round(write * 0.67)),
  };
}
