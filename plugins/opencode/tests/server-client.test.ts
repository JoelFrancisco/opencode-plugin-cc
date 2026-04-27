import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpencodeClient } from "../src/lib/server-client.js";
import type { ServerEndpoint } from "../src/lib/server-endpoint.js";

interface CapturedRequest {
  readonly method: string;
  readonly path: string;
  readonly auth: string | undefined;
  readonly body: string;
}

describe("OpencodeClient", () => {
  let server: Server;
  let endpoint: ServerEndpoint;
  const captured: CapturedRequest[] = [];
  let nextResponse: { status: number; body: string } = { status: 200, body: "{}" };

  beforeEach(async () => {
    captured.length = 0;
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        captured.push({
          method: req.method ?? "",
          path: req.url ?? "",
          auth: req.headers.authorization,
          body: Buffer.concat(chunks).toString("utf8"),
        });
        res.writeHead(nextResponse.status, { "Content-Type": "application/json" });
        res.end(nextResponse.body);
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("no port");
    endpoint = {
      pid: process.pid,
      host: "127.0.0.1",
      port: addr.port,
      password: "test-password",
      workspace: "/tmp/test",
      started: new Date().toISOString(),
    };
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("sends Basic auth header derived from password", async () => {
    nextResponse = { status: 200, body: JSON.stringify({ id: "s1" }) };
    const client = new OpencodeClient(endpoint);
    await client.createSession();
    expect(captured[0]?.auth).toBe(
      `Basic ${Buffer.from("opencode:test-password").toString("base64")}`,
    );
  });

  it("createSession POSTs to /session and returns the parsed body", async () => {
    nextResponse = { status: 200, body: JSON.stringify({ id: "session-1" }) };
    const client = new OpencodeClient(endpoint);
    const result = await client.createSession({ title: "my review" });
    expect(captured[0]?.method).toBe("POST");
    expect(captured[0]?.path).toBe("/session");
    expect(JSON.parse(captured[0]?.body ?? "")).toEqual({ title: "my review" });
    expect(result.id).toBe("session-1");
  });

  it("sendMessage extracts text parts from the response", async () => {
    nextResponse = {
      status: 200,
      body: JSON.stringify({
        info: { id: "m1", role: "assistant" },
        parts: [
          { type: "text", text: "Hello " },
          { type: "tool", text: "should be ignored" },
          { type: "text", text: "world." },
        ],
      }),
    };
    const client = new OpencodeClient(endpoint);
    const text = await client.sendMessage("session-1", "review this");
    expect(text).toBe("Hello world.");
  });

  it("sendMessage forwards parsed model ref when --model is supplied", async () => {
    nextResponse = {
      status: 200,
      body: JSON.stringify({ info: {}, parts: [{ type: "text", text: "ok" }] }),
    };
    const client = new OpencodeClient(endpoint);
    await client.sendMessage("session-1", "prompt", {
      model: "openrouter/moonshotai/kimi-k2-0905",
    });
    const body = JSON.parse(captured[0]?.body ?? "");
    expect(body).toMatchObject({
      parts: [{ type: "text", text: "prompt" }],
      model: { providerID: "openrouter", modelID: "moonshotai/kimi-k2-0905" },
    });
  });

  it("ping returns true on 2xx /doc", async () => {
    nextResponse = { status: 200, body: "{}" };
    const client = new OpencodeClient(endpoint);
    expect(await client.ping()).toBe(true);
    expect(captured[0]?.path).toBe("/doc");
  });

  it("ping returns false on non-2xx", async () => {
    nextResponse = { status: 500, body: "boom" };
    const client = new OpencodeClient(endpoint);
    expect(await client.ping()).toBe(false);
  });

  it("request throws on non-2xx with helpful message", async () => {
    nextResponse = { status: 400, body: "bad input" };
    const client = new OpencodeClient(endpoint);
    await expect(client.createSession()).rejects.toThrow(/400.*bad input/);
  });

  it("listSessions GETs /session with directory and limit query params", async () => {
    nextResponse = {
      status: 200,
      body: JSON.stringify([{ id: "s1", title: "review" }]),
    };
    const client = new OpencodeClient(endpoint);
    const result = await client.listSessions({ directory: "/tmp/repo", limit: 5 });
    expect(captured[0]?.method).toBe("GET");
    expect(captured[0]?.path).toContain("/session?");
    expect(captured[0]?.path).toContain("directory=%2Ftmp%2Frepo");
    expect(captured[0]?.path).toContain("limit=5");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("s1");
  });

  it("listSessions accepts no params", async () => {
    nextResponse = { status: 200, body: "[]" };
    const client = new OpencodeClient(endpoint);
    const result = await client.listSessions();
    expect(captured[0]?.path).toBe("/session");
    expect(result).toEqual([]);
  });

  it("deleteSession DELETEs /session/:id and tolerates an empty body", async () => {
    nextResponse = { status: 200, body: "true" };
    const client = new OpencodeClient(endpoint);
    await client.deleteSession("s1");
    expect(captured[0]?.method).toBe("DELETE");
    expect(captured[0]?.path).toBe("/session/s1");
  });
});
