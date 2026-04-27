---
name: opencode-prompting
description: Generic guidance for crafting prompts sent through opencode. Model-agnostic — opencode's provider/model is set by the user, not by this plugin.
---

# Prompting through opencode

opencode's `POST /session/:id/message` accepts a prompt and returns the
assistant's response. The user picks the underlying model (Anthropic, OpenAI,
Moonshot, OpenRouter routes, etc.) via opencode's own config or the
`--model <provider/model>` flag. This plugin doesn't choose models or alias them.

## When you're forwarding a user's task

The companion's `rescue` subcommand sends the user's free-form text directly.
**Don't add framing the user didn't ask for.** Specifically:

- Don't prepend "You are an expert software engineer..." style preambles.
- Don't add output-format prescriptions ("respond in markdown with sections...").
- Don't attach extra context (file dumps, diff summaries) the user didn't include.

If the user wants context, they include it. opencode has its own tools for
reading files and running shell commands inside the session — let it use them
on demand.

## When you're building review prompts

`buildReviewPrompt` and `buildAdversarialReviewPrompt` already produce the
right framing for their respective modes. Don't wrap or rewrite them upstream.

## Model-agnostic tone

Avoid model-family quirks:

- No "let me think step by step" prefixes (extended-thinking-style).
- No "respond with reasoning_effort=high" hints.
- No JSON-mode tricks unless the user explicitly asks for structured output.

Different providers handle these differently or ignore them. A clean,
declarative prompt travels well across opencode's model registry.

## Long context

opencode's session model already keeps conversation history. For follow-ups,
prefer `/opencode:rescue --resume <text>` over re-uploading context — the
session retains what was already discussed.
