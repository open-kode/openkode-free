/**
 * Plan Viewer - WebView Panel for Plan Visualization
 * 
 * Provides a React-based webview for displaying OpenKode specs,
 * phase tree visualization, and file change preview.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MessageHandler, MessageType, WebviewMessage } from './messageHandler';
import { SpecPlan, PlanPhase } from '../types';

export class PlanViewer {
    public static readonly viewType = 'openkode.planViewer';
    private static currentPanel: PlanViewer | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private messageHandler: MessageHandler;
    private disposables: vscode.Disposable[] = [];
    private currentPlan: SpecPlan | undefined;

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
     * Show or create the plan viewer panel
     */
    public static showPlan(extensionUri: vscode.Uri, plan?: SpecPlan): PlanViewer {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (PlanViewer.currentPanel) {
            PlanViewer.currentPanel.panel.reveal(column);
            if (plan) {
                PlanViewer.currentPanel.setPlan(plan);
            }
            return PlanViewer.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            PlanViewer.viewType,
            'OpenKode Plan',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        PlanViewer.currentPanel = new PlanViewer(panel, extensionUri);
        if (plan) {
            PlanViewer.currentPanel.setPlan(plan);
        }
        return PlanViewer.currentPanel;
    }

    /**
     * Set the current plan to display
     */
    public setPlan(plan: SpecPlan): void {
        this.currentPlan = plan;
        this.updateView();
        this.messageHandler.postMessage({
            type: MessageType.PLAN_UPDATED,
            payload: plan
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
        PlanViewer.currentPanel = undefined;
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
            case MessageType.PHASE_SELECTED:
                vscode.commands.executeCommand('openkode.selectPhase', message.payload);
                break;
            case MessageType.FILE_PREVIEW_REQUEST:
                vscode.commands.executeCommand('openkode.previewFile', message.payload);
                break;
            case MessageType.EXECUTE_PHASE:
                vscode.commands.executeCommand('openkode.executePhase', message.payload);
                break;
            case MessageType.EXPAND_ALL:
                vscode.commands.executeCommand('openkode.expandAllPhases');
                break;
            case MessageType.COLLAPSE_ALL:
                vscode.commands.executeCommand('openkode.collapseAllPhases');
                break;
            case MessageType.READY:
                // Webview is ready, send current plan if available
                if (this.currentPlan) {
                    this.messageHandler.postMessage({
                        type: MessageType.PLAN_UPDATED,
                        payload: this.currentPlan
                    });
                }
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    /**
     * Generate HTML for the webview
     */
    private getHtmlForWebview(): string {
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'planViewer.js')
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
    <title>OpenKode Plan</title>
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
}

/**
 * Interface for plan viewer options
 */
export interface PlanViewerOptions {
    showFilePreview?: boolean;
    showPhaseDetails?: boolean;
    enableEditing?: boolean;
}

/**
 * Plan viewer state
 */
export interface PlanViewerState {
    expandedPhases: string[];
    selectedPhase: string | null;
    searchQuery: string;
    filterStatus: 'all' | 'pending' | 'in-progress' | 'completed';
}
