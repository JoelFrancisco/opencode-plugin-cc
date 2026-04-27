import { fetchWithTimeout } from "./fetch-with-timeout.js";
import {
  buildAuthHeader,
  buildBaseUrl,
  parseModelRef,
  type ServerEndpoint,
} from "./server-endpoint.js";

const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

interface MessagePart {
  readonly type: string;
  readonly text?: string;
}

interface MessageResponse {
  readonly info?: unknown;
  readonly parts?: readonly MessagePart[];
}

export interface SessionInfo {
  readonly id: string;
  readonly title?: string;
  readonly time?: { readonly created?: number; readonly updated?: number };
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

export class OpencodeClient {
  constructor(private readonly endpoint: ServerEndpoint) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit & { timeoutMs: number } = {
      method,
      headers: {
        Authorization: buildAuthHeader(this.endpoint.password),
        "Content-Type": "application/json",
      },
      timeoutMs: REQUEST_TIMEOUT_MS,
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetchWithTimeout(`${buildBaseUrl(this.endpoint)}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `${method} ${path} failed: ${res.status} ${res.statusText}${text.length > 0 ? ` — ${text}` : ""}`,
      );
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (text.length === 0) return undefined as T;
    return JSON.parse(text) as T;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${buildBaseUrl(this.endpoint)}/doc`, {
        headers: { Authorization: buildAuthHeader(this.endpoint.password) },
        timeoutMs: 2_000,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async createSession(options: CreateSessionOptions = {}): Promise<SessionInfo> {
    return this.request<SessionInfo>("POST", "/session", { title: options.title ?? "review" });
  }

  async listSessions(options: ListSessionsOptions = {}): Promise<SessionInfo[]> {
    const params = new URLSearchParams();
    if (options.directory !== undefined) params.set("directory", options.directory);
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.roots === true) params.set("roots", "true");
    const query = params.toString();
    const path = query.length > 0 ? `/session?${query}` : "/session";
    return this.request<SessionInfo[]>("GET", path);
  }

  async sendMessage(
    sessionId: string,
    prompt: string,
    options: SendMessageOptions = {},
  ): Promise<string> {
    const body: Record<string, unknown> = {
      parts: [{ type: "text", text: prompt }],
    };
    if (options.model !== undefined) {
      body["model"] = parseModelRef(options.model);
    }

    const result = await this.request<MessageResponse>(
      "POST",
      `/session/${sessionId}/message`,
      body,
    );

    const parts = result.parts ?? [];
    return parts
      .filter(
        (part): part is MessagePart & { text: string } =>
          part.type === "text" && typeof part.text === "string",
      )
      .map((part) => part.text)
      .join("");
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request("DELETE", `/session/${sessionId}`);
  }
}
