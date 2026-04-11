/**
 * Core LLM routing types for OpenKode's BYO-LLM engine.
 *
 * These types are the single source of truth for all LLM provider
 * configuration. Every future module (spec/, orchestration/, verification/)
 * should depend on these types rather than the legacy LLMConfig in src/types/.
 */

/** Top-level routing mode: local server, user-owned cloud key, or OpenKode managed relay. */
export type LlmProviderMode = 'local' | 'cloud-key' | 'openkode-relay';

/** Supported local inference servers. */
export type LocalProvider = 'ollama' | 'lmstudio' | 'llamacpp';

/** Supported cloud providers when using user-supplied API keys. */
export type CloudProvider = 'openai' | 'anthropic' | 'xai' | 'gemini';

/** Local server connection configuration. */
export interface LocalLlmConfig {
  /** Which local server is running. */
  provider: LocalProvider;
  /** Base URL of the local inference server. */
  host: string;
  /** Model name as known to the local server (e.g. "qwen2.5-coder:32b"). */
  model: string;
}

/** Cloud provider configuration (API key is fetched separately from SecretStorage). */
export interface CloudLlmConfig {
  /** Which cloud provider to call. */
  provider: CloudProvider;
  /** Model name (e.g. "claude-3.7-sonnet", "gpt-4o"). */
  model: string;
}

/** OpenKode managed relay configuration (for Pro/Team subscribers). */
export interface RelayLlmConfig {
  /** WebSocket endpoint of the relay backend. */
  endpoint: string;
  /** JWT access token for the relay. */
  token: string;
}

/** Unified LLM routing configuration. Exactly one of local/cloud/relay will be set. */
export interface LlmConfig {
  mode: LlmProviderMode;
  local?: LocalLlmConfig;
  cloud?: CloudLlmConfig;
  relay?: RelayLlmConfig;
}

/** A single chat message passed to the LLM. */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Input to any LLM call or streaming call. */
export interface LlmRequest {
  messages: LlmMessage[];
  /** Sampling temperature (0–1). Defaults to 0.3. */
  temperature?: number;
  /** Max tokens to generate. */
  maxTokens?: number;
}

/** Standardised response from any LLM provider. */
export interface LlmResponse {
  /** The text content of the assistant reply. */
  content: string;
  /** Token usage statistics if available from the provider. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Which model actually served the request. */
  model?: string;
}

/** Health-check result for a local server. */
export interface LocalServerStatus {
  available: boolean;
  host: string;
  provider: LocalProvider;
  /** Available model names returned by the server, if any. */
  models?: string[];
  error?: string;
}
