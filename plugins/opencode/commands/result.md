---
description: Print the result of the most recent (or specified) opencode background review
argument-hint: '[--job <id>]'
allowed-tools: Bash(node:*)
---

Raw slash-command arguments:
`$ARGUMENTS`

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" result $ARGUMENTS
```

Return the command stdout verbatim, exactly as-is. Do not paraphrase, summarize,
or add commentary before or after it. Do not fix any issues mentioned in the
review output.
