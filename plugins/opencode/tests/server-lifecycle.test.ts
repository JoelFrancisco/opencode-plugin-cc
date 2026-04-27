import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteLockfile, readLockfile, writeLockfile } from "../src/lib/server-lifecycle.js";
import type { ServerEndpoint } from "../src/lib/server-endpoint.js";

function makeEndpoint(workspace: string, overrides: Partial<ServerEndpoint> = {}): ServerEndpoint {
  return {
    pid: process.pid,
    host: "127.0.0.1",
    port: 4096,
    password: "secret",
    workspace,
    started: new Date().toISOString(),
    ...overrides,
  };
}

describe("server lifecycle lockfile", () => {
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

  it("readLockfile returns null when no file exists", () => {
    expect(readLockfile("/tmp/nope")).toBeNull();
  });

  it("write then read round-trips", () => {
    const endpoint = makeEndpoint("/tmp/repo-a");
    writeLockfile(endpoint);
    expect(readLockfile("/tmp/repo-a")).toEqual(endpoint);
  });

  it("workspace lockfiles are isolated", () => {
    writeLockfile(makeEndpoint("/tmp/repo-a", { port: 1 }));
    writeLockfile(makeEndpoint("/tmp/repo-b", { port: 2 }));
    expect(readLockfile("/tmp/repo-a")?.port).toBe(1);
    expect(readLockfile("/tmp/repo-b")?.port).toBe(2);
  });

  it("deleteLockfile removes the file", () => {
    writeLockfile(makeEndpoint("/tmp/repo-a"));
    deleteLockfile("/tmp/repo-a");
    expect(readLockfile("/tmp/repo-a")).toBeNull();
  });
});
