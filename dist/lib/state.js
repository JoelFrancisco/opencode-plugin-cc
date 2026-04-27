import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function getStateDir() {
    const override = process.env["OPENCODE_PLUGIN_STATE_DIR"];
    if (override !== undefined && override.length > 0)
        return override;
    const xdgState = process.env["XDG_STATE_HOME"];
    const base = xdgState !== undefined && xdgState.length > 0 ? xdgState : join(homedir(), ".local", "state");
    return join(base, "opencode-plugin-cc");
}
function ensureDir(path) {
    mkdirSync(path, { recursive: true });
    return path;
}
export function getJobsDir() {
    return ensureDir(join(getStateDir(), "jobs"));
}
export function getOutputDir() {
    return ensureDir(join(getStateDir(), "output"));
}
export function getJobPath(id) {
    return join(getJobsDir(), `${id}.json`);
}
export function getOutputPath(id, stream) {
    return join(getOutputDir(), `${id}.${stream}`);
}
export function newJobId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${ts}-${rand}`;
}
export function writeJobState(state) {
    writeFileSync(getJobPath(state.id), JSON.stringify(state, null, 2));
}
export function readJobState(id) {
    const path = getJobPath(id);
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return null;
    }
}
export function listJobs() {
    const dir = getJobsDir();
    if (!existsSync(dir))
        return [];
    return readdirSync(dir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
        try {
            return JSON.parse(readFileSync(join(dir, file), "utf8"));
        }
        catch {
            return null;
        }
    })
        .filter((job) => job !== null);
}
export function listJobsForWorkspace(workspace) {
    return listJobs()
        .filter((job) => job.workspace === workspace)
        .toSorted((a, b) => b.started.localeCompare(a.started));
}
