import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fakeOpencodeEnv,
  findMessageCall,
  mkTmpRepo,
  runCompanion,
  type TmpRepo,
} from "./helpers.js";

function jobIdFromStdout(stdout: string): string {
  const match = stdout.match(/opencode review started: (\S+)/);
  if (match === null) throw new Error(`No job id in stdout:\n${stdout}`);
  return match[1] ?? "";
}

describe("companion jobs (e2e, Layer A)", () => {
  let repo: TmpRepo;
  let stateDir: string;

  beforeEach(() => {
    repo = mkTmpRepo({ withChanges: true });
    stateDir = mkdtempSync(join(tmpdir(), "opencode-plugin-state-"));
  });

  afterEach(() => {
    repo.cleanup();
    rmSync(stateDir, { recursive: true, force: true });
  });

  function envFor(): NodeJS.ProcessEnv {
    return {
      ...fakeOpencodeEnv(repo),
      OPENCODE_PLUGIN_STATE_DIR: stateDir,
    };
  }

  it("--background writes state, captures output to files, marks completed", () => {
    const result = runCompanion(["review", "--background"], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(result.status).toBe(0);
    const id = jobIdFromStdout(result.stdout);

    const statusResult = runCompanion(["status", "--json"], {
      cwd: repo.path,
      env: envFor(),
    });
    const jobs = JSON.parse(statusResult.stdout) as Array<{
      id: string;
      status: string;
      exitCode?: number;
    }>;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe(id);
    expect(jobs[0]?.status).toBe("completed");
    expect(jobs[0]?.exitCode).toBe(0);
  });

  it("status filters jobs by workspace", () => {
    runCompanion(["review", "--background"], { cwd: repo.path, env: envFor() });

    const otherRepo = mkTmpRepo({ withChanges: true });
    try {
      const otherEnv = {
        ...fakeOpencodeEnv(otherRepo),
        OPENCODE_PLUGIN_STATE_DIR: stateDir,
      };
      runCompanion(["review", "--background"], { cwd: otherRepo.path, env: otherEnv });

      const fromRepo = runCompanion(["status", "--json"], { cwd: repo.path, env: envFor() });
      const fromOther = runCompanion(["status", "--json"], { cwd: otherRepo.path, env: otherEnv });

      expect(JSON.parse(fromRepo.stdout) as unknown[]).toHaveLength(1);
      expect(JSON.parse(fromOther.stdout) as unknown[]).toHaveLength(1);
    } finally {
      otherRepo.cleanup();
    }
  });

  it("result prints the latest job's output by default", () => {
    runCompanion(["review", "--background"], { cwd: repo.path, env: envFor() });
    const result = runCompanion(["result"], { cwd: repo.path, env: envFor() });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Fake Broker Review");
  });

  it("result --job <id> targets a specific job", () => {
    const first = runCompanion(["review", "--background"], { cwd: repo.path, env: envFor() });
    const firstId = jobIdFromStdout(first.stdout);
    runCompanion(["review", "--background"], { cwd: repo.path, env: envFor() });

    const result = runCompanion(["result", "--job", firstId], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Fake Broker Review");
  });

  it("cancel marks the job as cancelled", () => {
    const start = runCompanion(["review", "--background"], { cwd: repo.path, env: envFor() });
    const id = jobIdFromStdout(start.stdout);

    const cancelOut = runCompanion(["cancel", "--job", id], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(cancelOut.status).toBe(0);
    expect(cancelOut.stdout).toMatch(/Cancelled|already/);

    const persisted = JSON.parse(readFileSync(join(stateDir, "jobs", `${id}.json`), "utf8")) as {
      status: string;
    };
    expect(["cancelled", "completed"]).toContain(persisted.status);
  });

  it("--background forwards --model to opencode (parsed providerID/modelID)", () => {
    runCompanion(["review", "--background", "--model", "anthropic/claude-sonnet-4-6"], {
      cwd: repo.path,
      env: envFor(),
    });
    const call = findMessageCall(repo.log);
    expect(call?.body.model).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-6",
    });
  });

  it("--background tracks the broker session id in JobState", () => {
    const start = runCompanion(["review", "--background"], { cwd: repo.path, env: envFor() });
    const id = jobIdFromStdout(start.stdout);
    const status = runCompanion(["status", "--json"], { cwd: repo.path, env: envFor() });
    const jobs = JSON.parse(status.stdout) as Array<{ id: string; sessionId?: string }>;
    const tracked = jobs.find((job) => job.id === id);
    expect(tracked?.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("status reports 'No opencode reviews' when none exist", () => {
    const result = runCompanion(["status"], { cwd: repo.path, env: envFor() });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No opencode reviews");
  });

  it("result errors with a clear message when no jobs exist", () => {
    const result = runCompanion(["result"], { cwd: repo.path, env: envFor() });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("No opencode reviews");
  });
});
