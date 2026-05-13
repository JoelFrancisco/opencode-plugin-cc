import { spawnSync } from "node:child_process";

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly input?: string;
  readonly maxBuffer?: number;
}

export interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly error: NodeJS.ErrnoException | null;
}

const DEFAULT_MAX_BUFFER = 100 * 1024 * 1024;

export function runCommand(
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): RunResult {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
    signal: result.signal,
    error: (result.error as NodeJS.ErrnoException | undefined) ?? null,
  };
}
