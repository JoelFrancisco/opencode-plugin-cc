export interface BrokerReviewOptions {
    readonly cwd: string;
    readonly prompt: string;
    readonly model?: string;
    readonly title?: string;
    readonly sessionId?: string;
}
export interface BrokerReviewResult {
    readonly sessionId: string;
    readonly text: string;
}
export declare function runReviewViaBroker(options: BrokerReviewOptions): Promise<BrokerReviewResult>;
export declare function findLatestSessionByTitle(cwd: string, title: string): Promise<string | null>;
