import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPANION,
  fakeOpencodeEnv,
  findMessageCall,
  mkTmpRepo,
  REPO_ROOT,
  type TmpRepo,
} from "./helpers.js";

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
    // Per-test state dir so the broker the slash command spawns lands in a
    // throwaway location and afterEach cleanup can reach it. Without this,
    // the broker writes to the user's real XDG state and leaks across runs.
    const stateDir = mkdtempSync(join(tmpdir(), "opencode-plugin-state-"));
    try {
      installPlugin(repo.path);

      const env = {
        ...fakeOpencodeEnv(repo),
        OPENCODE_PLUGIN_STATE_DIR: stateDir,
      };

      const result = spawnSync(
        "claude",
        ["-p", "/opencode:review --wait", "--dangerously-skip-permissions"],
        { cwd: repo.path, env, encoding: "utf8", timeout: 240_000 },
      );

      if (result.status !== 0) {
        throw new Error(
          `claude -p failed (status ${result.status}):\n` +
            `stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`,
        );
      }

      // Reviews go through the broker by default, so the fake server should
      // have logged the POST /session/:id/message call. The assistant text
      // surfaces via Claude Code's stdout transcript.
      expect(result.stdout).toContain("Fake Broker Review");

      const call = findMessageCall(repo.log);
      expect(call).toBeDefined();
      expect(call?.body.parts?.[0]?.text).toContain("## Diff");
    } finally {
      // Kill the broker the slash command spawned. Without this every Layer B
      // run leaks one detached fake-opencode `serve` process per test.
      spawnSync("node", [COMPANION, "broker", "stop"], {
        cwd: repo.path,
        env: { ...process.env, OPENCODE_PLUGIN_STATE_DIR: stateDir },
        encoding: "utf8",
      });
      rmSync(stateDir, { recursive: true, force: true });
      repo.cleanup();
    }
  }, 300_000);
});
