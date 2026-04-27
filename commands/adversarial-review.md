---
description: Run an opencode adversarial review that challenges the implementation approach and design choices
argument-hint: '[--wait|--background] [--base <ref>] [--model <provider/model>] [--effort <level>] [--no-broker] [focus...]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run an adversarial opencode review through the companion.
Position it as a challenge review that questions the chosen implementation,
design choices, tradeoffs, and assumptions. It is not just a stricter pass over
implementation defects.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues, apply patches, or suggest that you are about to make changes.
- Your only job is to run the review and return opencode's output verbatim.
- Keep the framing focused on whether the current approach is the right one, what assumptions it depends on, and where the design could fail under real-world conditions.

Execution mode rules:
- If the raw arguments include `--wait`, do not ask. Run in the foreground.
- If the raw arguments include `--background`, do not ask. Run in a Claude background task.
- Otherwise, estimate the review size before asking, using the same logic as `/opencode:review`:
  - Inspect `git status --short --untracked-files=all` and `git diff --shortstat` (cached and unstaged).
  - For `--base <ref>` review, use `git diff --shortstat <base>...HEAD`.
  - Recommend waiting only when the scoped review is clearly tiny.
  - In every other case, including unclear size, recommend background.
- Then use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Wait for results`
  - `Run in background`

Argument handling:
- Preserve the user's arguments exactly.
- Anything that is not a flag becomes the focus text passed to opencode (it appears as `Focus areas:` in the prompt).
- Do not strip `--wait` or `--background` yourself.
- Reviews go through the broker by default. Pass `--no-broker` for the subprocess fallback.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" adversarial-review $ARGUMENTS
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.

Background flow:
- Launch the review with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" adversarial-review $ARGUMENTS`,
  description: "opencode adversarial review",
  run_in_background: true
})
```
- Tell the user: "opencode adversarial review started in the background. Check `/opencode:status` for progress and `/opencode:result` for output."
