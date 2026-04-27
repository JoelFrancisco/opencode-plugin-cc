import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleSessionEnd, handleSessionStart } from "../src/lib/hooks.js";
import { workspaceKey, type ServerEndpoint } from "../src/lib/server-endpoint.js";
import { writeLockfile } from "../src/lib/server-lifecycle.js";

describe("session lifecycle hooks", () => {
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

  it("handleSessionStart is a no-op", () => {
    expect(handleSessionStart("/tmp/repo")).toEqual({ action: "noop" });
  });

  it("handleSessionEnd reports no-broker-to-stop when none is running", () => {
    expect(handleSessionEnd("/tmp/repo-empty")).toEqual({ action: "no-broker-to-stop" });
  });

  it("handleSessionEnd kills a tracked broker and removes the lockfile", () => {
    const workspace = "/tmp/repo-with-broker";
    const endpoint: ServerEndpoint = {
      pid: 2 ** 22,
      host: "127.0.0.1",
      port: 4096,
      password: "secret",
      workspace,
      started: new Date().toISOString(),
    };
    writeLockfile(endpoint);
    // sanity: lockfile path uses workspace key
    expect(workspaceKey(workspace)).toMatch(/^[0-9a-f]{16}$/);

    const outcome = handleSessionEnd(workspace);
    expect(outcome.action).toBe("stopped-broker");
    expect(outcome.pid).toBe(2 ** 22);
  });

  it("handleSessionEnd is safe to call twice", () => {
    const workspace = "/tmp/repo-double";
    writeLockfile({
      pid: 2 ** 22,
      host: "127.0.0.1",
      port: 4096,
      password: "secret",
      workspace,
      started: new Date().toISOString(),
    });
    handleSessionEnd(workspace);
    expect(handleSessionEnd(workspace)).toEqual({ action: "no-broker-to-stop" });
  });

  it("handleSessionStart honors an arbitrary cwd argument without erroring", () => {
    expect(() => handleSessionStart("/some/random/path")).not.toThrow();
  });

  it("handleSessionEnd ignores corrupt lockfiles and reports no-broker-to-stop", () => {
    const workspace = "/tmp/repo-corrupt";
    const path = join(stateDir, "server", `${workspaceKey(workspace)}.json`);
    // write a deliberately broken JSON file
    const dir = path.substring(0, path.lastIndexOf("/"));
    rmSync(dir, { recursive: true, force: true });
    require("node:fs").mkdirSync(dir, { recursive: true });
    writeFileSync(path, "{ not valid json");
    expect(handleSessionEnd(workspace)).toEqual({ action: "no-broker-to-stop" });
  });
});
