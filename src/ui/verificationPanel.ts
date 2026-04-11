/**
 * Verification Panel - Verification Results Panel
 * 
 * Provides a webview for displaying verification results,
 * issue list with severity indicators, and diff view integration.
 */

import * as vscode from 'vscode';
import { MessageHandler, MessageType, WebviewMessage } from './messageHandler';
import { VerificationResult, VerificationIssue, IssueSeverity } from '../types';

export class VerificationPanel {
    public static readonly viewType = 'openkode.verificationPanel';
    private static currentPanel: VerificationPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private messageHandler: MessageHandler;
    private disposables: vscode.Disposable[] = [];
    private currentResults: VerificationResult | undefined;
    private issues: VerificationIssue[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.messageHandler = new MessageHandler(panel.webview);

        // Set initial HTML content
        this.updateView();

        // Listen for panel disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Handle messages from webview
        this.messageHandler.onMessage((message: WebviewMessage) => {
            this.handleWebviewMessage(message);
        });

        // Update content when panel becomes visible
        this.panel.onDidChangeViewState(
            () => {
                if (this.panel.visible) {
                    this.updateView();
                }
            },
            null,
            this.disposables
        );
    }

    /**
     * Show or create the verification panel
     */
    public static showResults(
        extensionUri: vscode.Uri, 
        results?: VerificationResult
    ): VerificationPanel {
        const column = vscode.ViewColumn.Beside;

        if (VerificationPanel.currentPanel) {
            VerificationPanel.currentPanel.panel.reveal(column);
            if (results) {
                VerificationPanel.currentPanel.setResults(results);
            }
            return VerificationPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            VerificationPanel.viewType,
            'Verification Results',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        VerificationPanel.currentPanel = new VerificationPanel(panel, extensionUri);
        if (results) {
            VerificationPanel.currentPanel.setResults(results);
        }
        return VerificationPanel.currentPanel;
    }

    /**
     * Set verification results to display
     */
    public setResults(results: VerificationResult): void {
        this.currentResults = results;
        this.issues = results.issues || [];
        this.updateView();
        this.messageHandler.postMessage({
            type: MessageType.VERIFICATION_RESULTS,
            payload: results
        });
    }

    /**
     * Add a single issue to the list
     */
    public addIssue(issue: VerificationIssue): void {
        this.issues.push(issue);
        if (this.currentResults) {
            this.currentResults.issues = this.issues;
            this.messageHandler.postMessage({
                type: MessageType.ISSUE_ADDED,
                payload: issue
            });
        }
    }

    /**
     * Highlight a specific issue
     */
    public highlightIssue(issueId: string): void {
        this.messageHandler.postMessage({
            type: MessageType.HIGHLIGHT_ISSUE,
            payload: { issueId }
        });

        // Also open the file at the issue location
        const issue = this.issues.find(i => i.id === issueId);
        if (issue && issue.filePath) {
            this.openFileAtLocation(issue.filePath, issue.line, issue.column);
        }
    }

    /**
     * Clear all results
     */
    public clear(): void {
        this.currentResults = undefined;
        this.issues = [];
        this.messageHandler.postMessage({
            type: MessageType.CLEAR_RESULTS
        });
    }

    /**
     * Update the webview content
     */
    public updateView(): void {
        this.panel.webview.html = this.getHtmlForWebview();
    }

    /**
     * Dispose of the panel and resources
     */
    public dispose(): void {
        VerificationPanel.currentPanel = undefined;
        this.panel.dispose();
        this.messageHandler.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Handle messages from the webview
     */
    private handleWebviewMessage(message: WebviewMessage): void {
        switch (message.type) {
            case MessageType.ISSUE_SELECTED:
                this.handleIssueSelected(message.payload);
                break;
            case MessageType.SHOW_DIFF:
                this.handleShowDiff(message.payload);
                break;
            case MessageType.APPLY_FIX:
                vscode.commands.executeCommand('openkode.applyFix', message.payload);
                break;
            case MessageType.IGNORE_ISSUE:
                this.handleIgnoreIssue(message.payload);
                break;
            case MessageType.FILTER_ISSUES:
                this.handleFilterIssues(message.payload);
                break;
            case MessageType.READY:
                // Webview is ready, send current results if available
                if (this.currentResults) {
                    this.messageHandler.postMessage({
                        type: MessageType.VERIFICATION_RESULTS,
                        payload: this.currentResults
                    });
                }
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    /**
     * Handle issue selection
     */
    private handleIssueSelected(payload: { issueId: string }): void {
        const issue = this.issues.find(i => i.id === payload.issueId);
        if (issue) {
            this.highlightIssue(issue.id);
        }
    }

    /**
     * Handle show diff request
     */
    private async handleShowDiff(payload: { issueId: string }): Promise<void> {
        const issue = this.issues.find(i => i.id === payload.issueId);
        if (issue && issue.filePath && issue.suggestedFix) {
            const uri = vscode.Uri.file(issue.filePath);
            
            // Create a temporary document with the suggested fix
            const tempUri = uri.with({ scheme: 'openkode-diff', query: issue.suggestedFix });
            
            await vscode.commands.executeCommand(
                'vscode.diff',
                uri,
                tempUri,
                `Original ↔ Fix: ${path.basename(issue.filePath)}`,
                { preview: true }
            );
        }
    }

    /**
     * Handle ignore issue request
     */
    private handleIgnoreIssue(payload: { issueId: string }): void {
        const index = this.issues.findIndex(i => i.id === payload.issueId);
        if (index >= 0) {
            this.issues.splice(index, 1);
            if (this.currentResults) {
                this.currentResults.issues = this.issues;
                this.messageHandler.postMessage({
                    type: MessageType.VERIFICATION_RESULTS,
                    payload: this.currentResults
                });
            }
        }
    }

    /**
     * Handle filter issues request
     */
    private handleFilterIssues(payload: { severity?: string; status?: string; searchQuery?: string }): void {
        let filteredIssues = this.issues;
        
        if (payload.severity) {
            filteredIssues = filteredIssues.filter(i => i.severity === payload.severity);
        }
        
        if (payload.searchQuery) {
            const query = payload.searchQuery.toLowerCase();
            filteredIssues = filteredIssues.filter(i => 
                i.message.toLowerCase().includes(query) ||
                (i.filePath && i.filePath.toLowerCase().includes(query))
            );
        }
        
        this.messageHandler.postMessage({
            type: MessageType.FILTERED_ISSUES,
            payload: { issues: filteredIssues }
        });
    }

    /**
     * Open a file at a specific location
     */
    private async openFileAtLocation(
        filePath: string, 
        line?: number, 
        column?: number
    ): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            if (line !== undefined) {
                const position = new vscode.Position(
                    line - 1, 
                    (column || 1) - 1
                );
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
        }
    }

    /**
     * Generate HTML for the webview
     */
    private getHtmlForWebview(): string {
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'verificationResults.js')
        );
        const styleUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'styles.css')
        );
        const codiconsUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );

        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${this.panel.webview.cspSource};">
    <title>Verification Results</title>
    <link rel="stylesheet" href="${styleUri}">
    <link rel="stylesheet" href="${codiconsUri}">
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Generate a nonce for CSP
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Get summary statistics
     */
    public getSummary(): { total: number; error: number; warning: number; info: number } {
        return {
            total: this.issues.length,
            error: this.issues.filter(i => i.severity === 'error').length,
            warning: this.issues.filter(i => i.severity === 'warning').length,
            info: this.issues.filter(i => i.severity === 'info').length
        };
    }
}

import * as path from 'path';

/**
 * Interface for verification panel options
 */
export interface VerificationPanelOptions {
    showDiffByDefault?: boolean;
    autoOpenFiles?: boolean;
    groupByFile?: boolean;
    groupBySeverity?: boolean;
}

/**
 * Verification panel state
 */
export interface VerificationPanelState {
    expandedIssues: string[];
    selectedIssue: string | null;
    filterSeverity: IssueSeverity | 'all';
    searchQuery: string;
}
