import { runCommand } from "./process.js";
export function getOpencodeBin() {
    return process.env["OPENCODE_BIN"] ?? "opencode";
}
export function checkOpencodeAvailable() {
    const result = runCommand(getOpencodeBin(), ["--version"]);
    if (result.error?.code === "ENOENT") {
        return { available: false, version: null };
    }
    if (result.status !== 0) {
        return { available: false, version: null };
    }
    return { available: true, version: result.stdout.trim() || null };
}
export function runOpencode(options) {
    const args = ["run"];
    if (options.model !== undefined) {
        args.push("--model", options.model);
    }
    args.push(options.prompt);
    const runOptions = {};
    if (options.cwd !== undefined)
        runOptions.cwd = options.cwd;
    return runCommand(getOpencodeBin(), args, runOptions);
}
