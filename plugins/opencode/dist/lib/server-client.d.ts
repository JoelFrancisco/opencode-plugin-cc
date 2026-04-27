import { type ServerEndpoint } from "./server-endpoint.js";
interface SessionInfo {
    readonly id: string;
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
    sendMessage(sessionId: string, prompt: string, options?: SendMessageOptions): Promise<string>;
    deleteSession(sessionId: string): Promise<void>;
}
export {};
