---
name: opencode-cli-runtime
description: Reference for invoking the opencode-plugin-cc companion script. Use when forwarding work to opencode through `companion rescue`, `companion review`, or related subcommands.
---

# opencode CLI runtime

The companion at `${CLAUDE_PLUGIN_ROOT}/dist/companion.js` is the only entrypoint that this
plugin exposes to Claude Code. Subagents and slash commands shell out to it via `Bash`.

## Subcommands

- `companion setup` — verifies the local opencode CLI is installed.
- `companion review [--base <ref>] [--model <provider/model>] [--background] [--no-broker]`
  — runs a focused, prioritized review of the current git state.
- `companion adversarial-review [--base <ref>] [--model ...] [--background] [--no-broker] [focus...]`
  — challenges the chosen approach instead of just spotting defects.
- `companion rescue [--model ...] [--resume|--fresh] [task...]` — free-form task
  delegation. `--resume` reuses the most recent rescue session in the workspace;
  `--fresh` forces a new one. `--check-resume` (JSON) reports whether a resumable
  thread exists; the `/opencode:rescue` slash command uses this to decide whether
  to ask the user.
- `companion status` / `companion result [--job <id>]` / `companion cancel [--job <id>]`
  — manage tracked background jobs.
- `companion broker {start|stop|status}` — manage the per-workspace
  `opencode serve` process.
- `companion sessions` — list workspace sessions on the running broker.

## Flag conventions

- `--model <provider/model>` is forwarded verbatim. Multi-segment routes like
  `openrouter/moonshotai/kimi-k2-0905` are split at the first slash:
  `providerID="openrouter"`, `modelID="moonshotai/kimi-k2-0905"`.
- `--background` and `--wait` are Claude Code execution-mode flags. The companion
  reads them, but Claude Code's `Bash(..., run_in_background: true)` is what
  actually detaches the run.
- Anything not recognized as a flag becomes positional: rescue task text or
  adversarial-review focus areas.

## Output contract

The companion writes opencode's response **verbatim** to stdout. Slash
commands and subagents must return that stdout to the user without
paraphrasing, summarizing, or reformatting.
