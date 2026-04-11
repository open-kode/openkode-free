/**
 * Verification Report Panel — TreeView UI.
 *
 * Displays the most recent LlmVerificationResult in the OpenKode sidebar.
 * Structure:
 *
 *   ⬤ Score: 82/100 — 2 Warnings, 0 Critical
 *   ▶ Critical  (0)
 *   ▼ Warning   (2)
 *       ⚠ src/auth.ts:42 — Missing input validation on email field
 *   ▼ Info      (3)
 *       ℹ general — Consider extracting shared types
 *   ▼ Praise    (1)
 *       ✓ src/routes/health.ts — Clean, idiomatic error handling
 *
 * Auto-refreshes via VerificationEngine.onResultReady.
 */
import * as vscode from 'vscode';
import { verificationEngine, type LlmVerificationResult, type LlmVerificationIssue } from './verification-engine';
import type { LlmIssueSeverity } from './engine-types';

// ─── Tree item types ──────────────────────────────────────────────────────────

type NodeKind = 'summary' | 'severity-group' | 'issue' | 'empty-state';

export class VerificationTreeItem extends vscode.TreeItem {
  constructor(
    public readonly kind: NodeKind,
    label: string,
    public readonly severity?: LlmIssueSeverity,
    public readonly issue?: LlmVerificationIssue,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
  }
}

// ─── Icon / colour helpers ────────────────────────────────────────────────────

function severityIcon(severity: LlmIssueSeverity): string {
  switch (severity) {
    case 'Critical': return 'error';
    case 'Warning':  return 'warning';
    case 'Info':     return 'info';
    case 'Praise':   return 'pass';
  }
}

function severityColor(severity: LlmIssueSeverity): vscode.ThemeColor {
  switch (severity) {
    case 'Critical': return new vscode.ThemeColor('testing.iconFailed');
    case 'Warning':  return new vscode.ThemeColor('editorWarning.foreground');
    case 'Info':     return new vscode.ThemeColor('editorInfo.foreground');
    case 'Praise':   return new vscode.ThemeColor('testing.iconPassed');
  }
}

function scoreColor(score: number): vscode.ThemeColor {
  if (score >= 85) return new vscode.ThemeColor('testing.iconPassed');
  if (score >= 65) return new vscode.ThemeColor('editorWarning.foreground');
  return new vscode.ThemeColor('testing.iconFailed');
}

const SEVERITY_ORDER: LlmIssueSeverity[] = ['Critical', 'Warning', 'Info', 'Praise'];

// ─── TreeDataProvider ─────────────────────────────────────────────────────────

export class VerificationReportProvider
  implements vscode.TreeDataProvider<VerificationTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    VerificationTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _result: LlmVerificationResult | undefined;
  private _resultListener: vscode.Disposable;

  constructor() {
    // Auto-refresh when a new result arrives
    this._resultListener = verificationEngine.onResultReady((result) => {
      this._result = result;
      this._onDidChangeTreeData.fire();
    });

    // Pick up any result that arrived before the panel was created
    this._result = verificationEngine.getLastResult();
  }

  refresh(): void {
    this._result = verificationEngine.getLastResult();
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._resultListener.dispose();
    this._onDidChangeTreeData.dispose();
  }

  // ── TreeDataProvider implementation ─────────────────────────────────────────

  getTreeItem(element: VerificationTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: VerificationTreeItem): VerificationTreeItem[] {
    if (!element) {
      return this._buildRoot();
    }

    if (element.kind === 'severity-group' && element.severity && this._result) {
      return this._buildIssueChildren(element.severity, this._result.issues);
    }

    return [];
  }

  // ── Private builders ─────────────────────────────────────────────────────────

  private _buildRoot(): VerificationTreeItem[] {
    if (!this._result) {
      const item = new VerificationTreeItem('empty-state', 'No verification run yet');
      item.description = 'Run "OpenKode: Run Verification" to start';
      item.iconPath = new vscode.ThemeIcon('circle-slash');
      return [item];
    }

    const items: VerificationTreeItem[] = [];

    // ── Summary row ────────────────────────────────────────────────────────
    const criticals = this._result.issues.filter((i) => i.severity === 'Critical').length;
    const warnings  = this._result.issues.filter((i) => i.severity === 'Warning').length;

    const summaryLabel = `Score: ${this._result.score}/100`;
    const summaryItem = new VerificationTreeItem('summary', summaryLabel);
    summaryItem.description = this._result.summary;
    summaryItem.tooltip = new vscode.MarkdownString(
      `**Verification Result**\n\n` +
      `Score: **${this._result.score}/100**\n\n` +
      `Profile: \`${this._result.profileLabel}\`\n\n` +
      `Context: ${this._result.contextSummary}\n\n` +
      `Run at: ${new Date(this._result.timestamp).toLocaleTimeString()}\n\n` +
      `Duration: ${this._result.durationMs}ms`,
    );
    summaryItem.iconPath = new vscode.ThemeIcon(
      this._result.score >= 85 ? 'pass-filled' : this._result.score >= 65 ? 'warning' : 'error',
      scoreColor(this._result.score),
    );
    summaryItem.contextValue = 'verificationSummary';
    items.push(summaryItem);

    // ── Severity group rows ────────────────────────────────────────────────
    for (const sev of SEVERITY_ORDER) {
      const sevIssues = this._result.issues.filter((i) => i.severity === sev);
      const groupItem = new VerificationTreeItem(
        'severity-group',
        `${sev}  (${sevIssues.length})`,
        sev,
        undefined,
        sevIssues.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      );
      groupItem.iconPath = new vscode.ThemeIcon(severityIcon(sev), severityColor(sev));
      groupItem.description = sevIssues.length === 0 ? 'none' : undefined;

      // Auto-expand Critical group if issues exist
      if (sev === 'Critical' && sevIssues.length > 0) {
        groupItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }

      groupItem.contextValue = `verificationGroup_${sev.toLowerCase()}`;
      items.push(groupItem);
    }

    return items;
  }

  private _buildIssueChildren(
    severity: LlmIssueSeverity,
    allIssues: LlmVerificationIssue[],
  ): VerificationTreeItem[] {
    const issues = allIssues.filter((i) => i.severity === severity);

    if (issues.length === 0) {
      const empty = new VerificationTreeItem('empty-state', 'No issues');
      empty.iconPath = new vscode.ThemeIcon('check');
      return [empty];
    }

    return issues.map((issue) => {
      const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      const item = new VerificationTreeItem('issue', issue.message, severity, issue);
      item.description = location;
      item.tooltip = new vscode.MarkdownString(
        `**${severity}** — \`${location}\`\n\n${issue.message}` +
        (issue.suggestion ? `\n\n💡 **Suggestion:** ${issue.suggestion}` : ''),
      );
      item.iconPath = new vscode.ThemeIcon(severityIcon(severity), severityColor(severity));
      item.contextValue = 'verificationIssue';

      // If we have a file + line, make the item clickable to navigate there
      if (issue.file !== 'general') {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (workspaceRoot) {
          const absPath = require('path').isAbsolute(issue.file)
            ? issue.file
            : require('path').join(workspaceRoot, issue.file);
          item.command = {
            command: 'vscode.open',
            title: 'Go to file',
            arguments: [
              vscode.Uri.file(absPath),
              issue.line
                ? { selection: new vscode.Range(issue.line - 1, 0, issue.line - 1, 0) }
                : undefined,
            ],
          };
        }
      }

      return item;
    });
  }
}

// ─── Panel registration ───────────────────────────────────────────────────────

let _provider: VerificationReportProvider | undefined;

/**
 * Register the Verification Report tree view.
 * Must be called once from `activate()`.
 *
 * @param context  VS Code extension context.
 */
export function registerVerificationPanel(context: vscode.ExtensionContext): void {
  _provider = new VerificationReportProvider();

  const treeView = vscode.window.createTreeView('openkode.verificationTree', {
    treeDataProvider: _provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView, _provider);

  // "Show Verification Report" → focus / expand the tree
  context.subscriptions.push(
    vscode.commands.registerCommand('openkode.showVerificationReport', () => {
      _provider?.refresh();
      treeView.reveal(_provider?.getChildren()[0] as VerificationTreeItem, {
        focus: true,
        expand: 2,
      });
    }),
  );
}

/** Force an external refresh of the panel (e.g. from commands.ts). */
export function refreshVerificationPanel(): void {
  _provider?.refresh();
}
