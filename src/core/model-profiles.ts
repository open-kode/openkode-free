/**
 * Model Profiles — the "Cloud on Local" differentiator.
 *
 * Each of the four OpenKode workflow modes has a recommended LLM profile
 * (provider mode + model name). Profiles can be viewed and swapped via the
 * Model Profiles panel without touching raw VS Code settings.
 *
 * Design rationale:
 *  - Precision / Visionary → cloud (claude-3.7-sonnet) — reasoning-heavy tasks
 *  - Blueprint / Rocket    → local (qwen2.5-coder:32b) — fast, cheap, private
 */
import * as vscode from 'vscode';
import type { LlmProviderMode } from './types';
import { llmRouter } from './llm-router';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A named LLM profile linked to a single workflow mode. */
export interface ModelProfile {
  /** Target provider mode. */
  mode: LlmProviderMode;
  /** Model identifier as accepted by the target server / API. */
  model: string;
  /** For `local` mode: which inference server to use. Defaults to "ollama". */
  localProvider?: 'ollama' | 'lmstudio' | 'llamacpp';
}

/** Workflow mode names used as profile keys. */
export type WorkflowModeName = 'Precision' | 'Blueprint' | 'Visionary' | 'Rocket';

/** Map of all four workflow modes to their active profiles. */
export type ModelProfileMap = Record<WorkflowModeName, ModelProfile>;

// ─── Built-in recommended defaults ───────────────────────────────────────────

/**
 * Recommended out-of-the-box profiles for each workflow mode.
 * These reflect the "Cloud on Local" philosophy:
 *  - Heavy reasoning tasks → cloud (claude-3.7-sonnet)
 *  - Fast iteration / automation → local (qwen2.5-coder:32b)
 */
export const RECOMMENDED_PROFILES: ModelProfileMap = {
  Precision: { mode: 'cloud-key',  model: 'claude-3.7-sonnet' },
  Blueprint: { mode: 'local',      model: 'qwen2.5-coder:32b', localProvider: 'ollama' },
  Visionary: { mode: 'cloud-key',  model: 'claude-3.7-sonnet' },
  Rocket:    { mode: 'local',      model: 'qwen2.5-coder:32b', localProvider: 'ollama' },
};

/** Codicon icon names per provider mode — used in the TreeView. */
export const MODE_ICONS: Record<LlmProviderMode, string> = {
  'local':           'cpu',
  'cloud-key':       'cloud',
  'openkode-relay':  'globe',
};

/** Codicon icon names per workflow mode. */
export const WORKFLOW_ICONS: Record<WorkflowModeName, string> = {
  Precision: 'target',
  Blueprint: 'layout',
  Visionary: 'telescope',
  Rocket:    'rocket',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return the current persisted profile for a workflow mode.
 * Falls back to the built-in recommended profile if not explicitly saved.
 *
 * @param workflowMode  One of "Precision", "Blueprint", "Visionary", "Rocket".
 */
export function getRecommendedProfile(workflowMode: WorkflowModeName): ModelProfile {
  const cfg = vscode.workspace.getConfiguration('openkode');
  const profiles = cfg.get<Partial<ModelProfileMap>>('modelProfiles') ?? {};
  return profiles[workflowMode] ?? RECOMMENDED_PROFILES[workflowMode];
}

/**
 * Return all four current profiles as a map.
 */
export function getAllProfiles(): ModelProfileMap {
  return {
    Precision: getRecommendedProfile('Precision'),
    Blueprint: getRecommendedProfile('Blueprint'),
    Visionary: getRecommendedProfile('Visionary'),
    Rocket:    getRecommendedProfile('Rocket'),
  };
}

/**
 * Apply a model profile for a given workflow mode.
 *
 * This:
 *  1. Persists the profile to VS Code global settings under `openkode.modelProfiles`.
 *  2. Updates the top-level `openkode.llmProvider` and `openkode.local.*` / `openkode.cloud.*`
 *     settings to instantly reflect the profile.
 *  3. Calls `llmRouter.refresh()` so the status bar and internal state update immediately.
 *
 * @param workflowMode  The workflow mode to configure.
 * @param profile       The profile to apply.
 */
export async function applyProfile(
  workflowMode: WorkflowModeName,
  profile: ModelProfile,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('openkode');
  const target = vscode.ConfigurationTarget.Global;

  // 1. Persist to modelProfiles map
  const current = cfg.get<Partial<ModelProfileMap>>('modelProfiles') ?? {};
  await cfg.update('modelProfiles', { ...current, [workflowMode]: profile }, target);

  // 2. Apply as the active global provider so llmRouter picks it up
  await cfg.update('llmProvider', profile.mode, target);

  if (profile.mode === 'local') {
    await cfg.update('local.provider', profile.localProvider ?? 'ollama', target);
    await cfg.update('local.model', profile.model, target);
  } else if (profile.mode === 'cloud-key') {
    await cfg.update('cloud.model', profile.model, target);
  }

  // 3. Force an immediate router refresh
  await llmRouter.refresh();
}

/**
 * Convenience: apply a profile by prompting the user to pick a model.
 * Presents a QuickPick with sensible presets for the given workflow mode.
 *
 * @param workflowMode  The workflow mode whose profile is being changed.
 */
export async function promptAndApplyProfile(workflowMode: WorkflowModeName): Promise<void> {
  const current = getRecommendedProfile(workflowMode);

  type QuickPickProviderItem = vscode.QuickPickItem & { value: LlmProviderMode };
  const providerPick = await vscode.window.showQuickPick<QuickPickProviderItem>(
    [
      {
        label: '$(cpu) Local',
        description: 'Ollama / LM Studio / llama.cpp — zero data leakage',
        value: 'local',
        picked: current.mode === 'local',
      },
      {
        label: '$(cloud) Cloud Key',
        description: 'Your own API key (OpenAI / Anthropic / Gemini)',
        value: 'cloud-key',
        picked: current.mode === 'cloud-key',
      },
      {
        label: '$(globe) OpenKode Relay',
        description: 'Managed plan (Pro/Team)',
        value: 'openkode-relay',
        picked: current.mode === 'openkode-relay',
      },
    ],
    {
      title: `${workflowMode} Mode — Choose Provider`,
      placeHolder: 'Pick the LLM provider for this workflow',
    },
  );
  if (!providerPick) return;

  // Model name input
  const presets: Record<LlmProviderMode, string> = {
    'local':          'qwen2.5-coder:32b',
    'cloud-key':      'claude-3.7-sonnet',
    'openkode-relay': '',
  };
  const modelInput = await vscode.window.showInputBox({
    title: `${workflowMode} Mode — Model Name`,
    value: current.mode === providerPick.value ? current.model : presets[providerPick.value],
    prompt: 'Enter the model name (e.g. qwen2.5-coder:32b, claude-3.7-sonnet, gpt-4o)',
    ignoreFocusOut: true,
  });
  if (modelInput === undefined) return;

  const profile: ModelProfile = {
    mode: providerPick.value,
    model: modelInput,
    ...(providerPick.value === 'local' ? { localProvider: 'ollama' } : {}),
  };

  await applyProfile(workflowMode, profile);

  vscode.window.showInformationMessage(
    `OpenKode: ${workflowMode} profile updated → ${providerPick.value === 'local' ? '$(cpu) Local' : '$(cloud) Cloud'} • ${modelInput}`,
  );
}
