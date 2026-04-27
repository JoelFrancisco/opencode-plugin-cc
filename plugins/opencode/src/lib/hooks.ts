import { readLockfile, stopServer } from "./server-lifecycle.js";

export type LifecycleEvent = "SessionStart" | "SessionEnd";

export interface HookOutcome {
  readonly action: "noop" | "stopped-broker" | "no-broker-to-stop";
  readonly pid?: number;
}

export function handleSessionStart(_cwd: string): HookOutcome {
  // Intentionally no-op: pre-warming `opencode serve` would add 30-60s to every
  // Claude Code session start. The broker is started lazily when a review needs it.
  return { action: "noop" };
}

export function handleSessionEnd(cwd: string): HookOutcome {
  const endpoint = readLockfile(cwd);
  if (endpoint === null) return { action: "no-broker-to-stop" };
  const result = stopServer(cwd);
  if (!result.stopped) return { action: "no-broker-to-stop" };
  return {
    action: "stopped-broker",
    ...(result.endpoint === null ? {} : { pid: result.endpoint.pid }),
  };
}
