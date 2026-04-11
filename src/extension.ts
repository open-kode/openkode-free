import * as vscode from 'vscode';
import { MainPanel } from './ui/mainPanel';
import { SidebarPanelProvider } from './ui/sidebarPanel';
import { OpenKode } from './core/openkode';
import { LlmRouter, llmRouter } from './core/llm-router';
import { initSettings, saveCloudApiKey, autoDiscoverLocalServer, initContext } from './settings';
import { registerModelProfilesPanel, refreshModelProfilesPanel } from './ui/model-panel';
import { registerHandoffCommands } from './agent-handoff/commands';
import { registerVerificationCommands } from './verification/commands';
import { registerVerificationPanel } from './verification/report-panel';
import { showWelcomeScreen, maybeShowWelcome } from './ui/welcome-screen';
import { telemetry } from './core/telemetry';
import type { CloudProvider } from './core/types';

export { llmRouter };

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('OpenKode');
    outputChannel.appendLine('OpenKode extension activating...');

    // Initialise secret storage (must come before LlmRouter)
    initSettings(context.secrets);
    initContext(context);

    // Register sidebar panel provider
    const sidebarProvider = new SidebarPanelProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarPanelProvider.viewType,
            sidebarProvider
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('openkode.openUI', () => {
            MainPanel.createOrShow(context.extensionUri, context);
        })
    );

    // ── LLM Provider selection command ──────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('openkode.selectLlmProvider', async () => {
            const pick = await vscode.window.showQuickPick(
                [
                    { label: '$(cpu) Local', description: 'Ollama / LM Studio / llama.cpp — zero data leakage', value: 'local' },
                    { label: '$(cloud) Cloud Key', description: 'Your own OpenAI / Anthropic / Gemini key', value: 'cloud-key' },
                    { label: '$(globe) OpenKode Relay', description: 'Managed plan (Pro/Team)', value: 'openkode-relay' },
                ],
                { title: 'OpenKode: Select LLM Provider', placeHolder: 'Choose how OpenKode sends LLM requests' }
            );

            if (!pick) return;

            await vscode.workspace
                .getConfiguration('openkode')
                .update('llmProvider', pick.value, vscode.ConfigurationTarget.Global);

            // If switching to cloud, prompt for API key
            if (pick.value === 'cloud-key') {
                const cfg = vscode.workspace.getConfiguration('openkode');
                const provider = (cfg.get<string>('cloud.provider') ?? 'openai') as CloudProvider;
                const key = await vscode.window.showInputBox({
                    title: `OpenKode: Enter ${provider} API Key`,
                    prompt: 'Key is stored in VS Code SecretStorage — never in plain text.',
                    password: true,
                    ignoreFocusOut: true,
                });
                if (key) {
                    await saveCloudApiKey(provider, key);
                    vscode.window.showInformationMessage(`OpenKode: ${provider} API key saved.`);
                }
            }
        })
    );

    // ── Test LLM Router command ──────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('openkode.testLlmRouter', async () => {
            try {
                const config = llmRouter.getConfig();
                outputChannel.appendLine(`[LlmRouter] Testing ${config.mode} provider…`);
                outputChannel.show(true);

                const response = await llmRouter.execute({
                    messages: [
                        { role: 'system', content: 'You are OpenKode. Reply with exactly one sentence.' },
                        { role: 'user', content: 'Say hello and confirm you are working.' },
                    ],
                    temperature: 0.2,
                    maxTokens: 50,
                });

                outputChannel.appendLine(`[LlmRouter] Response: ${response.content}`);
                vscode.window.showInformationMessage(`OpenKode LLM OK: ${response.content.slice(0, 80)}`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                outputChannel.appendLine(`[LlmRouter] Error: ${msg}`);
                vscode.window.showErrorMessage(`OpenKode LLM error: ${msg}`);
            }
        })
    );

    // ── Status bar (generic OpenKode entry — higher priority than router bar) ─
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(extensions) OpenKode';
    statusBarItem.tooltip = 'OpenKode - AI Development Orchestration';
    statusBarItem.command = 'openkode.openUI';
    statusBarItem.show();

    context.subscriptions.push(outputChannel, statusBarItem);

    await vscode.commands.executeCommand('setContext', 'openkode:enabled', true);

    // ── Initialise LlmRouter (creates provider status bar item) ─────────────
    await llmRouter.init(context);
    outputChannel.appendLine(`[LlmRouter] Active mode: ${llmRouter.getConfig().mode}`);

    // ── Auto-discover local LLM server (non-blocking, local mode only) ───────
    autoDiscoverLocalServer().catch(() => {/* non-fatal */});

    // Keep Model Profiles tree in sync with router config changes
    context.subscriptions.push(
        llmRouter.onConfigChanged(() => refreshModelProfilesPanel())
    );

    // Register Model Profiles tree view + related commands
    registerModelProfilesPanel(context);

    // ── Agent Handoff commands ───────────────────────────────────────────────
    registerHandoffCommands(context);

    // ── Verification Engine + Report Panel ───────────────────────────────────
    registerVerificationPanel(context);
    registerVerificationCommands(context);

    // ── Welcome screen ───────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('openkode.showWelcome', () =>
            showWelcomeScreen(context)
        )
    );
    // Show automatically only on first ever activation
    await maybeShowWelcome(context);

    // ── Telemetry (opt-in) ───────────────────────────────────────────────────
    telemetry.init(context);
    telemetry.track('extension.activate');

    // ── Full SDD Demo command ────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('openkode.runFullSDDDemo', async () => {
            telemetry.track('demo.run');
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'OpenKode: Running full SDD demo…',
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({ message: '1/3 — Generating spec…', increment: 0 });
                    await new Promise(r => setTimeout(r, 1200)); // simulate LLM spec gen

                    progress.report({ message: '2/3 — Running mock implementation…', increment: 33 });
                    await new Promise(r => setTimeout(r, 1200)); // simulate agent execution

                    progress.report({ message: '3/3 — Verifying against spec…', increment: 66 });
                    // Trigger real verification engine with a mock context
                    await vscode.commands.executeCommand('openkode.testVerification');

                    const action = await vscode.window.showInformationMessage(
                        'OpenKode SDD Demo complete! Check the Verification panel for results.',
                        'Open Verification Report',
                        'Open OpenKode UI',
                    );
                    if (action === 'Open Verification Report') {
                        await vscode.commands.executeCommand('openkode.showVerificationReport');
                    } else if (action === 'Open OpenKode UI') {
                        await vscode.commands.executeCommand('openkode.openUI');
                    }
                },
            );
        })
    );

    // If local mode, do a background health-check and warn if server is down
    llmRouter.checkLocalServer().then((status) => {
        if (status && !status.available) {
            vscode.window.showWarningMessage(
                `OpenKode: Local LLM server (${status.provider}) is not reachable at ${status.host}. ` +
                `Start the server or switch provider via "OpenKode: Select LLM Provider".`
            );
        }
    }).catch(() => { /* non-fatal */ });

    // Initialize the OpenKode orchestration engine (non-fatal if it fails)
    OpenKode.initialize({ context }).catch(err => {
        outputChannel.appendLine(`OpenKode orchestration engine failed to initialize: ${err}`);
    });

    outputChannel.appendLine('OpenKode extension activated');
}

export function deactivate(): void {
    LlmRouter.getInstance().dispose();
    if (OpenKode.isInitialized()) {
        OpenKode.getInstance().dispose();
    }
    outputChannel?.appendLine('OpenKode extension deactivated');
    outputChannel?.dispose();
}
