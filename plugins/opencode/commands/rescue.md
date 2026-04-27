---
description: Delegate investigation, an explicit fix request, or follow-up rescue work to the opencode rescue subagent
argument-hint: '[--background|--wait] [--resume|--fresh] [--model <provider/model>] [--effort <level>] [task...]'
allowed-tools: Bash(node:*), AskUserQuestion, Agent
---

Invoke the `opencode:opencode-rescue` subagent via the `Agent` tool
(`subagent_type: "opencode:opencode-rescue"`), forwarding the raw user request as the prompt.
`opencode:opencode-rescue` is a subagent, not a skill — do not call
`Skill(opencode:opencode-rescue)` (no such skill) or re-enter `/opencode:rescue`
recursively. The command runs inline so the `Agent` tool stays in scope.
The final user-visible response must be opencode's output verbatim.

Raw user request:
$ARGUMENTS

Execution mode:
- If the request includes `--background`, run the subagent in the background.
- If the request includes `--wait`, run the subagent in the foreground.
- If neither flag is present, default to foreground.
- `--background` and `--wait` are execution flags for Claude Code. Do not forward them to `companion rescue`, and do not treat them as part of the task text.
- `--model` is a runtime-selection flag. Preserve it for the forwarded call, but do not treat it as part of the task text.
- `--effort <level>` is also a runtime-selection flag (accepted values: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`). Preserve it for the forwarded call, but do not treat it as part of the task text. Note that opencode does not have a uniform reasoning-effort API, so the plugin appends a soft instruction to the prompt — actual model behavior varies by provider.
- If the request includes `--resume`, do not ask whether to continue. The user already chose.
- If the request includes `--fresh`, do not ask whether to continue. The user already chose.
- Otherwise, before starting opencode, check for a resumable rescue thread by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" rescue --check-resume
```

- If that helper reports `available: true`, use `AskUserQuestion` exactly once to ask whether to continue the current opencode rescue thread or start a new one.
- The two choices must be:
  - `Continue current opencode thread`
  - `Start a new opencode thread`
- If the user is clearly giving a follow-up instruction such as "continue", "keep going", "resume", "apply the top fix", or "dig deeper", put `Continue current opencode thread (Recommended)` first.
- Otherwise put `Start a new opencode thread (Recommended)` first.
- If the user chooses continue, add `--resume` before routing to the subagent.
- If the user chooses a new thread, add `--fresh` before routing to the subagent.
- If the helper reports `available: false`, do not ask. Route normally.

Operating rules:
- The subagent is a thin forwarder only. It should use one `Bash` call to invoke
  `node "${CLAUDE_PLUGIN_ROOT}/dist/companion.js" rescue ...` and return that
  command's stdout as-is.
- Return the opencode companion stdout verbatim to the user.
- Do not paraphrase, summarize, rewrite, or add commentary before or after it.
- Leave the model unset unless the user explicitly asks for one.
- If the user did not supply a task, ask what opencode should investigate or fix.
