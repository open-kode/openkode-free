/**
 * Welcome Screen — shown on first activation and via the
 * "OpenKode: Welcome / Quick Start" command.
 *
 * Renders a full webview panel with:
 *  - Hero headline + feature overview
 *  - Three quick-start action buttons
 *  - LLM provider setup checklist
 *  - Link to docs / Marketplace
 */
import * as vscode from 'vscode';

// ─── State key ───────────────────────────────────────────────────────────────

const WELCOMED_KEY = 'openkode.welcomed.v1';

// ─── Panel singleton ─────────────────────────────────────────────────────────

let _panel: vscode.WebviewPanel | undefined;

/**
 * Open (or reveal) the Welcome webview panel.
 *
 * @param context  Extension context — used for SecretStorage state check and
 *                 to resolve asset URIs.
 */
export function showWelcomeScreen(context: vscode.ExtensionContext): void {
  if (_panel) {
    _panel.reveal(vscode.ViewColumn.One);
    return;
  }

  _panel = vscode.window.createWebviewPanel(
    'openkode.welcome',
    'OpenKode — Welcome',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'src', 'assets'),
        vscode.Uri.joinPath(context.extensionUri, 'out'),
      ],
    },
  );

  _panel.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    'src', 'assets', 'logo', 'ok.png',
  );

  _panel.webview.html = buildHtml(_panel.webview, context);

  // Handle messages from the webview
  _panel.webview.onDidReceiveMessage(
    async (msg: { command: string }) => {
      switch (msg.command) {
        case 'selectProvider':
          await vscode.commands.executeCommand('openkode.selectLlmProvider');
          break;
        case 'newSpec':
          await vscode.commands.executeCommand('openkode.openUI');
          break;
        case 'showProfiles':
          await vscode.commands.executeCommand('openkode.showModelProfiles');
          break;
        case 'runDemo':
          await vscode.commands.executeCommand('openkode.runFullSDDDemo');
          break;
        case 'dismiss':
          _panel?.dispose();
          break;
      }
    },
    undefined,
    context.subscriptions,
  );

  _panel.onDidDispose(() => {
    _panel = undefined;
  });
}

/**
 * Show the welcome screen only on the very first activation.
 * After the first show, the state key is set so it is never shown automatically again.
 */
export async function maybeShowWelcome(context: vscode.ExtensionContext): Promise<void> {
  const alreadyShown = context.globalState.get<boolean>(WELCOMED_KEY);
  if (!alreadyShown) {
    await context.globalState.update(WELCOMED_KEY, true);
    showWelcomeScreen(context);
  }
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;`;

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenKode — Welcome</title>
  <style nonce="${nonce}">
    :root {
      --ok-accent:  #6c9ef8;
      --ok-green:   #4ec9b0;
      --ok-yellow:  #f5d76e;
      --ok-red:     #f14c4c;
      --ok-bg:      var(--vscode-editor-background);
      --ok-fg:      var(--vscode-editor-foreground);
      --ok-border:  var(--vscode-panel-border);
      --ok-card:    var(--vscode-sideBar-background);
      --ok-btn:     var(--vscode-button-background);
      --ok-btn-fg:  var(--vscode-button-foreground);
      --ok-btn-hover: var(--vscode-button-hoverBackground);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--ok-fg);
      background: var(--ok-bg);
      padding: 32px;
      max-width: 860px;
      margin: 0 auto;
    }

    .hero {
      text-align: center;
      padding: 24px 0 32px;
      border-bottom: 1px solid var(--ok-border);
      margin-bottom: 32px;
    }

    .hero h1 {
      font-size: 1.8rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-bottom: 12px;
    }

    .hero h1 span { color: var(--ok-accent); }

    .hero p {
      font-size: 1rem;
      opacity: 0.8;
      max-width: 560px;
      margin: 0 auto 20px;
      line-height: 1.6;
    }

    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin: 0 4px;
    }

    .badge-beta { background: rgba(108,158,248,0.18); color: var(--ok-accent); border: 1px solid var(--ok-accent); }
    .badge-local { background: rgba(78,201,176,0.18); color: var(--ok-green); border: 1px solid var(--ok-green); }
    .badge-oss { background: rgba(245,215,110,0.18); color: var(--ok-yellow); border: 1px solid var(--ok-yellow); }

    /* ── Quick-start buttons ── */
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
      margin: 24px 0 0;
    }

    button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      background: var(--ok-btn);
      color: var(--ok-btn-fg);
      transition: background 0.15s;
    }
    button:hover { background: var(--ok-btn-hover); }

    button.secondary {
      background: transparent;
      border: 1px solid var(--ok-border);
      color: var(--ok-fg);
    }
    button.secondary:hover { background: var(--ok-card); }

    /* ── Feature cards ── */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .card {
      background: var(--ok-card);
      border: 1px solid var(--ok-border);
      border-radius: 8px;
      padding: 18px 16px;
    }

    .card .icon { font-size: 1.5rem; margin-bottom: 10px; }
    .card h3 { font-size: 0.92rem; font-weight: 700; margin-bottom: 6px; }
    .card p  { font-size: 0.82rem; opacity: 0.75; line-height: 1.5; }

    /* ── Setup checklist ── */
    .setup {
      background: var(--ok-card);
      border: 1px solid var(--ok-border);
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 28px;
    }

    .setup h2 {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 14px;
    }

    .setup ol {
      padding-left: 20px;
      line-height: 2;
      font-size: 0.88rem;
    }

    .setup code {
      font-family: var(--vscode-editor-font-family);
      background: rgba(128,128,128,0.15);
      padding: 1px 5px;
      border-radius: 4px;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      font-size: 0.78rem;
      opacity: 0.5;
      border-top: 1px solid var(--ok-border);
      padding-top: 20px;
    }
    .footer a { color: var(--ok-accent); text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>

  <div class="hero">
    <h1>Welcome to <span>OpenKode</span></h1>
    <p>Spec-Driven Development as an outer loop above Cursor, Claude Code & Windsurf.<br/>Plan → Execute → Verify — with any LLM, fully local or cloud.</p>
    <span class="badge badge-beta">0.1.0-beta</span>
    <span class="badge badge-local">Local LLM ready</span>
    <span class="badge badge-oss">Open Source</span>
    <div class="actions">
      <button id="btn-demo">🚀 Run 60-Second Demo</button>
      <button id="btn-provider" class="secondary">🔌 Set Up LLM Provider</button>
      <button id="btn-spec" class="secondary">📋 Start New Spec</button>
      <button id="btn-profiles" class="secondary">🧩 Model Profiles</button>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="icon">🔌</div>
      <h3>BYO-LLM Router</h3>
      <p>Use Ollama, LM Studio, or llama.cpp locally — or plug in your own OpenAI / Anthropic / Gemini key. Zero lock-in.</p>
    </div>
    <div class="card">
      <div class="icon">🧩</div>
      <h3>4 Workflow Modes</h3>
      <p>Precision, Blueprint, Visionary & Rocket — each mode applies the right LLM profile for the task at hand.</p>
    </div>
    <div class="card">
      <div class="icon">🤖</div>
      <h3>Agent Handoff</h3>
      <p>Generate context-rich prompts and hand off to Cursor, Claude Code, Windsurf or any custom agent with one keystroke.</p>
    </div>
    <div class="card">
      <div class="icon">✅</div>
      <h3>Verification Engine</h3>
      <p>After your agent writes code, OpenKode LLM-reviews the diff against your spec and scores it 0–100.</p>
    </div>
  </div>

  <div class="setup">
    <h2>⚡ 60-Second Setup</h2>
    <ol>
      <li>Click <strong>Set Up LLM Provider</strong> above (or press <code>Ctrl+Shift+O</code>)</li>
      <li>Choose <strong>Local</strong> (Ollama) or <strong>Cloud Key</strong> — your key is stored encrypted</li>
      <li>Click <strong>Run 60-Second Demo</strong> to watch the full Plan → Execute → Verify cycle</li>
      <li>Open your project with <strong>Start New Spec</strong> to begin your first SDD workflow</li>
    </ol>
  </div>

  <div class="footer">
    <p>
      <a href="https://github.com/openkode/openkode-vscode">GitHub</a> ·
      <a href="https://github.com/openkode/openkode-vscode/issues">Report Issue</a> ·
      <a href="https://github.com/openkode/openkode-vscode/blob/main/OpenKode-FrontEnd/README.md">Docs</a>
    </p>
    <p style="margin-top:8px">Telemetry is <strong>off</strong> by default. Enable it in settings to help improve OpenKode.</p>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('btn-demo').addEventListener('click',     () => vscode.postMessage({ command: 'runDemo' }));
    document.getElementById('btn-provider').addEventListener('click', () => vscode.postMessage({ command: 'selectProvider' }));
    document.getElementById('btn-spec').addEventListener('click',     () => vscode.postMessage({ command: 'newSpec' }));
    document.getElementById('btn-profiles').addEventListener('click', () => vscode.postMessage({ command: 'showProfiles' }));
  </script>
</body>
</html>`;
}
