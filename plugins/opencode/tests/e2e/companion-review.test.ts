import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeOpencodeEnv, findRunCall, mkTmpRepo, runCompanion, type TmpRepo } from "./helpers.js";

describe("companion review (e2e, Layer A)", () => {
  let repo: TmpRepo;

  beforeEach(() => {
    repo = mkTmpRepo({ withChanges: true });
  });

  afterEach(() => {
    repo.cleanup();
  });

  it("runs a review against the working tree and returns fake output", () => {
    const result = runCompanion(["review"], {
      cwd: repo.path,
      env: fakeOpencodeEnv(repo),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Fake Review");
    expect(result.stdout).toContain("Verdict: looks plausible.");
  });

  it("forwards --model verbatim to opencode", () => {
    const model = "anthropic/claude-sonnet-4-6";
    const result = runCompanion(["review", "--model", model], {
      cwd: repo.path,
      env: fakeOpencodeEnv(repo),
    });
    expect(result.status).toBe(0);
    const call = findRunCall(repo.log);
    expect(call).toBeDefined();
    expect(call?.args).toContain("--model");
    expect(call?.args).toContain(model);
  });

  it("forwards multi-segment provider routes (e.g. openrouter)", () => {
    const model = "openrouter/moonshotai/kimi-k2-0905";
    runCompanion(["review", "--model", model], {
      cwd: repo.path,
      env: fakeOpencodeEnv(repo),
    });
    expect(findRunCall(repo.log)?.args).toContain(model);
  });

  it("includes the working-tree diff and status in the prompt", () => {
    runCompanion(["review"], { cwd: repo.path, env: fakeOpencodeEnv(repo) });
    const call = findRunCall(repo.log);
    expect(call?.prompt).toContain("## Diff");
    expect(call?.prompt).toContain("## Git status");
    expect(call?.prompt).toContain("feature.ts");
    expect(call?.prompt).toContain("export const answer = 42");
  });

  it("rejects malformed --model before doing any work", () => {
    const result = runCompanion(["review", "--model", "bad model"], {
      cwd: repo.path,
      env: fakeOpencodeEnv(repo),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid --model");
    expect(findRunCall(repo.log)).toBeUndefined();
  });

  it("emits 'No changes to review' on a clean tree without invoking opencode", () => {
    const cleanRepo = mkTmpRepo();
    try {
      const result = runCompanion(["review"], {
        cwd: cleanRepo.path,
        env: fakeOpencodeEnv(cleanRepo),
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("No changes to review");
      expect(findRunCall(cleanRepo.log)).toBeUndefined();
    } finally {
      cleanRepo.cleanup();
    }
  });

  it("errors when run outside a git repo", () => {
    const result = runCompanion(["review"], {
      cwd: "/tmp",
      env: fakeOpencodeEnv(repo),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Not a git repository");
    expect(findRunCall(repo.log)).toBeUndefined();
  });

  it("errors when OPENCODE_BIN is missing", () => {
    const result = runCompanion(["review"], {
      cwd: repo.path,
      env: { ...fakeOpencodeEnv(repo), OPENCODE_BIN: "/nonexistent/opencode-xyz" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("opencode CLI not found");
  });

  it("propagates non-zero opencode exit status", () => {
    const result = runCompanion(["review"], {
      cwd: repo.path,
      env: { ...fakeOpencodeEnv(repo), OPENCODE_FAKE_EXIT: "3" },
    });
    expect(result.status).toBe(3);
  });
});
