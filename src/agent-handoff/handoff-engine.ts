/**
 * AgentHandoffEngine — generates rich SDD-aware handoff prompts.
 *
 * This is the heart of Phase 3. Instead of giving an agent a naked task
 * description, it packages the full OpenKode SDD context:
 *   - Active workflow mode
 *   - LLM profile (provider + model)
 *   - Active workspace + selected code
 *   - Current spec / tactical plan (when available)
 *   - Agent-specific execution instructions
 *
 * All future handoff commands call generateHandoffPrompt() — nothing else.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { llmRouter } from '../core/llm-router';
import { getRecommendedProfile, type WorkflowModeName } from '../core/model-profiles';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Target agent identifier. */
export type TargetAgent = 'cursor' | 'claude-code' | 'windsurf' | 'custom';

/** Everything the engine needs to build a handoff prompt. */
export interface HandoffContext {
  /** The raw task or intent the user wants to execute. */
  task: string;
  /** OpenKode workflow mode being used. */
  workflowMode: WorkflowModeName;
  /** Absolute path to the workspace root, if available. */
  workspaceRoot?: string;
  /** Relative path to the currently active file, if any. */
  currentFile?: string;
  /** User-selected text in the active editor, if any. */
  selectedCode?: string;
  /** Rendered spec / tactical plan markdown, if available. */
  specMarkdown?: string;
  /** Active phase title, if available. */
  activePhase?: string;
  /** Acceptance criteria, if available. */
  acceptanceCriteria?: string[];
}

/** Result of prompt generation. */
export interface HandoffPrompt {
  /** Fully formatted markdown prompt ready to paste into the target agent. */
  content: string;
  /** A one-line summary suitable for a notification message. */
  summary: string;
  /** The target agent this prompt was built for. */
  agent: TargetAgent;
  /** Workflow mode context. */
  workflowMode: WorkflowModeName;
}

// ─── AgentHandoffEngine ───────────────────────────────────────────────────────

/**
 * Generates SDD-aware handoff prompts for external coding agents.
 *
 * Usage:
 *   const engine = AgentHandoffEngine.getInstance();
 *   const prompt = await engine.generateHandoffPrompt(ctx, 'cursor');
 */
export class AgentHandoffEngine {
  private static _instance: AgentHandoffEngine | undefined;

  private constructor() {}

  /** Get or create the singleton instance. */
  static getInstance(): AgentHandoffEngine {
    if (!AgentHandoffEngine._instance) {
      AgentHandoffEngine._instance = new AgentHandoffEngine();
    }
    return AgentHandoffEngine._instance;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Build a complete, SDD-enriched handoff prompt for the given agent.
   *
   * The prompt includes:
   *  1. SDD context header (mode, LLM profile, workspace)
   *  2. The task description
   *  3. Selected code / active file context (if present)
   *  4. Spec / tactical plan (if available)
   *  5. Agent-specific execution instructions
   *  6. Acceptance criteria (if available)
   *
   * @param ctx    Context gathered from the active editor + OpenKode state.
   * @param agent  The target agent that will receive this prompt.
   */
  async generateHandoffPrompt(
    ctx: HandoffContext,
    agent: TargetAgent,
  ): Promise<HandoffPrompt> {
    const routerConfig = llmRouter.getConfig();
    const profile = getRecommendedProfile(ctx.workflowMode);
    const profileLabel = llmRouter.getActiveProfileName();

    const sections: string[] = [];

    // ── 1. SDD context header ──────────────────────────────────────────────
    sections.push(this._buildHeader(ctx, profileLabel, routerConfig.mode));

    // ── 2. Task ────────────────────────────────────────────────────────────
    sections.push(this._buildTaskSection(ctx.task));

    // ── 3. Code context ────────────────────────────────────────────────────
    const codeSection = this._buildCodeContext(ctx);
    if (codeSection) sections.push(codeSection);

    // ── 4. Spec / tactical plan ────────────────────────────────────────────
    if (ctx.specMarkdown) {
      sections.push(this._buildSpecSection(ctx.specMarkdown, ctx.activePhase));
    }

    // ── 5. Acceptance criteria ─────────────────────────────────────────────
    if (ctx.acceptanceCriteria?.length) {
      sections.push(this._buildAcceptanceCriteria(ctx.acceptanceCriteria));
    }

    // ── 6. Agent-specific instructions ────────────────────────────────────
    sections.push(this._getAgentSpecificInstructions(agent, ctx.workflowMode, profile.model));

    const content = sections.join('\n\n');
    const modeLine = profile.mode === 'local' ? `Local • ${profile.model}` : `Cloud • ${profile.model}`;

    return {
      content,
      summary: `${ctx.workflowMode} → ${this._agentLabel(agent)} | ${modeLine}`,
      agent,
      workflowMode: ctx.workflowMode,
    };
  }

  /**
   * Return per-agent execution instructions.
   * These are injected at the end of every handoff prompt so the agent
   * knows exactly how OpenKode expects it to behave.
   *
   * @param agent         Target agent.
   * @param workflowMode  Active OpenKode workflow mode.
   * @param model         Model name being used.
   */
  getAgentSpecificInstructions(
    agent: TargetAgent,
    workflowMode: WorkflowModeName,
    model: string,
  ): string {
    return this._getAgentSpecificInstructions(agent, workflowMode, model);
  }

  // ─── Private builders ────────────────────────────────────────────────────────

  private _buildHeader(
    ctx: HandoffContext,
    profileLabel: string,
    providerMode: string,
  ): string {
    const workspaceDisplay = ctx.workspaceRoot
      ? path.basename(ctx.workspaceRoot)
      : 'unknown workspace';

    const lines = [
      '=== OpenKode SDD Context ===',
      `Mode:        ${ctx.workflowMode}`,
      `LLM:         ${profileLabel}`,
      `Provider:    ${providerMode}`,
      `Workspace:   ${workspaceDisplay}`,
    ];

    if (ctx.activePhase) {
      lines.push(`Active Phase: ${ctx.activePhase}`);
    }
    if (ctx.currentFile) {
      lines.push(`Active File:  ${ctx.currentFile}`);
    }

    lines.push('============================');
    return lines.join('\n');
  }

  private _buildTaskSection(task: string): string {
    return `## Task\n\n${task.trim()}`;
  }

  private _buildCodeContext(ctx: HandoffContext): string | undefined {
    const parts: string[] = [];

    if (ctx.currentFile && !ctx.selectedCode) {
      parts.push(`**File in focus:** \`${ctx.currentFile}\``);
    }

    if (ctx.selectedCode) {
      const lang = ctx.currentFile ? this._inferLanguage(ctx.currentFile) : '';
      parts.push(
        `**Selected code** from \`${ctx.currentFile ?? 'editor'}\`:`,
        '```' + lang,
        ctx.selectedCode.trim(),
        '```',
      );
    }

    return parts.length ? `## Code Context\n\n${parts.join('\n')}` : undefined;
  }

  private _buildSpecSection(specMarkdown: string, activePhase?: string): string {
    const header = activePhase
      ? `## Spec / Plan — Active Phase: ${activePhase}`
      : '## Spec / Plan';
    return `${header}\n\n${specMarkdown.trim()}`;
  }

  private _buildAcceptanceCriteria(criteria: string[]): string {
    const items = criteria.map((c) => `- [ ] ${c}`).join('\n');
    return `## Acceptance Criteria\n\n${items}`;
  }

  private _getAgentSpecificInstructions(
    agent: TargetAgent,
    workflowMode: WorkflowModeName,
    model: string,
  ): string {
    const base = this._baseInstructions(workflowMode);
    const agentBlock = this._agentBlock(agent, model);
    return `## Instructions for ${this._agentLabel(agent)}\n\n${base}\n\n${agentBlock}`;
  }

  private _baseInstructions(mode: WorkflowModeName): string {
    const modeInstructions: Record<WorkflowModeName, string> = {
      Precision:
        'This is a **Precision** task — make targeted, minimal changes. ' +
        'Do not refactor unrelated code. Confirm file scope before writing.',
      Blueprint:
        'This is a **Blueprint** task — implement the full phase as specified. ' +
        'Respect the file structure and interfaces defined in the spec above. ' +
        'Work phase-by-phase; do not skip ahead.',
      Visionary:
        'This is a **Visionary** task — follow the architecture defined in the spec. ' +
        'Preserve all interface contracts. Flag any deviation before implementing it.',
      Rocket:
        'This is a **Rocket** task — move fast. Implement all phases automatically. ' +
        'Use the spec as the contract. Minimise questions; proceed with best-guess if unambiguous.',
    };
    return modeInstructions[mode];
  }

  private _agentBlock(agent: TargetAgent, model: string): string {
    switch (agent) {
      case 'cursor':
        return (
          '**Cursor Composer** instructions:\n' +
          '1. Paste this prompt into Composer (Cmd/Ctrl+I).\n' +
          '2. Composer will see your open files — no need to re-attach them.\n' +
          '3. After Cursor finishes, return to OpenKode and run **Verify** to check the diff.\n' +
          `4. Recommended model in Cursor: \`${model}\` (matches your OpenKode profile).`
        );
      case 'claude-code':
        return (
          '**Claude Code** instructions:\n' +
          '1. Run `claude` in your terminal from the workspace root.\n' +
          '2. Paste this prompt at the `>` prompt.\n' +
          '3. Claude Code will read your files automatically.\n' +
          `4. Model: \`${model}\` (set via \`ANTHROPIC_MODEL\` env var if needed).\n` +
          '5. After completion, return to OpenKode and run **Verify**.'
        );
      case 'windsurf':
        return (
          '**Windsurf Cascade** instructions:\n' +
          '1. Open Cascade (Cmd/Ctrl+L) and paste this prompt.\n' +
          '2. Cascade has full repo access — it will find referenced files.\n' +
          `3. Model: \`${model}\`.\n` +
          '4. After completion, return to OpenKode and run **Verify**.'
        );
      case 'custom': {
        const cfg = vscode.workspace.getConfiguration('openkode');
        const name = cfg.get<string>('customAgent.name') ?? 'Custom Agent';
        const template = cfg.get<string>('customAgent.commandTemplate') ?? '';
        const templateNote = template
          ? `\nCommand template: \`${template}\``
          : '\n_Configure a command via **openkode.customAgent.commandTemplate** in Settings._';
        return (
          `**${name}** instructions:\n` +
          '1. Save the prompt to a file or pipe it directly to your agent.\n' +
          `2. Model: \`${model}\`.${templateNote}\n` +
          '3. After completion, return to OpenKode and run **Verify**.'
        );
      }
    }
  }

  private _agentLabel(agent: TargetAgent): string {
    const labels: Record<TargetAgent, string> = {
      cursor: 'Cursor',
      'claude-code': 'Claude Code',
      windsurf: 'Windsurf',
      custom: 'Custom Agent',
    };
    return labels[agent];
  }

  private _inferLanguage(filePath: string): string {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescriptreact',
      js: 'javascript', jsx: 'javascriptreact',
      py: 'python', rs: 'rust', go: 'go',
      java: 'java', cs: 'csharp', cpp: 'cpp',
      c: 'c', rb: 'ruby', php: 'php', swift: 'swift',
      kt: 'kotlin', sh: 'bash', json: 'json',
      yaml: 'yaml', yml: 'yaml', md: 'markdown',
      css: 'css', html: 'html', sql: 'sql',
    };
    return map[ext] ?? ext;
  }
}

/** Convenience singleton reference. */
export const agentHandoffEngine = AgentHandoffEngine.getInstance();
