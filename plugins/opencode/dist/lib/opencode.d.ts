import { type RunResult } from "./process.js";
export declare function getOpencodeBin(): string;
export interface OpencodeAvailability {
    readonly available: boolean;
    readonly version: string | null;
}
export declare function checkOpencodeAvailable(): OpencodeAvailability;
export interface RunOpencodeOptions {
    readonly prompt: string;
    readonly model?: string;
    readonly cwd?: string;
}
export declare function runOpencode(options: RunOpencodeOptions): RunResult;
