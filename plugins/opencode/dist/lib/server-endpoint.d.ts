export interface ServerEndpoint {
    readonly pid: number;
    readonly host: string;
    readonly port: number;
    readonly password: string;
    readonly workspace: string;
    readonly started: string;
}
export declare function workspaceKey(workspace: string): string;
export declare function getServerLockfile(workspace: string): string;
export interface ModelRef {
    readonly providerID: string;
    readonly modelID: string;
}
export declare function parseModelRef(value: string): ModelRef;
export declare const OPENCODE_SERVER_USERNAME = "opencode";
export declare function buildAuthHeader(password: string): string;
export declare function buildBaseUrl(endpoint: ServerEndpoint): string;
