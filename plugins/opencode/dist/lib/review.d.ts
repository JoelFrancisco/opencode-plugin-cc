export interface BrokerReviewOptions {
    readonly cwd: string;
    readonly prompt: string;
    readonly model?: string;
}
export interface BrokerReviewResult {
    readonly sessionId: string;
    readonly text: string;
}
export declare function runReviewViaBroker(options: BrokerReviewOptions): Promise<BrokerReviewResult>;
