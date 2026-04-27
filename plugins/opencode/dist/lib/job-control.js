import { existsSync, readFileSync } from "node:fs";
import { getOutputPath, listJobsForWorkspace, readJobState, writeJobState, } from "./state.js";
export function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code === "EPERM";
    }
}
export function reconcileJobStatus(state) {
    if (state.status !== "running")
        return state;
    if (isProcessAlive(state.pid))
        return state;
    const updated = {
        ...state,
        status: "failed",
        ended: new Date().toISOString(),
        errorMessage: "process exited without writing final status",
    };
    writeJobState(updated);
    return updated;
}
export function getLatestJob(workspace) {
    return listJobsForWorkspace(workspace)[0] ?? null;
}
export function readJobOutput(id) {
    const stdoutPath = getOutputPath(id, "stdout");
    const stderrPath = getOutputPath(id, "stderr");
    return {
        stdout: existsSync(stdoutPath) ? readFileSync(stdoutPath, "utf8") : "",
        stderr: existsSync(stderrPath) ? readFileSync(stderrPath, "utf8") : "",
    };
}
export function cancelJob(id) {
    const state = readJobState(id);
    if (state === null)
        return { outcome: "not-found" };
    if (state.status !== "running")
        return { outcome: "not-running", state };
    try {
        process.kill(state.pid, "SIGTERM");
    }
    catch {
        // process already gone — fall through to mark cancelled anyway
    }
    const updated = {
        ...state,
        status: "cancelled",
        ended: new Date().toISOString(),
    };
    writeJobState(updated);
    return { outcome: "cancelled", state: updated };
}
