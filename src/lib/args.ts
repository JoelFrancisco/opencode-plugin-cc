const MODEL_PATTERN = /^[a-zA-Z0-9._:-]+(?:\/[a-zA-Z0-9._:-]+)+$/;

export function validateModel(value: string): string {
  if (!MODEL_PATTERN.test(value)) {
    throw new Error(
      `Invalid --model value: ${value} (expected provider/model, e.g. anthropic/claude-sonnet-4-6)`,
    );
  }
  return value;
}

export const EFFORT_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export function validateEffort(value: string): EffortLevel {
  if (!(EFFORT_LEVELS as readonly string[]).includes(value)) {
    throw new Error(
      `Invalid --effort value: ${value} (expected one of: ${EFFORT_LEVELS.join(", ")})`,
    );
  }
  return value as EffortLevel;
}
