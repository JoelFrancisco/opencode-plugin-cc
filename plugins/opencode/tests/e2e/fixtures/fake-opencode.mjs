#!/usr/bin/env node
// Test stub that mimics the opencode CLI.
//
// Logs every invocation as one JSONL line to OPENCODE_FAKE_LOG (if set).
// Honors OPENCODE_FAKE_RESPONSE to override the default review body.
// Honors OPENCODE_FAKE_EXIT to force a non-zero exit code.
// Honors OPENCODE_FAKE_STDERR to write a message to stderr.
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const argv = process.argv.slice(2);
const subcommand = argv[0] ?? "";

const logPath = process.env.OPENCODE_FAKE_LOG;
if (logPath && subcommand !== "serve") {
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

if (subcommand === "serve") {
  const port = readFlag("--port");
  const host = readFlag("--hostname") ?? "127.0.0.1";
  if (port === undefined) {
    process.stderr.write("fake-opencode serve: --port is required\n");
    process.exit(2);
  }
  const expectedAuth = process.env.OPENCODE_SERVER_PASSWORD
    ? `Basic ${Buffer.from(`:${process.env.OPENCODE_SERVER_PASSWORD}`).toString("base64")}`
    : null;

  const sessions = new Map();

  const server = createServer((req, res) => {
    if (expectedAuth !== null && req.headers.authorization !== expectedAuth) {
      res.writeHead(401);
      res.end();
      return;
    }
    const url = req.url ?? "";
    if (req.method === "GET" && url === "/doc") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ openapi: "3.1.0", info: { title: "fake" } }));
      return;
    }
    if (req.method === "POST" && url === "/session") {
      consumeBody(req, () => {
        const id = randomUUID();
        sessions.set(id, { id });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id }));
      });
      return;
    }
    const messageMatch = url.match(/^\/session\/([^/]+)\/message$/);
    if (req.method === "POST" && messageMatch !== null) {
      consumeBody(req, (body) => {
        if (logPath) {
          try {
            appendFileSync(
              logPath,
              JSON.stringify({
                kind: "message",
                sessionId: messageMatch[1],
                body: safeJSON(body),
                ts: new Date().toISOString(),
              }) + "\n",
            );
          } catch {}
        }
        const response =
          process.env.OPENCODE_FAKE_BROKER_RESPONSE ?? "# Fake Broker Review\n\nVerdict: ok.\n";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            info: { id: randomUUID(), role: "assistant" },
            parts: [{ type: "text", text: response }],
          }),
        );
      });
      return;
    }
    const deleteMatch = url.match(/^\/session\/([^/]+)$/);
    if (req.method === "DELETE" && deleteMatch !== null) {
      sessions.delete(deleteMatch[1]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("true");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(Number(port), host, () => {
    if (logPath) {
      try {
        appendFileSync(
          logPath,
          JSON.stringify({ kind: "serve-start", port: Number(port), host, pid: process.pid }) +
            "\n",
        );
      } catch {}
    }
  });

  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });
} else {
  process.stderr.write(`fake-opencode: unknown invocation: ${argv.join(" ")}\n`);
  process.exit(2);
}

function readFlag(name) {
  const idx = argv.indexOf(name);
  if (idx === -1 || idx === argv.length - 1) return undefined;
  return argv[idx + 1];
}

function consumeBody(req, callback) {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => callback(Buffer.concat(chunks).toString("utf8")));
}

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
