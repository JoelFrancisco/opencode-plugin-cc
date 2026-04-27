import { createHash } from "node:crypto";
import { join } from "node:path";
import { getStateDir } from "./state.js";

export interface ServerEndpoint {
  readonly pid: number;
  readonly host: string;
  readonly port: number;
  readonly password: string;
  readonly workspace: string;
  readonly started: string;
}

export function workspaceKey(workspace: string): string {
  return createHash("sha256").update(workspace).digest("hex").slice(0, 16);
}

export function getServerLockfile(workspace: string): string {
  return join(getStateDir(), "server", `${workspaceKey(workspace)}.json`);
}

export interface ModelRef {
  readonly providerID: string;
  readonly modelID: string;
}

export function parseModelRef(value: string): ModelRef {
  const slash = value.indexOf("/");
  if (slash <= 0 || slash === value.length - 1) {
    throw new Error(`Invalid model: ${value} (expected provider/model)`);
  }
  return {
    providerID: value.slice(0, slash),
    modelID: value.slice(slash + 1),
  };
}

// opencode's basicAuth middleware uses username "opencode" by default
// (overridable via OPENCODE_SERVER_USERNAME). Hono's basicAuth checks both,
// so we send "opencode:<password>" rather than the empty-username form.
export const OPENCODE_SERVER_USERNAME = "opencode";

export function buildAuthHeader(password: string): string {
  return `Basic ${Buffer.from(`${OPENCODE_SERVER_USERNAME}:${password}`).toString("base64")}`;
}

export function buildBaseUrl(endpoint: ServerEndpoint): string {
  return `http://${endpoint.host}:${endpoint.port}`;
}
