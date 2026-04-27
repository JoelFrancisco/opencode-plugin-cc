---
description: List opencode sessions in the current workspace
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" sessions
```

Present the output to the user verbatim.

This requires a running broker. If none is registered for the current
workspace, the companion will say so — start one with `/opencode:broker start`.
