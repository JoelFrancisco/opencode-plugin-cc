# opencode-plugin-cc — orientation for AI coding agents

Mirror of [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc),
re-targeted at [opencode](https://opencode.ai). Architectural decisions and
build order live here so future contributors (human or AI) don't re-derive them.

## Repos to consult while working

- `/tmp/codex-plugin-cc` — upstream Claude Code plugin we mirror. Read its
  `plugins/codex/scripts/` and `plugins/codex/commands/` for behavior parity.
- `/tmp/opencode` — opencode source. `packages/opencode/src/server/` is the
  REST + SSE surface this plugin will eventually drive.

## Architecture

| codex-plugin-cc primitive | opencode primitive |
|---|---|
| `codex app-server` (JSON-RPC over stdio) | `opencode serve` (REST + SSE on `127.0.0.1:4096`) |
| `codex` CLI one-shot | `opencode run` |
| `codex --resume <id>` | `opencode run --session <id>` / `--continue` |
| Codex sessions | opencode sessions (`GET /session`) |
| `codex --write` | opencode tools enabled by default; restrict via custom agent for review-only |
| Codex effort flag | provider-specific in opencode — translate or omit |

## Build order

1. ✅ **MVP**: `setup` + foreground `review`.
2. ✅ **Background jobs**: tracked-jobs on disk, `status`/`result`/`cancel`.
3. ✅ **Broker**: `opencode serve` reuse via lockfile, REST client wraps endpoints.
4. ✅ **Broker-routed reviews**: foreground + background reviews go through the
   broker by default (`--no-broker` opts out), `JobState` tracks `sessionId`,
   `/opencode:sessions` lists workspace sessions.
5. ✅ **Adversarial review + `opencode-rescue` subagent**: free-form task
   delegation via `companion rescue`, with `--resume`/`--fresh`
   resume-or-fresh flow driven by `--check-resume`.
6. ✅ **SessionEnd hook + skills**: `dist/session-lifecycle-hook.js` kills the
   broker on Claude Code session end so per-workspace `opencode serve`
   processes don't leak. Three skills (`opencode-cli-runtime`,
   `opencode-result-handling`, `opencode-prompting`) document the contracts
   for subagents and slash commands.

Out-of-scope for now (codex-plugin-cc has them; we don't):
- Stop-time review gate hook (codex prompts for a review on session stop).
- `--effort` flag (provider-specific in opencode; not portable through one knob).
- `--write` flag (opencode's tools are write-capable by default).
- Model aliases (codex's `spark → gpt-5.3-codex-spark`-style mappings).

## Toolchain decisions

- **TypeScript 6 + ESM (NodeNext).** `.js` extensions in TS imports.
- **pnpm workspaces.** Root is dev-only; `plugins/opencode` is the shippable unit.
- **oxlint** for fast structural lint, **`tsc --noEmit`** for type semantics.
  Don't try to make oxlint match `@typescript-eslint` rule-for-rule.
- **oxfmt** for formatting (still young — pin the version, fall back to prettier
  if it bites).
- **vitest** with `pool: "forks"`. Integration tests get per-test tmpdir
  workspaces; opencode's server takes a workspace lock so don't share cwds.
- **Zero runtime dependencies.** Companion uses `node:*` built-ins only. The
  user installs the plugin; `node_modules/` should not exist at their site.

## Distribution model

`dist/` is committed. Claude Code plugins execute hooks via raw shell commands;
there's no install-time build step. CI verifies `dist/` is in sync with `src/`.

## Conventions

- Slash commands return opencode stdout **verbatim**. The Claude Code agent
  must not paraphrase, summarize, or "improve" review output.
- Model selection lives entirely on the user's command line (`--model
  provider/model`) or in opencode's own config. The plugin never defaults a
  model and never aliases one ("spark" → "gpt-5.3-codex-spark"-style mappings
  are explicitly forbidden).
- `--background` and `--wait` are *Claude Code execution* flags, not forwarded
  to the companion's task semantics. They control whether `Bash(...,
  run_in_background: true)` is used.
