import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getJobPath,
  getOutputPath,
  type JobState,
  listJobsForWorkspace,
  newJobId,
  readJobState,
  writeJobState,
} from "../src/lib/state.js";

describe("state", () => {
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
      workspace: "/tmp/repo-a",
      pid: 12345,
      started: new Date().toISOString(),
      scope: "working-tree",
      status: "running",
      ...overrides,
    };
  }

  it("newJobId produces unique-looking ids", () => {
    const ids = new Set([newJobId(), newJobId(), newJobId()]);
    expect(ids.size).toBe(3);
  });

  it("writeJobState then readJobState round-trips", () => {
    const job = makeJob();
    writeJobState(job);
    const loaded = readJobState(job.id);
    expect(loaded).toEqual(job);
  });

  it("readJobState returns null for unknown ids", () => {
    expect(readJobState("does-not-exist")).toBeNull();
  });

  it("listJobsForWorkspace filters and sorts by started desc", () => {
    const older = makeJob({ workspace: "/tmp/repo-a", started: "2026-01-01T00:00:00Z" });
    const newer = makeJob({ workspace: "/tmp/repo-a", started: "2026-02-01T00:00:00Z" });
    const other = makeJob({ workspace: "/tmp/repo-b" });
    writeJobState(older);
    writeJobState(newer);
    writeJobState(other);

    const jobs = listJobsForWorkspace("/tmp/repo-a");
    expect(jobs.map((j) => j.id)).toEqual([newer.id, older.id]);
  });

  it("getJobPath and getOutputPath produce paths under the override state dir", () => {
    const id = "abc-123";
    expect(getJobPath(id).startsWith(stateDir)).toBe(true);
    expect(getOutputPath(id, "stdout").endsWith(`${id}.stdout`)).toBe(true);
  });
});
