/**
 * OpenKode Main Panel - With Logging and Fallback Rendering
 */

import * as vscode from 'vscode';

export class MainPanel {
    public static currentPanel: MainPanel | undefined;
    private static readonly viewType = 'openkode.mainPanel';
    
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private _isLoggedIn = false;
    private _selectedProvider: string | null = null;
    private _hasApiKey = false;

    public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext): MainPanel {
        console.log('[MainPanel] createOrShow called');
        
        if (MainPanel.currentPanel) {
            console.log('[MainPanel] Panel already exists, revealing...');
            MainPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return MainPanel.currentPanel;
        }

        console.log('[MainPanel] Creating new webview panel...');
        const panel = vscode.window.createWebviewPanel(
            MainPanel.viewType,
            'OpenKode',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: false
            }
        );

        console.log('[MainPanel] Panel created, initializing MainPanel...');
        MainPanel.currentPanel = new MainPanel(panel, extensionUri, context);
        console.log('[MainPanel] MainPanel constructor completed');
        return MainPanel.currentPanel;
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        console.log('[MainPanel.constructor] Starting...');
        
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._context = context;

        try {
            console.log('[MainPanel.constructor] Loading saved state...');
            this._isLoggedIn = this._context.globalState.get('openkode.isLoggedIn', false);
            this._selectedProvider = this._context.globalState.get('openkode.selectedProvider', null);
            console.log('[MainPanel.constructor] State loaded:', {
                isLoggedIn: this._isLoggedIn,
                selectedProvider: this._selectedProvider
            });
            
            console.log('[MainPanel.constructor] Setting up message handler...');
            this._setupMessageHandler();

            console.log('[MainPanel.constructor] Calling _update()...');
            this._update();
            console.log('[MainPanel.constructor] _update() completed');

            // Check for API key asynchronously
            if (this._selectedProvider) {
                console.log('[MainPanel.constructor] Checking for API key...');
                this._checkApiKeyAsync();
            }

            console.log('[MainPanel.constructor] Setting up dispose handler...');
            this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
            
            console.log('[MainPanel.constructor] Constructor completed successfully');
        } catch (error) {
            console.error('[MainPanel.constructor] CRITICAL ERROR:', error);
            // Show fallback UI
            this._showFallback('Error during initialization', String(error));
        }
    }

    private _setupMessageHandler(): void {
        console.log('[MainPanel._setupMessageHandler] Setting up...');
        try {
            this._panel.webview.onDidReceiveMessage(
                async (message) => {
                    console.log('[MainPanel] Message received:', message.command);
                    
                    try {
                        if (message.command === 'login') {
                            console.log('[MainPanel] Processing login...');
                            await this._context.globalState.update('openkode.isLoggedIn', true);
                            this._isLoggedIn = true;
                            this._showLLMSelect();
                        }
                        else if (message.command === 'selectProvider') {
                            console.log('[MainPanel] Selecting provider:', message.provider);
                            await this._context.globalState.update('openkode.selectedProvider', message.provider);
                            this._selectedProvider = message.provider;
                            this._showApiKeyInput();
                        }
                        else if (message.command === 'saveApiKey') {
                            console.log('[MainPanel] Saving API key...');
                            const { provider, apiKey } = message;
                            if (apiKey && apiKey.trim()) {
                                await this._context.secrets.store(`openkode.apiKey.${provider}`, apiKey.trim());
                                this._hasApiKey = true;
                                vscode.window.showInformationMessage('✅ API Key saved!');
                                this._showMain();
                            }
                        }
                        else if (message.command === 'logout') {
                            console.log('[MainPanel] Logging out...');
                            await this._context.globalState.update('openkode.isLoggedIn', false);
                            await this._context.globalState.update('openkode.selectedProvider', null);
                            this._isLoggedIn = false;
                            this._selectedProvider = null;
                            this._hasApiKey = false;
                            this._showWelcome();
                        }
                        else if (message.command === 'sendMessage') {
                            console.log('[MainPanel] User message:', message.text.substring(0, 50) + '...');
                            vscode.window.showInformationMessage('📨 Message received!');
                        }
                    } catch (err) {
                        console.error('[MainPanel] Error handling message:', err);
                        vscode.window.showErrorMessage('Error: ' + String(err));
                    }
                },
                null,
                this._disposables
            );
            console.log('[MainPanel._setupMessageHandler] Completed');
        } catch (error) {
            console.error('[MainPanel._setupMessageHandler] ERROR:', error);
        }
    }

    private _checkApiKeyAsync(): void {
        console.log('[MainPanel._checkApiKeyAsync] Checking for API key...');
        if (!this._selectedProvider) return;
        
        try {
            const secretKey = `openkode.apiKey.${this._selectedProvider}`;
            // Use void to ignore the PromiseLike return type
            void this._context.secrets.get(secretKey).then(
                (key: string | undefined) => {
                    try {
                        console.log('[MainPanel._checkApiKeyAsync] API key check result:', !!key);
                        if (key) {
                            this._hasApiKey = true;
                            if (this._isLoggedIn && this._selectedProvider) {
                                console.log('[MainPanel._checkApiKeyAsync] Updating to show main UI');
                                this._showMain();
                            }
                        }
                    } catch (err) {
                        console.error('[MainPanel._checkApiKeyAsync] Error in promise handler:', err);
                    }
                }
            );
        } catch (err) {
            console.error('[MainPanel._checkApiKeyAsync] Error checking API key:', err);
        }
    }

    private _showWelcome(): void {
        console.log('[MainPanel._showWelcome] STARTING - Rendering welcome screen');
        try {
            const html = this._getWelcomeHtml();
            console.log('[MainPanel._showWelcome] HTML generated, length:', html.length);
            this._panel.webview.html = html;
            console.log('[MainPanel._showWelcome] HTML SET SUCCESSFULLY');
        } catch (error) {
            console.error('[MainPanel._showWelcome] ERROR:', error);
            this._showFallback('Welcome Screen Error', String(error));
        }
    }

    private _showLLMSelect(): void {
        console.log('[MainPanel._showLLMSelect] STARTING - Rendering LLM selection');
        try {
            const html = this._getLLMSelectHtml();
            console.log('[MainPanel._showLLMSelect] HTML generated, length:', html.length);
            this._panel.webview.html = html;
            console.log('[MainPanel._showLLMSelect] HTML SET SUCCESSFULLY');
        } catch (error) {
            console.error('[MainPanel._showLLMSelect] ERROR:', error);
            this._showFallback('LLM Selection Error', String(error));
        }
    }

    private _showApiKeyInput(): void {
        console.log('[MainPanel._showApiKeyInput] STARTING - Rendering API key input');
        try {
            const html = this._getApiKeyInputHtml();
            console.log('[MainPanel._showApiKeyInput] HTML generated, length:', html.length);
            this._panel.webview.html = html;
            console.log('[MainPanel._showApiKeyInput] HTML SET SUCCESSFULLY');
        } catch (error) {
            console.error('[MainPanel._showApiKeyInput] ERROR:', error);
            this._showFallback('API Key Input Error', String(error));
        }
    }

    private _showMain(): void {
        console.log('[MainPanel._showMain] STARTING - Rendering main dashboard');
        try {
            const html = this._getMainHtml();
            console.log('[MainPanel._showMain] HTML generated, length:', html.length);
            this._panel.webview.html = html;
            console.log('[MainPanel._showMain] HTML SET SUCCESSFULLY');
        } catch (error) {
            console.error('[MainPanel._showMain] ERROR:', error);
            this._showFallback('Main Dashboard Error', String(error));
        }
    }

    private _showFallback(title: string, message: string): void {
        console.log('[MainPanel._showFallback] Showing fallback:', title);
        this._panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: monospace; background: #1e1e1e; color: #fff; padding: 20px; }
        h1 { color: #f44747; }
        pre { background: #2d2d2d; padding: 10px; border-radius: 4px; overflow: auto; }
    </style>
</head>
<body>
    <h1>⚠️ ${title}</h1>
    <p>Please check the Debug Console (View → Debug Console) for full error details.</p>
    <pre>${message}</pre>
    <p><button onclick="location.reload()">Reload</button></p>
</body>
</html>`;
    }

    private _update(): void {
        console.log('[MainPanel._update] STARTING UPDATE - Current state:', {
            isLoggedIn: this._isLoggedIn,
            selectedProvider: this._selectedProvider,
            hasApiKey: this._hasApiKey
        });

        try {
            if (this._isLoggedIn) {
                console.log('[MainPanel._update] User is logged in, checking provider...');
                if (this._selectedProvider && this._hasApiKey) {
                    console.log('[MainPanel._update] CONDITION MET: provider + api key → showing main');
                    this._showMain();
                } else if (this._selectedProvider) {
                    console.log('[MainPanel._update] CONDITION: provider but no api key → showing api key input');
                    this._showApiKeyInput();
                } else {
                    console.log('[MainPanel._update] CONDITION: logged in but no provider → showing LLM select');
                    this._showLLMSelect();
                }
            } else {
                console.log('[MainPanel._update] CONDITION: not logged in → showing welcome');
                this._showWelcome();
            }
            console.log('[MainPanel._update] UPDATE COMPLETED SUCCESSFULLY');
        } catch (error) {
            console.error('[MainPanel._update] CRITICAL ERROR:', error);
            this._showFallback('State Update Error', String(error));
        }
    }

    private _getWelcomeHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1e1e1e; color: #fff; margin: 0; padding: 40px 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .container { text-align: center; max-width: 400px; }
        h1 { font-size: 32px; margin: 0 0 10px 0; }
        p { color: #aaa; margin: 0 0 30px 0; }
        button { background: #667eea; color: white; border: none; padding: 12px 32px; font-size: 16px; border-radius: 6px; cursor: pointer; width: 100%; }
        button:hover { background: #5568d3; }
        .error { color: #f44747; font-size: 12px; margin-top: 10px; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 OpenKode</h1>
        <p>AI Development Orchestration<br>Plan • Execute • Verify</p>
        <button onclick="handleClick()">Get Started</button>
        <div id="error" class="error"></div>
    </div>
    <script>
        console.log('[Welcome] Page loaded');
        let vscode;
        try {
            vscode = acquireVsCodeApi();
            console.log('[Welcome] vscode API acquired');
        } catch (e) {
            console.error('[Welcome] Failed to acquire vscode API:', e);
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = 'API Error: ' + e.message;
        }
        
        function handleClick() {
            console.log('[Welcome] Get Started clicked');
            try {
                if (vscode) {
                    vscode.postMessage({ command: 'login' });
                    console.log('[Welcome] Message sent');
                } else {
                    console.error('[Welcome] vscode API not available');
                }
            } catch (e) {
                console.error('[Welcome] Error sending message:', e);
                document.getElementById('error').style.display = 'block';
                document.getElementById('error').textContent = 'Send Error: ' + e.message;
            }
        }
        console.log('[Welcome] Script execution completed');
    </script>
</body>
</html>`;
    }

    private _getLLMSelectHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1e1e1e; color: #fff; margin: 0; padding: 40px 20px; min-height: 100vh; }
        .container { max-width: 400px; margin: 0 auto; }
        h2 { margin: 0 0 30px 0; }
        .provider-btn { width: 100%; padding: 14px; margin: 10px 0; background: #2d2d2d; color: white; border: 1px solid #444; border-radius: 6px; cursor: pointer; font-size: 15px; text-align: left; }
        .provider-btn:hover { background: #3d3d3d; border-color: #667eea; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Select LLM Provider</h2>
        <button class="provider-btn" onclick="selectProvider('openai')">🤖 OpenAI</button>
        <button class="provider-btn" onclick="selectProvider('anthropic')">🧠 Anthropic</button>
        <button class="provider-btn" onclick="selectProvider('gemini')">💎 Google Gemini</button>
        <button class="provider-btn" onclick="selectProvider('azure')">☁️ Azure OpenAI</button>
    </div>
    <script>
        console.log('[LLMSelect] Page loaded');
        let vscode;
        try {
            vscode = acquireVsCodeApi();
            console.log('[LLMSelect] vscode API acquired');
        } catch (e) {
            console.error('[LLMSelect] Failed to acquire vscode API:', e);
        }
        
        function selectProvider(id) {
            console.log('[LLMSelect] Provider selected:', id);
            try {
                if (vscode) {
                    vscode.postMessage({ command: 'selectProvider', provider: id });
                }
            } catch (e) {
                console.error('[LLMSelect] Error:', e);
            }
        }
    </script>
</body>
</html>`;
    }

    private _getApiKeyInputHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1e1e1e; color: #fff; margin: 0; padding: 40px 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .container { max-width: 400px; width: 100%; }
        h2 { margin: 0 0 20px 0; }
        input { width: 100%; padding: 10px; margin: 10px 0; background: #333; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
        input:focus { outline: none; border-color: #667eea; }
        button { width: 100%; padding: 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px; }
        button:hover { background: #5568d3; }
        .note { font-size: 12px; color: #aaa; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Enter API Key</h2>
        <input type="password" id="apiKey" placeholder="sk-...">
        <button onclick="saveKey()">Save & Continue</button>
        <p class="note">🔒 API key is stored securely in VS Code</p>
    </div>
    <script>
        console.log('[ApiKeyInput] Page loaded');
        let vscode;
        try {
            vscode = acquireVsCodeApi();
        } catch (e) {
            console.error('[ApiKeyInput] API Error:', e);
        }
        
        function saveKey() {
            console.log('[ApiKeyInput] Save clicked');
            try {
                const key = document.getElementById('apiKey').value;
                if (key && key.trim() && vscode) {
                    vscode.postMessage({ 
                        command: 'saveApiKey',
                        provider: 'openai',
                        apiKey: key
                    });
                }
            } catch (e) {
                console.error('[ApiKeyInput] Error:', e);
            }
        }
        document.getElementById('apiKey').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') saveKey();
        });
    </script>
</body>
</html>`;
    }

    private _getMainHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1e1e1e; color: #fff; margin: 0; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 15px; }
        .modes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px; }
        .mode-card { background: #2d2d2d; border: 1px solid #444; padding: 20px; border-radius: 8px; cursor: pointer; text-align: center; }
        .mode-card:hover { background: #3d3d3d; border-color: #667eea; }
        .mode-emoji { font-size: 32px; margin-bottom: 10px; }
        textarea { width: 100%; min-height: 80px; padding: 10px; background: #2d2d2d; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
        textarea:focus { outline: none; border-color: #667eea; }
        button { width: 100%; padding: 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px; }
        button:hover { background: #5568d3; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 OpenKode</h1>
        <small style="color: #aaa;">Ready</small>
    </div>
    <div class="modes">
        <div class="mode-card" onclick="selectMode('precision')">
            <div class="mode-emoji">🎯</div>
            <div class="mode-name">Precision</div>
        </div>
        <div class="mode-card" onclick="selectMode('blueprint')">
            <div class="mode-emoji">🏗️</div>
            <div class="mode-name">Blueprint</div>
        </div>
        <div class="mode-card" onclick="selectMode('visionary')">
            <div class="mode-emoji">🔭</div>
            <div class="mode-name">Visionary</div>
        </div>
        <div class="mode-card" onclick="selectMode('rocket')">
            <div class="mode-emoji">🚀</div>
            <div class="mode-name">Rocket</div>
        </div>
    </div>
    <div class="chat">
        <textarea id="input" placeholder="Describe what you want to build..."></textarea>
        <button onclick="sendMessage()">Send</button>
    </div>
    <button style="background: #333; margin-top: 20px;" onclick="logout()">Logout</button>
    <script>
        console.log('[Main] Page loaded');
        let vscode, selectedMode = 'precision';
        try {
            vscode = acquireVsCodeApi();
        } catch (e) {
            console.error('[Main] API Error:', e);
        }
        function selectMode(m) { selectedMode = m; console.log('[Main] Mode:', m); }
        function sendMessage() {
            try {
                const text = document.getElementById('input').value;
                if (text.trim() && vscode) {
                    vscode.postMessage({ command: 'sendMessage', text, mode: selectedMode });
                    document.getElementById('input').value = '';
                }
            } catch (e) { console.error('[Main] Error:', e); }
        }
        function logout() {
            try { if (vscode) vscode.postMessage({ command: 'logout' }); } 
            catch (e) { console.error('[Main] Logout error:', e); }
        }
    </script>
</body>
</html>`;
    }

    private _dispose(): void {
        console.log('[MainPanel._dispose] Disposing panel');
        MainPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
    }
}
