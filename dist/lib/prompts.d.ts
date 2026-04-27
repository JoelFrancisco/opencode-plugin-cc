export interface ReviewPromptInput {
    readonly scope: "working-tree" | "branch";
    readonly base?: string;
    readonly status: string;
    readonly diff: string;
    readonly focus?: string;
}
export declare function buildReviewPrompt(input: ReviewPromptInput): string;
export declare function buildAdversarialReviewPrompt(input: ReviewPromptInput): string;
