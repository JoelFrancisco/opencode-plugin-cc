export type LifecycleEvent = "SessionStart" | "SessionEnd";
export interface HookOutcome {
    readonly action: "noop" | "stopped-broker" | "no-broker-to-stop";
    readonly pid?: number;
}
export declare function handleSessionStart(_cwd: string): HookOutcome;
export declare function handleSessionEnd(cwd: string): HookOutcome;
