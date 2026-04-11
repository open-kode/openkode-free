import * as vscode from 'vscode';
import { LLMClient, LLMProvider, ExecutionPlan, PlanTask } from '../llm/llmClient';
import { ChatStore, Conversation } from '../core/chatStore';
import { FileWriter } from '../vibe/fileWriter';
import { ModeType } from '../vibe/modeEngine';
import { intentDetector } from '../core/intentDetector';
import { buildWorkspaceContext } from '../core/workspaceContext';
import { LLM_PROVIDERS, noWorkspaceHtml, welcomeHtml, loginHtml, registerHtml, planSelectHtml, providerHtml, apiKeyHtml, mainHtml } from './sidebarHtml';

interface UserConfig {
    isLoggedIn: boolean;
    uuid?: string;
    email?: string;
    authToken?: string;
    plan?: 'byollm' | 'auto' | null;
    selectedProvider?: string;
    hasApiKey: boolean;
}



// Used for conversational chat (non-plan messages)
const SYSTEM_PROMPTS: Record<string, string> = {
    precision: `You are OpenKode in Precision Mode — a meticulous senior engineer in VS Code.
For conversational questions: answer step-by-step, numbered, with explicit reasoning. Identify any ambiguity and ask 1-2 clarifying questions before giving a final answer.
For code questions: show your analysis of the problem before the solution. Never skip steps.`,

    blueprint: `You are OpenKode in Blueprint Mode — a software architect in VS Code.
Answer with structure: start with the "why" (design rationale), then the "what" (components/interfaces), then the "how" (implementation). Use ASCII diagrams to illustrate architecture. Define types and interfaces before discussing implementation.`,

    visionary: `You are OpenKode in Visionary Mode — a product strategist and senior engineer in VS Code.
Challenge assumptions in every answer. When asked about building something, always question whether it's the right thing to build. Present trade-offs between approaches. Think about: scalability, user experience, long-term maintainability, and business impact. Propose creative alternatives the user may not have considered.`,

    rocket: `You are OpenKode in Rocket Mode — maximum speed, zero friction.
Skip all preamble. Give working code immediately. No explanations unless asked. If there are multiple ways, pick the fastest and do it. Output code blocks ready to copy-paste.`
};


export class SidebarPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'openkode.sidebarPanel';

    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _userConfig: UserConfig = { isLoggedIn: false, hasApiKey: false };
    private _currentView: 'welcome' | 'login' | 'register' | 'plan-select' | 'llm-select' | 'api-key' | 'no-workspace' | 'main' = 'welcome';
    private _chatStore: ChatStore;
    private _currentConversation?: Conversation;
    private _activeMode: ModeType = 'precision';
    // Local copy of messages kept in sync so history is always current
    private _localMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    // Stored while waiting for stack clarification answers from the user
    private _pendingPlanRequest?: { text: string; provider: LLMProvider; apiKey: string };
    // True once the BYO-LLM disclaimer has been shown this VS Code session
    private _byollmDisclaimerShown = false;
    // WebSocket for auto/paid plan chat and event streaming
    private _chatSocket?: any;
    private _socketReady = false;
    private _socketReconnectAttempts = 0;
    private _socketHeartbeatInterval?: ReturnType<typeof setInterval>;
    // Pending resolve called when a socket chat response finishes (done/error/rateLimited)
    private _socketChatResolve?: (err?: string) => void;
    // Accumulates streamed tokens for the current auto-plan chat turn
    private _socketStreamBuffer = '';
    // Latest usage data streamed from the backend
    private _usageData?: {
        used: number; limit: number;
        tokensUsed: number; tokenLimit: number;
        resetAt: string;
    };

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._chatStore = new ChatStore(context);
        this._loadUserConfig();
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _ctx: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };
        webviewView.webview.html = this._getHtml();
        webviewView.webview.onDidReceiveMessage(msg => {
            this._handleMessage(msg).catch(err => {
                console.error('[OpenKode] Unhandled error in message handler:', err);
                this._view?.webview.postMessage({ type: 'streamError', error: err instanceof Error ? err.message : String(err) });
            });
        });

        // Show BYO-LLM disclaimer once per session when panel first becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._maybeShowByollmDisclaimer();
            }
        });
        // Also fire on initial load if already visible
        if (webviewView.visible) {
            // Small delay so the webview script has time to initialise
            setTimeout(() => this._maybeShowByollmDisclaimer(), 400);
        }

        // Auto-advance from no-workspace when user opens a folder
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            if (this._currentView === 'no-workspace' && vscode.workspace.workspaceFolders?.length) {
                this._currentView = 'main';
                this._update();
            } else if (this._currentView === 'main' && !vscode.workspace.workspaceFolders?.length) {
                this._currentView = 'no-workspace';
                this._update();
            }
        });

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot && this._userConfig.isLoggedIn) {
            this._currentConversation = await this._chatStore.getOrCreateConversation(workspaceRoot, this._activeMode);
            this._localMessages = this._currentConversation.messages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

            if (this._currentConversation.messages.length > 0) {
                webviewView.webview.postMessage({
                    type: 'loadConversation',
                    messages: this._currentConversation.messages
                });
            }
            const conversations = await this._chatStore.getAllConversations();
            webviewView.webview.postMessage({
                type: 'updateChatHistory',
                conversations: conversations.map(c => ({ id: c.id, title: c.title || 'Chat' }))
            });
        }
    }

    private async _loadUserConfig(): Promise<void> {
        const uuid = this._context.globalState.get<string>('openkode.uuid');
        const email = this._context.globalState.get<string>('openkode.email');
        const authToken = this._context.globalState.get<string>('openkode.authToken');
        const plan = this._context.globalState.get<'byollm' | 'auto' | null>('openkode.plan', null);
        const selectedProvider = this._context.globalState.get<string>('openkode.selectedProvider');
        let hasApiKey = false;
        if (selectedProvider) {
            const key = await this._context.secrets.get(`openkode.apiKey.${selectedProvider}`);
            hasApiKey = !!key;
        }
        this._userConfig = { isLoggedIn: !!uuid, uuid, email, authToken, plan, selectedProvider, hasApiKey };
        this._currentView = this._resolveView();
    }

    private _resolveView(): 'welcome' | 'login' | 'register' | 'plan-select' | 'llm-select' | 'api-key' | 'no-workspace' | 'main' {
        const { uuid, plan, selectedProvider, hasApiKey } = this._userConfig;
        if (!uuid)                                              { return 'welcome'; }
        if (plan === null || plan === undefined)                { return 'plan-select'; }
        if (plan === 'byollm' && !selectedProvider)            { return 'llm-select'; }
        if (plan === 'byollm' && !hasApiKey)                   { return 'api-key'; }
        if (!vscode.workspace.workspaceFolders?.length)        { return 'no-workspace'; }
        return 'main';
    }

    private _update(): void {
        if (this._view) {
            this._view.webview.html = this._getHtml();
        }
    }

    private _maybeShowByollmDisclaimer(): void {
        if (
            this._currentView === 'main' &&
            this._userConfig.plan === 'byollm' &&
            !this._byollmDisclaimerShown
        ) {
            this._byollmDisclaimerShown = true;
            this._view?.webview.postMessage({ type: 'showByollmDisclaimer' });
        }
    }

    private async _handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'goToLogin':
                this._currentView = 'login';
                this._update();
                break;
            case 'goToRegister':
                this._currentView = 'register';
                this._update();
                break;
            case 'loginSubmit':
                await this._handleLoginSubmit(message.email as string, message.password as string);
                break;
            case 'registerSubmit':
                await this._handleRegisterSubmit(message.name as string, message.email as string, message.password as string);
                break;
            case 'selectPlan':
                await this._handleSelectPlan(message.planId as 'byollm' | 'auto');
                break;
            case 'byollmDisclaimerDismissed':
                // already marked shown in-memory; nothing to persist
                break;
            case 'selectProvider':
                await this._context.globalState.update('openkode.selectedProvider', message.provider);
                this._userConfig.selectedProvider = message.provider;
                this._currentView = 'api-key';
                this._update();
                break;
            case 'saveApiKey':
                await this._handleSaveApiKey(message.provider, message.apiKey);
                break;
            case 'selectMode':
                this._activeMode = message.mode as ModeType;
                this._view?.webview.postMessage({ type: 'modeSet', mode: this._activeMode });
                break;
            case 'sendMessage':
                await this._handleChat(message.text);
                break;
            case 'newChat':
                await this._handleNewChat();
                break;
            case 'loadConversation':
                await this._handleLoadConversation(message.conversationId);
                break;
            case 'logout':
                await this._handleLogout();
                break;
            case 'changeProvider':
                this._currentView = 'llm-select';
                this._update();
                break;
            case 'backToWelcome':
                this._currentView = this._userConfig.uuid ? 'plan-select' : 'welcome';
                this._update();
                break;
            case 'openFolder':
                await vscode.commands.executeCommand('vscode.openFolder');
                break;
            case 'stackAnswered':
                await this._handleStackAnswered(message.answers as Record<string, string>);
                break;
            case 'generateDetailedPlan':
                await this._handleGenerateDetailedPlan(message.plan as ExecutionPlan);
                break;
            case 'executeVia':
                await this._handleExecuteVia(message.method as string, message.detailedPlan as string);
                break;
            case 'verifyExecution':
                await this._handleVerifyExecution(message.tasks as PlanTask[], message.planTitle as string);
                break;
            case 'listCheckpoints':
                await this._handleListCheckpoints(message.workflowId as string | undefined);
                break;
            case 'previewRollback':
                await this._handlePreviewRollback(message.checkpointId as string);
                break;
            case 'rollbackTo':
                await this._handleRollbackTo(message.checkpointId as string);
                break;
            case 'runPRReview':
                await this._handleRunPRReview(message.baseRef as string | undefined);
                break;
            case 'fixWithOpenKode':
                await this._handleFixWithOpenKode(message.finding as Record<string, unknown>);
                break;
            case 'runReleaseCheck':
                await this._handleRunReleaseCheck();
                break;
            case 'getTraceCoverage':
                await this._handleGetTraceCoverage(message.taskIds as string[]);
                break;
            case 'saveTraceLink':
                await this._handleSaveTraceLink(
                    message.taskId as string,
                    message.planId as string,
                    message.taskTitle as string,
                    (message.changedFiles as string[] | undefined) ?? [],
                    (message.testFiles as string[] | undefined) ?? [],
                    message.evidence as string | undefined
                );
                break;
        }
    }

    private async _handleSaveApiKey(provider: string, apiKey: string): Promise<void> {
        if (!apiKey?.trim()) {
            this._view?.webview.postMessage({ type: 'error', message: 'Please enter a valid API key.' });
            return;
        }
        await this._context.secrets.store(`openkode.apiKey.${provider}`, apiKey.trim());
        this._userConfig.hasApiKey = true;
        this._currentView = 'main';
        this._update();
        const providerName = LLM_PROVIDERS.find(p => p.id === provider)?.name || provider;
        vscode.window.showInformationMessage(`OpenKode connected to ${providerName}`);
    }

    private async _handleLogout(): Promise<void> {
        this._teardownSocket();
        await this._context.globalState.update('openkode.isLoggedIn', false);
        await this._context.globalState.update('openkode.uuid', undefined);
        await this._context.globalState.update('openkode.email', undefined);
        await this._context.globalState.update('openkode.authToken', undefined);
        await this._context.globalState.update('openkode.plan', undefined);
        await this._context.globalState.update('openkode.selectedProvider', undefined);
        for (const p of LLM_PROVIDERS) {
            await this._context.secrets.delete(`openkode.apiKey.${p.id}`);
        }
        this._userConfig = { isLoggedIn: false, hasApiKey: false };
        this._localMessages = [];
        this._currentConversation = undefined;
        this._currentView = 'welcome';
        this._byollmDisclaimerShown = false;
        this._usageData = undefined;
        this._update();
    }

    private async _handleLoginSubmit(email: string, password: string): Promise<void> {
        this._view?.webview.postMessage({ type: 'authLoading' });
        try {
            const res = await fetch('https://validate.openkode.dev/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) {
                let errMsg = 'Login failed. Please check your credentials.';
                try { const e = await res.json(); errMsg = e.message || errMsg; } catch { /* ignore */ }
                this._view?.webview.postMessage({ type: 'authError', message: errMsg });
                return;
            }
            const data = await res.json() as { uuid: string; token: string; email: string; plan?: 'byollm' | 'auto' | null };
            await this._storeAuthData(data.uuid, data.email, data.token, data.plan ?? null);
            this._initMainSocket(data.token);
            this._advanceFromAuth();
        } catch {
            this._view?.webview.postMessage({
                type: 'authError',
                message: 'Could not reach validate.openkode.dev — check your internet connection.'
            });
        }
    }

    private async _handleRegisterSubmit(name: string, email: string, password: string): Promise<void> {
        this._view?.webview.postMessage({ type: 'authLoading' });
        try {
            const res = await fetch('https://validate.openkode.dev/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            if (!res.ok) {
                let errMsg = 'Registration failed. Please try again.';
                try { const e = await res.json(); errMsg = e.message || errMsg; } catch { /* ignore */ }
                this._view?.webview.postMessage({ type: 'authError', message: errMsg });
                return;
            }
            const data = await res.json() as { uuid: string; token: string; email: string };
            await this._storeAuthData(data.uuid, data.email, data.token, null);
            this._initMainSocket(data.token);
            this._advanceFromAuth();
        } catch {
            this._view?.webview.postMessage({
                type: 'authError',
                message: 'Could not reach validate.openkode.dev — check your internet connection.'
            });
        }
    }

    private async _storeAuthData(uuid: string, email: string, token: string, plan: 'byollm' | 'auto' | null): Promise<void> {
        await this._context.globalState.update('openkode.uuid', uuid);
        await this._context.globalState.update('openkode.email', email);
        await this._context.globalState.update('openkode.authToken', token);
        await this._context.globalState.update('openkode.plan', plan);
        await this._context.globalState.update('openkode.isLoggedIn', true);
        this._userConfig.uuid = uuid;
        this._userConfig.email = email;
        this._userConfig.authToken = token;
        this._userConfig.plan = plan;
        this._userConfig.isLoggedIn = true;
    }

    private _advanceFromAuth(): void {
        this._currentView = this._resolveView();
        this._update();
        // Small delay so the new HTML is rendered before the message arrives
        setTimeout(() => this._maybeShowByollmDisclaimer(), 400);
    }

    private async _handleSelectPlan(planId: 'byollm' | 'auto'): Promise<void> {
        await this._context.globalState.update('openkode.plan', planId);
        this._userConfig.plan = planId;
        const uuid = this._userConfig.uuid || '';
        const url = `https://payments.openkode.dev?planid=${planId}&uuid=${uuid}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        this._advanceFromAuth();
    }

    private _initMainSocket(token: string): void {
        // BYO-LLM users have no backend socket; byollm chat goes direct to provider
        if (this._userConfig.plan === 'byollm') { return; }
        this._teardownSocket();
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { WebSocket } = require('ws') as { WebSocket: new (url: string) => any };
            const ws = new WebSocket(`wss://validate.openkode.dev/ws?token=${token}`);
            this._chatSocket = ws;

            ws.on('open', () => {
                this._socketReady = true;
                this._socketReconnectAttempts = 0;
                // Heartbeat every 30 s
                this._socketHeartbeatInterval = setInterval(() => {
                    if (ws.readyState === 1 /* OPEN */) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000);
                // Request history for auto plan users
                if (this._userConfig.plan !== 'byollm') {
                    ws.send(JSON.stringify({ type: 'getHistory' }));
                }
            });

            ws.on('message', (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString()) as Record<string, any>;
                    this._handleSocketMessage(msg);
                } catch { /* ignore malformed messages */ }
            });

            ws.on('error', () => { /* silent — backend not yet live */ });

            ws.on('close', () => {
                this._socketReady = false;
                clearInterval(this._socketHeartbeatInterval);
                this._socketHeartbeatInterval = undefined;
                // Resolve any pending chat with a disconnect error so the awaiting send() unblocks
                if (this._socketChatResolve) {
                    this._socketChatResolve('Disconnected from server.');
                    this._socketChatResolve = undefined;
                }
                // Exponential back-off reconnect (max 3 attempts: 2s / 4s / 8s)
                if (this._socketReconnectAttempts < 3 && this._userConfig.authToken) {
                    const delay = Math.pow(2, this._socketReconnectAttempts + 1) * 1000;
                    this._socketReconnectAttempts++;
                    setTimeout(() => this._initMainSocket(this._userConfig.authToken!), delay);
                }
            });
        } catch { /* ws module unavailable */ }
    }

    private _teardownSocket(): void {
        clearInterval(this._socketHeartbeatInterval);
        this._socketHeartbeatInterval = undefined;
        if (this._chatSocket) {
            try { this._chatSocket.removeAllListeners(); this._chatSocket.close(); } catch { /* ignore */ }
            this._chatSocket = undefined;
        }
        this._socketReady = false;
        this._socketReconnectAttempts = 0;
    }

    private _handleSocketMessage(msg: Record<string, any>): void {
        switch (msg.type) {
            case 'ready': {
                if (msg.usage) {
                    this._usageData = {
                        used: msg.usage.used ?? 0,
                        limit: msg.usage.limit ?? 0,
                        tokensUsed: msg.usage.tokensUsed ?? 0,
                        tokenLimit: msg.usage.tokenLimit ?? 0,
                        resetAt: msg.usage.resetAt ?? '',
                    };
                    this._view?.webview.postMessage({ type: 'usageUpdate', ...this._usageData });
                }
                break;
            }
            case 'token': {
                const tok = msg.content ?? '';
                this._socketStreamBuffer += tok;
                this._view?.webview.postMessage({ type: 'streamToken', content: tok });
                break;
            }
            case 'done': {
                this._view?.webview.postMessage({ type: 'streamEnd' });
                this._socketChatResolve?.(undefined);
                this._socketChatResolve = undefined;
                break;
            }
            case 'usage': {
                this._usageData = {
                    used: msg.used ?? 0,
                    limit: msg.limit ?? 0,
                    tokensUsed: msg.tokensUsed ?? 0,
                    tokenLimit: msg.tokenLimit ?? 0,
                    resetAt: msg.resetAt ?? '',
                };
                this._view?.webview.postMessage({ type: 'usageUpdate', ...this._usageData });
                break;
            }
            case 'rateLimited':
                this._view?.webview.postMessage({ type: 'streamError', error: msg.message ?? 'Rate limit reached.' });
                this._socketChatResolve?.('rateLimited');
                this._socketChatResolve = undefined;
                break;
            case 'error':
                this._view?.webview.postMessage({ type: 'streamError', error: msg.message ?? 'Server error.' });
                this._socketChatResolve?.('error');
                this._socketChatResolve = undefined;
                break;
            case 'planActivated':
                if (msg.plan) {
                    this._context.globalState.update('openkode.plan', msg.plan);
                    this._userConfig.plan = msg.plan;
                    this._advanceFromAuth();
                }
                break;
            case 'history':
                if (Array.isArray(msg.conversations)) {
                    this._view?.webview.postMessage({
                        type: 'updateChatHistory',
                        conversations: msg.conversations.map((c: any) => ({ id: c.id, title: c.title || 'Chat' }))
                    });
                }
                break;
            case 'pong':
                break; // heartbeat acknowledged — no action needed
        }
    }

    private async _handleChat(text: string): Promise<void> {
        if (this._userConfig.plan === 'auto') {
            await this._handleChatViaSocket(text);
        } else {
            await this._handleChatLocal(text);
        }
    }

    private async _handleChatLocal(text: string): Promise<void> {
        const provider = this._userConfig.selectedProvider as LLMProvider | undefined;
        if (!provider) {
            this._view?.webview.postMessage({ type: 'error', message: 'No LLM provider selected. Please log out and set up again.' });
            return;
        }

        const apiKey = await this._context.secrets.get(`openkode.apiKey.${provider}`);
        if (!apiKey) {
            this._view?.webview.postMessage({ type: 'error', message: 'API key not found. Please log out and set up again.' });
            return;
        }

        // Auto-compact if conversation is getting long
        await this._compactIfNeeded(provider, apiKey);

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'global';
        if (!this._currentConversation) {
            this._currentConversation = await this._chatStore.getOrCreateConversation(workspaceRoot, this._activeMode);
            this._localMessages = [];
        }

        // Detect intent — plan request vs direct chat
        const intent = intentDetector.detectIntent(text);

        // Rocket mode skips planning entirely — goes straight to execution
        if (intent.shouldGeneratePlan && this._activeMode !== 'rocket') {
            await this._handlePlanRequest(text, provider, apiKey);
            return;
        }

        // Persist user message
        this._localMessages.push({ role: 'user', content: text });
        this._chatStore.addMessage(this._currentConversation.id, { role: 'user', content: text }).catch(() => {});

        const history = this._localMessages.slice(-20);
        const client = new LLMClient({ provider, apiKey });
        this._view?.webview.postMessage({ type: 'streamStart' });

        // Build workspace context so the LLM can read the project files
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        let systemPrompt = SYSTEM_PROMPTS[this._activeMode];
        if (wsRoot) {
            try {
                const wsContext = await buildWorkspaceContext(wsRoot, text);
                if (wsContext) {
                    systemPrompt += `\n\nYou have read-only access to the user's current project. Use this context to give precise, project-aware answers. Do NOT make up files that are not listed here.\n\n${wsContext}`;
                }
            } catch {
                // Workspace context is best-effort — proceed without it
            }
        }

        let fullResponse = '';
        try {
            fullResponse = await client.streamChat(history, (token) => {
                this._view?.webview.postMessage({ type: 'streamToken', content: token });
            }, systemPrompt);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this._view?.webview.postMessage({ type: 'streamError', error: errMsg });
            this._localMessages.pop();
            return;
        }

        this._view?.webview.postMessage({ type: 'streamEnd' });
        this._localMessages.push({ role: 'assistant', content: fullResponse });
        this._chatStore.addMessage(this._currentConversation.id, { role: 'assistant', content: fullResponse }).catch(() => {});

        const conversations = await this._chatStore.getAllConversations();
        this._view?.webview.postMessage({
            type: 'updateChatHistory',
            conversations: conversations.map(c => ({ id: c.id, title: c.title || 'Chat' }))
        });
    }

    private async _handleChatViaSocket(text: string): Promise<void> {
        if (!this._chatSocket || !this._socketReady) {
            this._view?.webview.postMessage({ type: 'streamError', error: 'Not connected to OpenKode server. Please try again shortly.' });
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'global';
        if (!this._currentConversation) {
            this._currentConversation = await this._chatStore.getOrCreateConversation(workspaceRoot, this._activeMode);
            this._localMessages = [];
        }

        // Build workspace context (best-effort)
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        let workspaceContext = '';
        if (wsRoot) {
            try {
                const ctx = await buildWorkspaceContext(wsRoot, text);
                if (ctx) { workspaceContext = ctx; }
            } catch { /* non-fatal */ }
        }

        // Persist user message locally (cache)
        this._localMessages.push({ role: 'user', content: text });
        this._chatStore.addMessage(this._currentConversation.id, { role: 'user', content: text }).catch(() => {});

        this._view?.webview.postMessage({ type: 'streamStart' });
        this._socketStreamBuffer = '';

        const conversationId = this._currentConversation.id;
        const errMsg = await new Promise<string | undefined>((resolve) => {
            this._socketChatResolve = resolve;
            try {
                this._chatSocket.send(JSON.stringify({
                    type: 'chat',
                    conversationId: conversationId ?? null,
                    message: text,
                    history: this._localMessages.slice(-20, -1), // exclude the just-added user msg
                    mode: this._activeMode,
                    workspaceContext,
                }));
            } catch {
                resolve('Failed to send message.');
            }
        });

        if (errMsg) {
            this._view?.webview.postMessage({ type: 'streamError', error: errMsg });
            this._localMessages.pop();
            this._socketStreamBuffer = '';
            return;
        }

        if (this._socketStreamBuffer) {
            this._localMessages.push({ role: 'assistant', content: this._socketStreamBuffer });
            this._chatStore.addMessage(this._currentConversation!.id, { role: 'assistant', content: this._socketStreamBuffer }).catch(() => {});
        }
        this._socketStreamBuffer = '';
    }

    private async _handlePlanRequest(text: string, provider: LLMProvider, apiKey: string): Promise<void> {
        // Check if we need tech stack clarifications before generating the plan
        try {
            const client = new LLMClient({ provider, apiKey });
            const clarification = await client.generateStackClarifications(text);
            if (clarification.needed && clarification.questions.length > 0) {
                this._pendingPlanRequest = { text, provider, apiKey };
                this._view?.webview.postMessage({
                    type: 'stackQuestionsReady',
                    questions: clarification.questions,
                    originalText: text
                });
                return;
            }
        } catch {
            // If clarification check fails, proceed directly to plan generation
        }

        await this._generatePlan(text, provider, apiKey);
    }

    private async _generatePlan(text: string, provider: LLMProvider, apiKey: string): Promise<void> {
        this._view?.webview.postMessage({ type: 'planGenerating', mode: this._activeMode });

        try {
            const client = new LLMClient({ provider, apiKey });

            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            let wsContext: string | undefined;
            if (wsRoot) {
                wsContext = await buildWorkspaceContext(wsRoot, text) || undefined;
            }

            const plan = await client.generatePlan(text, this._activeMode, wsContext);
            this._view?.webview.postMessage({ type: 'planReady', plan });

            if (this._currentConversation) {
                this._chatStore.addMessage(this._currentConversation.id, {
                    role: 'user', content: text
                }).catch(() => {});
                this._chatStore.addMessage(this._currentConversation.id, {
                    role: 'assistant',
                    content: `[Execution Plan] ${plan.title}: ${plan.summary}`
                }).catch(() => {});
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this._view?.webview.postMessage({ type: 'streamError', error: `Plan generation failed: ${errMsg}` });
        }
    }

    private async _handleStackAnswered(answers: Record<string, string>): Promise<void> {
        const pending = this._pendingPlanRequest;
        if (!pending) { return; }
        this._pendingPlanRequest = undefined;

        // Append the chosen stack to the original request text so the plan uses it
        const stackSummary = Object.entries(answers)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
        const enrichedText = `${pending.text}\n\nTech stack decisions: ${stackSummary}`;

        await this._generatePlan(enrichedText, pending.provider, pending.apiKey);
    }

    private async _compactIfNeeded(provider: LLMProvider, apiKey: string): Promise<void> {
        const THRESHOLD = 30;
        const KEEP_RECENT = 10;
        if (this._localMessages.length <= THRESHOLD) { return; }

        const toSummarize = this._localMessages.slice(0, this._localMessages.length - KEEP_RECENT);
        const toKeep = this._localMessages.slice(this._localMessages.length - KEEP_RECENT);

        try {
            const client = new LLMClient({ provider, apiKey });
            const summary = await client.compactMessages(toSummarize);
            const summaryMsg: { role: 'user' | 'assistant'; content: string } = {
                role: 'assistant',
                content: summary
            };
            this._localMessages = [summaryMsg, ...toKeep];
            if (this._currentConversation) {
                this._chatStore.addMessage(this._currentConversation.id, {
                    role: 'assistant',
                    content: summary,
                    metadata: { model: 'compacted' }
                }).catch(() => {});
            }
        } catch (err) {
            console.warn('[OpenKode] Context compaction failed:', err);
        }
    }

    private async _handleGenerateDetailedPlan(plan: ExecutionPlan): Promise<void> {
        const provider = this._userConfig.selectedProvider as LLMProvider | undefined;
        if (!provider) { return; }
        const apiKey = await this._context.secrets.get(`openkode.apiKey.${provider}`);
        if (!apiKey) {
            this._view?.webview.postMessage({ type: 'error', message: 'API key not found.' });
            return;
        }

        this._view?.webview.postMessage({ type: 'detailedPlanGenerating' });

        try {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const fileContents: Record<string, string> = {};
            const preCheckStatus: Record<string, 'exists' | 'missing'> = {};

            if (wsRoot) {
                const writer = new FileWriter(wsRoot);
                const allFiles = new Set<string>();
                for (const epic of plan.epics) {
                    for (const phase of epic.phases) {
                        for (const task of phase.tasks) {
                            for (const f of task.files || []) { allFiles.add(f); }
                        }
                    }
                }
                let filesRead = 0;
                for (const filePath of allFiles) {
                    if (filesRead >= 15) { break; }
                    try {
                        const content = await writer.readFile(filePath);
                        fileContents[filePath] = content;
                        preCheckStatus[filePath] = content.trim().length > 0 ? 'exists' : 'missing';
                    } catch {
                        fileContents[filePath] = '';
                        preCheckStatus[filePath] = 'missing';
                    }
                    filesRead++;
                }
            }

            // Post pre-check result so the UI can show it before the LLM responds
            this._view?.webview.postMessage({ type: 'preCheckResult', preCheckStatus });

            const availableTools: string[] = ['clipboard'];
            if (vscode.extensions.getExtension('github.copilot-chat')) { availableTools.push('copilot'); }
            if (vscode.extensions.getExtension('continue.continue')) { availableTools.push('continue'); }
            if (vscode.extensions.getExtension('saoudrizwan.claude-dev')) { availableTools.push('cline'); }

            const client = new LLMClient({ provider, apiKey });
            const detailedPlan = await client.generateDetailedPlan(plan, fileContents, preCheckStatus);

            this._view?.webview.postMessage({ type: 'detailedPlanReady', detailedPlan, availableTools });
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this._view?.webview.postMessage({ type: 'error', message: `Detailed plan generation failed: ${errMsg}` });
            this._view?.webview.postMessage({ type: 'detailedPlanFailed' });
        }
    }

    private async _handleExecuteVia(method: string, detailedPlan: string): Promise<void> {
        try {
            switch (method) {
                case 'copilot':
                    try {
                        await vscode.commands.executeCommand('workbench.action.chat.open', {
                            query: detailedPlan,
                            isPartialQuery: false
                        });
                        this._view?.webview.postMessage({ type: 'executeViaConfirm', message: 'Implementation guide sent to GitHub Copilot Chat.' });
                    } catch {
                        await vscode.env.clipboard.writeText(detailedPlan);
                        this._view?.webview.postMessage({ type: 'executeViaConfirm', message: 'Copilot Chat unavailable — guide copied to clipboard instead.' });
                    }
                    break;
                case 'continue':
                    await vscode.env.clipboard.writeText(detailedPlan);
                    try { await vscode.commands.executeCommand('continue.focusContinueInput'); } catch {}
                    this._view?.webview.postMessage({ type: 'executeViaConfirm', message: 'Continue.dev focused. Implementation guide copied — paste it in.' });
                    break;
                case 'cline':
                    await vscode.env.clipboard.writeText(detailedPlan);
                    try { await vscode.commands.executeCommand('claude-dev.openInNewTab'); } catch {}
                    this._view?.webview.postMessage({ type: 'executeViaConfirm', message: 'Cline opened. Implementation guide copied — paste it in.' });
                    break;
                default:
                    await vscode.env.clipboard.writeText(detailedPlan);
                    this._view?.webview.postMessage({ type: 'executeViaConfirm', message: 'Implementation guide copied to clipboard.' });
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this._view?.webview.postMessage({ type: 'error', message: `Execute via failed: ${errMsg}` });
        }
    }

    private async _handleVerifyExecution(tasks: PlanTask[], planTitle: string): Promise<void> {
        const provider = this._userConfig.selectedProvider as LLMProvider | undefined;
        if (!provider) { return; }
        const apiKey = await this._context.secrets.get(`openkode.apiKey.${provider}`);
        if (!apiKey) {
            this._view?.webview.postMessage({ type: 'error', message: 'API key not found.' });
            return;
        }

        this._view?.webview.postMessage({ type: 'verifyingExecution' });

        try {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const fileContents: Record<string, string> = {};

            if (wsRoot) {
                const writer = new FileWriter(wsRoot);
                const allFiles = new Set<string>();
                for (const task of tasks) {
                    for (const f of task.files || []) { allFiles.add(f); }
                }
                for (const filePath of allFiles) {
                    try {
                        fileContents[filePath] = await writer.readFile(filePath);
                    } catch {
                        fileContents[filePath] = '';
                    }
                }
            }

            const client = new LLMClient({ provider, apiKey });
            const results = await client.verifyExecution(tasks, fileContents, planTitle);
            this._view?.webview.postMessage({ type: 'verificationComplete', results });
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this._view?.webview.postMessage({ type: 'error', message: `Verification failed: ${errMsg}` });
            this._view?.webview.postMessage({ type: 'verificationFailed' });
        }
    }

    private async _handleNewChat(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'global';
        this._currentConversation = await this._chatStore.getOrCreateConversation(
            `${workspaceRoot}-${Date.now()}`,
            this._activeMode
        );
        this._localMessages = [];
        this._view?.webview.postMessage({ type: 'loadConversation', messages: [] });
        const conversations = await this._chatStore.getAllConversations();
        this._view?.webview.postMessage({
            type: 'updateChatHistory',
            conversations: conversations.map(c => ({ id: c.id, title: c.title || 'Chat' }))
        });
    }

    private async _handleLoadConversation(id: string): Promise<void> {
        const conv = await this._chatStore.getConversation(id);
        if (conv) {
            this._currentConversation = conv;
            this._activeMode = conv.mode as ModeType;
            this._localMessages = conv.messages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
            this._view?.webview.postMessage({ type: 'loadConversation', messages: conv.messages });
            this._view?.webview.postMessage({ type: 'modeSet', mode: conv.mode });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Checkpoint / Rollback handlers
    // ─────────────────────────────────────────────────────────────────────────

    private async _handleListCheckpoints(workflowId?: string): Promise<void> {
        try {
            const { OpenKode } = await import('../core/openkode');
            if (!OpenKode.isInitialized()) {
                this._view?.webview.postMessage({ type: 'checkpointList', checkpoints: [] });
                return;
            }
            const cm = OpenKode.getInstance().getCheckpointManager();
            const checkpoints = cm ? await cm.listCheckpoints(workflowId) : [];
            this._view?.webview.postMessage({ type: 'checkpointList', checkpoints });
        } catch {
            this._view?.webview.postMessage({ type: 'checkpointList', checkpoints: [] });
        }
    }

    private async _handlePreviewRollback(checkpointId: string): Promise<void> {
        try {
            const { OpenKode } = await import('../core/openkode');
            const cm = OpenKode.isInitialized() ? OpenKode.getInstance().getCheckpointManager() : null;
            if (!cm) { return; }
            const diffs = await cm.previewRollback(checkpointId);
            this._view?.webview.postMessage({ type: 'rollbackPreview', checkpointId, diffs });
        } catch (err) {
            this._view?.webview.postMessage({ type: 'rollbackPreviewFailed', error: String(err) });
        }
    }

    private async _handleRollbackTo(checkpointId: string): Promise<void> {
        try {
            const { OpenKode } = await import('../core/openkode');
            const re = OpenKode.isInitialized() ? OpenKode.getInstance().getRollbackEngine() : null;
            if (!re) {
                this._view?.webview.postMessage({ type: 'rollbackFailed', error: 'Rollback engine not available' });
                return;
            }
            await re.rollbackTo(checkpointId, 'manual', 0);
            this._view?.webview.postMessage({ type: 'rollbackComplete', checkpointId });
            vscode.window.showInformationMessage('Rollback complete. Files restored to checkpoint.');
        } catch (err) {
            this._view?.webview.postMessage({ type: 'rollbackFailed', error: String(err) });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PR Review handlers
    // ─────────────────────────────────────────────────────────────────────────

    private async _handleRunPRReview(baseRef?: string): Promise<void> {
        const provider = this._userConfig.selectedProvider as LLMProvider | undefined;
        if (!provider) { return; }
        const apiKey = await this._context.secrets.get(`openkode.apiKey.${provider}`);
        if (!apiKey) { return; }

        this._view?.webview.postMessage({ type: 'prReviewStarted' });
        try {
            const { PRReviewOrchestrator } = await import('../verification/prReview');
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!wsRoot) {
                this._view?.webview.postMessage({ type: 'prReviewFailed', error: 'No workspace folder open.' });
                return;
            }
            const orchestrator = new PRReviewOrchestrator({
                workspaceRoot: wsRoot,
                baseRef: baseRef ?? 'HEAD~1',
                provider,
                apiKey,
            });
            const result = await orchestrator.review();
            this._view?.webview.postMessage({ type: 'prReviewComplete', result });
        } catch (err) {
            this._view?.webview.postMessage({ type: 'prReviewFailed', error: String(err) });
        }
    }

    private async _handleFixWithOpenKode(finding: Record<string, unknown>): Promise<void> {
        const title = String(finding.title ?? 'issue');
        const detail = String(finding.detail ?? '');
        const file = String(finding.file ?? '');
        const fix = finding.suggestedFix ? `\n\nSuggested fix:\n\`\`\`\n${finding.suggestedFix}\n\`\`\`` : '';
        const prompt = `Fix the following issue in \`${file}\`:\n**${title}**\n${detail}${fix}`;
        this._view?.webview.postMessage({ type: 'injectChat', text: prompt });
    }

    private async _handleRunReleaseCheck(): Promise<void> {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsRoot) {
            this._view?.webview.postMessage({ type: 'releaseCheckFailed', error: 'No workspace folder open.' });
            return;
        }
        this._view?.webview.postMessage({ type: 'releaseCheckStarted' });
        try {
            const { ReleaseReadinessChecker } = await import('../verification/releaseReadiness');
            const checker = new ReleaseReadinessChecker({ workspaceRoot: wsRoot });
            const result = await checker.check();
            this._view?.webview.postMessage({ type: 'releaseCheckComplete', result });
        } catch (err) {
            this._view?.webview.postMessage({ type: 'releaseCheckFailed', error: String(err) });
        }
    }

    private async _handleGetTraceCoverage(taskIds: string[]): Promise<void> {
        if (!taskIds?.length) { return; }
        try {
            const { TraceabilityEngine } = await import('../spec/traceability');
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!wsRoot) { return; }
            const engine = new TraceabilityEngine(wsRoot);
            const map = await engine.computeCoverageMap(taskIds);
            this._view?.webview.postMessage({ type: 'traceCoverage', map });
        } catch { /* non-fatal */ }
    }

    private async _handleSaveTraceLink(
        taskId: string,
        planId: string,
        taskTitle: string,
        changedFiles: string[],
        testFiles: string[],
        evidence?: string
    ): Promise<void> {
        try {
            const { TraceabilityEngine } = await import('../spec/traceability');
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!wsRoot) { return; }
            const engine = new TraceabilityEngine(wsRoot);
            await engine.recordTaskEvidence(taskId, planId, taskTitle, changedFiles, testFiles, evidence);
        } catch { /* non-fatal */ }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HTML rendering
    // ─────────────────────────────────────────────────────────────────────────

    private _getHtml(): string {
        const logoUri = this._view
            ? this._view.webview.asWebviewUri(
                  vscode.Uri.joinPath(this._context.extensionUri, 'out', 'openkode.png')
              ).toString()
            : '';
        switch (this._currentView) {
            case 'welcome':      return welcomeHtml(logoUri);
            case 'login':        return loginHtml(logoUri);
            case 'register':     return registerHtml(logoUri);
            case 'plan-select':  return planSelectHtml(this._userConfig.uuid || '', logoUri);
            case 'llm-select':   return providerHtml();
            case 'api-key':      return apiKeyHtml(this._userConfig.selectedProvider);
            case 'no-workspace': return noWorkspaceHtml();
            case 'main':         return mainHtml(this._userConfig.selectedProvider, this._activeMode, this._userConfig.plan);
            default:             return welcomeHtml(logoUri);
        }
    }

}