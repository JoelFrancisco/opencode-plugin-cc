import { type JobState } from "./state.js";
export declare function isProcessAlive(pid: number): boolean;
export declare function reconcileJobStatus(state: JobState): JobState;
export declare function getLatestJob(workspace: string): JobState | null;
export interface JobOutput {
    readonly stdout: string;
    readonly stderr: string;
}
export declare function readJobOutput(id: string): JobOutput;
export type CancelOutcome = {
    readonly outcome: "cancelled";
    readonly state: JobState;
} | {
    readonly outcome: "not-running";
    readonly state: JobState;
} | {
    readonly outcome: "not-found";
};
export declare function cancelJob(id: string): CancelOutcome;
