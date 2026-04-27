import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAKE_OPENCODE, mkTmpRepo, runCompanion, type TmpRepo } from "./helpers.js";

describe("companion setup (e2e, Layer A)", () => {
  let repo: TmpRepo;

  beforeAll(() => {
    repo = mkTmpRepo();
  });

  afterAll(() => {
    repo.cleanup();
  });

  it("reports the fake opencode version when OPENCODE_BIN points at the stub", () => {
    const result = runCompanion(["setup"], {
      cwd: repo.path,
      env: { ...process.env, OPENCODE_BIN: FAKE_OPENCODE },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("opencode is installed");
    expect(result.stdout).toContain("1.14.26-fake");
  });

  it("reports a missing CLI when OPENCODE_BIN points at a nonexistent file", () => {
    const result = runCompanion(["setup"], {
      cwd: repo.path,
      env: { ...process.env, OPENCODE_BIN: "/nonexistent/opencode-binary-xyz" },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("not installed or not on PATH");
    expect(result.stdout).toContain("opencode.ai/install");
  });
});
