import { OpencodeClient } from "./server-client.js";
import { ensureServerRunning } from "./server-lifecycle.js";

export interface BrokerReviewOptions {
  readonly cwd: string;
  readonly prompt: string;
  readonly model?: string;
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
  const session = await client.createSession({ title: "review" });
  const text = await client.sendMessage(
    session.id,
    options.prompt,
    options.model === undefined ? {} : { model: options.model },
  );
  return { sessionId: session.id, text };
}
