import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fakeOpencodeEnv,
  findMessageCall,
  findRunCall,
  mkTmpRepo,
  runCompanion,
  type TmpRepo,
} from "./helpers.js";

describe("companion review (e2e, Layer A)", () => {
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

  describe("broker path (default)", () => {
    it("runs a review and prints the assistant text", () => {
      const result = runCompanion(["review"], { cwd: repo.path, env: envFor() });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("# Fake Broker Review");
    });

    it("forwards --model as a parsed providerID/modelID pair", () => {
      const result = runCompanion(["review", "--model", "openrouter/moonshotai/kimi-k2-0905"], {
        cwd: repo.path,
        env: envFor(),
      });
      expect(result.status).toBe(0);
      const call = findMessageCall(repo.log);
      expect(call?.body.model).toEqual({
        providerID: "openrouter",
        modelID: "moonshotai/kimi-k2-0905",
      });
    });

    it("includes the diff and status in the prompt sent to /message", () => {
      runCompanion(["review"], { cwd: repo.path, env: envFor() });
      const call = findMessageCall(repo.log);
      const prompt = call?.body.parts?.[0]?.text ?? "";
      expect(prompt).toContain("## Diff");
      expect(prompt).toContain("## Git status");
      expect(prompt).toContain("feature.ts");
      expect(prompt).toContain("export const answer = 42");
    });

    it("rejects malformed --model before doing any work", () => {
      const result = runCompanion(["review", "--model", "bad model"], {
        cwd: repo.path,
        env: envFor(),
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Invalid --model");
      expect(findMessageCall(repo.log)).toBeUndefined();
    });

    it("emits 'No changes to review' on a clean tree without spawning a broker", () => {
      const cleanRepo = mkTmpRepo();
      try {
        const result = runCompanion(["review"], {
          cwd: cleanRepo.path,
          env: { ...fakeOpencodeEnv(cleanRepo), OPENCODE_PLUGIN_STATE_DIR: stateDir },
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("No changes to review");
        expect(findMessageCall(cleanRepo.log)).toBeUndefined();
      } finally {
        cleanRepo.cleanup();
      }
    });

    it("errors when run outside a git repo", () => {
      const result = runCompanion(["review"], { cwd: "/tmp", env: envFor() });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Not a git repository");
    });

    it("errors when OPENCODE_BIN is missing", () => {
      const result = runCompanion(["review"], {
        cwd: repo.path,
        env: { ...envFor(), OPENCODE_BIN: "/nonexistent/opencode-xyz" },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("opencode CLI not found");
    });
  });

  describe("subprocess path (--no-broker)", () => {
    it("falls back to `opencode run` and returns the fake review", () => {
      const result = runCompanion(["review", "--no-broker"], {
        cwd: repo.path,
        env: envFor(),
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("# Fake Review");
      expect(findRunCall(repo.log)?.args).toContain("run");
    });

    it("propagates non-zero opencode exit status", () => {
      const result = runCompanion(["review", "--no-broker"], {
        cwd: repo.path,
        env: { ...envFor(), OPENCODE_FAKE_EXIT: "3" },
      });
      expect(result.status).toBe(3);
    });
  });
});
