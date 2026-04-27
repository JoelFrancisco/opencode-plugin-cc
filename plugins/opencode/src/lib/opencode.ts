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
  if (result.error?.code === "ENOENT") {
    return { available: false, version: null };
  }
  if (result.status !== 0) {
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
