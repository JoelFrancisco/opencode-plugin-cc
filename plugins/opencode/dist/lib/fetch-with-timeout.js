// AbortSignal.timeout schedules a ref'd timer that keeps Node's event loop
// alive after the fetch resolves, which prevents process.exitCode-based
// natural exit. This helper uses an explicit setTimeout cleared in finally
// so the loop drains as soon as the fetch is done.
export async function fetchWithTimeout(input, init) {
    const { timeoutMs, ...rest } = init;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...rest, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
