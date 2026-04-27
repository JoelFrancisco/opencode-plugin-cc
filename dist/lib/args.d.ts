export declare function validateModel(value: string): string;
export declare const EFFORT_LEVELS: readonly ["none", "minimal", "low", "medium", "high", "xhigh"];
export type EffortLevel = (typeof EFFORT_LEVELS)[number];
export declare function validateEffort(value: string): EffortLevel;
