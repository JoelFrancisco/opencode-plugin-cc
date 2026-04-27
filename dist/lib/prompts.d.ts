import type { EffortLevel } from "./args.js";
export declare function effortInstruction(effort: EffortLevel | undefined): string | null;
export interface ReviewPromptInput {
    readonly scope: "working-tree" | "branch";
    readonly base?: string;
    readonly status: string;
    readonly diff: string;
    readonly focus?: string;
    readonly effort?: EffortLevel;
}
export declare function buildReviewPrompt(input: ReviewPromptInput): string;
export declare function buildAdversarialReviewPrompt(input: ReviewPromptInput): string;
