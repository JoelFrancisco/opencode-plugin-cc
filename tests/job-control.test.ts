import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cancelJob,
  isProcessAlive,
  readJobOutput,
  reconcileJobStatus,
} from "../src/lib/job-control.js";
import {
  getOutputPath,
  type JobState,
  newJobId,
  readJobState,
  writeJobState,
} from "../src/lib/state.js";

describe("job-control", () => {
  let stateDir: string;
  const originalEnv = process.env["OPENCODE_PLUGIN_STATE_DIR"];

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "opencode-plugin-state-"));
    process.env["OPENCODE_PLUGIN_STATE_DIR"] = stateDir;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["OPENCODE_PLUGIN_STATE_DIR"];
    } else {
      process.env["OPENCODE_PLUGIN_STATE_DIR"] = originalEnv;
    }
    rmSync(stateDir, { recursive: true, force: true });
  });

  function makeJob(overrides: Partial<JobState> = {}): JobState {
    return {
      id: overrides.id ?? newJobId(),
      kind: "review",
      workspace: "/tmp/repo",
      pid: 12345,
      started: new Date().toISOString(),
      scope: "working-tree",
      status: "running",
      ...overrides,
    };
  }

  it("isProcessAlive returns true for the current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it("isProcessAlive returns false for an unused pid", () => {
    expect(isProcessAlive(2 ** 22)).toBe(false);
  });

  it("reconcileJobStatus marks a dead 'running' job as failed", () => {
    const job = makeJob({ pid: 2 ** 22, status: "running" });
    writeJobState(job);
    const updated = reconcileJobStatus(job);
    expect(updated.status).toBe("failed");
    const persisted = readJobState(job.id);
    expect(persisted?.status).toBe("failed");
  });

  it("reconcileJobStatus leaves completed jobs alone", () => {
    const job = makeJob({ status: "completed", exitCode: 0 });
    writeJobState(job);
    expect(reconcileJobStatus(job)).toEqual(job);
  });

  it("readJobOutput returns empty strings when no files exist", () => {
    const output = readJobOutput("nonexistent-job");
    expect(output).toEqual({ stdout: "", stderr: "" });
  });

  it("readJobOutput reads previously-written stdout/stderr", () => {
    const id = "test-job-id";
    writeFileSync(getOutputPath(id, "stdout"), "out\n");
    writeFileSync(getOutputPath(id, "stderr"), "err\n");
    expect(readJobOutput(id)).toEqual({ stdout: "out\n", stderr: "err\n" });
  });

  it("cancelJob returns not-found for unknown ids", () => {
    expect(cancelJob("nope")).toEqual({ outcome: "not-found" });
  });

  it("cancelJob returns not-running for completed jobs", () => {
    const job = makeJob({ status: "completed" });
    writeJobState(job);
    const result = cancelJob(job.id);
    expect(result.outcome).toBe("not-running");
  });

  it("cancelJob marks a running job as cancelled even if pid is gone", () => {
    const job = makeJob({ pid: 2 ** 22, status: "running" });
    writeJobState(job);
    const result = cancelJob(job.id);
    expect(result.outcome).toBe("cancelled");
    expect(readJobState(job.id)?.status).toBe("cancelled");
  });
});
