import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// `src/lib/prompts.ts` and `dist/lib/prompts.js` are both two levels deep,
// so this resolves to `<repo>/prompts/` in dev (via vitest) and to
// `${CLAUDE_PLUGIN_ROOT}/prompts/` at production runtime.
const PROMPT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "prompts");
const EFFORT_INSTRUCTIONS = {
    none: null,
    minimal: "Answer in 1-2 sentences max. Skip preamble.",
    low: "Keep your response concise. Skip preamble and minor caveats.",
    medium: null,
    high: "Think carefully through edge cases, trade-offs, and alternative approaches before answering.",
    xhigh: "Reason thoroughly. Show your work. Consider failure modes, alternative approaches, and second-order consequences before answering.",
};
export function effortInstruction(effort) {
    if (effort === undefined)
        return null;
    return EFFORT_INSTRUCTIONS[effort];
}
export function fillTemplate(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = vars[key];
        return value === undefined ? match : value;
    });
}
function loadTemplate(name) {
    return readFileSync(join(PROMPT_DIR, `${name}.md`), "utf8");
}
function scopeLabel(input) {
    return input.scope === "branch"
        ? `branch diff against ${input.base ?? "(unspecified)"}`
        : "working-tree changes";
}
function statusOrEmpty(status) {
    const trimmed = status.trim();
    return trimmed.length > 0 ? trimmed : "(clean)";
}
function diffOrEmpty(diff) {
    const trimmed = diff.trim();
    return trimmed.length > 0 ? trimmed : "(empty)";
}
function focusOrNone(focus) {
    if (focus === undefined)
        return "(none)";
    const trimmed = focus.trim();
    return trimmed.length > 0 ? trimmed : "(none)";
}
function effortBlock(effort) {
    const hint = effortInstruction(effort);
    return hint === null ? "" : `\n${hint}\n`;
}
export function buildReviewPrompt(input) {
    return fillTemplate(loadTemplate("review"), {
        TARGET_LABEL: scopeLabel(input),
        GIT_STATUS: statusOrEmpty(input.status),
        GIT_DIFF: diffOrEmpty(input.diff),
        EFFORT_HINT: effortBlock(input.effort),
    });
}
export function buildAdversarialReviewPrompt(input) {
    return fillTemplate(loadTemplate("adversarial-review"), {
        TARGET_LABEL: scopeLabel(input),
        USER_FOCUS: focusOrNone(input.focus),
        GIT_STATUS: statusOrEmpty(input.status),
        GIT_DIFF: diffOrEmpty(input.diff),
        EFFORT_HINT: effortBlock(input.effort),
    });
}
