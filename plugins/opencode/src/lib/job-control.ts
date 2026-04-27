import { existsSync, readFileSync } from "node:fs";
import {
  getOutputPath,
  type JobState,
  listJobsForWorkspace,
  readJobState,
  writeJobState,
} from "./state.js";

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function reconcileJobStatus(state: JobState): JobState {
  if (state.status !== "running") return state;
  if (isProcessAlive(state.pid)) return state;
  const updated: JobState = {
    ...state,
    status: "failed",
    ended: new Date().toISOString(),
    errorMessage: "process exited without writing final status",
  };
  writeJobState(updated);
  return updated;
}

export function getLatestJob(workspace: string): JobState | null {
  return listJobsForWorkspace(workspace)[0] ?? null;
}

export interface JobOutput {
  readonly stdout: string;
  readonly stderr: string;
}

export function readJobOutput(id: string): JobOutput {
  const stdoutPath = getOutputPath(id, "stdout");
  const stderrPath = getOutputPath(id, "stderr");
  return {
    stdout: existsSync(stdoutPath) ? readFileSync(stdoutPath, "utf8") : "",
    stderr: existsSync(stderrPath) ? readFileSync(stderrPath, "utf8") : "",
  };
}

export type CancelOutcome =
  | { readonly outcome: "cancelled"; readonly state: JobState }
  | { readonly outcome: "not-running"; readonly state: JobState }
  | { readonly outcome: "not-found" };

export function cancelJob(id: string): CancelOutcome {
  const state = readJobState(id);
  if (state === null) return { outcome: "not-found" };
  if (state.status !== "running") return { outcome: "not-running", state };

  try {
    process.kill(state.pid, "SIGTERM");
  } catch {
    // process already gone — fall through to mark cancelled anyway
  }

  const updated: JobState = {
    ...state,
    status: "cancelled",
    ended: new Date().toISOString(),
  };
  writeJobState(updated);
  return { outcome: "cancelled", state: updated };
}
