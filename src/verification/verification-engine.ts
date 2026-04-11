/**
 * VerificationEngine — LLM-driven spec compliance checker.
 *
 * This is the outer-loop "Verify" phase of OpenKode's Plan → Execute → Verify
 * cycle. It uses the active llmRouter to review workspace changes against the
 * original PRD and tactical plan, producing structured, actionable feedback.
 *
 * Architecture note: This class deliberately does NOT replace the existing
 * `Verifier` class in verifier.ts (which handles static analysis, security
 * scans, and test runs). Instead, it adds the LLM *intent* review layer that
 * understands *why* code was written and whether it matches the spec.
 *
 * Usage:
 *   import { verificationEngine } from './verification-engine';
 *   const result = await verificationEngine.runVerification({ activePhase: 'Phase 1' });
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { llmRouter } from '../core/llm-router';
import type { LlmRequest } from '../core/types';
import {
  parseLlmVerificationResponse,
  computeVerificationScore,
  type LlmVerificationResult,
  type LlmVerificationIssue,
  type VerificationContext,
} from './engine-types';

export type { LlmVerificationResult, LlmVerificationIssue, VerificationContext };

// ─── Constants ────────────────────────────────────────────────────────────────

const VERIFIER_SYSTEM_PROMPT = `You are the OpenKode Verifier — a senior engineer reviewing an implementation against its original specification.

Your job:
1. Review the provided diff/changes against the spec and phase plan.
2. Identify deviations, missing requirements, and quality issues.
3. Also recognise things done particularly well.

Respond with a JSON object (inside a \`\`\`json fence) with this exact schema:
{
  "summary": "<1-3 sentence executive summary>",
  "score": <0-100 integer>,
  "issues": [
    {
      "severity": "Critical" | "Warning" | "Info" | "Praise",
      "file": "<workspace-relative path or 'general'>",
      "line": <number or null>,
      "message": "<clear, actionable description>",
      "suggestion": "<optional remediation>"
    }
  ]
}

Severity guide:
- Critical: Spec/plan deviation, missing required feature, security issue, breaking contract
- Warning:  Potential problem, partial implementation, missing test, code smell
- Info:     Neutral observation, style note, minor suggestion
- Praise:   Something done particularly well — name it specifically

Be a senior engineer: direct, specific, no fluff. If the implementation is solid, say so.
Score 90–100 = excellent, 70–89 = good, 50–69 = needs work, <50 = critical issues.`;

const MAX_DIFF_CHARS = 12_000;  // Keep prompt within context limits
const MAX_SPEC_CHARS = 4_000;

// ─── Diff capture ─────────────────────────────────────────────────────────────

/**
 * Attempt to capture the current workspace diff via the VS Code git extension API.
 * Falls back to a workspace file snapshot summary if git is not available.
 */
async function captureWorkspaceDiff(workspaceRoot?: string): Promise<string> {
  // Try VS Code git API
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension) {
      const git = gitExtension.isActive
        ? gitExtension.exports
        : await gitExtension.activate();

      const api = git.getAPI(1);
      const repos = api.repositories;

      if (repos.length > 0) {
        const repo = repos[0];
        // Get staged + unstaged changes
        const changes = [
          ...repo.state.workingTreeChanges,
          ...repo.state.indexChanges,
        ];

        if (changes.length === 0) {
          return '(no changes detected in git working tree)';
        }

        const lines: string[] = [
          `Git changes: ${changes.length} file(s) modified`,
          '',
        ];

        for (const change of changes.slice(0, 20)) {
          const rel = workspaceRoot
            ? path.relative(workspaceRoot, change.uri.fsPath)
            : change.uri.fsPath;
          lines.push(`  ${change.status} ${rel}`);
        }

        if (changes.length > 20) {
          lines.push(`  ... and ${changes.length - 20} more`);
        }

        return lines.join('\n');
      }
    }
  } catch {
    // Git API unavailable — fall through to file snapshot
  }

  // Fallback: list recently modified workspace files
  if (!workspaceRoot) {
    return '(no workspace open — provide diff explicitly)';
  }

  try {
    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx,py,rs,go,java,cs,rb,php}',
      '**/node_modules/**',
      50,
    );
    const lines = ['Recently tracked workspace files (git unavailable):'];
    for (const f of files.slice(0, 30)) {
      lines.push(`  ${path.relative(workspaceRoot, f.fsPath)}`);
    }
    return lines.join('\n');
  } catch {
    return '(could not enumerate workspace files)';
  }
}

/**
 * Truncate a string to a maximum character count, appending an ellipsis note.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n[... truncated to ${max} chars for context window ...]`;
}

// ─── VerificationEngine ───────────────────────────────────────────────────────

/**
 * Singleton LLM-driven verification engine.
 *
 * The engine:
 *  1. Captures (or accepts) a diff/change summary
 *  2. Builds a structured prompt including spec + plan context
 *  3. Calls llmRouter.execute() with the built-in Verifier system prompt
 *  4. Parses the JSON response into a typed LlmVerificationResult
 *  5. Fires onResultReady for subscribers (e.g. the report panel)
 */
export class VerificationEngine {
  private static _instance: VerificationEngine | undefined;

  /** Most recent verification result — retained for the report panel to display. */
  private _lastResult: LlmVerificationResult | undefined;

  /** Whether a verification is currently in progress. */
  private _running = false;

  /** Event fired whenever a new result is ready. */
  private readonly _onResultReady = new vscode.EventEmitter<LlmVerificationResult>();
  readonly onResultReady: vscode.Event<LlmVerificationResult> = this._onResultReady.event;

  private constructor() {}

  /** Get or create the singleton instance. */
  static getInstance(): VerificationEngine {
    if (!VerificationEngine._instance) {
      VerificationEngine._instance = new VerificationEngine();
    }
    return VerificationEngine._instance;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run a full LLM-powered verification pass.
   *
   * Automatically captures the workspace diff if not provided in `ctx`.
   * Respects the current llmRouter profile (local, cloud, relay).
   *
   * @param ctx  Optional context; omit for a fully automatic run.
   */
  async runVerification(ctx: VerificationContext = {}): Promise<LlmVerificationResult> {
    if (this._running) {
      throw new Error('A verification is already in progress.');
    }
    this._running = true;

    const start = Date.now();
    const profileLabel = llmRouter.getActiveProfileName();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

    try {
      // 1. Capture diff
      const diff = ctx.diff ?? (await captureWorkspaceDiff(workspaceRoot));
      const diffDisplay = truncate(diff, MAX_DIFF_CHARS);

      // 2. Build context-rich user prompt
      const userPrompt = this._buildUserPrompt(diffDisplay, ctx);
      const contextSummary = ctx.activePhase
        ? `Phase: ${ctx.activePhase} | ${diff.split('\n').length} diff lines`
        : `${diff.split('\n').length} diff lines`;

      // 3. Call LLM via router
      const systemPrompt = ctx.systemPromptOverride ?? VERIFIER_SYSTEM_PROMPT;

      const request: LlmRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.2,  // Low temp → deterministic, analytical
        maxTokens: 2000,
      };

      const response = await llmRouter.execute(request);

      // 4. Parse response
      const durationMs = Date.now() - start;
      const result = parseLlmVerificationResponse(
        response.content,
        profileLabel,
        durationMs,
        contextSummary,
      );

      // 5. Store + notify
      this._lastResult = result;
      this._onResultReady.fire(result);

      return result;
    } finally {
      this._running = false;
    }
  }

  /**
   * Return the most recent verification result, or `undefined` if none has run yet.
   */
  getLastResult(): LlmVerificationResult | undefined {
    return this._lastResult;
  }

  /**
   * Whether a verification is currently running.
   */
  isRunning(): boolean {
    return this._running;
  }

  /**
   * Generate inline comment annotations from a set of issues.
   * Returns a map of workspace-relative file path → list of diagnostic messages.
   *
   * These can be applied as VS Code `Diagnostic` entries to light up the Problems panel.
   */
  generateVibeCheckComments(
    issues: LlmVerificationIssue[],
  ): Map<string, vscode.Diagnostic[]> {
    const diagnostics = new Map<string, vscode.Diagnostic[]>();

    const severityMap: Record<string, vscode.DiagnosticSeverity> = {
      Critical: vscode.DiagnosticSeverity.Error,
      Warning:  vscode.DiagnosticSeverity.Warning,
      Info:     vscode.DiagnosticSeverity.Information,
      Praise:   vscode.DiagnosticSeverity.Hint,
    };

    for (const issue of issues) {
      if (issue.file === 'general') continue; // No file to anchor to

      const line = Math.max(0, (issue.line ?? 1) - 1); // Convert to 0-based
      const range = new vscode.Range(line, 0, line, 999);
      const message = issue.suggestion
        ? `${issue.message}\n💡 ${issue.suggestion}`
        : issue.message;

      const diagnostic = new vscode.Diagnostic(
        range,
        `[OpenKode] ${message}`,
        severityMap[issue.severity] ?? vscode.DiagnosticSeverity.Information,
      );
      diagnostic.source = 'OpenKode Verifier';

      const existing = diagnostics.get(issue.file) ?? [];
      existing.push(diagnostic);
      diagnostics.set(issue.file, existing);
    }

    return diagnostics;
  }

  /**
   * Apply verification diagnostics to the VS Code Problems panel.
   *
   * @param result        The verification result to apply.
   * @param collection    A DiagnosticCollection owned by the extension.
   * @param workspaceRoot Absolute path to the workspace root.
   */
  applyDiagnostics(
    result: LlmVerificationResult,
    collection: vscode.DiagnosticCollection,
    workspaceRoot: string,
  ): void {
    collection.clear();

    const byFile = this.generateVibeCheckComments(result.issues);
    for (const [relPath, diags] of byFile) {
      const absPath = path.isAbsolute(relPath)
        ? relPath
        : path.join(workspaceRoot, relPath);
      const uri = vscode.Uri.file(absPath);
      collection.set(uri, diags);
    }
  }

  /** Dispose the event emitter. */
  dispose(): void {
    this._onResultReady.dispose();
    VerificationEngine._instance = undefined;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _buildUserPrompt(diff: string, ctx: VerificationContext): string {
    const parts: string[] = [];

    if (ctx.activePhase) {
      parts.push(`## Active Phase\n${ctx.activePhase}`);
    }

    if (ctx.specMarkdown) {
      parts.push(`## Original Spec / PRD\n${truncate(ctx.specMarkdown, MAX_SPEC_CHARS)}`);
    }

    if (ctx.planMarkdown) {
      parts.push(`## Tactical Plan\n${truncate(ctx.planMarkdown, MAX_SPEC_CHARS)}`);
    }

    parts.push(`## Changes to Review\n\`\`\`diff\n${diff}\n\`\`\``);

    parts.push(
      '## Your Task\n' +
      'Review the changes above against the spec and plan. ' +
      'Return structured JSON as instructed. Be specific — reference file names and line numbers where possible.',
    );

    return parts.join('\n\n');
  }
}

/** Convenience singleton reference. Import this in all modules. */
export const verificationEngine = VerificationEngine.getInstance();
