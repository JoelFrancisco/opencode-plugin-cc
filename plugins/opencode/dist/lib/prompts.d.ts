export interface ReviewPromptInput {
    readonly scope: "working-tree" | "branch";
    readonly base?: string;
    readonly status: string;
    readonly diff: string;
}
export declare function buildReviewPrompt(input: ReviewPromptInput): string;
