import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gitChecked, initGitRepo } from "../test-utils.js";

const HERE = dirname(fileURLToPath(import.meta.url));

export const PLUGIN_ROOT = resolve(HERE, "..", "..");
export const REPO_ROOT = resolve(PLUGIN_ROOT, "..", "..");
export const COMPANION = join(PLUGIN_ROOT, "dist", "companion.js");
export const FIXTURES_DIR = join(HERE, "fixtures");
export const FAKE_OPENCODE = join(FIXTURES_DIR, "fake-opencode.mjs");

export interface TmpRepoOptions {
  readonly withChanges?: boolean;
  readonly withCommit?: boolean;
}

export interface TmpRepo {
  readonly path: string;
  readonly log: string;
  readonly cleanup: () => void;
}

export function mkTmpRepo(options: TmpRepoOptions = {}): TmpRepo {
  const path = mkdtempSync(join(tmpdir(), "opencode-plugin-e2e-"));
  const log = join(
    tmpdir(),
    `fake-opencode-log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );

  initGitRepo(path);

  if (options.withChanges === true) {
    writeFileSync(join(path, "README.md"), "initial\nexport const answer = 42;\n");
    writeFileSync(join(path, "feature.ts"), "// untracked feature stub\n");
    if (options.withCommit === true) {
      gitChecked(path, ["add", "."]);
      gitChecked(path, ["commit", "-q", "-m", "add changes"]);
    }
  }

  const cleanup = (): void => {
    rmSync(path, { recursive: true, force: true });
    rmSync(log, { force: true });
  };

  return { path, log, cleanup };
}

export interface RunCompanionOptions {
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
}

export interface CompanionResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export function runCompanion(
  args: readonly string[],
  options: RunCompanionOptions,
): CompanionResult {
  const result = spawnSync("node", [COMPANION, ...args], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 30_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export interface FakeOpencodeCall {
  readonly args: string[];
  readonly prompt: string;
  readonly cwd: string;
  readonly ts: string;
}

export function readFakeLog(logPath: string): FakeOpencodeCall[] {
  let raw: string;
  try {
    raw = readFileSync(logPath, "utf8");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as FakeOpencodeCall);
}

export function findRunCall(logPath: string): FakeOpencodeCall | undefined {
  return readFakeLog(logPath).find((call) => call.args[0] === "run");
}

export function fakeOpencodeEnv(repo: TmpRepo): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OPENCODE_BIN: FAKE_OPENCODE,
    OPENCODE_FAKE_LOG: repo.log,
  };
}
