import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkTmpRepo, runCompanion, type TmpRepo } from "../e2e/helpers.js";
import { OpencodeClient } from "../../src/lib/server-client.js";
import { readLockfile } from "../../src/lib/server-lifecycle.js";

// Extra gate beyond OPENCODE_LIVE_E2E because some installs wrap opencode in
// `npx --yes opencode-ai`, where startup latency is dominated by registry
// fetches and the broker timeout is unreliable. Layer A tests cover the
// lifecycle contract end-to-end against a fake server.
const LIVE_ENABLED =
  process.env["OPENCODE_LIVE_E2E"] === "1" && process.env["OPENCODE_LIVE_BROKER"] === "1";

describe.skipIf(!LIVE_ENABLED)("real opencode serve broker (Layer C)", () => {
  let repo: TmpRepo;
  let stateDir: string;

  beforeEach(() => {
    repo = mkTmpRepo({ withChanges: true });
    stateDir = mkdtempSync(join(tmpdir(), "opencode-plugin-state-"));
  });

  afterEach(() => {
    runCompanion(["broker", "stop"], {
      cwd: repo.path,
      env: { ...process.env, OPENCODE_PLUGIN_STATE_DIR: stateDir },
    });
    repo.cleanup();
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("starts a real opencode serve and pings successfully", async () => {
    const env = {
      ...process.env,
      OPENCODE_PLUGIN_STATE_DIR: stateDir,
      OPENCODE_BROKER_READY_TIMEOUT_MS: "120000",
    };
    const start = runCompanion(["broker", "start"], {
      cwd: repo.path,
      env,
      timeoutMs: 180_000,
    });
    if (start.status !== 0) {
      throw new Error(
        `broker start failed (status ${start.status}):\n` +
          `stdout: ${start.stdout}\nstderr: ${start.stderr}`,
      );
    }

    // readLockfile reads from getStateDir() in this process, so we need the
    // override here too — the companion ran with OPENCODE_PLUGIN_STATE_DIR set,
    // but the test process inherits the harness's default.
    const previousStateDir = process.env["OPENCODE_PLUGIN_STATE_DIR"];
    process.env["OPENCODE_PLUGIN_STATE_DIR"] = stateDir;
    try {
      const endpoint = readLockfile(repo.path);
      expect(endpoint).not.toBeNull();
      if (endpoint === null) return;
      const client = new OpencodeClient(endpoint);
      expect(await client.ping()).toBe(true);
    } finally {
      if (previousStateDir === undefined) {
        delete process.env["OPENCODE_PLUGIN_STATE_DIR"];
      } else {
        process.env["OPENCODE_PLUGIN_STATE_DIR"] = previousStateDir;
      }
    }
  }, 240_000);
});
