import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EffortLevel } from "./args.js";

// `src/lib/prompts.ts` and `dist/lib/prompts.js` are both two levels deep,
// so this resolves to `<repo>/prompts/` in dev (via vitest) and to
// `${CLAUDE_PLUGIN_ROOT}/prompts/` at production runtime.
const PROMPT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "prompts");

const EFFORT_INSTRUCTIONS: Readonly<Record<EffortLevel, string | null>> = {
  none: null,
  minimal: "Answer in 1-2 sentences max. Skip preamble.",
  low: "Keep your response concise. Skip preamble and minor caveats.",
  medium: null,
  high: "Think carefully through edge cases, trade-offs, and alternative approaches before answering.",
  xhigh:
    "Reason thoroughly. Show your work. Consider failure modes, alternative approaches, and second-order consequences before answering.",
};

export function effortInstruction(effort: EffortLevel | undefined): string | null {
  if (effort === undefined) return null;
  return EFFORT_INSTRUCTIONS[effort];
}

export function fillTemplate(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : value;
  });
}

function loadTemplate(name: "review" | "adversarial-review"): string {
  return readFileSync(join(PROMPT_DIR, `${name}.md`), "utf8");
}

export interface ReviewPromptInput {
  readonly scope: "working-tree" | "branch";
  readonly base?: string;
  readonly status: string;
  readonly diff: string;
  readonly focus?: string;
  readonly effort?: EffortLevel;
}

function scopeLabel(input: ReviewPromptInput): string {
  return input.scope === "branch"
    ? `branch diff against ${input.base ?? "(unspecified)"}`
    : "working-tree changes";
}

function statusOrEmpty(status: string): string {
  const trimmed = status.trim();
  return trimmed.length > 0 ? trimmed : "(clean)";
}

function diffOrEmpty(diff: string): string {
  const trimmed = diff.trim();
  return trimmed.length > 0 ? trimmed : "(empty)";
}

function focusOrNone(focus: string | undefined): string {
  if (focus === undefined) return "(none)";
  const trimmed = focus.trim();
  return trimmed.length > 0 ? trimmed : "(none)";
}

function effortBlock(effort: EffortLevel | undefined): string {
  const hint = effortInstruction(effort);
  return hint === null ? "" : `\n${hint}\n`;
}

export function buildReviewPrompt(input: ReviewPromptInput): string {
  return fillTemplate(loadTemplate("review"), {
    TARGET_LABEL: scopeLabel(input),
    GIT_STATUS: statusOrEmpty(input.status),
    GIT_DIFF: diffOrEmpty(input.diff),
    EFFORT_HINT: effortBlock(input.effort),
  });
}

export function buildAdversarialReviewPrompt(input: ReviewPromptInput): string {
  return fillTemplate(loadTemplate("adversarial-review"), {
    TARGET_LABEL: scopeLabel(input),
    USER_FOCUS: focusOrNone(input.focus),
    GIT_STATUS: statusOrEmpty(input.status),
    GIT_DIFF: diffOrEmpty(input.diff),
    EFFORT_HINT: effortBlock(input.effort),
  });
}
