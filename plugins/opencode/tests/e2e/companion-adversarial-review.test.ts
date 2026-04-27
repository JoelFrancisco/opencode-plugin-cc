import { mkdtempSync, rmSync } from "node:fs";
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

describe("companion adversarial-review (e2e, Layer A)", () => {
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

  it("uses the adversarial framing in the prompt", () => {
    const result = runCompanion(["adversarial-review"], {
      cwd: repo.path,
      env: envFor(),
    });
    expect(result.status).toBe(0);
    const call = findMessageCall(repo.log);
    const prompt = call?.body.parts?.[0]?.text ?? "";
    expect(prompt).toContain("adversarial review");
    expect(prompt).toContain("challenge");
    expect(prompt).toContain("strongest argument FOR this approach");
  });

  it("includes positional focus text under 'Focus areas'", () => {
    runCompanion(["adversarial-review", "concurrency", "edge", "cases"], {
      cwd: repo.path,
      env: envFor(),
    });
    const prompt = findMessageCall(repo.log)?.body.parts?.[0]?.text ?? "";
    expect(prompt).toContain("Focus areas: concurrency edge cases");
  });

  it("still gates on git repo + opencode availability", () => {
    const noRepo = runCompanion(["adversarial-review"], { cwd: "/tmp", env: envFor() });
    expect(noRepo.status).toBe(1);
    expect(noRepo.stderr).toContain("Not a git repository");
  });
});
