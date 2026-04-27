import process from "node:process";
import { handleSessionEnd, handleSessionStart, type LifecycleEvent } from "./lib/hooks.js";

function main(): number {
  const event = process.argv[2];
  if (event !== "SessionStart" && event !== "SessionEnd") {
    process.stderr.write(`session-lifecycle-hook: unknown event: ${event ?? "(none)"}\n`);
    return 1;
  }

  const cwd = process.cwd();
  try {
    const outcome =
      (event as LifecycleEvent) === "SessionStart"
        ? handleSessionStart(cwd)
        : handleSessionEnd(cwd);
    if (outcome.action === "stopped-broker" && outcome.pid !== undefined) {
      process.stdout.write(`opencode broker stopped (pid ${outcome.pid}).\n`);
    }
    return 0;
  } catch (error) {
    // Hooks must not block Claude Code on errors. Log and exit 0.
    process.stderr.write(`session-lifecycle-hook: ${(error as Error).message}\n`);
    return 0;
  }
}

process.exit(main());
