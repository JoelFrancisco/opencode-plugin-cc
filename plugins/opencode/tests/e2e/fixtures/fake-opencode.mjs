#!/usr/bin/env node
// Test stub that mimics the opencode CLI.
//
// Logs every invocation as one JSONL line to OPENCODE_FAKE_LOG (if set).
// Honors OPENCODE_FAKE_RESPONSE to override the default review body.
// Honors OPENCODE_FAKE_EXIT to force a non-zero exit code.
// Honors OPENCODE_FAKE_STDERR to write a message to stderr.
import { appendFileSync } from "node:fs";

const argv = process.argv.slice(2);
const subcommand = argv[0] ?? "";

const logPath = process.env.OPENCODE_FAKE_LOG;
if (logPath) {
  let prompt = "";
  let cliArgs = argv;
  if (subcommand === "run" && argv.length > 1) {
    prompt = argv[argv.length - 1];
    cliArgs = argv.slice(0, -1);
  }
  const entry = {
    args: cliArgs,
    prompt,
    cwd: process.cwd(),
    ts: new Date().toISOString(),
  };
  try {
    appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } catch {
    // ignore log failures in tests
  }
}

if (subcommand === "--version" || subcommand === "-v") {
  process.stdout.write("1.14.26-fake\n");
  process.exit(0);
}

if (subcommand === "run") {
  if (process.env.OPENCODE_FAKE_STDERR) {
    process.stderr.write(process.env.OPENCODE_FAKE_STDERR + "\n");
  }
  const response =
    process.env.OPENCODE_FAKE_RESPONSE ??
    [
      "# Fake Review",
      "",
      "Verdict: looks plausible.",
      "",
      "## Findings",
      "- nit: example finding for testing",
      "",
      "## Summary",
      "This is a fake review emitted by tests/e2e/fixtures/fake-opencode.mjs.",
      "",
    ].join("\n");
  process.stdout.write(response);
  const exitCode = Number(process.env.OPENCODE_FAKE_EXIT ?? "0");
  process.exit(Number.isFinite(exitCode) ? exitCode : 0);
}

process.stderr.write(`fake-opencode: unknown invocation: ${argv.join(" ")}\n`);
process.exit(2);
