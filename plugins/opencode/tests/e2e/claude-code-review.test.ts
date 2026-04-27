import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { fakeOpencodeEnv, findRunCall, mkTmpRepo, REPO_ROOT, type TmpRepo } from "./helpers.js";

const E2E_ENABLED = process.env["CLAUDE_CODE_E2E"] === "1";

function installPlugin(cwd: string): void {
  const env = process.env;

  const marketplaceAdd = spawnSync(
    "claude",
    ["plugin", "marketplace", "add", REPO_ROOT, "--scope", "project"],
    { cwd, env, encoding: "utf8" },
  );
  if (marketplaceAdd.status !== 0) {
    throw new Error(
      `claude plugin marketplace add failed (status ${marketplaceAdd.status}):\n` +
        `stdout: ${marketplaceAdd.stdout}\nstderr: ${marketplaceAdd.stderr}`,
    );
  }

  const install = spawnSync(
    "claude",
    ["plugin", "install", "opencode@opencode-plugin-cc", "--scope", "project"],
    { cwd, env, encoding: "utf8" },
  );
  if (install.status !== 0) {
    throw new Error(
      `claude plugin install failed (status ${install.status}):\n` +
        `stdout: ${install.stdout}\nstderr: ${install.stderr}`,
    );
  }
}

describe.skipIf(!E2E_ENABLED)("Claude Code dispatches /opencode:review (e2e, Layer B)", () => {
  it("runs /opencode:review and returns the fake review body", () => {
    const repo: TmpRepo = mkTmpRepo({ withChanges: true });
    try {
      installPlugin(repo.path);

      const result = spawnSync(
        "claude",
        ["-p", "/opencode:review", "--dangerously-skip-permissions"],
        {
          cwd: repo.path,
          env: fakeOpencodeEnv(repo),
          encoding: "utf8",
          timeout: 240_000,
        },
      );

      if (result.status !== 0) {
        throw new Error(
          `claude -p failed (status ${result.status}):\n` +
            `stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`,
        );
      }

      expect(result.stdout).toContain("Fake Review");

      const call = findRunCall(repo.log);
      expect(call).toBeDefined();
      expect(call?.prompt).toContain("## Diff");
    } finally {
      repo.cleanup();
    }
  }, 300_000);
});
