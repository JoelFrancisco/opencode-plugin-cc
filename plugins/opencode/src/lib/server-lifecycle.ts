import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { isProcessAlive } from "./job-control.js";
import { getOpencodeBin } from "./opencode.js";
import {
  buildAuthHeader,
  buildBaseUrl,
  getServerLockfile,
  type ServerEndpoint,
} from "./server-endpoint.js";

const POLL_INTERVAL_MS = 200;
const PING_TIMEOUT_MS = 2_000;

function getReadyTimeoutMs(): number {
  const override = process.env["OPENCODE_BROKER_READY_TIMEOUT_MS"];
  const parsed = override === undefined ? Number.NaN : Number(override);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

export function readLockfile(workspace: string): ServerEndpoint | null {
  const path = getServerLockfile(workspace);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ServerEndpoint;
  } catch {
    return null;
  }
}

export function writeLockfile(endpoint: ServerEndpoint): void {
  const path = getServerLockfile(endpoint.workspace);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(endpoint, null, 2));
}

export function deleteLockfile(workspace: string): void {
  rmSync(getServerLockfile(workspace), { force: true });
}

export async function pingServer(endpoint: ServerEndpoint): Promise<boolean> {
  try {
    const res = await fetch(`${buildBaseUrl(endpoint)}/doc`, {
      headers: { Authorization: buildAuthHeader(endpoint.password) },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function findFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("could not allocate port"));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
  });
}

export async function ensureServerRunning(workspace: string): Promise<ServerEndpoint> {
  const existing = readLockfile(workspace);
  if (existing !== null && isProcessAlive(existing.pid)) {
    if (await pingServer(existing)) return existing;
  }
  if (existing !== null) deleteLockfile(workspace);
  return startServer(workspace);
}

async function startServer(workspace: string): Promise<ServerEndpoint> {
  const port = await findFreePort();
  const password = randomBytes(16).toString("hex");

  const child = spawn(
    getOpencodeBin(),
    ["serve", "--port", String(port), "--hostname", "127.0.0.1"],
    {
      cwd: workspace,
      env: { ...process.env, OPENCODE_SERVER_PASSWORD: password },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );

  if (child.pid === undefined) {
    throw new Error("failed to spawn opencode serve");
  }
  child.unref();
  child.stdout?.resume();
  child.stderr?.resume();

  const endpoint: ServerEndpoint = {
    pid: child.pid,
    host: "127.0.0.1",
    port,
    password,
    workspace,
    started: new Date().toISOString(),
  };

  const readyTimeoutMs = getReadyTimeoutMs();
  const deadline = Date.now() + readyTimeoutMs;
  /* eslint-disable no-await-in-loop -- sequential polling for readiness */
  while (Date.now() < deadline) {
    if (await pingServer(endpoint)) {
      writeLockfile(endpoint);
      return endpoint;
    }
    if (!isProcessAlive(endpoint.pid)) {
      throw new Error("opencode serve exited before becoming ready");
    }
    await delay(POLL_INTERVAL_MS);
  }
  /* eslint-enable no-await-in-loop */

  try {
    process.kill(endpoint.pid, "SIGTERM");
  } catch {
    // already gone
  }
  throw new Error(`opencode serve did not become ready within ${readyTimeoutMs}ms`);
}

export interface StopResult {
  readonly stopped: boolean;
  readonly endpoint: ServerEndpoint | null;
}

export function stopServer(workspace: string): StopResult {
  const endpoint = readLockfile(workspace);
  if (endpoint === null) return { stopped: false, endpoint: null };
  try {
    process.kill(endpoint.pid, "SIGTERM");
  } catch {
    // already gone
  }
  deleteLockfile(workspace);
  return { stopped: true, endpoint };
}
