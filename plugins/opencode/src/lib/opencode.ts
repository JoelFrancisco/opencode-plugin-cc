import { runCommand, type RunResult } from "./process.js";

export function getOpencodeBin(): string {
  return process.env["OPENCODE_BIN"] ?? "opencode";
}

export interface OpencodeAvailability {
  readonly available: boolean;
  readonly version: string | null;
}

export function checkOpencodeAvailable(): OpencodeAvailability {
  const result = runCommand(getOpencodeBin(), ["--version"]);
  // Any spawn error (ENOENT, EACCES, EPERM, ...) means the binary isn't
  // usable. Earlier versions only checked ENOENT, which let an unrunnable
  // binary report "available: true, version: null" and cascade into
  // confusing broker failures downstream.
  if (result.error !== null || result.status !== 0) {
    return { available: false, version: null };
  }
  return { available: true, version: result.stdout.trim() || null };
}

export interface RunOpencodeOptions {
  readonly prompt: string;
  readonly model?: string;
  readonly cwd?: string;
}

export function runOpencode(options: RunOpencodeOptions): RunResult {
  const args: string[] = ["run"];
  if (options.model !== undefined) {
    args.push("--model", options.model);
  }
  args.push(options.prompt);

  const runOptions: { cwd?: string } = {};
  if (options.cwd !== undefined) runOptions.cwd = options.cwd;
  return runCommand(getOpencodeBin(), args, runOptions);
}
