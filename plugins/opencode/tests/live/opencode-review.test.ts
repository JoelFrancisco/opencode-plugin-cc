import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkTmpRepo, runCompanion, type TmpRepo } from "../e2e/helpers.js";

const LIVE_ENABLED = process.env["OPENCODE_LIVE_E2E"] === "1";

describe.skipIf(!LIVE_ENABLED)("live opencode review (Layer C, real API calls)", () => {
  let repo: TmpRepo;

  beforeEach(() => {
    repo = mkTmpRepo({ withChanges: true });
  });

  afterEach(() => {
    repo.cleanup();
  });

  it("runs a real review and returns substantive output", () => {
    const result = runCompanion(["review"], {
      cwd: repo.path,
      env: process.env,
      timeoutMs: 300_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(100);
  }, 240_000);

  it.skipIf(!process.env["OPENCODE_LIVE_MODEL"])(
    "real review with explicit --model passes through to opencode",
    () => {
      const model = process.env["OPENCODE_LIVE_MODEL"];
      if (model === undefined) return;
      const result = runCompanion(["review", "--no-broker", "--model", model], {
        cwd: repo.path,
        env: process.env,
        timeoutMs: 300_000,
      });
      expect(result.status).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(100);
    },
    420_000,
  );
});
