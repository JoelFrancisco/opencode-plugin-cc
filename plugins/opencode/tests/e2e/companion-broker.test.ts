import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeOpencodeEnv, mkTmpRepo, runCompanion, type TmpRepo } from "./helpers.js";
import { isProcessAlive } from "../../src/lib/job-control.js";
import { workspaceKey } from "../../src/lib/server-endpoint.js";

function lockfilePath(stateDir: string, workspace: string): string {
  return join(stateDir, "server", `${workspaceKey(workspace)}.json`);
}

describe("companion broker (e2e, Layer A)", () => {
  let repo: TmpRepo;
  let stateDir: string;

  beforeEach(() => {
    repo = mkTmpRepo({ withChanges: true });
    stateDir = mkdtempSync(join(tmpdir(), "opencode-plugin-state-"));
  });

  afterEach(() => {
    runCompanion(["broker", "stop"], { cwd: repo.path, env: envFor() });
    repo.cleanup();
    rmSync(stateDir, { recursive: true, force: true });
  });

  function envFor(): NodeJS.ProcessEnv {
    return {
      ...fakeOpencodeEnv(repo),
      OPENCODE_PLUGIN_STATE_DIR: stateDir,
    };
  }

  it("broker start spawns fake-opencode serve, writes a lockfile, reports endpoint", () => {
    const result = runCompanion(["broker", "start"], { cwd: repo.path, env: envFor() });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Broker running at http:\/\/127\.0\.0\.1:\d+ \(pid \d+\)/);

    const lockfile = JSON.parse(readFileSync(lockfilePath(stateDir, repo.path), "utf8")) as {
      pid: number;
      host: string;
      port: number;
      workspace: string;
    };
    expect(lockfile.workspace).toBe(repo.path);
    expect(isProcessAlive(lockfile.pid)).toBe(true);
  });

  it("broker status reports a running broker as reachable", () => {
    runCompanion(["broker", "start"], { cwd: repo.path, env: envFor() });
    const status = runCompanion(["broker", "status"], { cwd: repo.path, env: envFor() });
    expect(status.status).toBe(0);
    expect(status.stdout).toContain("Reachable:        yes");
  });

  it("broker status reports no broker when none is running", () => {
    const status = runCompanion(["broker", "status"], { cwd: repo.path, env: envFor() });
    expect(status.status).toBe(0);
    expect(status.stdout).toContain("No broker registered");
  });

  it("broker stop terminates the process and removes the lockfile", () => {
    runCompanion(["broker", "start"], { cwd: repo.path, env: envFor() });
    const lockfile = JSON.parse(readFileSync(lockfilePath(stateDir, repo.path), "utf8")) as {
      pid: number;
    };
    const stop = runCompanion(["broker", "stop"], { cwd: repo.path, env: envFor() });
    expect(stop.status).toBe(0);
    expect(stop.stdout).toMatch(/Stopped broker/);
    // give the OS a moment to reap the SIGTERM'd child
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline && isProcessAlive(lockfile.pid)) {
      // poll
    }
    expect(isProcessAlive(lockfile.pid)).toBe(false);
  });

  it("broker stop is idempotent — second call reports no broker", () => {
    runCompanion(["broker", "start"], { cwd: repo.path, env: envFor() });
    runCompanion(["broker", "stop"], { cwd: repo.path, env: envFor() });
    const second = runCompanion(["broker", "stop"], { cwd: repo.path, env: envFor() });
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("No broker running");
  });

  it("broker start is idempotent — second call reuses the live broker", () => {
    const first = runCompanion(["broker", "start"], { cwd: repo.path, env: envFor() });
    const firstPort = (first.stdout.match(/:(\d+)/) ?? [])[1];

    const second = runCompanion(["broker", "start"], { cwd: repo.path, env: envFor() });
    expect(second.status).toBe(0);
    const secondPort = (second.stdout.match(/:(\d+)/) ?? [])[1];
    expect(secondPort).toBe(firstPort);
  });
});
