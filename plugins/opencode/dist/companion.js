import { writeFileSync } from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
import { validateModel } from "./lib/args.js";
import { getBranchDiff, getStatus, getWorkingTreeDiff, isGitRepository } from "./lib/git.js";
import { cancelJob, getLatestJob, readJobOutput, reconcileJobStatus } from "./lib/job-control.js";
import { checkOpencodeAvailable, runOpencode } from "./lib/opencode.js";
import { buildReviewPrompt } from "./lib/prompts.js";
import { ensureServerRunning, pingServer, readLockfile, stopServer, } from "./lib/server-lifecycle.js";
import { getOutputPath, listJobsForWorkspace, newJobId, readJobState, writeJobState, } from "./lib/state.js";
function printUsage() {
    process.stdout.write([
        "opencode companion",
        "",
        "Usage:",
        "  companion setup              Check that opencode CLI is installed",
        "  companion review [opts]      Run a code review",
        "  companion status             List recent reviews in the current workspace",
        "  companion result [opts]      Print the output of a review",
        "  companion cancel [opts]      Cancel a running review",
        "  companion broker <action>    Manage the per-workspace opencode serve broker",
        "                               (start | stop | status)",
        "",
        "Review options:",
        "  --base <ref>                 Compare against a branch ref (default: working tree)",
        "  --model <provider/model>     Override opencode model for this call only",
        "  --background                 Track this run as a job (output goes to state files)",
        "  --wait                       No-op at the companion level; consumed by /opencode:review",
        "",
        "Result/cancel options:",
        "  --job <id>                   Target a specific job (default: most recent in workspace)",
        "",
    ].join("\n"));
}
function runSetup() {
    const check = checkOpencodeAvailable();
    if (check.available) {
        process.stdout.write(`opencode is installed: ${check.version ?? "(version unknown)"}\n`);
        return 0;
    }
    process.stdout.write([
        "opencode is not installed or not on PATH.",
        "",
        "Install it with:",
        "  curl -fsSL https://opencode.ai/install | bash",
        "",
        "Or via npm:",
        "  npm install -g opencode-ai",
        "",
        "Then run /opencode:setup again to verify.",
        "",
    ].join("\n"));
    return 1;
}
function runReview(argv) {
    try {
        const cwd = process.cwd();
        const { values } = parseArgs({
            args: [...argv],
            options: {
                base: { type: "string" },
                model: { type: "string" },
                background: { type: "boolean" },
                wait: { type: "boolean" },
            },
            allowPositionals: true,
        });
        const base = values.base;
        const model = values.model === undefined ? undefined : validateModel(values.model);
        const background = values.background === true;
        if (!isGitRepository(cwd)) {
            throw new Error(`Not a git repository: ${cwd}`);
        }
        if (!checkOpencodeAvailable().available) {
            throw new Error("opencode CLI not found on PATH. Run /opencode:setup.");
        }
        const status = getStatus(cwd);
        const diff = base === undefined ? getWorkingTreeDiff(cwd) : getBranchDiff(cwd, base);
        if (status.trim().length === 0 && diff.trim().length === 0) {
            process.stdout.write("No changes to review.\n");
            return 0;
        }
        const scope = base === undefined ? "working-tree" : "branch";
        const prompt = buildReviewPrompt({
            scope,
            ...(base === undefined ? {} : { base }),
            status,
            diff,
        });
        return background
            ? runReviewTracked({
                prompt,
                cwd,
                scope,
                ...(base === undefined ? {} : { base }),
                ...(model === undefined ? {} : { model }),
            })
            : runReviewForeground({ prompt, cwd, ...(model === undefined ? {} : { model }) });
    }
    catch (error) {
        process.stderr.write(`${error.message}\n`);
        return 1;
    }
}
function runReviewForeground(options) {
    const result = runOpencode(options);
    if (result.stdout.length > 0)
        process.stdout.write(result.stdout);
    if (result.stderr.length > 0)
        process.stderr.write(result.stderr);
    if (result.error !== null) {
        throw new Error(`opencode invocation failed: ${result.error.message}`);
    }
    return result.status ?? 1;
}
function runReviewTracked(options) {
    const id = newJobId();
    const state = {
        id,
        kind: "review",
        workspace: options.cwd,
        pid: process.pid,
        started: new Date().toISOString(),
        scope: options.scope,
        ...(options.base === undefined ? {} : { base: options.base }),
        ...(options.model === undefined ? {} : { model: options.model }),
        status: "running",
    };
    writeJobState(state);
    process.stdout.write(`opencode review started: ${id}\n`);
    process.stdout.write(`Check progress with /opencode:status. Fetch output with /opencode:result.\n`);
    const opencodeOptions = {
        prompt: options.prompt,
        cwd: options.cwd,
        ...(options.model === undefined ? {} : { model: options.model }),
    };
    const result = runOpencode(opencodeOptions);
    writeFileSync(getOutputPath(id, "stdout"), result.stdout);
    writeFileSync(getOutputPath(id, "stderr"), result.stderr);
    // If /opencode:cancel raced with us and already wrote "cancelled", don't clobber it.
    const current = readJobState(id);
    if (current !== null && current.status === "cancelled")
        return 130;
    const finalState = {
        ...state,
        status: result.status === 0 ? "completed" : "failed",
        ended: new Date().toISOString(),
        exitCode: result.status ?? 1,
        ...(result.error === null ? {} : { errorMessage: result.error.message }),
    };
    writeJobState(finalState);
    return result.status ?? 1;
}
function runStatus(argv) {
    const { values } = parseArgs({
        args: [...argv],
        options: { json: { type: "boolean" } },
        allowPositionals: true,
    });
    const cwd = process.cwd();
    const jobs = listJobsForWorkspace(cwd).map(reconcileJobStatus);
    if (values.json === true) {
        process.stdout.write(JSON.stringify(jobs, null, 2) + "\n");
        return 0;
    }
    if (jobs.length === 0) {
        process.stdout.write("No opencode reviews in this workspace.\n");
        return 0;
    }
    process.stdout.write(`opencode reviews in ${cwd}:\n\n`);
    for (const job of jobs) {
        const scope = job.base === undefined ? "working-tree" : `branch (${job.base})`;
        const model = job.model ?? "(opencode default)";
        const exitInfo = job.exitCode === undefined ? "" : ` (exit ${job.exitCode})`;
        process.stdout.write(`  ${job.id}  ${job.status}${exitInfo}  ${scope}  ${model}  ${job.started}\n`);
    }
    return 0;
}
function runResult(argv) {
    try {
        const { values } = parseArgs({
            args: [...argv],
            options: { job: { type: "string" } },
            allowPositionals: true,
        });
        const cwd = process.cwd();
        const job = values.job === undefined ? getLatestJob(cwd) : readJobState(values.job);
        if (job === null) {
            throw new Error(values.job === undefined
                ? "No opencode reviews in this workspace."
                : `No job found with id: ${values.job}`);
        }
        const reconciled = reconcileJobStatus(job);
        const output = readJobOutput(reconciled.id);
        if (output.stdout.length > 0)
            process.stdout.write(output.stdout);
        if (output.stderr.length > 0)
            process.stderr.write(output.stderr);
        if (reconciled.status === "running") {
            process.stderr.write(`\n[review still running — partial output above]\n`);
            return 0;
        }
        return reconciled.exitCode ?? (reconciled.status === "completed" ? 0 : 1);
    }
    catch (error) {
        process.stderr.write(`${error.message}\n`);
        return 1;
    }
}
async function runBroker(argv) {
    const action = argv[0];
    const cwd = process.cwd();
    if (action === "start") {
        if (!checkOpencodeAvailable().available) {
            process.stderr.write("opencode CLI not found on PATH. Run /opencode:setup.\n");
            return 1;
        }
        try {
            const endpoint = await ensureServerRunning(cwd);
            process.stdout.write(`Broker running at http://${endpoint.host}:${endpoint.port} (pid ${endpoint.pid}).\n`);
            return 0;
        }
        catch (error) {
            process.stderr.write(`Failed to start broker: ${error.message}\n`);
            return 1;
        }
    }
    if (action === "stop") {
        const result = stopServer(cwd);
        if (!result.stopped) {
            process.stdout.write("No broker running for this workspace.\n");
            return 0;
        }
        process.stdout.write(`Stopped broker (pid ${result.endpoint?.pid}).\n`);
        return 0;
    }
    if (action === "status") {
        const endpoint = readLockfile(cwd);
        if (endpoint === null) {
            process.stdout.write("No broker registered for this workspace.\n");
            return 0;
        }
        const reachable = await pingServer(endpoint);
        const lines = [
            `Broker pid:       ${endpoint.pid}`,
            `Endpoint:         http://${endpoint.host}:${endpoint.port}`,
            `Started:          ${endpoint.started}`,
            `Reachable:        ${reachable ? "yes" : "no (stale lockfile)"}`,
        ];
        process.stdout.write(lines.join("\n") + "\n");
        return 0;
    }
    process.stderr.write("Usage: companion broker <start|stop|status>\n");
    return 1;
}
function runCancel(argv) {
    try {
        const { values } = parseArgs({
            args: [...argv],
            options: { job: { type: "string" } },
            allowPositionals: true,
        });
        const cwd = process.cwd();
        const targetId = values.job ??
            (() => {
                const latest = getLatestJob(cwd);
                if (latest === null)
                    throw new Error("No opencode reviews in this workspace.");
                return latest.id;
            })();
        const result = cancelJob(targetId);
        switch (result.outcome) {
            case "cancelled":
                process.stdout.write(`Cancelled job ${targetId}.\n`);
                return 0;
            case "not-running":
                process.stdout.write(`Job ${targetId} is already ${result.state.status}.\n`);
                return 0;
            case "not-found":
                throw new Error(`No job found with id: ${targetId}`);
        }
    }
    catch (error) {
        process.stderr.write(`${error.message}\n`);
        return 1;
    }
}
async function main() {
    const subcommand = process.argv[2];
    const rest = process.argv.slice(3);
    switch (subcommand) {
        case "setup":
            return runSetup();
        case "review":
            return runReview(rest);
        case "status":
            return runStatus(rest);
        case "result":
            return runResult(rest);
        case "cancel":
            return runCancel(rest);
        case "broker":
            return await runBroker(rest);
        case undefined:
        case "--help":
        case "-h":
            printUsage();
            return 0;
        default:
            process.stderr.write(`Unknown subcommand: ${subcommand}\n\n`);
            printUsage();
            return 1;
    }
}
process.exit(await main());
