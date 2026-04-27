export interface ReviewPromptInput {
  readonly scope: "working-tree" | "branch";
  readonly base?: string;
  readonly status: string;
  readonly diff: string;
}

export function buildReviewPrompt(input: ReviewPromptInput): string {
  const scopeLabel =
    input.scope === "branch"
      ? `branch diff against ${input.base ?? "(unspecified)"}`
      : "working-tree changes";

  const trimmedStatus = input.status.trim();
  const trimmedDiff = input.diff.trim();
  const statusBlock = trimmedStatus.length > 0 ? trimmedStatus : "(clean)";
  const diffBlock = trimmedDiff.length > 0 ? trimmedDiff : "(empty)";

  return [
    "You are reviewing code changes. Provide a focused, prioritized review.",
    "",
    `Scope: ${scopeLabel}`,
    "",
    "## Git status",
    "",
    "```",
    statusBlock,
    "```",
    "",
    "## Diff",
    "",
    "```diff",
    diffBlock,
    "```",
    "",
    "## Output format",
    "",
    "- Lead with a one-line verdict.",
    "- Group findings by severity: blocking, important, nit.",
    "- For each finding cite the file and line.",
    "- End with a short summary.",
    "- Do not propose patches or rewrites unless explicitly asked.",
  ].join("\n");
}
