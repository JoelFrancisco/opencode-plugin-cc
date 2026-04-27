import { type ServerEndpoint } from "./server-endpoint.js";
export declare function readLockfile(workspace: string): ServerEndpoint | null;
export declare function writeLockfile(endpoint: ServerEndpoint): void;
export declare function deleteLockfile(workspace: string): void;
export declare function pingServer(endpoint: ServerEndpoint): Promise<boolean>;
export declare function ensureServerRunning(workspace: string): Promise<ServerEndpoint>;
export interface StopResult {
    readonly stopped: boolean;
    readonly endpoint: ServerEndpoint | null;
}
export declare function stopServer(workspace: string): StopResult;
