/**
 * LlmRouter — the single public interface for all LLM calls in OpenKode.
 *
 * This is a facade over:
 *  1. Local inference servers (Ollama, LM Studio, llama.cpp) — zero data leakage
 *  2. Cloud providers via the existing LLMClient (OpenAI, Anthropic, Gemini, etc.)  [Pro only]
 *  3. OpenKode managed relay (for Pro/Team subscribers) via WebSocket               [Pro only]
 *
 * Edition gating is controlled by the `OPENKODE_EDITION` environment variable:
 *  - `free` (default) — local provider only; cloud/relay paths redirect with an upgrade prompt.
 *  - `pro`            — all routing enabled.
 *
 * All future modules (spec/, orchestration/, verification/) should import and
 * call `llmRouter` rather than instantiating LLMClient directly.
 *
 * Usage:
 *   import { llmRouter } from './llm-router';
 *   const response = await llmRouter.execute({ messages: [...] });
 */
import * as vscode from 'vscode';

import type { LlmConfig, LlmRequest, LlmResponse, LocalProvider } from './types';
import { getLlmConfig, getCloudApiKey, validateLocalConnection, onConfigChange } from '../settings';
import { LLMClient } from '../llm/llmClient';

// ─── Edition guard ────────────────────────────────────────────────────────────

/**
 * Returns `true` when running as OpenKode Pro.
 * The build system sets `OPENKODE_EDITION=pro` for the Pro bundle;
 * anything else (including undefined) is treated as Free.
 */
function isProEdition(): boolean {
  return process.env['OPENKODE_EDITION'] === 'pro';
}

/**
 * Throw a user-facing error when a Pro-only feature is accessed in the Free edition.
 */
function requirePro(featureName: string): never {
  throw new Error(
    `"${featureName}" is a Pro feature. Upgrade at https://openkode.dev/pro ` +
    'or switch to Local mode to use OpenKode Free.',
  );
}

// ─── Local provider helpers ───────────────────────────────────────────────────

/** Map each local provider to its OpenAI-compatible chat endpoint. */
function getChatEndpoint(provider: LocalProvider, host: string): string {
  const base = host.replace(/\/$/, '');
  switch (provider) {
    case 'ollama':
      return `${base}/api/chat`;
    case 'lmstudio':
    case 'llamacpp':
      // Both expose an OpenAI-compatible endpoint
      return `${base}/v1/chat/completions`;
  }
}

/** Resolve the model name to send to a local server. */
function resolveLocalModel(provider: LocalProvider, model: string): string {
  // Ollama keeps model names as-is; lmstudio / llamacpp typically ignore this field
  // but we send it for future-proofing.
  return model;
}

/**
 * Call a local inference server and return a normalised LlmResponse.
 * Ollama uses its native /api/chat format; LM Studio and llama.cpp use the
 * OpenAI-compatible /v1/chat/completions format.
 */
async function callLocalProvider(
  request: LlmRequest,
  config: NonNullable<LlmConfig['local']>,
): Promise<LlmResponse> {
  const { provider, host, model } = config;
  const endpoint = getChatEndpoint(provider, host);

  let body: unknown;

  if (provider === 'ollama') {
    body = {
      model: resolveLocalModel(provider, model),
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.3,
        ...(request.maxTokens ? { num_predict: request.maxTokens } : {}),
      },
    };
  } else {
    // OpenAI-compatible format (LM Studio, llama.cpp)
    body = {
      model: resolveLocalModel(provider, model),
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Local LLM (${provider}) returned HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  // Parse Ollama native response
  if (provider === 'ollama') {
    const msg = (data['message'] as { content?: string } | undefined)?.content ?? '';
    return { content: msg, model };
  }

  // Parse OpenAI-compatible response
  const choices = data['choices'] as Array<{
    message?: { content?: string };
    delta?: { content?: string };
  }>;
  const content = choices?.[0]?.message?.content ?? '';
  const usage = data['usage'] as {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | undefined;

  return {
    content,
    model: (data['model'] as string | undefined) ?? model,
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        }
      : undefined,
  };
}

/**
 * Stream tokens from a local inference server, calling `onChunk` for each token.
 * Uses Ollama native streaming or OpenAI-compatible SSE for LM Studio / llama.cpp.
 */
async function streamLocalProvider(
  request: LlmRequest,
  config: NonNullable<LlmConfig['local']>,
  onChunk: (token: string) => void,
): Promise<void> {
  const { provider, host, model } = config;
  const endpoint = getChatEndpoint(provider, host);

  let body: unknown;

  if (provider === 'ollama') {
    body = {
      model,
      messages: request.messages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.3,
        ...(request.maxTokens ? { num_predict: request.maxTokens } : {}),
      },
    };
  } else {
    body = {
      model,
      messages: request.messages,
      stream: true,
      temperature: request.temperature ?? 0.3,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Local LLM stream (${provider}) returned HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      // OpenAI-compatible SSE: "data: {...}" or "data: [DONE]"
      if (line.startsWith('data: ')) {
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            message?: { content?: string };
            done?: boolean;
          };
          // Ollama may send { message: { content } } or { done: true }
          const token =
            parsed.choices?.[0]?.delta?.content ??
            parsed.message?.content ??
            '';
          if (token) onChunk(token);
        } catch {
          // Malformed chunk — skip
        }
        continue;
      }

      // Ollama native: raw JSON objects (no "data:" prefix)
      if (line.startsWith('{')) {
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
          };
          if (parsed.done) continue;
          const token = parsed.message?.content ?? '';
          if (token) onChunk(token);
        } catch {
          // Malformed chunk — skip
        }
      }
    }
  }
}

// ─── Relay provider helper ────────────────────────────────────────────────────

/**
 * Send a request through the OpenKode managed relay over WebSocket.
 * Resolves with the full response once the server signals completion.
 */
async function callRelayProvider(
  request: LlmRequest,
  config: NonNullable<LlmConfig['relay']>,
): Promise<LlmResponse> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${config.endpoint}?token=${encodeURIComponent(config.token)}`);
    let fullContent = '';

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'chat', payload: request }));
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: 'chunk' | 'done' | 'error';
          content?: string;
          error?: string;
        };

        if (msg.type === 'chunk' && msg.content) {
          fullContent += msg.content;
        } else if (msg.type === 'done') {
          ws.close();
          resolve({ content: fullContent });
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

    // 30 s timeout
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('OpenKode relay timed out after 30 s.'));
    }, 30_000);

    ws.addEventListener('close', () => clearTimeout(timer));
  });
}

// ─── LlmRouter ───────────────────────────────────────────────────────────────

/**
 * Singleton facade that routes all LLM calls to the correct provider.
 *
 * Obtain the instance via `LlmRouter.getInstance()`.
 * After activation, prefer the exported `llmRouter` convenience reference.
 */
export class LlmRouter {
  private static _instance: LlmRouter | undefined;

  private _config!: LlmConfig;
  private _cloudClient: LLMClient | undefined;
  private _statusBarItem!: vscode.StatusBarItem;
  private _configListener!: vscode.Disposable;

  /** Fires whenever the active configuration changes (e.g. profile applied). */
  private readonly _onConfigChanged = new vscode.EventEmitter<LlmConfig>();
  /** Subscribe to receive the new LlmConfig whenever the active provider changes. */
  readonly onConfigChanged: vscode.Event<LlmConfig> = this._onConfigChanged.event;

  private constructor() {}

  /** Get or create the singleton LlmRouter. */
  static getInstance(): LlmRouter {
    if (!LlmRouter._instance) {
      LlmRouter._instance = new LlmRouter();
    }
    return LlmRouter._instance;
  }

  /**
   * Initialise the router. Must be called once from `activate()`.
   * Loads configuration, validates local servers, and sets up the status bar.
   *
   * @param context  VS Code extension context (used for status bar subscription).
   */
  async init(context: vscode.ExtensionContext): Promise<void> {
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99, // Just below the generic OpenKode item (priority 100)
    );
    this._statusBarItem.command = 'workbench.action.openSettings';
    context.subscriptions.push(this._statusBarItem);

    await this._loadConfig();

    // Re-initialise whenever the user changes any openkode.* setting
    this._configListener = onConfigChange(async () => {
      await this._loadConfig();
    });
    context.subscriptions.push(this._configListener);
  }

  // ─── Private internals ──────────────────────────────────────────────────────

  /** Load config from settings, rebuild the cloud client if needed, update status bar. */
  private async _loadConfig(): Promise<void> {
    this._config = await getLlmConfig();
    await this._rebuildCloudClient();
    this._updateStatusBar();
    this._onConfigChanged.fire(this._config);
  }

  /** (Re)build the LLMClient for cloud-key mode. Skipped for local / relay. */
  private async _rebuildCloudClient(): Promise<void> {
    if (this._config.mode !== 'cloud-key') {
      this._cloudClient = undefined;
      return;
    }

    const { provider, model } = this._config.cloud!;
    const apiKey = (await getCloudApiKey(provider as import('./types').CloudProvider)) ?? '';

    if (!apiKey) {
      this._cloudClient = undefined;
      return;
    }

    this._cloudClient = new LLMClient({
      provider: provider as import('../types').LLMProvider,
      apiKey,
      model,
    });
  }

  /** Update the status bar text to reflect current provider + model. */
  private _updateStatusBar(): void {
    const { mode } = this._config;

    let label: string;
    let tooltip: string;

    if (mode === 'local') {
      const { provider, model } = this._config.local!;
      label = `$(cpu) Local • ${model}`;
      tooltip = `OpenKode LLM: ${provider} @ ${this._config.local!.host}\nClick to open settings`;
    } else if (mode === 'cloud-key') {
      const { provider, model } = this._config.cloud!;
      label = `$(cloud) Cloud • ${model}`;
      tooltip = `OpenKode LLM: ${provider} (your API key)\nClick to open settings`;
    } else {
      label = `$(globe) Relay • OpenKode`;
      tooltip = `OpenKode LLM: Managed relay (Pro/Team plan)\nClick to open settings`;
    }

    this._statusBarItem.text = label;
    this._statusBarItem.tooltip = tooltip;
    this._statusBarItem.command = 'workbench.action.openSettings';
    this._statusBarItem.show();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Return the current active profile name as a human-readable string
   * suitable for use in handoff prompt headers and notifications.
   *
   * Examples:
   *  - "Local • qwen2.5-coder:32b"
   *  - "Cloud • claude-3.7-sonnet"
   *  - "Relay • OpenKode"
   */
  getActiveProfileName(): string {
    const { mode } = this._config;
    if (mode === 'local') {
      return `Local • ${this._config.local!.model}`;
    }
    if (mode === 'cloud-key') {
      return `Cloud • ${this._config.cloud!.model}`;
    }
    return 'Relay • OpenKode';
  }

  /**
   * Return the currently active LLM configuration.
   */
  getConfig(): LlmConfig {
    return this._config;
  }

  /**
   * Execute a non-streaming LLM call and return the full response.
   *
   * Routes automatically based on the current provider mode:
   *  - `local`           → direct fetch to Ollama / LM Studio / llama.cpp
   *  - `cloud-key`       → delegates to existing LLMClient (OpenAI, Anthropic, etc.)
   *  - `openkode-relay`  → WebSocket relay at validate.openkode.dev
   */
  async execute(request: LlmRequest): Promise<LlmResponse> {
    const { mode } = this._config;

    if (mode === 'local') {
      return callLocalProvider(request, this._config.local!);
    }

    // ── Pro-only paths ────────────────────────────────────────────────────────
    if (!isProEdition()) {
      if (mode === 'openkode-relay') requirePro('OpenKode Relay');
      if (mode === 'cloud-key')      requirePro('Cloud Key routing');
    }

    if (mode === 'openkode-relay') {
      return callRelayProvider(request, this._config.relay!);
    }

    // cloud-key — delegate to the existing LLMClient
    if (!this._cloudClient) {
      throw new Error(
        'Cloud API key not configured. Run "OpenKode: Select LLM Provider" to add your key.',
      );
    }

    const result = await this._cloudClient.streamChat(
      request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      () => {}, // no-op onChunk for non-streaming path
      request.messages.find((m) => m.role === 'system')?.content,
    );

    return { content: result, model: this._config.cloud?.model };
  }

  /**
   * Execute a streaming LLM call, calling `onChunk` for each token as it arrives.
   *
   * @param request   The LLM request.
   * @param onChunk   Callback invoked with each streamed token.
   */
  async streamChat(
    request: LlmRequest,
    onChunk: (token: string) => void,
  ): Promise<void> {
    const { mode } = this._config;

    if (mode === 'local') {
      await streamLocalProvider(request, this._config.local!, onChunk);
      return;
    }

    // ── Pro-only paths ────────────────────────────────────────────────────────
    if (!isProEdition()) {
      if (mode === 'openkode-relay') requirePro('OpenKode Relay streaming');
      if (mode === 'cloud-key')      requirePro('Cloud Key streaming');
    }

    if (mode === 'openkode-relay') {
      // Relay doesn't expose a streaming path yet — fall back to buffered call
      const response = await callRelayProvider(request, this._config.relay!);
      // Simulate streaming so callers don't need to branch
      onChunk(response.content);
      return;
    }

    // cloud-key — delegate to existing LLMClient which has real streaming
    if (!this._cloudClient) {
      throw new Error(
        'Cloud API key not configured. Run "OpenKode: Select LLM Provider" to add your key.',
      );
    }

    await this._cloudClient.streamChat(
      request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      onChunk,
      request.messages.find((m) => m.role === 'system')?.content,
    );
  }

  /**
   * Probe the currently configured local server and return its status.
   * Returns `undefined` when the active mode is not `local`.
   */
  async checkLocalServer(): Promise<import('./types').LocalServerStatus | undefined> {
    if (this._config.mode !== 'local') return undefined;
    const { provider, host } = this._config.local!;
    return validateLocalConnection(provider, host);
  }

  /**
   * Force an immediate config reload and status bar update.
   * Call this after programmatically changing VS Code settings (e.g. after
   * `applyProfile()` writes new values) so the router reflects the change
   * without waiting for the VS Code config-change event debounce.
   */
  async refresh(): Promise<void> {
    await this._loadConfig();
  }

  /** Dispose resources (called from `deactivate()`). */
  dispose(): void {
    this._statusBarItem.dispose();
    this._configListener.dispose();
    this._onConfigChanged.dispose();
    LlmRouter._instance = undefined;
  }
}

/** Convenience singleton reference — initialised by `activate()`. Import this in all modules. */
export const llmRouter = LlmRouter.getInstance();
