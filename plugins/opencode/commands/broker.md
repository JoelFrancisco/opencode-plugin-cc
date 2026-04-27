---
description: Manage the per-workspace opencode serve broker (start, stop, status)
argument-hint: 'start | stop | status'
allowed-tools: Bash(node:*)
---

Raw slash-command arguments:
`$ARGUMENTS`

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" broker $ARGUMENTS
```

Present the output to the user verbatim.

The broker is a long-lived `opencode serve` process scoped to the current
workspace. It removes the per-call `npx --yes opencode-ai` startup cost from
subsequent reviews. Lockfile lives at
`${OPENCODE_PLUGIN_STATE_DIR:-~/.local/state/opencode-plugin-cc}/server/`.
