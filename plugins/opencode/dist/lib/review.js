import { OpencodeClient } from "./server-client.js";
import { ensureServerRunning } from "./server-lifecycle.js";
export async function runReviewViaBroker(options) {
    const endpoint = await ensureServerRunning(options.cwd);
    const client = new OpencodeClient(endpoint);
    let sessionId = options.sessionId;
    if (sessionId === undefined) {
        const session = await client.createSession({ title: options.title ?? "review" });
        sessionId = session.id;
    }
    const text = await client.sendMessage(sessionId, options.prompt, options.model === undefined ? {} : { model: options.model });
    return { sessionId, text };
}
export async function findLatestSessionByTitle(cwd, title) {
    const endpoint = await ensureServerRunning(cwd);
    const client = new OpencodeClient(endpoint);
    const sessions = await client.listSessions({ directory: cwd, limit: 50 });
    const match = sessions.find((session) => session.title === title);
    return match?.id ?? null;
}
