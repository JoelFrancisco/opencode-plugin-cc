const MODEL_PATTERN = /^[a-zA-Z0-9._:-]+(?:\/[a-zA-Z0-9._:-]+)+$/;
export function validateModel(value) {
    if (!MODEL_PATTERN.test(value)) {
        throw new Error(`Invalid --model value: ${value} (expected provider/model, e.g. anthropic/claude-sonnet-4-6)`);
    }
    return value;
}
