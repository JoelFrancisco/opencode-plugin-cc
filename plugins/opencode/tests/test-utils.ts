import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function git(cwd: string, args: readonly string[]): void {
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
}

export function initGitRepo(path: string): void {
  git(path, ["init", "-q", "-b", "main"]);
  git(path, ["config", "user.email", "test@example.com"]);
  git(path, ["config", "user.name", "Test"]);
  git(path, ["config", "commit.gpgsign", "false"]);
  writeFileSync(join(path, "README.md"), "initial\n");
  git(path, ["add", "README.md"]);
  git(path, ["commit", "-q", "-m", "initial"]);
}

export function gitChecked(cwd: string, args: readonly string[]): void {
  git(cwd, args);
}
