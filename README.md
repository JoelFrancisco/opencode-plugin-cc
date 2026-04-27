# opencode-plugin-cc

Claude Code plugin that delegates code review (and, eventually, task work) to a
local [opencode](https://opencode.ai) CLI. Mirrors the architecture of
[openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc), substituting
opencode's REST server + `run` CLI for Codex's JSON-RPC app server.

## Status

Step 1 (MVP):
- `/opencode:setup` — verifies the local opencode CLI is installed.
- `/opencode:review` — runs a foreground review against the working tree or a
  branch ref, using whatever model opencode is configured to use (override with
  `--model <provider/model>`).

See [`AGENTS.md`](./AGENTS.md) for the planned full-parity scope.

## Development

```bash
pnpm install
pnpm build         # tsc → plugins/opencode/dist
pnpm typecheck
pnpm lint          # oxlint
pnpm fmt:check     # oxfmt
pnpm test          # vitest
```

The compiled `dist/` is committed so the plugin works without a build step at
install time. Don't forget to rebuild before pushing.
