function scopeLabel(input) {
    return input.scope === "branch"
        ? `branch diff against ${input.base ?? "(unspecified)"}`
        : "working-tree changes";
}
function gitContextBlocks(input) {
    const trimmedStatus = input.status.trim();
    const trimmedDiff = input.diff.trim();
    const statusBlock = trimmedStatus.length > 0 ? trimmedStatus : "(clean)";
    const diffBlock = trimmedDiff.length > 0 ? trimmedDiff : "(empty)";
    return [
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
    ];
}
export function buildReviewPrompt(input) {
    return [
        "You are reviewing code changes. Provide a focused, prioritized review.",
        "",
        `Scope: ${scopeLabel(input)}`,
        "",
        ...gitContextBlocks(input),
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
export function buildAdversarialReviewPrompt(input) {
    const focusLines = input.focus !== undefined && input.focus.trim().length > 0
        ? [`Focus areas: ${input.focus.trim()}`, ""]
        : [];
    return [
        "You are conducting an adversarial review. Your job is to challenge the chosen",
        "implementation, design choices, tradeoffs, and assumptions — not just to spot defects.",
        "Question whether this is the right approach, what assumptions it depends on, and where",
        "the design could fail under real-world conditions.",
        "",
        `Scope: ${scopeLabel(input)}`,
        "",
        ...focusLines,
        ...gitContextBlocks(input),
        "",
        "## Output format",
        "",
        "- Lead with a one-line verdict on whether the approach is sound.",
        "- Group concerns by category: design, assumptions, edge cases, risks.",
        "- For each concern cite the file and line, then state the assumption being made and how it could break.",
        "- End with the strongest argument FOR this approach (steel-man what you just attacked).",
        "- Do not propose patches or rewrites unless explicitly asked.",
    ].join("\n");
}
