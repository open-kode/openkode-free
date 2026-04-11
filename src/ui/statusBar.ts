/**
 * Status Bar - Status Bar Integration
 * 
 * Provides status bar items for:
 * - Current mode indicator (Precision/Blueprint/Visionary/Rocket)
 * - Progress indicator
 * - Quick mode switching
 */

import * as vscode from 'vscode';
import { OpenKodeMode } from '../types';

/**
 * Mode configuration with display properties
 */
interface ModeConfig {
    label: string;
    icon: string;
    color: string;
    description: string;
}

/**
 * Mode configurations
 */
const MODE_CONFIGS: Record<OpenKodeMode, ModeConfig> = {
    precision: {
        label: 'Precision',
        icon: '$(notebook-render-all)',
        color: '#4EC9B0',
        description: 'Full planning mode with spec generation'
    },
    blueprint: {
        label: 'Blueprint',
        icon: '$(layers)',
        color: '#9CDCFE',
        description: 'Execute phases with verification'
    },
    visionary: {
        label: 'Visionary',
        icon: '$(project)',
        color: '#C586C0',
        description: 'Execute a single epic'
    },
    rocket: {
        label: 'Rocket',
        icon: '$(zap)',
        color: '#CE9178',
        description: 'Execute without verification'
    }
};

/**
 * Status bar manager for OpenKode
 */
export class StatusBarManager {
    private modeItem: vscode.StatusBarItem;
    private progressItem: vscode.StatusBarItem;
    private actionItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];
    
    private currentMode: OpenKodeMode = 'precision';
    private isProcessing: boolean = false;
    private progressTimer: NodeJS.Timeout | null = null;
    private progressDots: number = 0;

    constructor(private context: vscode.ExtensionContext) {
        // Create mode indicator item
        this.modeItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.modeItem.command = 'openkode.switchMode';
        
        // Create progress indicator item
        this.progressItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.progressItem.hide();

        // Create action item for quick actions
        this.actionItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            98
        );
        this.actionItem.hide();

        // Initialize with default mode
        this.updateModeDisplay();

        // Register commands
        this.registerCommands();

        // Add to subscriptions
        this.context.subscriptions.push(
            this.modeItem,
            this.progressItem,
            this.actionItem
        );
    }

    /**
     * Show the status bar items
     */
    public show(): void {
        this.modeItem.show();
        if (this.isProcessing) {
            this.progressItem.show();
        }
    }

    /**
     * Hide the status bar items
     */
    public hide(): void {
        this.modeItem.hide();
        this.progressItem.hide();
        this.actionItem.hide();
    }

    /**
     * Set the current mode
     */
    public setMode(mode: OpenKodeMode): void {
        this.currentMode = mode;
        this.updateModeDisplay();
        
        // Store in workspace state
        this.context.workspaceState.update('openkode.mode', mode);
        
        // Emit mode change event
        vscode.commands.executeCommand('openkode.modeChanged', mode);
    }

    /**
     * Get the current mode
     */
    public getMode(): OpenKodeMode {
        return this.currentMode;
    }

    /**
     * Show progress indicator
     */
    public showProgress(message?: string): void {
        this.isProcessing = true;
        this.progressItem.text = '$(sync~spin) ' + (message || 'Processing...');
        this.progressItem.show();
        
        // Start animated dots
        this.startProgressAnimation();
    }

    /**
     * Update progress with percentage
     */
    public updateProgress(message: string, percent: number): void {
        if (!this.isProcessing) {
            this.showProgress();
        }
        this.progressItem.text = `$(sync~spin) ${message} (${percent}%)`;
    }

    /**
     * Hide progress indicator
     */
    public hideProgress(): void {
        this.isProcessing = false;
        this.stopProgressAnimation();
        this.progressItem.hide();
        this.actionItem.hide();
    }

    /**
     * Show a quick action button
     */
    public showAction(label: string, command: string, tooltip?: string): void {
        this.actionItem.text = label;
        this.actionItem.command = command;
        this.actionItem.tooltip = tooltip || label;
        this.actionItem.show();
    }

    /**
     * Show error state
     */
    public showError(message: string): void {
        this.progressItem.text = `$(error) ${message}`;
        this.progressItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        
        // Clear error after 5 seconds
        setTimeout(() => {
            if (this.isProcessing) {
                this.progressItem.backgroundColor = undefined;
            } else {
                this.hideProgress();
            }
        }, 5000);
    }

    /**
     * Show success state
     */
    public showSuccess(message: string): void {
        const originalText = this.progressItem.text;
        this.progressItem.text = `$(check) ${message}`;
        
        // Return to normal or hide after 3 seconds
        setTimeout(() => {
            if (this.isProcessing) {
                this.progressItem.text = originalText;
            } else {
                this.hideProgress();
            }
        }, 3000);
    }

    /**
     * Update the mode display
     */
    private updateModeDisplay(): void {
        const config = MODE_CONFIGS[this.currentMode];
        this.modeItem.text = `${config.icon} OpenKode: ${config.label}`;
        this.modeItem.tooltip = `${config.description}\nClick to switch mode`;
        this.modeItem.color = config.color;
    }

    /**
     * Start progress animation
     */
    private startProgressAnimation(): void {
        this.stopProgressAnimation();
        this.progressTimer = setInterval(() => {
            this.progressDots = (this.progressDots + 1) % 4;
        }, 500);
    }

    /**
     * Stop progress animation
     */
    private stopProgressAnimation(): void {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
        this.progressDots = 0;
    }

    /**
     * Register commands
     */
    private registerCommands(): void {
        // Switch mode command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openkode.switchMode', async () => {
                const modes: { label: string; mode: OpenKodeMode; description: string }[] = [
                    { label: '$(notebook-render-all) Precision', mode: 'precision', description: 'Full planning with spec generation' },
                    { label: '$(layers) Blueprint', mode: 'blueprint', description: 'Execute phases with verification' },
                    { label: '$(project) Visionary', mode: 'visionary', description: 'Execute a single epic' },
                    { label: '$(zap) Rocket', mode: 'rocket', description: 'Execute without verification' }
                ];

                const selected = await vscode.window.showQuickPick(modes, {
                    placeHolder: 'Select OpenKode mode',
                    title: 'Switch Mode'
                });

                if (selected) {
                    this.setMode(selected.mode);
                    vscode.window.showInformationMessage(
                        `OpenKode mode switched to: ${selected.mode}`
                    );
                }
            })
        );

        // Quick mode toggle commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openkode.setModePrecision', () => this.setMode('precision')),
            vscode.commands.registerCommand('openkode.setModeBlueprint', () => this.setMode('blueprint')),
            vscode.commands.registerCommand('openkode.setModeVisionary', () => this.setMode('visionary')),
            vscode.commands.registerCommand('openkode.setModeRocket', () => this.setMode('rocket'))
        );
    }

    /**
     * Restore mode from workspace state
     */
    public restoreMode(): void {
        const savedMode = this.context.workspaceState.get<OpenKodeMode>('openkode.mode');
        if (savedMode && MODE_CONFIGS[savedMode]) {
            this.setMode(savedMode);
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.stopProgressAnimation();
        this.modeItem.dispose();
        this.progressItem.dispose();
        this.actionItem.dispose();
        
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

/**
 * Progress reporter for long-running operations
 */
export class StatusBarProgressReporter {
    private statusBar: StatusBarManager;
    private totalSteps: number = 0;
    private currentStep: number = 0;
    private stepName: string = '';

    constructor(statusBar: StatusBarManager) {
        this.statusBar = statusBar;
    }

    /**
     * Start a new progress sequence
     */
    public start(totalSteps: number, name: string = 'Processing'): void {
        this.totalSteps = totalSteps;
        this.currentStep = 0;
        this.stepName = name;
        this.report(0, 'Starting...');
    }

    /**
     * Report progress
     */
    public report(step: number, message: string): void {
        this.currentStep = step;
        const percent = Math.round((step / this.totalSteps) * 100);
        this.statusBar.updateProgress(`${this.stepName}: ${message}`, percent);
    }

    /**
     * Increment progress
     */
    public increment(message: string): void {
        this.report(this.currentStep + 1, message);
    }

    /**
     * Complete the progress
     */
    public complete(message: string = 'Complete'): void {
        this.statusBar.showSuccess(message);
    }

    /**
     * Report an error
     */
    public error(message: string): void {
        this.statusBar.showError(message);
    }
}
