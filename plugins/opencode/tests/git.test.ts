import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getStatus, getWorkingTreeDiff, isGitRepository } from "../src/lib/git.js";
import { runCommand } from "../src/lib/process.js";
import { initGitRepo } from "./test-utils.js";

describe("git helpers", () => {
  let repo: string;
  let nonRepo: string;

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "opencode-plugin-test-repo-"));
    nonRepo = mkdtempSync(join(tmpdir(), "opencode-plugin-test-nonrepo-"));
    initGitRepo(repo);
  });

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(nonRepo, { recursive: true, force: true });
  });

  it("isGitRepository returns true inside a repo", () => {
    expect(isGitRepository(repo)).toBe(true);
  });

  it("isGitRepository returns false outside a repo", () => {
    expect(isGitRepository(nonRepo)).toBe(false);
  });

  it("getStatus reports modified files", () => {
    writeFileSync(join(repo, "README.md"), "hello\nworld\n");
    const status = getStatus(repo);
    expect(status).toContain("README.md");
  });

  it("getWorkingTreeDiff returns the unstaged diff", () => {
    const diff = getWorkingTreeDiff(repo);
    expect(diff).toContain("+world");
  });

  it("getWorkingTreeDiff is empty for a clean tree", () => {
    runCommand("git", ["checkout", "--", "README.md"], { cwd: repo });
    expect(getWorkingTreeDiff(repo).trim()).toBe("");
  });
});
