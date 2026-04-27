import { describe, expect, it } from "vitest";
import {
  buildAuthHeader,
  buildBaseUrl,
  parseModelRef,
  workspaceKey,
} from "../src/lib/server-endpoint.js";

describe("workspaceKey", () => {
  it("is deterministic for the same path", () => {
    expect(workspaceKey("/tmp/repo")).toBe(workspaceKey("/tmp/repo"));
  });

  it("differs across paths", () => {
    expect(workspaceKey("/tmp/repo-a")).not.toBe(workspaceKey("/tmp/repo-b"));
  });

  it("returns a 16-char hex slice", () => {
    expect(workspaceKey("/tmp/x")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("parseModelRef", () => {
  it("splits a simple provider/model", () => {
    expect(parseModelRef("anthropic/claude-sonnet-4-6")).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-6",
    });
  });

  it("preserves slashes after the first one (multi-segment routes)", () => {
    expect(parseModelRef("openrouter/moonshotai/kimi-k2-0905")).toEqual({
      providerID: "openrouter",
      modelID: "moonshotai/kimi-k2-0905",
    });
  });

  it("rejects values without a slash", () => {
    expect(() => parseModelRef("noslash")).toThrow(/Invalid model/);
  });

  it("rejects empty providerID", () => {
    expect(() => parseModelRef("/foo")).toThrow(/Invalid model/);
  });

  it("rejects empty modelID", () => {
    expect(() => parseModelRef("foo/")).toThrow(/Invalid model/);
  });
});

describe("auth + url helpers", () => {
  it("buildAuthHeader produces a Basic header with the opencode username", () => {
    const header = buildAuthHeader("secret");
    expect(header.startsWith("Basic ")).toBe(true);
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    expect(decoded).toBe("opencode:secret");
  });

  it("buildBaseUrl assembles host and port", () => {
    expect(
      buildBaseUrl({
        pid: 1,
        host: "127.0.0.1",
        port: 4096,
        password: "x",
        workspace: "/tmp",
        started: "2026-01-01T00:00:00Z",
      }),
    ).toBe("http://127.0.0.1:4096");
  });
});
