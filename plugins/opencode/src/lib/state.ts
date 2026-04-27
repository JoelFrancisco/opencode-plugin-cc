import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type JobKind = "review";
export type JobStatus = "running" | "completed" | "failed" | "cancelled";

export interface JobState {
  readonly id: string;
  readonly kind: JobKind;
  readonly workspace: string;
  readonly pid: number;
  readonly started: string;
  readonly model?: string;
  readonly base?: string;
  readonly scope: "working-tree" | "branch";
  status: JobStatus;
  ended?: string;
  exitCode?: number;
  errorMessage?: string;
}

export function getStateDir(): string {
  const override = process.env["OPENCODE_PLUGIN_STATE_DIR"];
  if (override !== undefined && override.length > 0) return override;
  const xdgState = process.env["XDG_STATE_HOME"];
  const base =
    xdgState !== undefined && xdgState.length > 0 ? xdgState : join(homedir(), ".local", "state");
  return join(base, "opencode-plugin-cc");
}

function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

export function getJobsDir(): string {
  return ensureDir(join(getStateDir(), "jobs"));
}

export function getOutputDir(): string {
  return ensureDir(join(getStateDir(), "output"));
}

export function getJobPath(id: string): string {
  return join(getJobsDir(), `${id}.json`);
}

export function getOutputPath(id: string, stream: "stdout" | "stderr"): string {
  return join(getOutputDir(), `${id}.${stream}`);
}

export function newJobId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

export function writeJobState(state: JobState): void {
  writeFileSync(getJobPath(state.id), JSON.stringify(state, null, 2));
}

export function readJobState(id: string): JobState | null {
  const path = getJobPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as JobState;
  } catch {
    return null;
  }
}

export function listJobs(): JobState[] {
  const dir = getJobsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(readFileSync(join(dir, file), "utf8")) as JobState;
      } catch {
        return null;
      }
    })
    .filter((job): job is JobState => job !== null);
}

export function listJobsForWorkspace(workspace: string): JobState[] {
  return listJobs()
    .filter((job) => job.workspace === workspace)
    .toSorted((a, b) => b.started.localeCompare(a.started));
}
