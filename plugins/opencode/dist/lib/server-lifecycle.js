import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fetchWithTimeout } from "./fetch-with-timeout.js";
import { isProcessAlive } from "./job-control.js";
import { getOpencodeBin } from "./opencode.js";
import { buildAuthHeader, buildBaseUrl, getServerLockfile, } from "./server-endpoint.js";
const POLL_INTERVAL_MS = 200;
const PING_TIMEOUT_MS = 2_000;
function getReadyTimeoutMs() {
    const override = process.env["OPENCODE_BROKER_READY_TIMEOUT_MS"];
    const parsed = override === undefined ? Number.NaN : Number(override);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}
export function readLockfile(workspace) {
    const path = getServerLockfile(workspace);
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return null;
    }
}
export function writeLockfile(endpoint) {
    const path = getServerLockfile(endpoint.workspace);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(endpoint, null, 2));
}
export function deleteLockfile(workspace) {
    rmSync(getServerLockfile(workspace), { force: true });
}
export async function pingServer(endpoint) {
    try {
        const res = await fetchWithTimeout(`${buildBaseUrl(endpoint)}/doc`, {
            headers: { Authorization: buildAuthHeader(endpoint.password) },
            timeoutMs: PING_TIMEOUT_MS,
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
async function findFreePort() {
    return new Promise((resolve, reject) => {
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
export async function ensureServerRunning(workspace) {
    const existing = readLockfile(workspace);
    if (existing !== null) {
        if (isProcessAlive(existing.pid) && (await pingServer(existing)))
            return existing;
        // Stale lockfile (dead pid) or unhealthy broker (alive pid, /doc not
        // responding). In the unhealthy-but-alive case we have to SIGTERM the
        // old process explicitly — it was spawned detached + unref'd, so
        // dropping the lockfile alone would leak it.
        if (isProcessAlive(existing.pid)) {
            try {
                process.kill(existing.pid, "SIGTERM");
            }
            catch {
                // already gone or no permission; lockfile cleanup below is enough
            }
        }
        deleteLockfile(workspace);
    }
    return startServer(workspace);
}
async function startServer(workspace) {
    const port = await findFreePort();
    const password = randomBytes(16).toString("hex");
    const child = spawn(getOpencodeBin(), ["serve", "--port", String(port), "--hostname", "127.0.0.1"], {
        cwd: workspace,
        env: { ...process.env, OPENCODE_SERVER_PASSWORD: password },
        // Discard stdout/stderr at the kernel rather than piping them — piped
        // handles keep the parent's event loop alive even after child.unref(),
        // which prevents process.exitCode-based clean exit. We don't need the
        // child's logs (readiness comes from polling /doc).
        stdio: "ignore",
        detached: true,
    });
    if (child.pid === undefined) {
        throw new Error("failed to spawn opencode serve");
    }
    child.unref();
    const endpoint = {
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
    }
    catch {
        // already gone
    }
    throw new Error(`opencode serve did not become ready within ${readyTimeoutMs}ms`);
}
export function stopServer(workspace) {
    const endpoint = readLockfile(workspace);
    if (endpoint === null)
        return { stopped: false, endpoint: null };
    try {
        process.kill(endpoint.pid, "SIGTERM");
    }
    catch {
        // already gone
    }
    deleteLockfile(workspace);
    return { stopped: true, endpoint };
}
