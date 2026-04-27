import { OpencodeClient } from "./server-client.js";
import { ensureServerRunning } from "./server-lifecycle.js";

export interface BrokerReviewOptions {
  readonly cwd: string;
  readonly prompt: string;
  readonly model?: string;
  readonly title?: string;
  readonly sessionId?: string;
}

export interface BrokerReviewResult {
  readonly sessionId: string;
  readonly text: string;
}

export async function runReviewViaBroker(
  options: BrokerReviewOptions,
): Promise<BrokerReviewResult> {
  const endpoint = await ensureServerRunning(options.cwd);
  const client = new OpencodeClient(endpoint);

  let sessionId = options.sessionId;
  if (sessionId === undefined) {
    const session = await client.createSession({ title: options.title ?? "review" });
    sessionId = session.id;
  }

  const text = await client.sendMessage(
    sessionId,
    options.prompt,
    options.model === undefined ? {} : { model: options.model },
  );
  return { sessionId, text };
}

export async function findLatestSessionByTitle(cwd: string, title: string): Promise<string | null> {
  const endpoint = await ensureServerRunning(cwd);
  const client = new OpencodeClient(endpoint);
  const sessions = await client.listSessions({ directory: cwd, limit: 50 });
  const match = sessions.find((session) => session.title === title);
  return match?.id ?? null;
}
