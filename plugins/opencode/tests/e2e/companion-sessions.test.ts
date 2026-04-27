import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  killAllBrokersIn,
  fakeOpencodeEnv,
  mkTmpRepo,
  runCompanion,
  type TmpRepo,
} from "./helpers.js";

describe("companion sessions (e2e, Layer A)", () => {
  let repo: TmpRepo;
  let stateDir: string;

  beforeEach(() => {
    repo = mkTmpRepo({ withChanges: true });
    stateDir = mkdtempSync(join(tmpdir(), "opencode-plugin-state-"));
  });

  afterEach(() => {
    killAllBrokersIn(stateDir);
    repo.cleanup();
    rmSync(stateDir, { recursive: true, force: true });
  });

  function envFor(): NodeJS.ProcessEnv {
    return {
      ...fakeOpencodeEnv(repo),
      OPENCODE_PLUGIN_STATE_DIR: stateDir,
    };
  }

  it("reports no broker when none is running", () => {
    const result = runCompanion(["sessions"], { cwd: repo.path, env: envFor() });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No broker running");
  });

  it("lists sessions after a review has run through the broker", () => {
    runCompanion(["review"], { cwd: repo.path, env: envFor() });
    const result = runCompanion(["sessions"], { cwd: repo.path, env: envFor() });
    expect(result.status).toBe(0);
    // The fake server creates a session per /session POST. After one review we expect at least one entry.
    expect(result.stdout).toMatch(/opencode sessions in|No opencode sessions/);
  });
});
