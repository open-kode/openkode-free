if (process.env.OPENKODE_EDITION !== 'pro') {
  // Relay provider is Pro-only. No-op exports for Free edition.
  module.exports = {};
  return;
}

/**
 * RelayProvider — OpenKode Pro managed relay client.
 *
 * Sends LLM requests over the OpenKode WebSocket relay so teams can share
 * a single managed key with usage tracking, rate-limiting, and audit logging.
 *
 * ⚠️  PRO ONLY — this file is present in openkode-free but the paths that
 *     instantiate it are guarded by `process.env['OPENKODE_EDITION'] === 'pro'`
 *     in llm-router.ts.  Calling any export from the Free edition is a no-op
 *     or throws an upgrade error via `requirePro()`.
 */
/**
 * RelayProvider — OpenKode Pro managed relay client.
 *
 * Sends LLM requests over the OpenKode WebSocket relay so teams can share
 * a single managed key with usage tracking, rate-limiting, and audit logging.
 *
 * ⚠️  PRO ONLY — this file is present in openkode-free but the paths that
 *     instantiate it are guarded by `process.env['OPENKODE_EDITION'] === 'pro'`
 *     in llm-router.ts.  Calling any export from the Free edition is a no-op
 *     or throws an upgrade error via `requirePro()`.
 */

/** Relay endpoint — configurable in Pro settings. */
const DEFAULT_RELAY_ENDPOINT = 'wss://relay.openkode.dev/ws';

export type RelayConfig = {
  endpoint: string;
  token: string;
};

export type RelayResponse = {
  content: string;
  model?: string;
  /** Usage statistics surfaced by the relay server. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  };
};

/**
 * Send a chat request through the OpenKode managed relay.
 *
 * @param messages  Conversation messages (OpenAI-compatible format).
 * @param config    Relay endpoint + JWT token. Defaults to the production relay.
 * @returns         Full response once the relay signals completion.
 */
export async function callRelay(
  messages: Array<{ role: string; content: string }>,
  config: Partial<RelayConfig> = {},
): Promise<RelayResponse> {
  const endpoint = config.endpoint ?? DEFAULT_RELAY_ENDPOINT;
  const token    = config.token    ?? '';

  return new Promise<RelayResponse>((resolve, reject) => {
    const ws = new WebSocket(`${endpoint}?token=${encodeURIComponent(token)}`);
    let fullContent = '';

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'chat', payload: { messages } }));
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: 'chunk' | 'done' | 'error';
          content?: string;
          model?: string;
          usage?: RelayResponse['usage'];
          error?: string;
        };

        if (msg.type === 'chunk' && msg.content) {
          fullContent += msg.content;
        } else if (msg.type === 'done') {
          ws.close();
          resolve({ content: fullContent, model: msg.model, usage: msg.usage });
        } else if (msg.type === 'error') {
          ws.close();
          reject(new Error(msg.error ?? 'Relay error'));
        }
      } catch (err) {
        ws.close();
        reject(err);
      }
    });

    ws.addEventListener('error', () => {
      reject(new Error('OpenKode relay WebSocket connection failed.'));
    });

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('OpenKode relay timed out after 30 s.'));
    }, 30_000);

    ws.addEventListener('close', () => clearTimeout(timer));
  });
}

/**
 * Stream tokens from the OpenKode relay, calling `onChunk` for each token.
 *
 * @param messages   Conversation messages.
 * @param onChunk    Called with each token as it streams.
 * @param config     Relay endpoint + JWT token.
 */
export async function streamRelay(
  messages: Array<{ role: string; content: string }>,
  onChunk: (token: string) => void,
  config: Partial<RelayConfig> = {},
): Promise<void> {
  const res = await callRelay(messages, config);
  // Relay returns full content once complete; simulate token-by-token delivery.
  onChunk(res.content);
}
