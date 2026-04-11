/**
 * Agent Handoff Commands — VS Code command implementations.
 *
 * Each command:
 *  1. Gathers context from the active editor + OpenKode state
 *  2. Calls AgentHandoffEngine.generateHandoffPrompt()
 *  3. Copies the prompt to the clipboard
 *  4. Shows a notification with a "Show Prompt" action
 *
 * These are registered in extension.ts via registerHandoffCommands().
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { agentHandoffEngine, type TargetAgent, type HandoffContext } from './handoff-engine';
import { llmRouter } from '../core/llm-router';
import type { WorkflowModeName } from '../core/model-profiles';

// ─── Context gathering ────────────────────────────────────────────────────────

/**
 * Build a HandoffContext from the current VS Code editor state and
 * (optionally) provided task text.
 *
 * @param workflowMode    The workflow mode to tag in the prompt.
 * @param overrideTask    When provided, used as the task instead of prompting.
 */
async function gatherContext(
  workflowMode: WorkflowModeName,
  overrideTask?: string,
): Promise<HandoffContext | undefined> {
  // ── Workspace root ─────────────────────────────────────────────────────
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri?.fsPath;

  // ── Active editor state ────────────────────────────────────────────────
  const editor = vscode.window.activeTextEditor;
  let currentFile: string | undefined;
  let selectedCode: string | undefined;

  if (editor) {
    const fullPath = editor.document.uri.fsPath;
    currentFile = workspaceRoot
      ? path.relative(workspaceRoot, fullPath)
      : fullPath;

    const selection = editor.selection;
    if (!selection.isEmpty) {
      selectedCode = editor.document.getText(selection);
    }
  }

  // ── Task ───────────────────────────────────────────────────────────────
  const task =
    overrideTask ??
    (await vscode.window.showInputBox({
      title: 'OpenKode: Describe the task for the agent',
      prompt: 'What should the agent implement? Be specific.',
      ignoreFocusOut: true,
      placeHolder: 'e.g. Add JWT refresh token rotation to the auth service',
    }));

  if (!task) return undefined; // user cancelled

  return { task, workflowMode, workspaceRoot, currentFile, selectedCode };
}

// ─── Shared handoff runner ────────────────────────────────────────────────────

/**
 * Generate a prompt for the given agent, copy it to the clipboard, and
 * show an informational notification with a "Show Prompt" action.
 */
async function runHandoff(
  agent: TargetAgent,
  workflowMode: WorkflowModeName,
  overrideTask?: string,
): Promise<void> {
  const ctx = await gatherContext(workflowMode, overrideTask);
  if (!ctx) return;

  let prompt: Awaited<ReturnType<typeof agentHandoffEngine.generateHandoffPrompt>>;
  try {
    prompt = await agentHandoffEngine.generateHandoffPrompt(ctx, agent);
  } catch (err) {
    vscode.window.showErrorMessage(
      `OpenKode: Handoff prompt generation failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  // Copy to clipboard
  await vscode.env.clipboard.writeText(prompt.content);

  // Notification with "Show Prompt" action
  const action = await vscode.window.showInformationMessage(
    `OpenKode: Handoff ready — ${prompt.summary}. Prompt copied to clipboard.`,
    'Show Prompt',
    'Dismiss',
  );

  if (action === 'Show Prompt') {
    await openPromptDocument(prompt.content, agent);
  }
}

/**
 * Open the generated prompt in a new read-only VS Code text document tab.
 * This lets the user inspect or edit the prompt before pasting.
 */
async function openPromptDocument(
  content: string,
  agent: TargetAgent,
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content,
    language: 'markdown',
  });
  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside,
  });
}

// ─── Active workflow mode resolution ─────────────────────────────────────────

/**
 * Infer the current workflow mode from the LlmRouter config.
 * Defaults to 'Precision' if no strong signal is available.
 */
function resolveActiveMode(): WorkflowModeName {
  const cfg = vscode.workspace.getConfiguration('openkode');
  // If the user has explicitly set llmProvider to "local" → Rocket feels natural,
  // but we can't know for certain without workflow state — use a configurable default.
  const provider = cfg.get<string>('llmProvider') ?? 'local';
  // Conservative default: Precision for cloud, Rocket for local
  return provider === 'local' ? 'Rocket' : 'Precision';
}

// ─── Command implementations ──────────────────────────────────────────────────

/**
 * "OpenKode: Handoff to Cursor"
 * Uses the active workflow mode resolved from current config.
 */
export async function handoffToCursor(): Promise<void> {
  await runHandoff('cursor', resolveActiveMode());
}

/**
 * "OpenKode: Handoff to Claude Code"
 */
export async function handoffToClaudeCode(): Promise<void> {
  await runHandoff('claude-code', resolveActiveMode());
}

/**
 * "OpenKode: Handoff to Windsurf"
 */
export async function handoffToWindsurf(): Promise<void> {
  await runHandoff('windsurf', resolveActiveMode());
}

/**
 * "OpenKode: Handoff to Custom Agent"
 * Prompts the user to pick their agent (or uses the configured custom agent name).
 */
export async function handoffToCustomAgent(): Promise<void> {
  await runHandoff('custom', resolveActiveMode());
}

/**
 * "OpenKode: Test Agent Handoff (Rocket → Cursor)"
 * Generates a test prompt with a fixed task and opens it in a new tab.
 * Useful for verifying the handoff engine is working without touching clipboard.
 */
export async function testAgentHandoff(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  const testCtx: HandoffContext = {
    task: 'Implement a simple health-check endpoint at GET /health that returns { status: "ok", timestamp: ISO-string }.',
    workflowMode: 'Rocket',
    workspaceRoot,
    activePhase: 'Phase 1 — Core API',
    acceptanceCriteria: [
      'Endpoint returns HTTP 200',
      'Response body matches the schema',
      'No new dependencies introduced',
    ],
  };

  const prompt = await agentHandoffEngine.generateHandoffPrompt(testCtx, 'cursor');
  await openPromptDocument(prompt.content, 'cursor');

  vscode.window.showInformationMessage(
    `OpenKode: Test handoff prompt opened — ${prompt.summary}`,
  );
}

// ─── Registration helper ──────────────────────────────────────────────────────

/**
 * Register all 5 handoff commands with the VS Code extension context.
 * Call from `activate()`.
 *
 * @param context  VS Code extension context.
 */
export function registerHandoffCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('openkode.handoffToCursor',     handoffToCursor),
    vscode.commands.registerCommand('openkode.handoffToClaudeCode', handoffToClaudeCode),
    vscode.commands.registerCommand('openkode.handoffToWindsurf',   handoffToWindsurf),
    vscode.commands.registerCommand('openkode.handoffToCustomAgent', handoffToCustomAgent),
    vscode.commands.registerCommand('openkode.testAgentHandoff',    testAgentHandoff),
  );
}
