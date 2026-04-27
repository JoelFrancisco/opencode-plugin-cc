# opencode-plugin-cc

Claude Code plugin that delegates code review (and, eventually, task work) to a
local [opencode](https://opencode.ai) CLI. Mirrors the architecture of
[openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc), substituting
opencode's REST server + `run` CLI for Codex's JSON-RPC app server.

## Status

Feature parity with codex-plugin-cc, minus the few items called out in
[`AGENTS.md`](./AGENTS.md).

### Slash commands

- `/opencode:setup` — verifies the local opencode CLI is installed.
- `/opencode:review` — runs a code review (foreground or background) with
  diff scope `[--base <ref>]` and optional `[--model <provider/model>]`.
- `/opencode:adversarial-review [focus...]` — same scope selection but
  reframes the prompt around design / assumption challenges.
- `/opencode:rescue <task>` — free-form task delegation through the
  `opencode:opencode-rescue` subagent. `--resume` reuses the workspace's
  most recent rescue thread; `--fresh` always starts a new one.
- `/opencode:status`, `/opencode:result [--job <id>]`, `/opencode:cancel
  [--job <id>]` — manage tracked background jobs.
- `/opencode:broker {start|stop|status}` — manual control over the
  per-workspace `opencode serve` process.
- `/opencode:sessions` — list workspace sessions on the running broker.

### Hooks

- `SessionEnd` kills the per-workspace broker so `opencode serve`
  processes don't leak across Claude Code sessions.

### Skills

- `opencode-cli-runtime` — companion subcommand reference.
- `opencode-result-handling` — verbatim-stdout contract.
- `opencode-prompting` — generic, model-agnostic prompting guidance.

## Development

```bash
pnpm install
pnpm build         # tsc → dist/
pnpm typecheck
pnpm lint          # oxlint
pnpm fmt:check     # oxfmt
pnpm test          # vitest (Layers 0 + A)
pnpm test:e2e      # adds Layer B (Claude Code dispatch)
pnpm test:live     # adds Layer C (real opencode + real model)
```

The compiled `dist/` is committed so the plugin works without a build step at
install time. Don't forget to rebuild before pushing.
