---
description: Check whether the local opencode CLI is ready
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" setup
```

Present the output to the user verbatim. If the script reports that opencode is
not installed, surface its install hint as-is. Do not paraphrase or summarize.
