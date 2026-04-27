export type JobKind = "review";
export type JobStatus = "running" | "completed" | "failed" | "cancelled";
export interface JobState {
    readonly id: string;
    readonly kind: JobKind;
    readonly workspace: string;
    readonly pid: number;
    readonly started: string;
    readonly model?: string;
    readonly base?: string;
    readonly scope: "working-tree" | "branch";
    status: JobStatus;
    ended?: string;
    exitCode?: number;
    errorMessage?: string;
}
export declare function getStateDir(): string;
export declare function getJobsDir(): string;
export declare function getOutputDir(): string;
export declare function getJobPath(id: string): string;
export declare function getOutputPath(id: string, stream: "stdout" | "stderr"): string;
export declare function newJobId(): string;
export declare function writeJobState(state: JobState): void;
export declare function readJobState(id: string): JobState | null;
export declare function listJobs(): JobState[];
export declare function listJobsForWorkspace(workspace: string): JobState[];
