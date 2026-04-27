import { runCommand } from "./process.js";

export function isGitRepository(cwd: string): boolean {
  return runCommand("git", ["rev-parse", "--show-toplevel"], { cwd }).status === 0;
}

export function getStatus(cwd: string): string {
  const result = runCommand("git", ["status", "--short", "--untracked-files=all"], { cwd });
  if (result.status !== 0) {
    throw new Error(`git status failed: ${result.stderr.trim() || "unknown error"}`);
  }
  return result.stdout;
}

export function getWorkingTreeDiff(cwd: string): string {
  const staged = runCommand("git", ["diff", "--cached"], { cwd });
  const unstaged = runCommand("git", ["diff"], { cwd });
  return [staged.stdout, unstaged.stdout].filter((segment) => segment.length > 0).join("\n");
}

export function getBranchDiff(cwd: string, base: string): string {
  const result = runCommand("git", ["diff", `${base}...HEAD`], { cwd });
  if (result.status !== 0) {
    throw new Error(`git diff ${base}...HEAD failed: ${result.stderr.trim() || "unknown error"}`);
  }
  return result.stdout;
}
