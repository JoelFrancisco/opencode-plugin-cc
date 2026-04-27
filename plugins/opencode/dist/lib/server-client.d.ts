import { type ServerEndpoint } from "./server-endpoint.js";
export interface SessionInfo {
    readonly id: string;
    readonly title?: string;
    readonly time?: {
        readonly created?: number;
        readonly updated?: number;
    };
}
export interface ListSessionsOptions {
    readonly directory?: string;
    readonly limit?: number;
    readonly roots?: boolean;
}
export interface CreateSessionOptions {
    readonly title?: string;
}
export interface SendMessageOptions {
    readonly model?: string;
}
export declare class OpencodeClient {
    private readonly endpoint;
    constructor(endpoint: ServerEndpoint);
    private request;
    ping(): Promise<boolean>;
    createSession(options?: CreateSessionOptions): Promise<SessionInfo>;
    listSessions(options?: ListSessionsOptions): Promise<SessionInfo[]>;
    sendMessage(sessionId: string, prompt: string, options?: SendMessageOptions): Promise<string>;
    deleteSession(sessionId: string): Promise<void>;
}
