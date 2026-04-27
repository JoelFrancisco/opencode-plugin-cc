---
name: opencode-result-handling
description: How to surface output from `companion review`, `companion adversarial-review`, and `companion rescue` to the user. Use when handing back the stdout of a companion call.
---

# Handling opencode output

## The verbatim rule

opencode's response to a review or rescue call is the user-facing answer. The
slash commands and the `opencode:opencode-rescue` subagent must return that
stdout without modification:

- Do **not** paraphrase, summarize, or rewrite.
- Do **not** add commentary before or after.
- Do **not** fix issues mentioned in a review — review commands are review-only.
- Do **not** "improve" formatting; opencode's structure is intentional.

If the user wants follow-up action on a review finding, they will ask. The
contract is: review describes, the user decides.

## Empty / clean-tree output

When there are no changes to review the companion prints a single line:

```
No changes to review.
```

Surface that line as-is. Do not try to manufacture a review prompt around a
clean tree.

## Background-job output

`/opencode:review --background` prints a job id banner and returns immediately:

```
opencode review started: <id>
Check progress with /opencode:status. Fetch output with /opencode:result.
```

The eventual review body lives at the path returned by `/opencode:result`. When
the user runs `/opencode:result`, return its stdout verbatim — same rule.

## Errors

The companion writes errors to stderr and exits non-zero. Examples:

- `Not a git repository: <cwd>`
- `opencode CLI not found on PATH. Run /opencode:setup.`
- `Invalid --model value: <value>`

Surface these exactly. They contain the next action the user needs.
