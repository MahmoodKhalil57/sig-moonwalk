import { test, expect, describe } from "bun:test";
import { eachJob, costAudit, costTable } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

// C025: cron + queue jobs have NO inbound Request, so they live in the x-suluk-jobs vendor map (not paths/webhooks).
const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "t", version: "1" },
  paths: {},
  "x-suluk-jobs": {
    nightlyRollup: {
      trigger: "scheduled", schedule: "0 0 * * *",
      "x-suluk-cost": { components: [{ source: "compute", basis: "per-call", microUsd: 500 }], trigger: "scheduled", attribution: { strategy: "job-stamped" } },
    },
    drainEmailQueue: {
      trigger: "queue-consumed", queue: "emails",
      "x-suluk-cost": { components: [{ source: "resend", basis: "per-call", microUsd: 100 }], trigger: "queue-consumed" }, // no attribution
    },
  },
} as unknown as OpenAPIv4Document;

describe("C025 — x-suluk-jobs: cron/queue cost gets a first-class home", () => {
  test("eachJob enumerates the jobs map", () => {
    expect(eachJob(doc).map((j) => j.name).sort()).toEqual(["drainEmailQueue", "nightlyRollup"]);
    expect(eachJob(doc).find((j) => j.name === "nightlyRollup")?.job.schedule).toBe("0 0 * * *");
  });

  test("costTable includes job rows with their non-synchronous trigger", () => {
    const rows = costTable(doc);
    expect(rows.find((r) => r.operation === "nightlyRollup")).toMatchObject({ path: "jobs/nightlyRollup", trigger: "scheduled", estimateMicroUsd: 500 });
    expect(rows.find((r) => r.operation === "drainEmailQueue")?.trigger).toBe("queue-consumed");
  });

  test("costAudit applies the same fail-loud discipline to jobs: a job-stamped job is clean, an unattributed one is flagged", () => {
    const findings = costAudit(doc);
    expect(findings.find((f) => f.operation === "nightlyRollup" && f.code === "unattributed-background-cost")).toBeUndefined(); // job-stamped declares its principal
    expect(findings.find((f) => f.operation === "drainEmailQueue")?.code).toBe("unattributed-background-cost");                 // no attribution → fail loud
  });
});
