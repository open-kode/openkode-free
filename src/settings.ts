/**
 * OpenKode settings helpers.
 *
 * Centralises all reads/writes to VS Code configuration and SecretStorage.
 * Never stores API keys in plain-text workspace settings — always uses SecretStorage.
 */
import * as vscode from 'vscode';
import axios from 'axios';
import type {
  LlmConfig,
  LlmProviderMode,
  LocalProvider,
  CloudProvider,
  LocalServerStatus,
} from './core/types';

const SECRET_KEY_PREFIX = 'openkode.apiKey';
const RELAY_TOKEN_KEY = 'openkode.relayToken';
const RELAY_ENDPOINT = 'wss://validate.openkode.dev/ws';

/** Secret storage instance — injected once on extension activation. */
let _secrets: vscode.SecretStorage | undefined;

/**
 * Initialise the settings module with the extension's SecretStorage.
 * Must be called from `activate()` before any other settings helper.
 */
export function initSettings(secrets: vscode.SecretStorage): void {
  _secrets = secrets;
}

function requireSecrets(): vscode.SecretStorage {
  if (!_secrets) {
    throw new Error('Settings not initialised — call initSettings() first.');
  }
  return _secrets;
}

// ─── Config reading ─────────────────────────────────────────────────────────

/**
 * Read the current LLM configuration from VS Code workspace settings
 * and (for relay mode) from SecretStorage. Returns a fully typed LlmConfig.
 */
export async function getLlmConfig(): Promise<LlmConfig> {
  const cfg = vscode.workspace.getConfiguration('openkode');
  const mode = (cfg.get<string>('llmProvider') ?? 'local') as LlmProviderMode;

  if (mode === 'local') {
    const provider = (cfg.get<string>('local.provider') ?? 'ollama') as LocalProvider;
    const host = getLocalHost(cfg, provider);
    const model = cfg.get<string>('local.model') ?? 'qwen2.5-coder:32b';
    return { mode, local: { provider, host, model } };
  }

  if (mode === 'cloud-key') {
    const provider = (cfg.get<string>('cloud.provider') ?? 'openai') as CloudProvider;
    const model = cfg.get<string>('cloud.model') ?? 'claude-3.7-sonnet';
    return { mode, cloud: { provider, model } };
  }

  // openkode-relay
  const token = (await requireSecrets().get(RELAY_TOKEN_KEY)) ?? '';
  return { mode, relay: { endpoint: RELAY_ENDPOINT, token } };
}

/** Resolve the correct host URL for the selected local provider. */
function getLocalHost(
  cfg: vscode.WorkspaceConfiguration,
  provider: LocalProvider,
): string {
  switch (provider) {
    case 'ollama':
      return cfg.get<string>('local.ollamaHost') ?? 'http://localhost:11434';
    case 'lmstudio':
      return cfg.get<string>('local.lmstudioHost') ?? 'http://localhost:1234';
    case 'llamacpp':
      return cfg.get<string>('local.llamacppHost') ?? 'http://localhost:8080';
  }
}

// ─── Secret storage helpers ──────────────────────────────────────────────────

/**
 * Save a cloud provider API key to SecretStorage.
 * Never call `vscode.workspace.getConfiguration().update()` with keys — this
 * function is the only approved path for persisting credentials.
 *
 * @param provider  The cloud provider identifier (e.g. "openai").
 * @param apiKey    The raw API key string.
 */
export async function saveCloudApiKey(
  provider: CloudProvider,
  apiKey: string,
): Promise<void> {
  await requireSecrets().store(`${SECRET_KEY_PREFIX}.${provider}`, apiKey);
}

/**
 * Retrieve a previously saved cloud API key from SecretStorage.
 * Returns `undefined` if no key has been saved yet.
 */
export async function getCloudApiKey(
  provider: CloudProvider,
): Promise<string | undefined> {
  return requireSecrets().get(`${SECRET_KEY_PREFIX}.${provider}`);
}

/**
 * Delete a stored cloud API key (e.g. when the user switches providers or logs out).
 */
export async function deleteCloudApiKey(provider: CloudProvider): Promise<void> {
  await requireSecrets().delete(`${SECRET_KEY_PREFIX}.${provider}`);
}

/**
 * Save the OpenKode relay JWT token to SecretStorage.
 */
export async function saveRelayToken(token: string): Promise<void> {
  await requireSecrets().store(RELAY_TOKEN_KEY, token);
}

/**
 * Retrieve the OpenKode relay JWT token, or `undefined` if not set.
 */
export async function getRelayToken(): Promise<string | undefined> {
  return requireSecrets().get(RELAY_TOKEN_KEY);
}

// ─── Local server validation ─────────────────────────────────────────────────

/**
 * Perform a lightweight health-check against a local inference server.
 * Used on activation to show accurate status and on provider switch to verify the server is up.
 *
 * @param provider  Local provider type.
 * @param host      Base URL of the server.
 */
export async function validateLocalConnection(
  provider: LocalProvider,
  host: string,
): Promise<LocalServerStatus> {
  try {
    const url = getHealthCheckUrl(provider, host);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return { available: false, host, provider, error: `HTTP ${res.status}` };
    }

    // Ollama returns a list of models at /api/tags
    if (provider === 'ollama') {
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const models = data.models?.map((m) => m.name) ?? [];
      return { available: true, host, provider, models };
    }

    // LM Studio and llama.cpp just need a 200 response
    return { available: true, host, provider };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { available: false, host, provider, error: message };
  }
}

/** Returns the correct health-check endpoint for each local provider. */
function getHealthCheckUrl(provider: LocalProvider, host: string): string {
  const base = host.replace(/\/$/, '');
  switch (provider) {
    case 'ollama':
      return `${base}/api/tags`;
    case 'lmstudio':
      return `${base}/v1/models`;
    case 'llamacpp':
      return `${base}/v1/models`;
  }
}

/**
 * Retrieve the custom agent command template, or undefined if not configured.
 * The template may contain `{{PROMPT_FILE}}` which callers should replace
 * with a path to a temporary file containing the handoff prompt.
 */
export function getCustomAgentCommandTemplate(): string | undefined {
  const cfg = vscode.workspace.getConfiguration('openkode');
  const template = cfg.get<string>('customAgent.commandTemplate') ?? '';
  return template.trim() || undefined;
}

/**
 * Retrieve the display name for the custom agent.
 */
export function getCustomAgentName(): string {
  const cfg = vscode.workspace.getConfiguration('openkode');
  return cfg.get<string>('customAgent.name') ?? 'Custom Agent';
}

/**
 * Save a model profile for a specific workflow mode to VS Code global settings.
 *
 * @param workflowMode  One of "Precision", "Blueprint", "Visionary", "Rocket".
 * @param profile       The profile to persist.
 */
export async function saveModelProfile(
  workflowMode: string,
  profile: { mode: LlmProviderMode; model: string; localProvider?: string },
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('openkode');
  const current =
    cfg.get<Record<string, { mode: string; model: string }>>('modelProfiles') ?? {};
  await cfg.update(
    'modelProfiles',
    { ...current, [workflowMode]: profile },
    vscode.ConfigurationTarget.Global,
  );
}

// ─── Config change listener ──────────────────────────────────────────────────

/**
 * Register a callback that fires whenever any `openkode.*` setting changes.
 * Returns a disposable to unregister the listener.
 *
 * @param callback  Called with the updated LlmConfig whenever settings change.
 */
export function onConfigChange(
  callback: (config: LlmConfig) => void,
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('openkode')) {
      const config = await getLlmConfig();
      // When the user switches to local mode, try to discover a running server.
      if (config.mode === 'local') {
        autoDiscoverLocalServer().catch(() => {/* non-fatal */});
      }
      callback(config);
    }
  });
}

// ─── Auto-discovery ──────────────────────────────────────────────────────────

/** GlobalState key used to suppress the "first discovery" info message. */
const AUTO_DISCOVERED_KEY = 'openkode.autoDiscovered';

/** Extension context reference — injected by initSettings for globalState access. */
let _context: vscode.ExtensionContext | undefined;

/**
 * Store the extension context so autoDiscoverLocalServer() can read/write
 * globalState. Call this from activate() alongside initSettings().
 */
export function initContext(ctx: vscode.ExtensionContext): void {
  _context = ctx;
}

type DiscoveryCandidate = {
  provider: 'ollama' | 'lmstudio' | 'llamacpp';
  host: string;
  path: string;
  settingKey: string;
};

/**
 * Full auto-discovery for local LLM servers.
 *
 * Scans all common provider ports in parallel using a short (800 ms) timeout,
 * then auto-sets the `openkode.local.*Host` VS Code setting for the **first**
 * server that responds. Emits a one-time informational notification on first
 * discovery.
 *
 * Only runs when `openkode.llmProvider` is `"local"` — no-ops in cloud/relay
 * modes to keep things fast and unintrusive.
 *
 * @returns The discovered host URL (e.g. `"http://localhost:11434"`), or `null`
 *          if no server was found or the current mode is not `"local"`.
 */
export async function autoDiscoverLocalServer(): Promise<string | null> {
  const cfg = vscode.workspace.getConfiguration('openkode');
  const mode = cfg.get<string>('llmProvider') ?? 'local';
  if (mode !== 'local') return null;

  const candidates: DiscoveryCandidate[] = [
    { provider: 'ollama',   host: 'http://localhost:11434', path: '/api/tags',   settingKey: 'local.ollamaHost' },
    { provider: 'lmstudio', host: 'http://localhost:1234',  path: '/v1/models',  settingKey: 'local.lmstudioHost' },
    { provider: 'llamacpp', host: 'http://localhost:8080',  path: '/v1/models',  settingKey: 'local.llamacppHost' },
  ];

  // Probe all candidates simultaneously; resolve as soon as one replies.
  const probes = candidates.map(async (c) => {
    const url = `${c.host}${c.path}`;
    await axios.get(url, {
      timeout: 800,
      // Treat any 2xx as success — we just need the server to be alive.
      validateStatus: (s) => s >= 200 && s < 300,
    });
    return c; // propagate candidate on success
  });

  const results = await Promise.allSettled(probes);

  const winner = results.find(
    (r): r is PromiseFulfilledResult<DiscoveryCandidate> => r.status === 'fulfilled',
  );
  if (!winner) return null;

  const found = winner.value;

  // Persist the discovered host if it differs from the current setting.
  const current = cfg.get<string>(found.settingKey) ?? '';
  if (current !== found.host) {
    await cfg.update(found.settingKey, found.host, vscode.ConfigurationTarget.Global);
  }

  // Auto-select this provider so the router uses it immediately.
  await cfg.update('local.provider', found.provider, vscode.ConfigurationTarget.Global);

  // One-time notification — never shown again after first discovery.
  const alreadyNotified = _context?.globalState.get<boolean>(AUTO_DISCOVERED_KEY);
  if (!alreadyNotified) {
    await _context?.globalState.update(AUTO_DISCOVERED_KEY, true);
    vscode.window.showInformationMessage(
      `OpenKode: Auto-discovered ${found.provider} at ${found.host}. ` +
      'Local LLM is ready — zero cloud, zero data leakage.',
      'View Model Profiles',
    ).then((action) => {
      if (action === 'View Model Profiles') {
        vscode.commands.executeCommand('openkode.showModelProfiles');
      }
    });
  }

  return found.host;
}
