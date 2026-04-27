export interface RunOptions {
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly input?: string;
    readonly maxBuffer?: number;
}
export interface RunResult {
    readonly stdout: string;
    readonly stderr: string;
    readonly status: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly error: NodeJS.ErrnoException | null;
}
export declare function runCommand(command: string, args: readonly string[], options?: RunOptions): RunResult;
