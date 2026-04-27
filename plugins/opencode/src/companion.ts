import { writeFileSync } from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
import { validateModel } from "./lib/args.js";
import { getBranchDiff, getStatus, getWorkingTreeDiff, isGitRepository } from "./lib/git.js";
import { cancelJob, getLatestJob, readJobOutput, reconcileJobStatus } from "./lib/job-control.js";
import { checkOpencodeAvailable, runOpencode } from "./lib/opencode.js";
import { buildReviewPrompt } from "./lib/prompts.js";
import { runReviewViaBroker } from "./lib/review.js";
import { OpencodeClient } from "./lib/server-client.js";
import {
  ensureServerRunning,
  pingServer,
  readLockfile,
  stopServer,
} from "./lib/server-lifecycle.js";
import {
  getOutputPath,
  type JobState,
  listJobsForWorkspace,
  newJobId,
  readJobState,
  writeJobState,
} from "./lib/state.js";

function printUsage(): void {
  process.stdout.write(
    [
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
      "  companion sessions           List opencode sessions in the current workspace",
      "",
      "Review options:",
      "  --base <ref>                 Compare against a branch ref (default: working tree)",
      "  --model <provider/model>     Override opencode model for this call only",
      "  --background                 Track this run as a job (output goes to state files)",
      "  --wait                       No-op at the companion level; consumed by /opencode:review",
      "  --no-broker                  Bypass the broker and shell out to `opencode run` directly",
      "",
      "Result/cancel options:",
      "  --job <id>                   Target a specific job (default: most recent in workspace)",
      "",
    ].join("\n"),
  );
}

function runSetup(): number {
  const check = checkOpencodeAvailable();
  if (check.available) {
    process.stdout.write(`opencode is installed: ${check.version ?? "(version unknown)"}\n`);
    return 0;
  }
  process.stdout.write(
    [
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
    ].join("\n"),
  );
  return 1;
}

async function runReview(argv: readonly string[]): Promise<number> {
  try {
    const cwd = process.cwd();
    const { values } = parseArgs({
      args: [...argv],
      options: {
        base: { type: "string" },
        model: { type: "string" },
        background: { type: "boolean" },
        wait: { type: "boolean" },
        "no-broker": { type: "boolean" },
      },
      allowPositionals: true,
    });

    const base = values.base;
    const model = values.model === undefined ? undefined : validateModel(values.model);
    const background = values.background === true;
    const noBroker = values["no-broker"] === true;

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

    const scope: "working-tree" | "branch" = base === undefined ? "working-tree" : "branch";
    const prompt = buildReviewPrompt({
      scope,
      ...(base === undefined ? {} : { base }),
      status,
      diff,
    });

    if (background) {
      return await runReviewTracked({
        prompt,
        cwd,
        scope,
        noBroker,
        ...(base === undefined ? {} : { base }),
        ...(model === undefined ? {} : { model }),
      });
    }
    return await runReviewForeground({
      prompt,
      cwd,
      noBroker,
      ...(model === undefined ? {} : { model }),
    });
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

interface ForegroundOptions {
  readonly prompt: string;
  readonly cwd: string;
  readonly noBroker: boolean;
  readonly model?: string;
}

async function runReviewForeground(options: ForegroundOptions): Promise<number> {
  if (options.noBroker) return runReviewForegroundSubprocess(options);
  const result = await runReviewViaBroker(options);
  process.stdout.write(result.text);
  if (!result.text.endsWith("\n")) process.stdout.write("\n");
  return 0;
}

function runReviewForegroundSubprocess(options: ForegroundOptions): number {
  const result = runOpencode({
    prompt: options.prompt,
    cwd: options.cwd,
    ...(options.model === undefined ? {} : { model: options.model }),
  });
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  if (result.error !== null) {
    throw new Error(`opencode invocation failed: ${result.error.message}`);
  }
  return result.status ?? 1;
}

interface TrackedOptions {
  readonly prompt: string;
  readonly cwd: string;
  readonly scope: "working-tree" | "branch";
  readonly noBroker: boolean;
  readonly base?: string;
  readonly model?: string;
}

async function runReviewTracked(options: TrackedOptions): Promise<number> {
  const id = newJobId();
  const state: JobState = {
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
  process.stdout.write(
    `Check progress with /opencode:status. Fetch output with /opencode:result.\n`,
  );

  let outcome: { status: number; sessionId?: string };
  if (options.noBroker) {
    const result = runOpencode({
      prompt: options.prompt,
      cwd: options.cwd,
      ...(options.model === undefined ? {} : { model: options.model }),
    });
    writeFileSync(getOutputPath(id, "stdout"), result.stdout);
    writeFileSync(getOutputPath(id, "stderr"), result.stderr);
    outcome = { status: result.status ?? 1 };
  } else {
    try {
      const result = await runReviewViaBroker(options);
      writeFileSync(getOutputPath(id, "stdout"), result.text);
      writeFileSync(getOutputPath(id, "stderr"), "");
      outcome = { status: 0, sessionId: result.sessionId };
    } catch (error) {
      writeFileSync(getOutputPath(id, "stdout"), "");
      writeFileSync(getOutputPath(id, "stderr"), `${(error as Error).message}\n`);
      outcome = { status: 1 };
    }
  }

  // If /opencode:cancel raced with us and already wrote "cancelled", don't clobber it.
  const current = readJobState(id);
  if (current !== null && current.status === "cancelled") return 130;

  const finalState: JobState = {
    ...state,
    status: outcome.status === 0 ? "completed" : "failed",
    ended: new Date().toISOString(),
    exitCode: outcome.status,
    ...(outcome.sessionId === undefined ? {} : { sessionId: outcome.sessionId }),
  };
  writeJobState(finalState);
  return outcome.status;
}

async function runSessions(_argv: readonly string[]): Promise<number> {
  const cwd = process.cwd();
  const endpoint = readLockfile(cwd);
  if (endpoint === null) {
    process.stdout.write(
      "No broker running for this workspace. Start one with `/opencode:broker start`.\n",
    );
    return 0;
  }
  if (!(await pingServer(endpoint))) {
    process.stdout.write("Broker lockfile present but server is unreachable.\n");
    return 1;
  }

  const client = new OpencodeClient(endpoint);
  const sessions = await client.listSessions({ directory: cwd, limit: 20 });
  if (sessions.length === 0) {
    process.stdout.write("No opencode sessions in this workspace.\n");
    return 0;
  }

  process.stdout.write(`opencode sessions in ${cwd}:\n\n`);
  for (const session of sessions) {
    const title = session.title ?? "(untitled)";
    const updated = session.time?.updated;
    const updatedStr = updated === undefined ? "(no timestamp)" : new Date(updated).toISOString();
    process.stdout.write(`  ${session.id}  ${updatedStr}  ${title}\n`);
  }
  return 0;
}

function runStatus(argv: readonly string[]): number {
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
    process.stdout.write(
      `  ${job.id}  ${job.status}${exitInfo}  ${scope}  ${model}  ${job.started}\n`,
    );
  }
  return 0;
}

function runResult(argv: readonly string[]): number {
  try {
    const { values } = parseArgs({
      args: [...argv],
      options: { job: { type: "string" } },
      allowPositionals: true,
    });

    const cwd = process.cwd();
    const job = values.job === undefined ? getLatestJob(cwd) : readJobState(values.job);

    if (job === null) {
      throw new Error(
        values.job === undefined
          ? "No opencode reviews in this workspace."
          : `No job found with id: ${values.job}`,
      );
    }

    const reconciled = reconcileJobStatus(job);
    const output = readJobOutput(reconciled.id);
    if (output.stdout.length > 0) process.stdout.write(output.stdout);
    if (output.stderr.length > 0) process.stderr.write(output.stderr);

    if (reconciled.status === "running") {
      process.stderr.write(`\n[review still running — partial output above]\n`);
      return 0;
    }
    return reconciled.exitCode ?? (reconciled.status === "completed" ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

async function runBroker(argv: readonly string[]): Promise<number> {
  const action = argv[0];
  const cwd = process.cwd();

  if (action === "start") {
    if (!checkOpencodeAvailable().available) {
      process.stderr.write("opencode CLI not found on PATH. Run /opencode:setup.\n");
      return 1;
    }
    try {
      const endpoint = await ensureServerRunning(cwd);
      process.stdout.write(
        `Broker running at http://${endpoint.host}:${endpoint.port} (pid ${endpoint.pid}).\n`,
      );
      return 0;
    } catch (error) {
      process.stderr.write(`Failed to start broker: ${(error as Error).message}\n`);
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

function runCancel(argv: readonly string[]): number {
  try {
    const { values } = parseArgs({
      args: [...argv],
      options: { job: { type: "string" } },
      allowPositionals: true,
    });

    const cwd = process.cwd();
    const targetId =
      values.job ??
      (() => {
        const latest = getLatestJob(cwd);
        if (latest === null) throw new Error("No opencode reviews in this workspace.");
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
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

async function main(): Promise<number> {
  const subcommand = process.argv[2];
  const rest = process.argv.slice(3);

  switch (subcommand) {
    case "setup":
      return runSetup();
    case "review":
      return await runReview(rest);
    case "sessions":
      return await runSessions(rest);
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
