import { fetchWithTimeout } from "./fetch-with-timeout.js";
import { buildAuthHeader, buildBaseUrl, parseModelRef, } from "./server-endpoint.js";
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
export class OpencodeClient {
    endpoint;
    constructor(endpoint) {
        this.endpoint = endpoint;
    }
    async request(method, path, body) {
        const init = {
            method,
            headers: {
                Authorization: buildAuthHeader(this.endpoint.password),
                "Content-Type": "application/json",
            },
            timeoutMs: REQUEST_TIMEOUT_MS,
        };
        if (body !== undefined)
            init.body = JSON.stringify(body);
        const res = await fetchWithTimeout(`${buildBaseUrl(this.endpoint)}${path}`, init);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`${method} ${path} failed: ${res.status} ${res.statusText}${text.length > 0 ? ` — ${text}` : ""}`);
        }
        if (res.status === 204)
            return undefined;
        const text = await res.text();
        if (text.length === 0)
            return undefined;
        return JSON.parse(text);
    }
    async ping() {
        try {
            const res = await fetchWithTimeout(`${buildBaseUrl(this.endpoint)}/doc`, {
                headers: { Authorization: buildAuthHeader(this.endpoint.password) },
                timeoutMs: 2_000,
            });
            return res.ok;
        }
        catch {
            return false;
        }
    }
    async createSession(options = {}) {
        return this.request("POST", "/session", { title: options.title ?? "review" });
    }
    async listSessions(options = {}) {
        const params = new URLSearchParams();
        if (options.directory !== undefined)
            params.set("directory", options.directory);
        if (options.limit !== undefined)
            params.set("limit", String(options.limit));
        if (options.roots === true)
            params.set("roots", "true");
        const query = params.toString();
        const path = query.length > 0 ? `/session?${query}` : "/session";
        return this.request("GET", path);
    }
    async sendMessage(sessionId, prompt, options = {}) {
        const body = {
            parts: [{ type: "text", text: prompt }],
        };
        if (options.model !== undefined) {
            body["model"] = parseModelRef(options.model);
        }
        const result = await this.request("POST", `/session/${sessionId}/message`, body);
        const parts = result.parts ?? [];
        return parts
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text)
            .join("");
    }
    async deleteSession(sessionId) {
        await this.request("DELETE", `/session/${sessionId}`);
    }
}
