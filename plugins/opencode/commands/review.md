---
description: Run an opencode code review against local git state
argument-hint: '[--base <ref>] [--model <provider/model>]'
disable-model-invocation: true
allowed-tools: Bash(node:*), Bash(git:*)
---

Run an opencode review.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues, apply patches, or suggest that you are about to make changes.
- Your only job is to run the review and return opencode's output verbatim to the user.

Argument handling:
- Preserve the user's arguments exactly.
- `--base <ref>` switches scope from working-tree diff to `<ref>...HEAD` branch diff.
- `--model <provider/model>` overrides opencode's configured model for this call only.
- If neither is supplied, the review covers the working tree using opencode's configured default model.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" review $ARGUMENTS
```

Return the command stdout verbatim, exactly as-is. Do not paraphrase, summarize,
or add commentary before or after it. Do not fix any issues mentioned in the
review output.
