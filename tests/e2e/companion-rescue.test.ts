import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fakeOpencodeEnv,
  findMessageCall,
  mkTmpRepo,
  readFakeLog,
  runCompanion,
  type FakeOpencodeMessageCall,
  type TmpRepo,
} from "./helpers.js";

function messageCalls(logPath: string): FakeOpencodeMessageCall[] {
  return readFakeLog(logPath).filter(
    (entry): entry is FakeOpencodeMessageCall => "kind" in entry && entry.kind === "message",
  );
}

describe("companion rescue (e2e, Layer A)", () => {
  let repo: TmpRepo;
  let stateDir: string;

  beforeEach(() => {
    repo = mkTmpRepo();
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

  it("forwards the task text verbatim as the prompt", () => {
    const result = runCompanion(["rescue", "investigate", "the", "flaky", "merge", "test"], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(result.status).toBe(0);
    const call = findMessageCall(repo.log);
    expect(call?.body.parts?.[0]?.text).toBe("investigate the flaky merge test");
  });

  it("errors when no task is supplied", () => {
    const result = runCompanion(["rescue"], { cwd: repo.path, env: envFor() });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing task description");
    expect(findMessageCall(repo.log)).toBeUndefined();
  });

  it("rejects --resume + --fresh together", () => {
    const result = runCompanion(["rescue", "--resume", "--fresh", "do thing"], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("--check-resume reports false when no broker is running", () => {
    const result = runCompanion(["rescue", "--check-resume"], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ available: false });
  });

  it("--check-resume reports true after a rescue thread exists", () => {
    runCompanion(["rescue", "do", "the", "thing"], { cwd: repo.path, env: envFor() });
    const result = runCompanion(["rescue", "--check-resume"], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { available: boolean; sessionId?: string };
    expect(parsed.available).toBe(true);
    expect(parsed.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("--resume routes follow-up to the existing rescue session", () => {
    const first = runCompanion(["rescue", "investigate", "X"], { cwd: repo.path, env: envFor() });
    expect(first.status).toBe(0);

    const second = runCompanion(["rescue", "--resume", "now", "fix", "it"], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(second.status).toBe(0);

    const calls = messageCalls(repo.log);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0]?.sessionId).toBe(calls[1]?.sessionId);
  });

  it("--fresh starts a new session even if a rescue exists", () => {
    runCompanion(["rescue", "investigate", "X"], { cwd: repo.path, env: envFor() });
    runCompanion(["rescue", "--fresh", "different", "task"], { cwd: repo.path, env: envFor() });

    const calls = messageCalls(repo.log);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0]?.sessionId).not.toBe(calls[1]?.sessionId);
  });

  it("forwards --model as parsed providerID/modelID", () => {
    runCompanion(["rescue", "--model", "anthropic/claude-sonnet-4-6", "investigate"], {
      cwd: repo.path,
      env: envFor(),
    });
    const call = findMessageCall(repo.log);
    expect(call?.body.model).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-6",
    });
  });

  it("appends the --effort high hint to the task text", () => {
    runCompanion(["rescue", "--effort", "high", "investigate"], {
      cwd: repo.path,
      env: envFor(),
    });
    const prompt = findMessageCall(repo.log)?.body.parts?.[0]?.text ?? "";
    expect(prompt.startsWith("investigate")).toBe(true);
    expect(prompt).toContain("Think carefully through edge cases");
  });

  it("rejects unknown --effort values", () => {
    const result = runCompanion(["rescue", "--effort", "ultra", "do thing"], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid --effort");
  });
});
