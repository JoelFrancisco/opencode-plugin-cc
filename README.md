# opencode plugin for Claude Code

Use [opencode](https://opencode.ai) from inside Claude Code for code reviews
or to delegate tasks to opencode.

This plugin is for Claude Code users who want an easy way to start using
opencode from the workflow they already have.

## What You Get

- `/opencode:review` for a normal read-only opencode review
- `/opencode:adversarial-review` for a steerable challenge review
- `/opencode:rescue` to hand a free-form task to opencode through a subagent
- `/opencode:status`, `/opencode:result`, `/opencode:cancel` to manage tracked
  background jobs
- `/opencode:broker` and `/opencode:sessions` to control the long-lived
  `opencode serve` process and list its sessions
- `/opencode:setup` to verify the opencode CLI is installed

## Requirements

- **An opencode-compatible model.** opencode supports any provider on
  [models.dev](https://models.dev) — Anthropic, OpenAI, OpenRouter, Moonshot,
  GitHub Copilot, etc. The plugin doesn't pick a model for you; whatever
  opencode is configured to use is what you get.
- **Node.js 20 or later** (for the companion script that ships with the plugin).

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add JoelFrancisco/opencode-plugin-cc
```

Install the plugin:

```bash
/plugin install opencode@opencode-plugin-cc
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/opencode:setup
```

`/opencode:setup` will tell you whether opencode is installed.
If it isn't, install it with:

```bash
curl -fsSL https://opencode.ai/install | bash
```

If opencode is installed but not authenticated yet, run:

```bash
!opencode auth login
```

After install, you should see:

- the slash commands listed below
- the `opencode:opencode-rescue` subagent in `/agents`

One simple first run:

```bash
/opencode:review --background
/opencode:status
/opencode:result
```

## Usage

### `/opencode:review`

Runs a normal opencode review on your current work.

> [!NOTE]
> Code review for multi-file changes might take a while. It's generally
> recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your branch compared to a base branch like `main`

Supports `--base <ref>` for branch review, `--model <provider/model>` to
override opencode's configured model, plus `--wait` and `--background` to
choose execution mode. It is not steerable and does not take custom focus
text — use [`/opencode:adversarial-review`](#opencodeadversarial-review) for
that.

Examples:

```bash
/opencode:review
/opencode:review --base main
/opencode:review --background
/opencode:review --model anthropic/claude-sonnet-4-6
```

This command is read-only. When run in the background you can use
[`/opencode:status`](#opencodestatus) to check progress and
[`/opencode:cancel`](#opencodecancel) to abort.

### `/opencode:adversarial-review`

Runs a **steerable** review that questions the chosen implementation and
design.

It can be used to pressure-test assumptions, tradeoffs, failure modes, and
whether a different approach would have been safer or simpler.

Same scope flags as `/opencode:review` (`--base <ref>`, `--wait`,
`--background`, `--model`). Unlike `/opencode:review`, it can take extra
focus text after the flags — that becomes the `Focus areas:` line in the
prompt.

Examples:

```bash
/opencode:adversarial-review
/opencode:adversarial-review --base main challenge whether this caching design is safe
/opencode:adversarial-review --background look for race conditions and question the chosen approach
```

This command is read-only. It does not fix code.

### `/opencode:rescue`

Hands a task to opencode through the `opencode:opencode-rescue` subagent.

Use it when you want opencode to:

- investigate a bug
- try a fix
- continue a previous opencode task in this workspace
- take a faster pass with a smaller model

> [!NOTE]
> These tasks can take a long time depending on the model and the work — it's
> generally recommended to run them in the background.

Supports `--background`, `--wait`, `--resume`, `--fresh`, and
`--model <provider/model>`. If you omit `--resume` and `--fresh`, the plugin
offers to continue the latest rescue thread for this workspace when one
exists.

Examples:

```bash
/opencode:rescue investigate why the tests started failing
/opencode:rescue fix the failing test with the smallest safe patch
/opencode:rescue --resume apply the top fix from the last run
/opencode:rescue --background investigate the regression
/opencode:rescue --model openrouter/moonshotai/kimi-k2-0905 sketch a faster algorithm
```

You can also just ask for a task to be delegated:

```text
Ask opencode to redesign the database connection to be more resilient.
```

**Notes:**

- if you do not pass `--model`, opencode uses its configured default
- `--resume` and `--fresh` are mutually exclusive
- the plugin tracks rescue sessions by their title (`"rescue"`) so resume
  picks up the latest one in the current workspace

### `/opencode:status`

Shows running and recent opencode jobs for the current workspace.

Examples:

```bash
/opencode:status
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `/opencode:result`

Shows the final stored opencode output for a finished job.

Examples:

```bash
/opencode:result
/opencode:result --job <id>
```

Defaults to the most recent job in the current workspace.

### `/opencode:cancel`

Cancels an active background opencode job (SIGTERMs the tracked PID and
writes `status: cancelled`).

Examples:

```bash
/opencode:cancel
/opencode:cancel --job <id>
```

### `/opencode:broker`

Manages the long-lived `opencode serve` process for the current workspace.
The broker is started lazily on the first review, kept alive across
subsequent calls (no per-call npx/startup tax), and stopped automatically
on Claude Code's `SessionEnd` hook.

Examples:

```bash
/opencode:broker start
/opencode:broker status
/opencode:broker stop
```

Lockfile lives at `${OPENCODE_PLUGIN_STATE_DIR:-~/.local/state/opencode-plugin-cc}/server/`.

### `/opencode:sessions`

Lists opencode sessions in the current workspace via the broker.

```bash
/opencode:sessions
```

If no broker is running, you'll be told to start one with
`/opencode:broker start`.

### `/opencode:setup`

Checks whether opencode is installed and on `PATH`. If it isn't, prints the
install hint (`curl -fsSL https://opencode.ai/install | bash`).

```bash
/opencode:setup
```

## Typical Flows

### Review Before Shipping

```bash
/opencode:review
```

### Hand A Problem To opencode

```bash
/opencode:rescue investigate why the build is failing in CI
```

### Start Something Long-Running

```bash
/opencode:adversarial-review --background
/opencode:rescue --background investigate the flaky test
```

Then check in with:

```bash
/opencode:status
/opencode:result
```

## opencode Integration

The plugin wraps the [opencode HTTP server](https://opencode.ai/docs/server/).
It uses the global `opencode` binary on your `PATH` and inherits its
configuration and authentication.

### Common Configurations

If you want to change the default model or provider that gets used by the
plugin, set them in opencode's own config:

- user-level: `~/.config/opencode/opencode.json`
- project-level: `./opencode.json`

The `model` field there picks the default. The plugin only forwards a model
when you pass `--model <provider/model>` explicitly — otherwise it inherits.

See the [opencode config docs](https://opencode.ai/docs/config/) for the
full set of options.

### Resuming Inside opencode

Tracked jobs record the opencode session id (`JobState.sessionId`). You can
reopen any of them inside opencode directly:

```bash
opencode run --session <session-id>
```

Or use the plugin's own `/opencode:rescue --resume` to continue the latest
rescue thread without leaving Claude Code.

## Out-of-Scope vs codex-plugin-cc

A few codex-plugin-cc features are intentionally not mirrored here:

- **Stop-time review gate** — codex prompts for a review on session stop;
  this plugin doesn't (the loop risk and usage drain aren't worth it for
  most workflows).
- **`--effort`** — provider-specific in opencode (Anthropic thinking budget
  vs OpenAI reasoning effort vs none for Moonshot); not portable through a
  single flag. Configure it per-provider in `opencode.json`.
- **`--write`** — opencode's tools are write-capable by default, no analog
  needed.
- **Model aliases** — codex's `spark → gpt-5.3-codex-spark`-style mappings.
  Pass full `provider/model` strings.

## FAQ

### Do I need a separate opencode account?

No. The plugin uses whatever provider you've already authenticated with via
opencode (`opencode auth login`).

### Does the plugin use a separate opencode runtime?

No. It delegates through your local opencode CLI on the same machine. Same
install, same authentication state, same configuration.

### Does the plugin pick a model?

No — model selection lives entirely on the user's command line
(`--model provider/model`) or in opencode's own config. The plugin never
defaults a model and never aliases one.

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

The compiled `dist/` is committed so the plugin works without a build step
at install time. Don't forget to rebuild before pushing.

See [`AGENTS.md`](./AGENTS.md) for architecture notes and the build-order
breakdown.

## License

[MIT](./LICENSE).
