import process from "node:process";
import { parseArgs } from "node:util";
import { validateModel } from "./lib/args.js";
import { getBranchDiff, getStatus, getWorkingTreeDiff, isGitRepository } from "./lib/git.js";
import { checkOpencodeAvailable, runOpencode } from "./lib/opencode.js";
import { buildReviewPrompt } from "./lib/prompts.js";
function printUsage() {
    process.stdout.write([
        "opencode companion",
        "",
        "Usage:",
        "  companion setup              Check that opencode CLI is installed",
        "  companion review [opts]      Run a code review",
        "",
        "Review options:",
        "  --base <ref>                 Compare against a branch ref (default: working tree)",
        "  --model <provider/model>     Override opencode model for this call only",
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
            },
            allowPositionals: true,
        });
        const base = values.base;
        const model = values.model === undefined ? undefined : validateModel(values.model);
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
        const prompt = buildReviewPrompt({
            scope: base === undefined ? "working-tree" : "branch",
            ...(base === undefined ? {} : { base }),
            status,
            diff,
        });
        const result = runOpencode({
            prompt,
            cwd,
            ...(model === undefined ? {} : { model }),
        });
        if (result.stdout.length > 0)
            process.stdout.write(result.stdout);
        if (result.stderr.length > 0)
            process.stderr.write(result.stderr);
        if (result.error !== null) {
            throw new Error(`opencode invocation failed: ${result.error.message}`);
        }
        return result.status ?? 1;
    }
    catch (error) {
        process.stderr.write(`${error.message}\n`);
        return 1;
    }
}
function main() {
    const subcommand = process.argv[2];
    const rest = process.argv.slice(3);
    switch (subcommand) {
        case "setup":
            return runSetup();
        case "review":
            return runReview(rest);
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
process.exit(main());
