import { describe, expect, it } from "vitest";
import { EFFORT_LEVELS, validateEffort, validateModel } from "../src/lib/args.js";

describe("validateModel", () => {
  it("accepts simple provider/model", () => {
    expect(validateModel("anthropic/claude-sonnet-4-6")).toBe("anthropic/claude-sonnet-4-6");
  });

  it("accepts multi-segment routes (e.g. openrouter)", () => {
    expect(validateModel("openrouter/moonshotai/kimi-k2-0905")).toBe(
      "openrouter/moonshotai/kimi-k2-0905",
    );
  });

  it("accepts dots and colons in segments", () => {
    expect(validateModel("openai/gpt-5.4-mini")).toBe("openai/gpt-5.4-mini");
    expect(validateModel("anthropic/claude:nightly")).toBe("anthropic/claude:nightly");
  });

  it("rejects values without a slash", () => {
    expect(() => validateModel("noslash")).toThrow(/Invalid --model/);
  });

  it("rejects spaces", () => {
    expect(() => validateModel("foo bar/baz")).toThrow(/Invalid --model/);
  });

  it("rejects empty strings", () => {
    expect(() => validateModel("")).toThrow(/Invalid --model/);
  });
});

describe("validateEffort", () => {
  it("accepts every documented level", () => {
    for (const level of EFFORT_LEVELS) {
      expect(validateEffort(level)).toBe(level);
    }
  });

  it("rejects unknown levels with a helpful message", () => {
    expect(() => validateEffort("ultra")).toThrow(
      /Invalid --effort.*expected one of: none, minimal, low, medium, high, xhigh/,
    );
  });

  it("rejects empty strings", () => {
    expect(() => validateEffort("")).toThrow(/Invalid --effort/);
  });
});
