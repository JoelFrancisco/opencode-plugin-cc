---
description: Cancel a running opencode background review
argument-hint: '[--job <id>]'
allowed-tools: Bash(node:*)
---

Raw slash-command arguments:
`$ARGUMENTS`

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" cancel $ARGUMENTS
```

Present the output to the user verbatim.
