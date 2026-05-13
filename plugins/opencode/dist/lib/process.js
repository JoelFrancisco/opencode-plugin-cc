import { spawnSync } from "node:child_process";
const DEFAULT_MAX_BUFFER = 100 * 1024 * 1024;
export function runCommand(command, args, options = {}) {
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
        error: result.error ?? null,
    };
}
