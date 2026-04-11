// HTML/CSS template functions for SidebarPanelProvider.
// Extracted from sidebarPanel.ts to keep the panel class focused on logic.

export const LLM_PROVIDERS = [
    { id: 'openai',     name: 'OpenAI',                     icon: '⬡', description: 'GPT-4o, GPT-4o-mini' },
    { id: 'anthropic',  name: 'Anthropic',                  icon: '⬡', description: 'Claude 3.5 Sonnet, Claude 3 Opus' },
    { id: 'gemini',     name: 'Google Gemini',              icon: '⬡', description: 'Gemini 1.5 Pro, Flash' },
    { id: 'kimi',       name: 'Kimi (Moonshot)',            icon: '⬡', description: 'moonshot-v1-8k, 32k' },
    { id: 'deepseek',   name: 'DeepSeek',                   icon: '⬡', description: 'DeepSeek Coder, Chat' },
    { id: 'azure',      name: 'Azure OpenAI',               icon: '⬡', description: 'Enterprise OpenAI on Azure' },
    { id: 'openrouter', name: 'OpenRouter',                 icon: '⬡', description: 'Any model via unified API' },
    { id: 'custom',     name: 'Custom / OpenAI-Compatible', icon: '⬡', description: 'Any OpenAI-compatible endpoint' }
];

const MODE_CONFIGS = [
    { id: 'precision', label: 'Precision', color: '#4fc3f7', desc: 'Step-by-step, full codebase analysis' },
    { id: 'blueprint', label: 'Blueprint', color: '#81c784', desc: 'Architecture planning first' },
    { id: 'visionary', label: 'Visionary', color: '#ffb74d', desc: 'High-level thinking, alternatives' },
    { id: 'rocket',    label: 'Rocket',    color: '#ef5350', desc: 'Fast execution, minimal preamble' }
];

const KEY_URLS: Record<string, string> = {
    openai: 'platform.openai.com/api-keys',
    anthropic: 'console.anthropic.com/keys',
    gemini: 'aistudio.google.com/apikey',
    kimi: 'platform.moonshot.cn',
    deepseek: 'platform.deepseek.com',
    azure: 'portal.azure.com',
    openrouter: 'openrouter.ai/keys',
    custom: ''
};

export function baseCss(): string {
    return `
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        font-size: var(--vscode-font-size, 13px);
        color: var(--vscode-foreground, #cccccc);
        background: var(--vscode-sideBar-background, #1e1e1e);
        line-height: 1.5;
    }
    a { color: var(--vscode-textLink-foreground, #4ec9b0); text-decoration: none; }
    a:hover { text-decoration: underline; }
    input, textarea, button { font-family: inherit; font-size: inherit; }

    /* Buttons */
    .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer;
        font-size: 13px; font-weight: 500; transition: opacity 0.1s, background 0.1s;
    }
    .btn-primary {
        background: var(--vscode-button-background, #0e639c);
        color: var(--vscode-button-foreground, #ffffff);
        width: 100%; padding: 10px 16px;
    }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    .btn-secondary {
        background: var(--vscode-button-secondaryBackground, #3a3d41);
        color: var(--vscode-button-secondaryForeground, #cccccc);
    }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }

    /* Cards / panels */
    .panel {
        background: var(--vscode-editor-background, #1e1e1e);
        border: 1px solid var(--vscode-panel-border, #3c3c3c);
        border-radius: 6px; padding: 16px;
    }

    /* Inputs */
    input[type=text], input[type=password], textarea {
        width: 100%;
        background: var(--vscode-input-background, #3c3c3c);
        color: var(--vscode-input-foreground, #cccccc);
        border: 1px solid var(--vscode-input-border, #3c3c3c);
        border-radius: 2px; padding: 6px 8px;
        outline: none;
    }
    input:focus, textarea:focus {
        border-color: var(--vscode-focusBorder, #007fd4);
    }

    /* Links / back buttons */
    .back-link {
        display: inline-flex; align-items: center; gap: 4px;
        color: var(--vscode-descriptionForeground, #858585);
        cursor: pointer; font-size: 12px; margin-bottom: 12px;
    }
    .back-link:hover { color: var(--vscode-foreground, #cccccc); }

    /* Section labels */
    .label {
        font-size: 11px; font-weight: 600; letter-spacing: 0.8px;
        text-transform: uppercase;
        color: var(--vscode-descriptionForeground, #858585);
        margin-bottom: 8px; display: block;
    }

    /* Badges */
    .badge {
        display: inline-block; padding: 2px 8px; border-radius: 10px;
        font-size: 11px; font-weight: 600;
        background: var(--vscode-badge-background, #4d4d4d);
        color: var(--vscode-badge-foreground, #cccccc);
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, #4e4e4e); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground, #646464); }

    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.2s ease; }
    `;
}

// ── No Workspace ───────────────────────────────────────────────────────────
export function noWorkspaceHtml(): string {
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${baseCss()}
html, body { height: 100%; }
body { display: flex; flex-direction: column; }
.page {
flex: 1; display: flex; flex-direction: column;
align-items: center; justify-content: center;
padding: 24px 20px; text-align: center; gap: 16px;
}
.ws-icon {
font-size: 48px; opacity: 0.35; line-height: 1;
}
.ws-title {
font-size: 15px; font-weight: 700;
color: var(--vscode-foreground);
}
.ws-desc {
font-size: 13px; color: var(--vscode-descriptionForeground);
line-height: 1.6; max-width: 260px;
}
.ws-box {
background: rgba(255, 204, 0, 0.07);
border: 1px solid rgba(255, 204, 0, 0.22);
border-radius: 6px; padding: 12px 14px;
font-size: 12px; color: var(--vscode-descriptionForeground);
text-align: left; line-height: 1.6; max-width: 280px; width: 100%;
}
.ws-box strong { color: var(--vscode-foreground); }
.btn-open {
width: 100%; max-width: 280px;
background: var(--vscode-button-background, #0e639c);
color: var(--vscode-button-foreground, #fff);
border: none; border-radius: 4px; padding: 10px 16px;
font-size: 13px; font-weight: 500; cursor: pointer;
}
.btn-open:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
.hint {
font-size: 11px; color: var(--vscode-descriptionForeground);
opacity: 0.7;
}
</style></head><body>
<div class="page fade-in">
<div class="ws-icon">&#128193;</div>
<div class="ws-title">No Folder Open</div>
<p class="ws-desc">OpenKode needs an open project folder to read and write files, build context, and verify your code.</p>
<div class="ws-box">
    <strong>Why a folder is required:</strong><br>
    Project files are read to build LLM context &amp; verify task completion.
    All file operations stay within your local workspace — nothing is sent to external storage.
</div>
<button class="btn-open" id="openBtn">Open Folder&hellip;</button>
<p class="hint">Or open a folder via File &rsaquo; Open Folder, then return here.</p>
</div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('openBtn').onclick = () => vscode.postMessage({ command: 'openFolder' });
</script>
</body></html>`;
}

// ── Welcome ────────────────────────────────────────────────────────────────
export function welcomeHtml(logoUri: string): string {
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0d0d0d; color: #e0e0e0; line-height: 1.5;
}
.page {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 40px 24px; text-align: center; gap: 0;
}
.ok-logo { width: 80%; height: auto; border-radius: 16px; margin-bottom: 24px; display: block; object-fit: contain; }
.ok-tagline { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 24px; line-height: 1.6; }
.feature-pills { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 32px; }
.feature-pills span {
    font-size: 11px; padding: 4px 10px; border-radius: 20px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    color: #aaa;
}
.cta-group { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 240px; }
.btn-primary {
    padding: 10px 16px; border-radius: 6px; border: none; cursor: pointer;
    background: #0e639c; color: #fff; font-size: 13px; font-weight: 700; width: 100%;
}
.btn-primary:hover { background: #1177bb; }
.btn-ghost {
    padding: 10px 16px; border-radius: 6px; cursor: pointer;
    background: transparent; border: 1px solid #0e639c;
    color: #fff; font-size: 13px; font-weight: 700; width: 100%;
}
.btn-ghost:hover { background: rgba(14,99,156,0.25); }
.ok-footer { margin-top: 24px; font-size: 11px; color: #555; }
</style></head><body>
<div class="page fade-in">
    <img class="ok-logo" src="${logoUri}" alt="OpenKode">
    <p class="ok-tagline">Bring your own LLM &mdash; AI-powered<br>development orchestration</p>
    <div class="feature-pills">
        <span>&#127919; 4 AI Modes</span>
        <span>&#129302; BYO-LLM</span>
        <span>&#128274; 100% Secure</span>
    </div>
    <div class="cta-group">
        <button class="btn-primary" id="signInBtn">Sign In</button>
        <button class="btn-ghost" id="registerBtn">Create Account</button>
    </div>
    <p class="ok-footer">v0.1.0 &nbsp;&middot;&nbsp; openkode.dev</p>
</div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('signInBtn').onclick = () => vscode.postMessage({ command: 'goToLogin' });
document.getElementById('registerBtn').onclick = () => vscode.postMessage({ command: 'goToRegister' });
</script>
</body></html>`;
}

export function loginHtml(logoUri: string): string {
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d0d; color: #e0e0e0; }
.page { min-height: 100vh; display: flex; flex-direction: column; padding: 28px 20px; }
.top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
.ok-logo-sm { width: 32px; height: 32px; border-radius: 8px; }
.top-row span { font-size: 14px; font-weight: 700; color: #e0e0e0; }
h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: #fff; }
.auth-sub { font-size: 12px; color: #666; margin-bottom: 20px; }
.auth-error {
    padding: 10px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 16px;
    background: rgba(239,83,80,0.15); border: 1px solid rgba(239,83,80,0.3); color: #ef9a9a;
}
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 11px; color: #888; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
.form-group input {
    width: 100%; padding: 9px 12px; border-radius: 6px;
    background: #1a1a1a; border: 1px solid #333; color: #e0e0e0;
    font-size: 13px; outline: none;
}
.form-group input:focus { border-color: #764ba2; }
.btn-auth {
    width: 100%; padding: 10px; border-radius: 6px; border: none; cursor: pointer;
    background: #0e639c;
    color: #fff; font-size: 13px; font-weight: 700; margin-top: 6px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
}
.btn-auth:hover:not(:disabled) { background: #1177bb; }
.btn-auth:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: none; }
@keyframes spin { to { transform: rotate(360deg); } }
.auth-links { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
.auth-links a { font-size: 12px; color: #9b8ec4; cursor: pointer; }
.auth-links a:hover { color: #a78bfa; }
</style></head><body>
<div class="page fade-in">
    <h2>Welcome back</h2>
    <p class="auth-sub">Sign in to your OpenKode account</p>
    <div class="auth-error" id="authError" style="display:none"></div>
    <div class="form-group">
        <label>Email</label>
        <input type="email" id="emailInput" placeholder="you@example.com" autocomplete="email">
    </div>
    <div class="form-group">
        <label>Password</label>
        <input type="password" id="passInput" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="current-password">
    </div>
    <button class="btn-auth" id="loginBtn">
        <div class="spinner-sm" id="spinner"></div>
        <span id="btnLabel">Sign In</span>
    </button>
    <div class="auth-links">
        <a id="toRegister">Don&apos;t have an account? Create one &rarr;</a>
        <a id="toWelcome">&larr; Back</a>
    </div>
</div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('loginBtn').onclick = function() {
    var email = document.getElementById('emailInput').value.trim();
    var pass = document.getElementById('passInput').value;
    if (!email || !pass) { showError('Please enter your email and password.'); return; }
    vscode.postMessage({ command: 'loginSubmit', email: email, password: pass });
};
document.getElementById('toRegister').onclick = function() { vscode.postMessage({ command: 'goToRegister' }); };
document.getElementById('toWelcome').onclick = function() { vscode.postMessage({ command: 'backToWelcome' }); };
document.getElementById('passInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { document.getElementById('loginBtn').click(); }
});
function showError(msg) {
    var el = document.getElementById('authError');
    el.textContent = msg; el.style.display = 'block';
}
window.addEventListener('message', function(e) {
    var msg = e.data;
    if (msg.type === 'authLoading') {
        document.getElementById('loginBtn').disabled = true;
        document.getElementById('spinner').style.display = 'block';
        document.getElementById('btnLabel').textContent = 'Signing in\u2026';
        document.getElementById('authError').style.display = 'none';
    } else if (msg.type === 'authError') {
        document.getElementById('loginBtn').disabled = false;
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('btnLabel').textContent = 'Sign In';
        showError(msg.message);
    }
});
</script>
</body></html>`;
}

export function registerHtml(logoUri: string): string {
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d0d; color: #e0e0e0; }
.page { min-height: 100vh; display: flex; flex-direction: column; padding: 28px 20px; }
.top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
.ok-logo-sm { width: 32px; height: 32px; border-radius: 8px; }
.top-row span { font-size: 14px; font-weight: 700; color: #e0e0e0; }
h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: #fff; }
.auth-sub { font-size: 12px; color: #666; margin-bottom: 20px; }
.auth-error {
    padding: 10px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 16px;
    background: rgba(239,83,80,0.15); border: 1px solid rgba(239,83,80,0.3); color: #ef9a9a;
}
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 11px; color: #888; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
.form-group input {
    width: 100%; padding: 9px 12px; border-radius: 6px;
    background: #1a1a1a; border: 1px solid #333; color: #e0e0e0;
    font-size: 13px; outline: none;
}
.form-group input:focus { border-color: #764ba2; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.form-row .form-group { margin-bottom: 0; }
.btn-auth {
    width: 100%; padding: 10px; border-radius: 6px; border: none; cursor: pointer;
    background: #0e639c;
    color: #fff; font-size: 13px; font-weight: 700; margin-top: 6px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
}
.btn-auth:hover:not(:disabled) { background: #1177bb; }
.btn-auth:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: none; }
@keyframes spin { to { transform: rotate(360deg); } }
.auth-links { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
.auth-links a { font-size: 12px; color: #9b8ec4; cursor: pointer; }
.auth-links a:hover { color: #a78bfa; }
</style></head><body>
<div class="page fade-in">
    <h2>Create account</h2>
    <p class="auth-sub">Get started with OpenKode</p>
    <div class="auth-error" id="authError" style="display:none"></div>
    <div class="form-group">
        <label>Name</label>
        <input type="text" id="nameInput" placeholder="Your name" autocomplete="name">
    </div>
    <div class="form-group">
        <label>Email</label>
        <input type="email" id="emailInput" placeholder="you@example.com" autocomplete="email">
    </div>
    <div class="form-row">
        <div class="form-group">
            <label>Password</label>
            <input type="password" id="passInput" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="new-password">
        </div>
        <div class="form-group">
            <label>Re-enter</label>
            <input type="password" id="passConfirmInput" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="new-password">
        </div>
    </div>
    <button class="btn-auth" id="registerBtn">
        <div class="spinner-sm" id="spinner"></div>
        <span id="btnLabel">Create Account</span>
    </button>
    <div class="auth-links">
        <a id="toLogin">Already have an account? Sign in &rarr;</a>
        <a id="toWelcome">&larr; Back</a>
    </div>
</div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('registerBtn').onclick = function() {
    var name = document.getElementById('nameInput').value.trim();
    var email = document.getElementById('emailInput').value.trim();
    var pass = document.getElementById('passInput').value;
    var passConfirm = document.getElementById('passConfirmInput').value;
    if (!name || !email || !pass) { showError('Please fill in all fields.'); return; }
    if (pass !== passConfirm) { showError('Passwords do not match.'); return; }
    vscode.postMessage({ command: 'registerSubmit', name: name, email: email, password: pass });
};
document.getElementById('toLogin').onclick = function() { vscode.postMessage({ command: 'goToLogin' }); };
document.getElementById('toWelcome').onclick = function() { vscode.postMessage({ command: 'backToWelcome' }); };
document.getElementById('passInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { document.getElementById('passConfirmInput').focus(); }
});
document.getElementById('passConfirmInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { document.getElementById('registerBtn').click(); }
});
function showError(msg) {
    var el = document.getElementById('authError');
    el.textContent = msg; el.style.display = 'block';
}
window.addEventListener('message', function(e) {
    var msg = e.data;
    if (msg.type === 'authLoading') {
        document.getElementById('registerBtn').disabled = true;
        document.getElementById('spinner').style.display = 'block';
        document.getElementById('btnLabel').textContent = 'Creating account\u2026';
        document.getElementById('authError').style.display = 'none';
    } else if (msg.type === 'authError') {
        document.getElementById('registerBtn').disabled = false;
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('btnLabel').textContent = 'Create Account';
        showError(msg.message);
    }
});
</script>
</body></html>`;
}

export function planSelectHtml(uuid: string, logoUri: string): string {
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d0d; color: #e0e0e0; }
.page { min-height: 100vh; display: flex; flex-direction: column; padding: 28px 20px; }
.top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
.ok-logo-sm { width: 32px; height: 32px; border-radius: 8px; }
.top-row span { font-size: 14px; font-weight: 700; color: #e0e0e0; }
h2 { font-size: 18px; font-weight: 700; margin-bottom: 6px; color: #fff; }
.plan-sub { font-size: 12px; color: #666; margin-bottom: 24px; line-height: 1.5; }
.plan-cards { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.plan-card {
    padding: 18px 16px; border-radius: 10px; cursor: pointer;
    background: #161616; border: 1px solid #2a2a2a;
    transition: border-color 0.15s, background 0.15s;
}
.plan-card:hover { border-color: #764ba2; background: #1a1020; }
.plan-card-icon { font-size: 22px; margin-bottom: 8px; }
.plan-card-name { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 5px; }
.plan-card-desc { font-size: 12px; color: #888; line-height: 1.5; margin-bottom: 10px; }
.plan-badge {
    display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 10px;
    background: rgba(102,126,234,0.15); border: 1px solid rgba(102,126,234,0.3); color: #9b8ec4;
}
.plan-badge-pro { background: rgba(167,139,250,0.15); border-color: rgba(167,139,250,0.3); color: #c4b5fd; }
.plan-note { font-size: 11px; color: #444; text-align: center; line-height: 1.5; }
</style></head><body>
<div class="page fade-in">
    <div class="top-row">
        <img class="ok-logo-sm" src="${logoUri}" alt="">
        <span>OpenKode</span>
    </div>
    <h2>Choose your plan</h2>
    <p class="plan-sub">Your account is ready. Select how you want to use OpenKode.</p>
    <div class="plan-cards">
        <div class="plan-card" id="byollmCard">
            <div class="plan-card-icon">&#128273;</div>
            <div class="plan-card-name">BYOLLM</div>
            <div class="plan-card-desc">Bring your own API key. Use OpenAI, Anthropic, Gemini &amp; more with full control.</div>
            <span class="plan-badge">Pay once &middot; Your keys</span>
        </div>
        <div class="plan-card" id="autoCard">
            <div class="plan-card-icon">&#9889;</div>
            <div class="plan-card-name">Auto Selection</div>
            <div class="plan-card-desc">Managed LLM access. Best model selected automatically for each task.</div>
            <span class="plan-badge plan-badge-pro">Subscription &middot; Fully managed</span>
        </div>
    </div>
    <p class="plan-note">You&apos;ll be redirected to your browser<br>to complete setup &amp; payment.</p>
</div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('byollmCard').onclick = function() {
    vscode.postMessage({ command: 'selectPlan', planId: 'byollm' });
};
document.getElementById('autoCard').onclick = function() {
    vscode.postMessage({ command: 'selectPlan', planId: 'auto' });
};
</script>
</body></html>`;
}

// ── Provider selection ─────────────────────────────────────────────────────
export function providerHtml(): string {
    const cards = LLM_PROVIDERS.map(p => `
    <div class="provider-row" data-id="${p.id}" tabindex="0">
        <div class="pr-text">
            <div class="pr-name">${p.name}</div>
            <div class="pr-desc">${p.description}</div>
        </div>
        <span class="pr-arrow">›</span>
    </div>`).join('');

    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${baseCss()}
.page { padding: 16px; }
h2 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.subtitle { color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 16px; }
.provider-row {
display: flex; align-items: center; gap: 10px;
padding: 12px; margin-bottom: 6px;
background: var(--vscode-list-inactiveSelectionBackground, #2a2d2e);
border: 1px solid transparent; border-radius: 4px; cursor: pointer;
transition: border-color 0.1s, background 0.1s;
}
.provider-row:hover, .provider-row:focus {
background: var(--vscode-list-hoverBackground, #2a2d2e);
border-color: var(--vscode-focusBorder, #007fd4);
outline: none;
}
.pr-text { flex: 1; }
.pr-name { font-size: 13px; font-weight: 600; color: var(--vscode-foreground); }
.pr-desc { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
.pr-arrow { font-size: 18px; color: var(--vscode-descriptionForeground); }
</style></head><body>
<div class="page fade-in">
<span class="back-link" id="backBtn">‹ Back</span>
<h2>Choose LLM Provider</h2>
<p class="subtitle">Connect your API key — encrypted in the OS keychain.</p>
${cards}
</div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('backBtn').onclick = () => vscode.postMessage({ command: 'backToWelcome' });
document.querySelectorAll('.provider-row').forEach(el => {
el.onclick = () => vscode.postMessage({ command: 'selectProvider', provider: el.dataset.id });
el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') el.click(); };
});
</script>
</body></html>`;
}

// ── API Key input ──────────────────────────────────────────────────────────
export function apiKeyHtml(selectedProvider?: string): string {
    const p = LLM_PROVIDERS.find(x => x.id === selectedProvider);
    const keyUrl = p ? KEY_URLS[p.id] : '';

    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${baseCss()}
.page { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
h2 { font-size: 16px; font-weight: 600; }
.provider-tag {
display: inline-block; padding: 3px 10px; border-radius: 3px;
font-size: 12px; background: var(--vscode-badge-background, #4d4d4d);
color: var(--vscode-badge-foreground); margin-top: 4px;
}
.field { display: flex; flex-direction: column; gap: 6px; }
.input-row { position: relative; }
.input-row input { padding-right: 36px; }
.toggle-vis {
position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
background: none; border: none; cursor: pointer; padding: 2px 4px;
color: var(--vscode-descriptionForeground); font-size: 13px;
}
.security-box {
padding: 10px 12px;
background: rgba(78, 201, 176, 0.08);
border: 1px solid rgba(78, 201, 176, 0.25);
border-radius: 4px; font-size: 12px;
color: var(--vscode-descriptionForeground);
display: flex; gap: 8px; align-items: flex-start;
}
.key-link { font-size: 12px; color: var(--vscode-descriptionForeground); }
.error-box {
padding: 8px 10px; border-radius: 4px; font-size: 12px;
background: rgba(244,67,54,0.12); border: 1px solid rgba(244,67,54,0.35);
color: #f48fb1; display: none;
}
.error-box.show { display: block; }
</style></head><body>
<div class="page fade-in">
<div>
    <span class="back-link" id="backBtn">‹ Change Provider</span>
    <h2>Enter API Key</h2>
    <span class="provider-tag">${p?.name || 'Provider'}</span>
</div>

<div class="error-box" id="errBox"></div>

<div class="field">
    <span class="label">API KEY</span>
    <div class="input-row">
        <input type="password" id="keyInput" placeholder="Paste your API key here" autocomplete="off" spellcheck="false" />
        <button class="toggle-vis" id="toggleBtn" title="Show/hide">👁</button>
    </div>
</div>

<div class="security-box">
    🔒&nbsp; Your key is stored in the <strong>VS Code Secret Storage</strong> (OS keychain). It never leaves your machine.
</div>

${keyUrl ? `<p class="key-link">Get your key at <a href="#">${keyUrl}</a></p>` : ''}

<button class="btn btn-primary" id="saveBtn">Connect</button>
</div>
<script>
const vscode = acquireVsCodeApi();
const input = document.getElementById('keyInput');
const errBox = document.getElementById('errBox');
let visible = false;

document.getElementById('toggleBtn').onclick = () => {
visible = !visible;
input.type = visible ? 'text' : 'password';
};
document.getElementById('saveBtn').onclick = () => {
const key = input.value.trim();
if (!key) { errBox.textContent = 'Please enter your API key.'; errBox.classList.add('show'); return; }
errBox.classList.remove('show');
vscode.postMessage({ command: 'saveApiKey', provider: '${selectedProvider}', apiKey: key });
};
input.onkeydown = e => { if (e.key === 'Enter') document.getElementById('saveBtn').click(); };
document.getElementById('backBtn').onclick = () => vscode.postMessage({ command: 'changeProvider' });
window.addEventListener('message', e => {
if (e.data.type === 'error') { errBox.textContent = e.data.message; errBox.classList.add('show'); }
});
input.focus();
</script>
</body></html>`;
}

// ── Main chat ──────────────────────────────────────────────────────────────
export function mainHtml(selectedProvider: string | undefined, activeMode: string, plan?: 'byollm' | 'auto' | null): string {
    const prov = LLM_PROVIDERS.find(p => p.id === selectedProvider);
    const modeTabs = MODE_CONFIGS.map(m => `
    <button class="mode-tab ${m.id === activeMode ? 'active' : ''}" data-mode="${m.id}"
        title="${m.desc}" style="--mc:${m.color}">
        ${m.label}
    </button>`).join('');

    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${baseCss()}

html, body { height: 100%; overflow: hidden; }
body { display: flex; flex-direction: column; }

/* ── Top bar ── */
.topbar {
display: flex; align-items: center; gap: 6px; padding: 8px 12px 6px;
border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
flex-shrink: 0;
}
.topbar-title { font-size: 13px; font-weight: 600; flex: 1; color: var(--vscode-foreground); }
.pill-btn {
display: flex; align-items: center; gap: 4px;
padding: 3px 9px; border-radius: 10px; cursor: pointer;
font-size: 11px; border: 1px solid var(--vscode-panel-border, #3c3c3c);
background: var(--vscode-list-inactiveSelectionBackground, #2a2d2e);
color: var(--vscode-descriptionForeground);
}
.pill-btn:hover { border-color: var(--vscode-focusBorder, #007fd4); color: var(--vscode-foreground); }
.icon-btn {
background: none; border: none; cursor: pointer; padding: 4px 6px;
color: var(--vscode-descriptionForeground); border-radius: 3px; font-size: 14px;
}
.icon-btn:hover { background: var(--vscode-toolbar-hoverBackground, #3c3c3c); color: var(--vscode-foreground); }

/* ── Mode tabs ── */
.mode-bar {
display: flex; gap: 2px; padding: 6px 8px;
border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
flex-shrink: 0;
}
.mode-tab {
flex: 1; padding: 6px 4px; border: 1px solid transparent; border-radius: 3px;
font-size: 11px; font-weight: 600; cursor: pointer; text-align: center;
background: transparent; color: var(--vscode-descriptionForeground);
transition: all 0.12s;
}
.mode-tab:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground); }
.mode-tab.active {
background: var(--vscode-editor-background);
border-color: var(--mc, var(--vscode-focusBorder));
color: var(--mc, var(--vscode-foreground));
}

/* ── Chat area ── */
.chat-area {
flex: 1; overflow-y: auto; padding: 12px 12px 4px;
display: flex; flex-direction: column; gap: 14px;
min-height: 0; /* critical: allows flex child to scroll properly */
}

.empty-state {
flex: 1; display: flex; flex-direction: column;
align-items: center; justify-content: center;
color: var(--vscode-descriptionForeground); gap: 10px; text-align: center;
padding: 20px;
}
.empty-state .es-icon { font-size: 32px; opacity: 0.5; }
.empty-state p { font-size: 13px; line-height: 1.6; }

.msg { display: flex; gap: 8px; animation: fadeIn 0.15s ease; }
.msg.user { flex-direction: row-reverse; }

.avatar {
width: 26px; height: 26px; border-radius: 4px; flex-shrink: 0; margin-top: 2px;
display: flex; align-items: center; justify-content: center;
font-size: 12px; font-weight: 700;
}
.msg.user .avatar {
background: var(--vscode-button-background, #0e639c);
color: var(--vscode-button-foreground, #fff);
}
.msg.ai .avatar {
background: var(--vscode-list-inactiveSelectionBackground, #37373d);
color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border, #3c3c3c);
}

.bubble {
max-width: calc(100% - 40px);
padding: 9px 12px; border-radius: 6px;
font-size: 13px; line-height: 1.6; word-break: break-word;
}
.msg.user .bubble {
background: var(--vscode-editor-inactiveSelectionBackground, #264f78);
border: 1px solid var(--vscode-editor-selectionBackground, #264f78);
border-bottom-right-radius: 2px;
}
.msg.ai .bubble {
background: var(--vscode-editor-background, #1e1e1e);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
border-bottom-left-radius: 2px;
}
.bubble code {
font-family: var(--vscode-editor-font-family, 'Cascadia Code', monospace);
background: var(--vscode-textCodeBlock-background, #1e1e1e);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
padding: 1px 5px; border-radius: 3px; font-size: 12px;
}
.bubble pre {
background: var(--vscode-textCodeBlock-background, #0d0d0d);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
border-radius: 4px; padding: 10px 12px; margin: 6px 0;
overflow-x: auto; font-size: 12px; line-height: 1.5;
}
.bubble pre code { background: none; border: none; padding: 0; font-size: 12px; }

.cursor {
display: inline-block; width: 2px; height: 14px; margin-left: 2px;
background: var(--vscode-foreground); vertical-align: middle;
animation: blink 0.9s infinite;
}

/* ── Input bar ── */
.input-bar {
padding: 8px; border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
display: flex; gap: 6px; align-items: flex-end; flex-shrink: 0;
}
.input-bar textarea {
flex: 1; resize: none; min-height: 36px; max-height: 140px;
padding: 7px 10px; font-size: 13px; line-height: 1.4; border-radius: 4px;
overflow-y: auto;
}
.send-btn {
width: 36px; height: 36px; flex-shrink: 0; border-radius: 4px; border: none;
background: var(--vscode-button-background, #0e639c);
color: var(--vscode-button-foreground, #fff);
font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
transition: background 0.1s; flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground, #1177bb); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* error toast */
.toast {
margin: 0 8px 8px; padding: 8px 10px; border-radius: 4px; font-size: 12px;
background: rgba(244,67,54,0.12); border: 1px solid rgba(244,67,54,0.35);
color: #f48fb1; display: none;
}
.toast.show { display: block; }

/* ── BYO-LLM disclaimer modal ── */
.byollm-overlay {
position: fixed; inset: 0; z-index: 999;
background: rgba(14, 99, 156, 0.55);
backdrop-filter: blur(2px);
display: flex; align-items: center; justify-content: center;
padding: 20px;
}
.byollm-overlay.hidden { display: none; }
.byollm-modal {
background: rgba(14, 99, 156, 0.30);
border: 1px solid rgba(14, 99, 156, 0.7);
border-radius: 8px;
padding: 20px 18px 16px;
max-width: 280px; width: 100%;
box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.byollm-modal-title {
font-size: 12px; font-weight: 700; color: #fff;
margin: 0 0 10px; letter-spacing: 0.04em; text-transform: uppercase;
}
.byollm-modal-body {
font-size: 12px; color: rgba(255,255,255,0.88); line-height: 1.55;
margin: 0 0 16px;
}
.byollm-ok-btn {
width: 100%; padding: 7px 0;
background: #0e639c; border: none; border-radius: 4px;
color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
}
.byollm-ok-btn:hover { background: #1177bb; }

/* ── Usage bar (auto/paid plan) ── */
.usage-bar-wrap {
padding: 4px 12px 2px; display: flex; align-items: center; gap: 8px;
flex-shrink: 0; border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
}
.usage-bar-track {
flex: 1; height: 3px; background: rgba(255,255,255,0.10); border-radius: 2px; overflow: hidden;
}
.usage-bar-fill {
height: 100%; background: #0e639c; border-radius: 2px; transition: width 0.4s ease;
}
.usage-bar-label { font-size: 10px; color: var(--vscode-descriptionForeground); white-space: nowrap; }
.usage-bar-reset  { font-size: 10px; color: var(--vscode-descriptionForeground); white-space: nowrap; }

/* ── Plan cards ── */
.plan-card {
border: 1px solid var(--vscode-panel-border, #3c3c3c);
border-radius: 6px; overflow: hidden;
animation: fadeIn 0.2s ease;
width: 100%;
flex-shrink: 0; /* prevent height collapse as chat messages are added */
}
.plan-header {
padding: 12px 14px;
background: var(--vscode-editor-inactiveSelectionBackground, #264f78);
border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
}
.plan-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.plan-summary { font-size: 12px; color: var(--vscode-descriptionForeground); line-height: 1.5; }
.plan-mode-badge {
display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 10px;
font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
background: rgba(255,255,255,0.12); color: var(--vscode-foreground);
}
.plan-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }

.clarifications {
padding: 10px 12px;
background: rgba(255, 204, 0, 0.07); border: 1px solid rgba(255, 204, 0, 0.2);
border-radius: 4px;
}
.clarifications .cl-title { font-size: 11px; font-weight: 700; color: #ffc107; margin-bottom: 6px; }
.clarifications ol { margin: 0; padding-left: 16px; }
.clarifications li { font-size: 12px; color: var(--vscode-foreground); margin-bottom: 4px; line-height: 1.5; }

.approaches { display: flex; flex-direction: column; gap: 6px; }
.approach-card {
padding: 10px 12px; border-radius: 4px;
border: 1px solid var(--vscode-panel-border, #3c3c3c);
background: var(--vscode-editor-background);
}
.approach-card.recommended { border-color: #4caf50; }
.approach-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.rec-badge { font-size: 10px; background: #4caf50; color: #fff; padding: 1px 6px; border-radius: 8px; }
.approach-desc { font-size: 12px; color: var(--vscode-descriptionForeground); margin: 4px 0 6px; line-height: 1.5; }
.pcons { display: flex; gap: 10px; }
.pros, .cons { flex: 1; }
.pros .pc-label { font-size: 10px; font-weight: 700; color: #4caf50; margin-bottom: 3px; }
.cons .pc-label { font-size: 10px; font-weight: 700; color: #f44336; margin-bottom: 3px; }
.pros li, .cons li { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 2px; }

.epic { border: 1px solid var(--vscode-panel-border, #3c3c3c); border-radius: 4px; overflow: hidden; }
.epic-header {
padding: 8px 12px; cursor: pointer;
background: var(--vscode-list-inactiveSelectionBackground, #2a2d2e);
display: flex; align-items: center; gap: 8px; user-select: none;
}
.epic-header:hover { background: var(--vscode-list-hoverBackground); }
.epic-toggle { font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.15s; }
.epic-toggle.open { transform: rotate(90deg); }
.epic-id { font-size: 10px; font-weight: 700; color: var(--vscode-descriptionForeground); }
.epic-name { font-size: 13px; font-weight: 600; flex: 1; }
.epic-count { font-size: 11px; color: var(--vscode-descriptionForeground); }
.epic-body { padding: 8px; display: none; flex-direction: column; gap: 6px; }
.epic-body.open { display: flex; }

.phase { border-left: 2px solid var(--vscode-panel-border, #3c3c3c); margin-left: 4px; padding-left: 10px; }
.phase-header { font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.phase-eta { font-size: 10px; color: var(--vscode-descriptionForeground); font-weight: 400; }

.task-row {
display: flex; align-items: flex-start; gap: 8px; padding: 7px 8px; border-radius: 3px;
background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border, #3c3c3c);
cursor: pointer; transition: border-color 0.12s;
}
.task-row:hover { border-color: var(--vscode-focusBorder, #007fd4); }
.task-row.done { opacity: 0.55; }
.task-row.done .task-title { text-decoration: line-through; }
.task-cb { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; cursor: pointer; accent-color: var(--vscode-button-background); }
.task-info { flex: 1; min-width: 0; }
.task-title { font-size: 12px; font-weight: 500; line-height: 1.4; }
.task-desc { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; line-height: 1.4; }
.task-meta { display: flex; align-items: center; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
.type-badge {
font-size: 9px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
padding: 1px 5px; border-radius: 3px;
}
.type-create  { background: rgba(76,175,80,0.15); color: #81c784; }
.type-modify  { background: rgba(33,150,243,0.15); color: #64b5f6; }
.type-test    { background: rgba(255,152,0,0.15);  color: #ffb74d; }
.type-config  { background: rgba(156,39,176,0.15); color: #ce93d8; }
.type-research{ background: rgba(0,188,212,0.15);  color: #4dd0e1; }
.type-design  { background: rgba(233,30,99,0.15);  color: #f48fb1; }
.file-tag { font-size: 10px; color: var(--vscode-descriptionForeground); font-family: monospace; }

/* ── Trace coverage badges ── */
.trace-badge {
font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; flex-shrink: 0;
}
.trace-covered { background: rgba(76,175,80,0.15);  color: #81c784; }
.trace-partial  { background: rgba(255,152,0,0.15);  color: #ffb74d; }
.trace-missing  { background: rgba(244,67,54,0.12);  color: #ef9a9a; }

.plan-actions { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--vscode-panel-border, #3c3c3c); }
.plan-actions .btn { flex: 1; padding: 8px; font-size: 12px; }
.plan-pre-check-hint { padding: 8px 12px; border-top: 1px solid var(--vscode-panel-border, #3c3c3c); font-size: 11px; }
.pre-check-title { font-weight: 600; margin-bottom: 4px; opacity: 0.8; }
.pre-check-group { display: flex; align-items: baseline; gap: 6px; margin-bottom: 2px; flex-wrap: wrap; }
.pre-check-icon { white-space: nowrap; font-size: 10px; padding: 1px 5px; border-radius: 3px; }
.pre-check-exists { background: rgba(76,175,80,0.15); color: #81c784; }
.pre-check-missing { background: rgba(100,100,255,0.12); color: #9fa8da; }
.pre-check-files { opacity: 0.7; word-break: break-all; }
.pre-check-note { margin-top: 4px; opacity: 0.5; font-style: italic; }

.generating-indicator {
display: flex; align-items: center; gap: 10px; padding: 12px;
background: var(--vscode-editor-background);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
border-radius: 6px; animation: fadeIn 0.2s ease;
}
.spinner {
width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
border: 2px solid var(--vscode-panel-border);
border-top-color: var(--vscode-button-background);
animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.gen-text { font-size: 12px; color: var(--vscode-descriptionForeground); }

/* ── Execute via split button ── */
.exec-via-wrap { position: relative; display: flex; flex: 1; }
.exec-via-btn {
flex: 1; display: flex; align-items: center; gap: 6px;
padding: 8px 12px; border: none; border-radius: 4px 0 0 4px; cursor: pointer;
background: var(--vscode-button-background, #0e639c);
color: var(--vscode-button-foreground, #fff);
font-size: 12px; font-weight: 500;
}
.exec-via-btn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground, #1177bb); }
.exec-via-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.exec-via-caret {
padding: 8px 9px; border: none; border-radius: 0 4px 4px 0; cursor: pointer;
border-left: 1px solid rgba(255,255,255,0.2);
background: var(--vscode-button-background, #0e639c);
color: var(--vscode-button-foreground, #fff); font-size: 9px;
}
.exec-via-caret:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
.exec-via-menu {
display: none; position: absolute; bottom: calc(100% + 4px); left: 0;
min-width: 200px; z-index: 200;
background: var(--vscode-menu-background, #252526);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
border-radius: 4px; overflow: hidden;
box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.exec-via-menu.open { display: block; }
.exec-via-item {
padding: 8px 12px; font-size: 12px; cursor: pointer;
color: var(--vscode-foreground);
display: flex; align-items: center; gap: 8px;
}
.exec-via-item:hover { background: var(--vscode-list-hoverBackground); }
.exec-via-hint { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 6px; }

/* ── Verify button ── */
.verify-row { display: flex; align-items: center; gap: 6px; }
.verify-btn {
padding: 7px 12px; border: none; border-radius: 4px; cursor: pointer;
background: #1565c0; color: #fff; font-size: 12px; font-weight: 500; white-space: nowrap;
}
.verify-btn:hover:not(:disabled) { background: #1976d2; }
.verify-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.verify-btn-sm {
padding: 5px 10px; border: 1px solid #1565c0; border-radius: 4px; cursor: pointer;
background: transparent; color: #64b5f6; font-size: 11px; white-space: nowrap;
}
.verify-btn-sm:hover:not(:disabled) { background: rgba(21,101,192,0.15); }
.verify-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Verification result bubble ── */
.verify-result-bubble {
background: var(--vscode-editor-background);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
border-radius: 6px; padding: 10px 12px; margin-top: 8px;
font-size: 12px; animation: fadeIn 0.2s ease;
}
.vr-header { font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.vr-row { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 5px; }
.vr-icon { flex-shrink: 0; font-size: 13px; }
.vr-task-title { font-weight: 600; }
.vr-notes { color: var(--vscode-descriptionForeground); margin-top: 2px; }
.missing-section {
margin-top: 10px; padding: 8px 10px;
background: rgba(244,67,54,0.07);
border: 1px solid rgba(244,67,54,0.25); border-radius: 4px;
}
.missing-header { font-size: 11px; font-weight: 700; color: #f48fb1; margin-bottom: 6px; }

/* ── PR Review panel ── */
.pr-review-panel {
background: var(--vscode-editor-background);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
border-radius: 6px; padding: 12px;
animation: fadeIn 0.2s ease; width: 100%; flex-shrink: 0;
}
.pr-summary-header {
display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
}
.pr-summary-title { font-size: 13px; font-weight: 700; }
.pr-passed { color: #4caf50; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 8px; background: rgba(76,175,80,0.12); }
.pr-failed { color: #f44336; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 8px; background: rgba(244,67,54,0.12); }
.pr-risk-bar-wrap { margin-bottom: 8px; }
.pr-risk-label { font-size: 10px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; display: flex; justify-content: space-between; }
.pr-risk-bar { height: 5px; border-radius: 3px; background: var(--vscode-panel-border, #3c3c3c); overflow: hidden; }
.pr-risk-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }
.pr-summary-text { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 10px; line-height: 1.5; }
.pr-section-label {
font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px;
color: var(--vscode-descriptionForeground); margin: 8px 0 5px;
}
.finding-card {
padding: 9px 11px; border-radius: 4px; margin-bottom: 6px;
border: 1px solid var(--vscode-panel-border, #3c3c3c);
background: var(--vscode-list-inactiveSelectionBackground, #2a2d2e);
animation: fadeIn 0.15s ease;
}
.finding-header { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; flex-wrap: wrap; }
.finding-severity {
font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
padding: 1px 6px; border-radius: 3px; flex-shrink: 0;
}
.sev-critical { background: rgba(244,67,54,0.2);  color: #f44336; }
.sev-high     { background: rgba(255,152,0,0.2);   color: #ff9800; }
.sev-medium   { background: rgba(255,235,59,0.15); color: #ffe57f; }
.sev-low      { background: rgba(76,175,80,0.15);  color: #81c784; }
.sev-info     { background: rgba(79,195,247,0.15); color: #4fc3f7; }
.finding-category {
font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
padding: 1px 6px; border-radius: 3px;
background: rgba(255,255,255,0.07); color: var(--vscode-descriptionForeground); flex-shrink: 0;
}
.finding-title { font-size: 12px; font-weight: 600; flex: 1; min-width: 0; }
.finding-file { font-size: 10px; font-family: monospace; color: var(--vscode-descriptionForeground); width: 100%; margin-top: 1px; }
.finding-detail { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.5; margin-top: 3px; }
.finding-fix-btn {
margin-top: 6px; padding: 4px 10px; border-radius: 3px; cursor: pointer;
background: rgba(14,99,156,0.25); color: #4fc3f7; font-size: 11px;
border: 1px solid rgba(79,195,247,0.3);
}
.finding-fix-btn:hover { background: rgba(14,99,156,0.45); }
.pr-no-findings { font-size: 13px; color: #4caf50; text-align: center; padding: 14px 0; }
.pr-run-again-btn {
margin-top: 8px; padding: 5px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;
background: transparent; color: var(--vscode-descriptionForeground);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
}
.pr-run-again-btn:hover { color: var(--vscode-foreground); border-color: var(--vscode-focusBorder, #007fd4); }

/* ── Release readiness panel ── */
.release-panel {
background: var(--vscode-editor-background);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
border-radius: 6px; padding: 12px;
animation: fadeIn 0.2s ease; width: 100%; flex-shrink: 0;
}
.release-header {
display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.release-title { font-size: 13px; font-weight: 700; }
.release-passed { color: #4caf50; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 8px; background: rgba(76,175,80,0.12); }
.release-failed { color: #f44336; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 8px; background: rgba(244,67,54,0.12); }
.release-summary { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 10px; line-height: 1.5; }
.check-row {
display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 4px;
border-radius: 4px; background: var(--vscode-list-inactiveSelectionBackground, #2a2d2e);
font-size: 12px;
}
.check-icon-pass { color: #4caf50; font-weight: 700; flex-shrink: 0; }
.check-icon-fail { color: #f44336; font-weight: 700; flex-shrink: 0; }
.check-name { flex: 1; font-weight: 500; }
.check-duration { font-size: 10px; color: var(--vscode-descriptionForeground); }
.check-error {
font-size: 10px; color: #ef9a9a; margin-top: 3px; font-family: monospace;
white-space: pre-wrap; word-break: break-all; padding: 4px 6px;
background: rgba(244,67,54,0.06); border-radius: 3px;
}
.release-run-again-btn {
margin-top: 8px; padding: 5px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;
background: transparent; color: var(--vscode-descriptionForeground);
border: 1px solid var(--vscode-panel-border, #3c3c3c);
}
.release-run-again-btn:hover { color: var(--vscode-foreground); border-color: var(--vscode-focusBorder, #007fd4); }

/* ── Checkpoint timeline ── */
.ckpt-strip { padding: 6px 12px; border-top: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.ckpt-strip-header { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.7px; cursor: pointer; padding: 4px 0; }
.ckpt-strip-header:hover { color: var(--vscode-foreground); }
.ckpt-list { display: none; margin-top: 4px; max-height: 180px; overflow-y: auto; }
.ckpt-list.open { display: block; }
.ckpt-row { display: flex; align-items: center; gap: 8px; padding: 5px 4px; border-radius: 4px; cursor: pointer; }
.ckpt-row:hover { background: var(--vscode-list-hoverBackground); }
.ckpt-dot { width: 8px; height: 8px; border-radius: 50%; background: #4fc3f7; flex-shrink: 0; }
.ckpt-info { flex: 1; min-width: 0; }
.ckpt-label { font-size: 12px; color: var(--vscode-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ckpt-time { font-size: 10px; color: var(--vscode-descriptionForeground); }
.ckpt-restore-btn { font-size: 10px; padding: 2px 6px; border-radius: 3px; border: 1px solid var(--vscode-panel-border); background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; white-space: nowrap; }
.ckpt-restore-btn:hover { border-color: #4fc3f7; color: #4fc3f7; }
.ckpt-preview-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.ckpt-preview-box { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 16px; max-width: 480px; width: 90%; max-height: 70vh; overflow-y: auto; }
.ckpt-preview-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
.ckpt-diff-row { font-size: 11px; font-family: monospace; color: var(--vscode-descriptionForeground); padding: 3px 6px; border-radius: 3px; margin-bottom: 3px; background: var(--vscode-list-inactiveSelectionBackground); }
.ckpt-preview-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }
.stack-picker { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 14px 16px; margin: 10px 0; }
.stack-picker-title { font-size: 13px; font-weight: 700; color: var(--vscode-foreground); margin-bottom: 3px; }
.stack-picker-sub { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 14px; }
.stack-question { margin-bottom: 12px; }
.stack-question-label { font-size: 10px; font-weight: 700; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
.stack-options { display: flex; flex-wrap: wrap; gap: 6px; }
.stack-opt { padding: 4px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 12px; font-size: 12px; cursor: pointer; background: transparent; color: var(--vscode-foreground); }
.stack-opt:hover { border-color: #667eea; color: #667eea; }
.stack-opt.selected { background: rgba(102,126,234,0.15); border-color: #667eea; color: #667eea; font-weight: 600; }
.stack-picker-actions { display: flex; gap: 8px; margin-top: 14px; }
.stack-generate-btn { flex: 1; padding: 7px; background: #667eea; color: #fff; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
.stack-generate-btn:hover { background: #5a67d8; }
.stack-generate-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.stack-skip-btn { padding: 7px 12px; background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--vscode-panel-border); border-radius: 6px; font-size: 12px; cursor: pointer; }
.stack-skip-btn:hover { color: var(--vscode-foreground); }
.history-panel { display: none; border-bottom: 1px solid var(--vscode-panel-border); max-height: 180px; overflow-y: auto; background: var(--vscode-sideBar-background); }
.history-item { padding: 6px 14px; cursor: pointer; font-size: 12px; color: var(--vscode-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 2px solid transparent; }
.history-item:hover { background: var(--vscode-list-hoverBackground); }
.history-item.active { border-left-color: #667eea; background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.history-empty { padding: 10px 14px; font-size: 11px; color: var(--vscode-descriptionForeground); }
</style>
</head><body>

<div class="topbar">
<span class="topbar-title">OpenKode</span>
<div class="pill-btn" id="providerBtn" title="Change LLM provider">${prov?.name || 'Provider'}</div>
<button class="icon-btn" id="releaseCheckBtn" title="Release readiness check">✓</button>
<button class="icon-btn" id="prReviewBtn" title="Review PR / changed files">⚑</button>
<button class="icon-btn" id="historyBtn" title="Chat history">☰</button>
<button class="icon-btn" id="newChatBtn" title="New chat">＋</button>
<button class="icon-btn" id="logoutBtn" title="Logout">⏻</button>
</div>

<div class="history-panel" id="historyPanel">
<div class="history-list" id="historyList"><div class="history-empty">No previous chats</div></div>
</div>

<div class="mode-bar">${modeTabs}</div>

<div class="chat-area" id="chatArea">
<div class="empty-state" id="emptyState">
    <span class="es-icon">💬</span>
    <p>Ask a question about your code, describe a feature to build, or request an architecture review.</p>
</div>
</div>

<div class="byollm-overlay hidden" id="byollmOverlay">
  <div class="byollm-modal">
    <p class="byollm-modal-title">BYO&#8209;LLM Mode</p>
    <p class="byollm-modal-body">Operating in BYO&#8209;LLM mode, OpenKode does not guarantee the accuracy of the generated output.</p>
    <button class="byollm-ok-btn" id="byollmOkBtn">OK</button>
  </div>
</div>

<div class="toast" id="errorToast"></div>

<div class="usage-bar-wrap" id="usageBarWrap" style="${plan === 'auto' ? 'display:flex' : 'display:none'}">
  <div class="usage-bar-track">
    <div class="usage-bar-fill" id="usageBarFill" style="width:0%"></div>
  </div>
  <span class="usage-bar-label" id="usageBarLabel">&#x2014; / &#x2014; requests</span>
  <span class="usage-bar-reset" id="usageBarReset"></span>
</div>

<div class="input-bar">
<textarea id="msgInput" placeholder="Ask OpenKode..." rows="1"
    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg();}"></textarea>
<button class="send-btn" id="sendBtn" title="Send (Enter)" onclick="sendMsg()">›</button>
</div>

<script>
window.onerror = function(msg, src, line) {
var toast = document.getElementById('errorToast');
if (toast) { toast.textContent = 'Script error: ' + msg + ' (line ' + line + ')'; toast.className = 'toast show'; }
};
const vscode = acquireVsCodeApi();
const chatArea = document.getElementById('chatArea');
const emptyState = document.getElementById('emptyState');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const errorToast = document.getElementById('errorToast');

let streaming = false;
let streamBubble = null;
let currentMode = '${activeMode}';

// Mode tabs
document.querySelectorAll('.mode-tab').forEach(btn => {
btn.onclick = () => {
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    vscode.postMessage({ command: 'selectMode', mode: currentMode });
};
});

try {
document.getElementById('providerBtn').onclick = () => vscode.postMessage({ command: 'changeProvider' });
document.getElementById('newChatBtn').onclick = () => { clearChat(); vscode.postMessage({ command: 'newChat' }); };
document.getElementById('logoutBtn').onclick = () => vscode.postMessage({ command: 'logout' });
document.getElementById('releaseCheckBtn').onclick = () => runReleaseCheck();
document.getElementById('prReviewBtn').onclick = () => runPRReview();
document.getElementById('historyBtn').onclick = () => {
    var panel = document.getElementById('historyPanel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
};
} catch(e) { console.error('[OpenKode] Init error:', e); }

// Send — also wired via inline onclick/onkeydown on the elements
if (sendBtn) sendBtn.onclick = sendMsg;
if (msgInput) {
msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});
msgInput.addEventListener('input', autoResize);
}

function autoResize() {
msgInput.style.height = 'auto';
msgInput.style.height = Math.min(msgInput.scrollHeight, 140) + 'px';
}

let streamTimeout = null;

function sendMsg() {
var input = msgInput || document.getElementById('msgInput');
var btn   = sendBtn  || document.getElementById('sendBtn');
if (!input) return;
const text = input.value.trim();
if (!text || streaming) return;
input.value = '';
autoResize();
hideEmpty();
appendMsg('user', escapeHtml(text));
streaming = true;
if (btn) btn.disabled = true;
vscode.postMessage({ command: 'sendMessage', text, mode: currentMode });
// Safety valve: if no response in 90s, unlock the input
if (streamTimeout) clearTimeout(streamTimeout);
streamTimeout = setTimeout(() => { if (streaming) endStream(); }, 90000);
}

function escapeHtml(s) {
return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function hideEmpty() {
emptyState.style.display = 'none';
}

function appendMsg(role, htmlContent) {
hideEmpty();
const div = document.createElement('div');
div.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
div.innerHTML = '<div class="avatar">' + (role === 'user' ? 'U' : 'K') + '</div>'
              + '<div class="bubble">' + htmlContent + '</div>';
chatArea.appendChild(div);
chatArea.scrollTop = chatArea.scrollHeight;
return div.querySelector('.bubble');
}

function renderMarkdown(text) {
var bt = String.fromCharCode(96);
var tripleRe = new RegExp(bt+bt+bt+'(\\\\w*)\\\\n?([\\\\s\\\\S]*?)'+bt+bt+bt, 'g');
var inlineRe = new RegExp(bt+'([^'+bt+'\\\\n]+)'+bt, 'g');
return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(tripleRe, function(m, lang, code) {
        return '<pre><code>' + code.trim() + '</code></pre>';
    })
    .replace(inlineRe, '<code>$1</code>')
    .replace(/\\*\\*([^*\\n]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*([^*\\n]+)\\*/g, '<em>$1</em>')
    .replace(/\\n/g, '<br>');
}

window.addEventListener('message', e => {
const msg = e.data;

if (msg.type === 'streamStart') {
    hideEmpty();
    const div = document.createElement('div');
    div.className = 'msg ai';
    div.innerHTML = '<div class="avatar">K</div><div class="bubble"><span class="stream-text"></span><span class="cursor"></span></div>';
    chatArea.appendChild(div);
    streamBubble = div.querySelector('.stream-text');
    chatArea.scrollTop = chatArea.scrollHeight;
}
else if (msg.type === 'streamToken' && streamBubble) {
    streamBubble.textContent += msg.content;
    chatArea.scrollTop = chatArea.scrollHeight;
}
else if (msg.type === 'streamEnd' && streamBubble) {
    const raw = streamBubble.textContent || '';
    const bubble = streamBubble.closest('.bubble');
    if (bubble) bubble.innerHTML = renderMarkdown(raw);
    streamBubble = null;
    endStream();
}
else if (msg.type === 'streamError') {
    if (streamBubble) {
        const bubble = streamBubble.closest('.bubble');
        if (bubble) bubble.innerHTML = '<span style="color:#f48fb1">Error: ' + escapeHtml(msg.error || 'Unknown error') + '</span>';
    }
    streamBubble = null;
    showError(msg.error || 'LLM error');
    endStream();
}
else if (msg.type === 'loadConversation') {
    clearChat();
    if (msg.messages) {
        msg.messages.filter(m => m.role !== 'system').forEach(m => {
            appendMsg(m.role === 'user' ? 'user' : 'ai', renderMarkdown(m.content));
        });
    }
}
else if (msg.type === 'stackQuestionsReady') {
    endStream();
    renderStackPicker(msg.questions, msg.originalText);
}
else if (msg.type === 'updateChatHistory') {
    var list = document.getElementById('historyList');
    if (!list) return;
    var convs = msg.conversations || [];
    if (convs.length === 0) {
        list.innerHTML = '<div class="history-empty">No previous chats</div>';
        return;
    }
    list.innerHTML = '';
    convs.forEach(function(c) {
        var item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = c.title || 'Chat';
        item.dataset.id = c.id;
        item.onclick = function() {
            document.getElementById('historyPanel').style.display = 'none';
            document.querySelectorAll('.history-item').forEach(function(el) { el.classList.remove('active'); });
            item.classList.add('active');
            vscode.postMessage({ command: 'loadConversation', conversationId: c.id });
        };
        list.appendChild(item);
    });
}
else if (msg.type === 'modeSet') {
    currentMode = msg.mode;
    document.querySelectorAll('.mode-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === msg.mode);
    });
}
else if (msg.type === 'planGenerating') {
    hideEmpty();
    const modeLabels = { precision: 'Precision', blueprint: 'Blueprint', visionary: 'Visionary', rocket: 'Rocket' };
    const label = modeLabels[msg.mode] || msg.mode;
    const ind = document.createElement('div');
    ind.className = 'generating-indicator';
    ind.id = 'planGenerating';
    ind.innerHTML = '<div class="spinner"></div><span class="gen-text">Generating ' + label + ' execution plan\u2026</span>';
    chatArea.appendChild(ind);
    chatArea.scrollTop = chatArea.scrollHeight;
    sendBtn.disabled = true;
    streaming = true;
}
else if (msg.type === 'planReady') {
    const ind = document.getElementById('planGenerating');
    if (ind) ind.remove();
    renderPlanCard(msg.plan);
    streaming = false;
    sendBtn.disabled = false;
}
else if (msg.type === 'error') {
    const ind = document.getElementById('planGenerating');
    if (ind) ind.remove();
    showError(msg.message);
    endStream();
}
else if (msg.type === 'detailedPlanReady') {
    var genCard = document.querySelector('.plan-card[data-plan-state="generating-detail"]');
    if (genCard) {
        genCard.dataset.detailedPlan = msg.detailedPlan;
        genCard.dataset.availableTools = JSON.stringify(msg.availableTools || ['clipboard']);
        setPlanState(genCard, 'ready-to-execute');
    }
}
else if (msg.type === 'preCheckResult') {
    var pcCard = document.querySelector('.plan-card[data-plan-state="generating-detail"]');
    if (pcCard && msg.preCheckStatus) {
        var pcStatus = msg.preCheckStatus;
        var existFiles = Object.keys(pcStatus).filter(function(f) { return pcStatus[f] === 'exists'; });
        var missingFiles = Object.keys(pcStatus).filter(function(f) { return pcStatus[f] === 'missing'; });
        var pcHint = pcCard.querySelector('.plan-pre-check-hint');
        if (!pcHint) {
            pcHint = document.createElement('div');
            pcHint.className = 'plan-pre-check-hint';
            var actionsEl = pcCard.querySelector('.plan-actions');
            if (actionsEl) { pcCard.insertBefore(pcHint, actionsEl); }
            else { pcCard.appendChild(pcHint); }
        }
        var hintHtml = '<div class="pre-check-title">File pre-check</div>';
        if (existFiles.length > 0) {
            hintHtml += '<div class="pre-check-group"><span class="pre-check-icon pre-check-exists">\u2713 exists</span><span class="pre-check-files">' + existFiles.map(function(f) { return escapeHtml(f); }).join(', ') + '</span></div>';
        }
        if (missingFiles.length > 0) {
            hintHtml += '<div class="pre-check-group"><span class="pre-check-icon pre-check-missing">\u2717 new</span><span class="pre-check-files">' + missingFiles.map(function(f) { return escapeHtml(f); }).join(', ') + '</span></div>';
        }
        hintHtml += '<div class="pre-check-note">LLM is checking which tasks are already done\u2026</div>';
        pcHint.innerHTML = hintHtml;
    }
}
else if (msg.type === 'detailedPlanFailed') {
    var failCard = document.querySelector('.plan-card[data-plan-state="generating-detail"]');
    if (failCard) {
        var totalTasks2 = failCard.querySelectorAll('.task-row').length;
        var actionsArea2 = failCard.querySelector('.plan-actions');
        if (actionsArea2) {
            actionsArea2.innerHTML =
                '<button class="btn btn-secondary" onclick="askAboutPlan(this)">Ask about this plan</button>'
                + '<button class="btn btn-primary" onclick="executePlan(this)">Execute Plan (' + totalTasks2 + ' tasks)</button>';
        }
        failCard.dataset.planState = 'pending';
    }
}
else if (msg.type === 'executeViaConfirm') {
    showSuccess(msg.message || 'Done.');
}
else if (msg.type === 'verificationComplete') {
    var verCard = document.querySelector('.plan-card[data-is-verifying="true"]');
    if (verCard) {
        verCard.dataset.isVerifying = 'false';
        renderVerificationResults(verCard, msg.results);
    }
}
else if (msg.type === 'verificationFailed') {
    var failVerCard = document.querySelector('.plan-card[data-is-verifying="true"]');
    if (failVerCard) {
        failVerCard.dataset.isVerifying = 'false';
        var retryBtn = failVerCard.querySelector('.verify-btn, .verify-btn-sm');
        if (retryBtn) { retryBtn.disabled = false; retryBtn.textContent = '\u21ba Retry'; }
    }
}
else if (msg.type === 'prReviewStarted') {
    hideEmpty();
    var prInd = document.createElement('div');
    prInd.className = 'generating-indicator';
    prInd.id = 'prReviewGenerating';
    prInd.innerHTML = '<div class="spinner"></div><span class="gen-text">Analyzing changed files\u2026</span>';
    chatArea.appendChild(prInd);
    chatArea.scrollTop = chatArea.scrollHeight;
}
else if (msg.type === 'prReviewComplete') {
    var prInd2 = document.getElementById('prReviewGenerating');
    if (prInd2) { prInd2.remove(); }
    renderPRFindings(msg.result);
}
else if (msg.type === 'prReviewFailed') {
    var prInd3 = document.getElementById('prReviewGenerating');
    if (prInd3) { prInd3.remove(); }
    showError('PR review failed: ' + (msg.error || 'Unknown error'));
}
else if (msg.type === 'injectChat') {
    if (msg.text) {
        msgInput.value = msg.text;
        autoResize();
        msgInput.focus();
    }
}
else if (msg.type === 'traceCoverage') {
    applyTraceBadges(msg.map || {});
}
else if (msg.type === 'releaseCheckStarted') {
    hideEmpty();
    var relInd = document.createElement('div');
    relInd.className = 'generating-indicator';
    relInd.id = 'releaseCheckGenerating';
    relInd.innerHTML = '<div class="spinner"></div><span class="gen-text">Running release checks\u2026</span>';
    chatArea.appendChild(relInd);
    chatArea.scrollTop = chatArea.scrollHeight;
}
else if (msg.type === 'releaseCheckComplete') {
    var relInd2 = document.getElementById('releaseCheckGenerating');
    if (relInd2) { relInd2.remove(); }
    renderReleaseCheck(msg.result);
}
else if (msg.type === 'releaseCheckFailed') {
    var relInd3 = document.getElementById('releaseCheckGenerating');
    if (relInd3) { relInd3.remove(); }
    showError('Release check failed: ' + (msg.error || 'Unknown error'));
}
});

function renderPlanCard(plan) {
hideEmpty();
const modeColors = { precision: '#4fc3f7', blueprint: '#81c784', visionary: '#ffb74d', rocket: '#ef5350' };
const mc = modeColors[plan.mode] || '#667eea';

let clarHtml = '';
if (plan.clarifications && plan.clarifications.length > 0) {
    const items = plan.clarifications.map(q => '<li>' + escapeHtml(q) + '</li>').join('');
    clarHtml = '<div class="clarifications"><div class="cl-title">⚠ Clarifications Needed</div><ol>' + items + '</ol></div>';
}

let approachesHtml = '';
if (plan.approaches && plan.approaches.length > 0) {
    approachesHtml = '<div class="approaches">' + plan.approaches.map(a => {
        const pros = (a.pros||[]).map(p => '<li>' + escapeHtml(p) + '</li>').join('');
        const cons = (a.cons||[]).map(c => '<li>' + escapeHtml(c) + '</li>').join('');
        return '<div class="approach-card' + (a.recommended ? ' recommended' : '') + '">'
            + '<div class="approach-title">' + escapeHtml(a.title)
            + (a.recommended ? '<span class="rec-badge">Recommended</span>' : '') + '</div>'
            + '<div class="approach-desc">' + escapeHtml(a.description) + '</div>'
            + '<div class="pcons"><div class="pros"><div class="pc-label">Pros</div><ul>' + pros + '</ul></div>'
            + '<div class="cons"><div class="pc-label">Cons</div><ul>' + cons + '</ul></div></div>'
            + '</div>';
    }).join('') + '</div>';
}

let totalTasks = 0;
const epicsHtml = (plan.epics || []).map((epic, ei) => {
    const phasesHtml = (epic.phases || []).map(phase => {
        const tasksHtml = (phase.tasks || []).map(task => {
            totalTasks++;
            const files = (task.files || []).map(f => '<span class="file-tag">' + escapeHtml(f) + '</span>').join(' ');
            return '<div class="task-row" data-id="' + task.id + '">'
                + '<input class="task-cb" type="checkbox" onclick="toggleTask(this)">'
                + '<div class="task-info">'
                + '<div class="task-title">' + escapeHtml(task.title) + '</div>'
                + '<div class="task-desc">' + escapeHtml(task.description) + '</div>'
                + '<div class="task-meta">'
                + '<span class="type-badge type-' + (task.type||'create') + '">' + (task.type||'create') + '</span>'
                + files
                + '</div></div></div>';
        }).join('');
        const eta = phase.estimatedHours ? ' <span class="phase-eta">~' + phase.estimatedHours + 'h</span>' : '';
        return '<div class="phase"><div class="phase-header">' + escapeHtml(phase.title) + eta + '</div>' + tasksHtml + '</div>';
    }).join('');

    const taskCount = (epic.phases||[]).reduce((s,p) => s + (p.tasks||[]).length, 0);
    return '<div class="epic">'
        + '<div class="epic-header" onclick="toggleEpic(this)">'
        + '<span class="epic-toggle' + (ei === 0 ? ' open' : '') + '">&#9658;</span>'
        + '<span class="epic-id">' + escapeHtml(epic.id) + '</span>'
        + '<span class="epic-name">' + escapeHtml(epic.title) + '</span>'
        + '<span class="epic-count">' + taskCount + ' tasks</span>'
        + '</div>'
        + '<div class="epic-body' + (ei === 0 ? ' open' : '') + '">' + phasesHtml + '</div>'
        + '</div>';
}).join('');

const card = document.createElement('div');
card.className = 'plan-card';
card.innerHTML =
    '<div class="plan-header">'
    + '<div class="plan-title">\uD83D\uDCCB ' + escapeHtml(plan.title) + '</div>'
    + '<div class="plan-summary">' + escapeHtml(plan.summary) + '</div>'
    + '<span class="plan-mode-badge" style="background:' + mc + '22;color:' + mc + '">' + (plan.mode||'').toUpperCase() + ' MODE</span>'
    + '</div>'
    + '<div class="plan-body">' + clarHtml + approachesHtml + epicsHtml + '</div>'
    + '<div class="plan-actions">'
    + '<button class="btn btn-secondary" onclick="askAboutPlan(this)">Ask about this plan</button>'
    + '<button class="btn btn-primary" onclick="executePlan(this)">Execute Plan (' + totalTasks + ' tasks)</button>'
    + '</div>';
// Store serialized plan for button context (JSON.stringify may contain quotes; use dataset)
card.dataset.plan = JSON.stringify(plan);
chatArea.appendChild(card);
chatArea.scrollTop = chatArea.scrollHeight;

// Request existing coverage badges for all tasks
var allTaskIds2 = [];
(plan.epics || []).forEach(function(epic) {
    (epic.phases || []).forEach(function(phase) {
        (phase.tasks || []).forEach(function(task) { allTaskIds2.push(task.id); });
    });
});
if (allTaskIds2.length > 0) {
    vscode.postMessage({ command: 'getTraceCoverage', taskIds: allTaskIds2 });
}
}

function toggleEpic(header) {
const toggle = header.querySelector('.epic-toggle');
const body = header.nextElementSibling;
toggle.classList.toggle('open');
body.classList.toggle('open');
}

function toggleTask(cb) {
cb.closest('.task-row').classList.toggle('done', cb.checked);
}

function askAboutPlan(btn) {
const card = btn.closest('.plan-card');
const plan = card && card.dataset.plan ? JSON.parse(card.dataset.plan) : {};
const epicList = (plan.epics || []).map(function(e) { return e.title; }).join(', ');
const context = plan.title
    ? 'Regarding the execution plan "' + plan.title + '" with epics: ' + epicList + ' — '
    : '';
msgInput.value = context + 'Can you clarify the approach and answer questions about this plan?';
msgInput.focus();
}

function executePlan(btn) {
var card = btn.closest('.plan-card');
if (!card) { return; }
var plan = card.dataset.plan ? JSON.parse(card.dataset.plan) : {};
setPlanState(card, 'generating-detail');
vscode.postMessage({ command: 'generateDetailedPlan', plan: plan });
}

function setPlanState(card, state) {
card.dataset.planState = state;
var actionsArea = card.querySelector('.plan-actions');
if (!actionsArea) { return; }

if (state === 'generating-detail') {
    actionsArea.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;padding:4px 0">'
        + '<div class="spinner"></div>'
        + '<span style="font-size:12px;color:var(--vscode-descriptionForeground)">Generating detailed implementation guide\u2026</span>'
        + '</div>';
} else if (state === 'ready-to-execute') {
    var tools = card.dataset.availableTools ? JSON.parse(card.dataset.availableTools) : ['clipboard'];
    actionsArea.innerHTML = buildExecuteViaHtml(tools);
    wireExecuteVia(card);
} else if (state === 'executing') {
    var tools2 = card.dataset.availableTools ? JSON.parse(card.dataset.availableTools) : ['clipboard'];
    actionsArea.innerHTML = '<div class="verify-row" style="width:100%">'
        + buildExecuteViaHtml(tools2)
        + '<button class="verify-btn" onclick="verifyPlan(this)">\u2713 Verify</button>'
        + '</div>';
    wireExecuteVia(card);
} else if (state === 'verifying') {
    var vBtn = card.querySelector('.verify-btn');
    if (vBtn) { vBtn.disabled = true; vBtn.textContent = 'Verifying\u2026'; }
}
}

function buildExecuteViaHtml(tools) {
var toolLabels = {
    clipboard: { label: 'Copy to Clipboard', icon: '\uD83D\uDCCB' },
    copilot:   { label: 'GitHub Copilot Chat', icon: '\uD83E\uDD16' },
    continue:  { label: 'Continue.dev', icon: '\u25B6' },
    cline:     { label: 'Cline', icon: '\u2699' }
};
var primaryTool = tools[0] || 'clipboard';
var primaryInfo = toolLabels[primaryTool] || { label: primaryTool, icon: '' };
var menuItems = '';
for (var i = 0; i < tools.length; i++) {
    var info = toolLabels[tools[i]] || { label: tools[i], icon: '' };
    menuItems += '<div class="exec-via-item" data-tool="' + tools[i] + '">'
        + info.icon + ' ' + escapeHtml(info.label) + '</div>';
}
return '<div class="exec-via-wrap">'
    + '<button class="exec-via-btn" data-primary-tool="' + primaryTool + '">'
    + primaryInfo.icon + ' ' + escapeHtml(primaryInfo.label)
    + '</button>'
    + '<button class="exec-via-caret" title="More options">\u25BE</button>'
    + '<div class="exec-via-menu">' + menuItems + '</div>'
    + '</div>';
}

function wireExecuteVia(card) {
var wrap = card.querySelector('.exec-via-wrap');
if (!wrap) { return; }
var primaryBtn = wrap.querySelector('.exec-via-btn');
var caretBtn = wrap.querySelector('.exec-via-caret');
var menu = wrap.querySelector('.exec-via-menu');

primaryBtn.onclick = function() {
    doExecuteVia(card, primaryBtn.dataset.primaryTool || 'clipboard');
};
caretBtn.onclick = function(e) {
    e.stopPropagation();
    menu.classList.toggle('open');
};
document.addEventListener('click', function() { menu.classList.remove('open'); });
var items = menu.querySelectorAll('.exec-via-item');
items.forEach(function(item) {
    item.onclick = function(e) {
        e.stopPropagation();
        menu.classList.remove('open');
        doExecuteVia(card, item.dataset.tool);
    };
});
}

function doExecuteVia(card, method) {
var detailedPlan = card.dataset.detailedPlan || '';
vscode.postMessage({ command: 'executeVia', method: method, detailedPlan: detailedPlan });
setPlanState(card, 'executing');
}

function verifyPlan(btn) {
var card = btn.closest('.plan-card');
if (!card) { return; }
var plan = card.dataset.plan ? JSON.parse(card.dataset.plan) : {};
var allTasks = [];
(plan.epics || []).forEach(function(epic) {
    (epic.phases || []).forEach(function(phase) {
        (phase.tasks || []).forEach(function(task) { allTasks.push(task); });
    });
});
card.dataset.isVerifying = 'true';
setPlanState(card, 'verifying');
vscode.postMessage({ command: 'verifyExecution', tasks: allTasks, planTitle: plan.title || 'Plan' });
}

function renderVerificationResults(card, results) {
var plan = card.dataset.plan ? JSON.parse(card.dataset.plan) : {};
var taskMap = {};
(plan.epics || []).forEach(function(epic) {
    (epic.phases || []).forEach(function(phase) {
        (phase.tasks || []).forEach(function(task) { taskMap[task.id] = task; });
    });
});

var planId = plan.id || plan.title || 'plan';
var coverageUpdate = {};
results.forEach(function(result) {
    var task = taskMap[result.taskId];
    if (result.completed) {
        var taskRow = card.querySelector('.task-row[data-id="' + result.taskId + '"]');
        if (taskRow) {
            var cb = taskRow.querySelector('.task-cb');
            if (cb && !cb.checked) { cb.checked = true; toggleTask(cb); }
        }
        coverageUpdate[result.taskId] = 'covered';
        // Persist trace link
        vscode.postMessage({
            command: 'saveTraceLink',
            taskId: result.taskId,
            planId: planId,
            taskTitle: task ? task.title : result.taskId,
            changedFiles: task ? (task.files || []) : [],
            testFiles: [],
            evidence: result.notes || undefined
        });
    } else {
        coverageUpdate[result.taskId] = 'partial';
    }
});

// Apply badges immediately without waiting for backend round-trip
applyTraceBadges(coverageUpdate);
autoAdvancePhases(card);

var completedCount = results.filter(function(r) { return r.completed; }).length;
var totalCount = results.length;
var allDone = completedCount === totalCount;
var headerColor = allDone ? '#4caf50' : '#ff9800';
var headerText = allDone
    ? '\u2713 All ' + totalCount + ' tasks verified complete!'
    : completedCount + '/' + totalCount + ' tasks complete';

var rowsHtml = '';
results.forEach(function(result) {
    var task = taskMap[result.taskId];
    var title = task ? task.title : result.taskId;
    rowsHtml += '<div class="vr-row">'
        + '<span class="vr-icon" style="color:' + (result.completed ? '#4caf50' : '#f48fb1') + '">'
        + (result.completed ? '\u2713' : '\u2717') + '</span>'
        + '<div><div class="vr-task-title" style="color:' + (result.completed ? '#4caf50' : '#f48fb1') + '">'
        + escapeHtml(title) + '</div>'
        + '<div class="vr-notes">' + escapeHtml(result.notes) + '</div></div></div>';
});

var missing = results.filter(function(r) { return !r.completed; });
var missingHtml = '';
if (missing.length > 0) {
    var missingItems = missing.map(function(r) {
        var task = taskMap[r.taskId];
        return '<div style="margin-bottom:6px"><strong>' + escapeHtml(task ? task.title : r.taskId) + '</strong>'
            + '<div style="color:var(--vscode-descriptionForeground);margin-top:2px">' + escapeHtml(r.notes) + '</div></div>';
    }).join('');
    missingHtml = '<div class="missing-section"><div class="missing-header">What\\'s Missing</div>' + missingItems + '</div>';
}

var bubble = document.createElement('div');
bubble.className = 'verify-result-bubble';
bubble.innerHTML = '<div class="vr-header" style="color:' + headerColor + '">' + headerText + '</div>'
    + rowsHtml + missingHtml;

var planBody = card.querySelector('.plan-body');
if (planBody) { planBody.appendChild(bubble); }

var vBtn = card.querySelector('.verify-btn');
if (vBtn) { vBtn.disabled = false; vBtn.className = 'verify-btn-sm'; vBtn.textContent = '\u21ba Re-verify'; }
}

function autoAdvancePhases(card) {
var epics = card.querySelectorAll('.epic');
epics.forEach(function(epic) {
    var allEpicTasks = epic.querySelectorAll('.task-row');
    var allEpicDone = epic.querySelectorAll('.task-row.done');
    if (allEpicTasks.length > 0 && allEpicTasks.length === allEpicDone.length) {
        var epicBody = epic.querySelector('.epic-body');
        var epicToggle = epic.querySelector('.epic-toggle');
        if (epicBody && epicBody.classList.contains('open')) {
            epicBody.classList.remove('open');
            if (epicToggle) { epicToggle.classList.remove('open'); }
        }
        var nextEpic = epic.nextElementSibling;
        if (nextEpic && nextEpic.classList.contains('epic')) {
            var nextBody = nextEpic.querySelector('.epic-body');
            var nextToggle = nextEpic.querySelector('.epic-toggle');
            if (nextBody && !nextBody.classList.contains('open')) {
                nextBody.classList.add('open');
                if (nextToggle) { nextToggle.classList.add('open'); }
            }
        }
    }
});
}

function showSuccess(successMsg) {
errorToast.style.background = 'rgba(76,175,80,0.12)';
errorToast.style.borderColor = 'rgba(76,175,80,0.35)';
errorToast.style.color = '#81c784';
errorToast.textContent = successMsg;
errorToast.classList.add('show');
setTimeout(function() {
    errorToast.classList.remove('show');
    errorToast.style.background = '';
    errorToast.style.borderColor = '';
    errorToast.style.color = '';
}, 4000);
}

function renderStackPicker(questions, originalText) {
hideEmpty();
var card = document.createElement('div');
card.className = 'stack-picker';
card.dataset.originalText = originalText;
var html = '<div class="stack-picker-title">Quick Setup</div>'
    + '<div class="stack-picker-sub">A few decisions before I create your plan:</div>';
questions.forEach(function(q) {
    html += '<div class="stack-question" data-qid="' + escapeHtml(q.id) + '">'
        + '<div class="stack-question-label">' + escapeHtml(q.label) + '</div>'
        + '<div class="stack-options">';
    (q.options || []).forEach(function(opt) {
        html += '<button class="stack-opt" onclick="selectStackOpt(this)">' + escapeHtml(opt) + '</button>';
    });
    html += '</div></div>';
});
html += '<div class="stack-picker-actions">'
    + '<button class="stack-skip-btn" onclick="skipStackPicker(this)">Skip, use defaults</button>'
    + '<button class="stack-generate-btn" onclick="submitStackChoices(this)" disabled>Generate Plan \u2192</button>'
    + '</div>';
card.innerHTML = html;
chatArea.appendChild(card);
chatArea.scrollTop = chatArea.scrollHeight;
}

function selectStackOpt(btn) {
var group = btn.closest('.stack-options');
group.querySelectorAll('.stack-opt').forEach(function(b) { b.classList.remove('selected'); });
btn.classList.add('selected');
var card = btn.closest('.stack-picker');
var totalQ = card.querySelectorAll('.stack-question').length;
var answeredQ = new Set();
card.querySelectorAll('.stack-opt.selected').forEach(function(b) {
    answeredQ.add(b.closest('.stack-question').dataset.qid);
});
card.querySelector('.stack-generate-btn').disabled = answeredQ.size < totalQ;
}

function submitStackChoices(btn) {
var card = btn.closest('.stack-picker');
var answers = {};
card.querySelectorAll('.stack-question').forEach(function(q) {
    var sel = q.querySelector('.stack-opt.selected');
    if (sel) { answers[q.dataset.qid] = sel.textContent.trim(); }
});
_lockStackPicker(card, 'Generating plan\u2026');
vscode.postMessage({ command: 'stackAnswered', answers: answers });
}

function skipStackPicker(btn) {
var card = btn.closest('.stack-picker');
_lockStackPicker(card, 'Generating plan\u2026');
vscode.postMessage({ command: 'stackAnswered', answers: {} });
}

function _lockStackPicker(card, label) {
card.querySelectorAll('.stack-opt, .stack-generate-btn, .stack-skip-btn').forEach(function(b) { b.disabled = true; });
var genBtn = card.querySelector('.stack-generate-btn');
if (genBtn) { genBtn.textContent = label; genBtn.disabled = true; }
}

function runReleaseCheck() {
vscode.postMessage({ command: 'runReleaseCheck' });
}

function renderReleaseCheck(result) {
hideEmpty();
var checks = result.checks || [];
var passed = result.passed;
var summary = result.summary || '';

var checksHtml = '';
checks.forEach(function(c) {
    var isPass = c.status === 'pass';
    var durText = c.durationMs > 0 ? (c.durationMs / 1000).toFixed(1) + 's' : '';
    checksHtml += '<div class="check-row">'
        + '<span class="' + (isPass ? 'check-icon-pass' : 'check-icon-fail') + '">'
        + (isPass ? '\u2713' : '\u2717') + '</span>'
        + '<span class="check-name">' + escapeHtml(c.name) + '</span>'
        + (durText ? '<span class="check-duration">' + durText + '</span>' : '')
        + '</div>'
        + (c.error ? '<div class="check-error">' + escapeHtml(c.error.slice(0, 300)) + '</div>' : '');
});

var panel = document.createElement('div');
panel.className = 'release-panel';
panel.innerHTML =
    '<div class="release-header">'
    + '<span class="release-title">\uD83D\uDE80 Release Check</span>'
    + '<span class="' + (passed ? 'release-passed' : 'release-failed') + '">'
    + (passed ? '\u2713 READY' : '\u2717 NOT READY') + '</span>'
    + '</div>'
    + '<div class="release-summary">' + escapeHtml(summary) + '</div>'
    + checksHtml
    + '<button class="release-run-again-btn" onclick="runReleaseCheck()">Run again</button>';

chatArea.appendChild(panel);
chatArea.scrollTop = chatArea.scrollHeight;
}

function runPRReview() {
vscode.postMessage({ command: 'runPRReview' });
}

var _prFindings = [];

function renderPRFindings(result) {
hideEmpty();
_prFindings = result.findings || [];
var riskScore = result.riskScore || 0;
var passed = result.passed;
var summary = result.summary || '';
var riskColor = riskScore >= 60 ? '#f44336' : riskScore >= 30 ? '#ff9800' : '#4caf50';

var groupOrder = ['security', 'logic', 'regression', 'missing-test', 'style'];
var groups = {};
groupOrder.forEach(function(g) { groups[g] = []; });
_prFindings.forEach(function(f, i) {
    f._idx = i;
    var cat = f.category || 'style';
    if (!groups[cat]) { groups[cat] = []; }
    groups[cat].push(f);
});

var findingsHtml = '';
var catLabels = { security: 'Security', logic: 'Logic', regression: 'Regression Risk', 'missing-test': 'Missing Tests', style: 'Style' };
groupOrder.forEach(function(cat) {
    var catFindings = groups[cat];
    if (!catFindings || catFindings.length === 0) { return; }
    findingsHtml += '<div class="pr-section-label">' + escapeHtml(catLabels[cat] || cat) + ' (' + catFindings.length + ')</div>';
    catFindings.forEach(function(f) {
        var sev = f.severity || 'info';
        var lineInfo = f.line ? ':' + f.line : '';
        var fixBtn = f.suggestedFix
            ? '<button class="finding-fix-btn" data-idx="' + f._idx + '">Fix with OpenKode</button>'
            : '';
        findingsHtml += '<div class="finding-card">'
            + '<div class="finding-header">'
            + '<span class="finding-severity sev-' + sev + '">' + sev + '</span>'
            + '<span class="finding-category">' + escapeHtml(f.category || '') + '</span>'
            + '<span class="finding-title">' + escapeHtml(f.title || '') + '</span>'
            + '</div>'
            + (f.file ? '<div class="finding-file">' + escapeHtml(f.file + lineInfo) + '</div>' : '')
            + '<div class="finding-detail">' + escapeHtml(f.detail || '') + '</div>'
            + fixBtn
            + '</div>';
    });
});

if (_prFindings.length === 0) {
    findingsHtml = '<div class="pr-no-findings">\u2713 No issues found</div>';
}

var panel = document.createElement('div');
panel.className = 'pr-review-panel';
panel.innerHTML =
    '<div class="pr-summary-header">'
    + '<span class="pr-summary-title">\u26F3 PR Review</span>'
    + '<span class="' + (passed ? 'pr-passed' : 'pr-failed') + '">' + (passed ? '\u2713 PASSED' : '\u2717 FAILED') + '</span>'
    + '</div>'
    + '<div class="pr-risk-bar-wrap">'
    + '<div class="pr-risk-label"><span>Risk Score</span><span>' + riskScore + '/100</span></div>'
    + '<div class="pr-risk-bar"><div class="pr-risk-fill" style="width:' + riskScore + '%;background:' + riskColor + '"></div></div>'
    + '</div>'
    + '<div class="pr-summary-text">' + escapeHtml(summary) + '</div>'
    + findingsHtml
    + '<button class="pr-run-again-btn" onclick="runPRReview()">Run again</button>';

panel.querySelectorAll('.finding-fix-btn').forEach(function(btn) {
    btn.onclick = function() {
        var idx = parseInt(btn.dataset.idx, 10);
        fixWithOpenKode(_prFindings[idx]);
    };
});

chatArea.appendChild(panel);
chatArea.scrollTop = chatArea.scrollHeight;
}

function fixWithOpenKode(finding) {
vscode.postMessage({ command: 'fixWithOpenKode', finding: finding });
}

function applyTraceBadges(coverageMap) {
var LABEL = { covered: '\u2713 covered', partial: '~ partial', missing: '\u2717 missing' };
var CLASSES = { covered: 'trace-covered', partial: 'trace-partial', missing: 'trace-missing' };
Object.keys(coverageMap).forEach(function(taskId) {
    var status = coverageMap[taskId];
    var row = document.querySelector('.task-row[data-id="' + taskId + '"]');
    if (!row) { return; }
    var meta = row.querySelector('.task-meta');
    if (!meta) { return; }
    var existing = meta.querySelector('.trace-badge');
    if (existing) { existing.remove(); }
    var badge = document.createElement('span');
    badge.className = 'trace-badge ' + (CLASSES[status] || '');
    badge.textContent = LABEL[status] || status;
    meta.appendChild(badge);
});
}

function endStream() {
streaming = false;
sendBtn.disabled = false;
if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
}

function showError(msg) {
errorToast.textContent = msg;
errorToast.classList.add('show');
setTimeout(() => errorToast.classList.remove('show'), 6000);
}

function clearChat() {
while (chatArea.firstChild) chatArea.removeChild(chatArea.firstChild);
chatArea.appendChild(emptyState);
emptyState.style.display = '';
}

msgInput.focus();

// ── Checkpoint timeline ──────────────────────────────────────────────────────
(function() {
var strip = document.createElement('div');
strip.className = 'ckpt-strip';
strip.innerHTML = '<div class="ckpt-strip-header" id="ckptToggle">&#9677; Checkpoints <span id="ckptCount" style="font-weight:400;opacity:0.6"></span></div><div class="ckpt-list" id="ckptList"></div>';
document.body.appendChild(strip);

var ckptToggle = document.getElementById('ckptToggle');
var ckptList = document.getElementById('ckptList');
var ckptCount = document.getElementById('ckptCount');
var allCkpts = [];

ckptToggle.onclick = function() {
  var isOpen = ckptList.classList.toggle('open');
  if (isOpen && allCkpts.length === 0) { vscode.postMessage({ command: 'listCheckpoints' }); }
};

function renderCheckpoints(checkpoints) {
  allCkpts = checkpoints;
  ckptCount.textContent = checkpoints.length ? '(' + checkpoints.length + ')' : '';
  if (!checkpoints.length) {
    ckptList.innerHTML = '<div style="font-size:11px;padding:6px 4px;color:var(--vscode-descriptionForeground)">No checkpoints yet.</div>';
    return;
  }
  ckptList.innerHTML = checkpoints.map(function(c) {
    var t = new Date(c.createdAt).toLocaleTimeString();
    return '<div class="ckpt-row" data-id="' + c.id + '">'
      + '<div class="ckpt-dot"></div>'
      + '<div class="ckpt-info"><div class="ckpt-label" title="' + c.label + '">' + c.label + '</div><div class="ckpt-time">' + t + ' &middot; phase ' + c.phaseIndex + '</div></div>'
      + '<button class="ckpt-restore-btn">Restore&hellip;</button>'
      + '</div>';
  }).join('');
  ckptList.querySelectorAll('.ckpt-restore-btn').forEach(function(btn) {
    btn.onclick = function(evt) {
      var row = btn.closest('.ckpt-row');
      var ckptId = row ? row.dataset.id : '';
      var ckpt = allCkpts.find(function(c) { return c.id === ckptId; });
      if (ckpt) { previewRollback(evt, ckpt.id, ckpt.label); }
    };
  });
}

window.previewRollback = function(evt, checkpointId, label) {
  evt.stopPropagation();
  vscode.postMessage({ command: 'previewRollback', checkpointId: checkpointId });
  window._pendingRollbackId = checkpointId;
  window._pendingRollbackLabel = label;
};

function showRollbackPreview(diffs) {
  var existing = document.getElementById('ckptPreviewModal');
  if (existing) existing.remove();
  var diffHtml = diffs.length
    ? diffs.map(function(d) { return '<div class="ckpt-diff-row">' + d.file + '</div>'; }).join('')
    : '<div style="font-size:12px;color:var(--vscode-descriptionForeground)">No file changes detected — state is identical.</div>';
  var modal = document.createElement('div');
  modal.className = 'ckpt-preview-modal';
  modal.id = 'ckptPreviewModal';
  modal.innerHTML = '<div class="ckpt-preview-box">'
    + '<div class="ckpt-preview-title">Restore to: ' + (window._pendingRollbackLabel || '') + '</div>'
    + '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:8px">' + diffs.length + ' file(s) will be reverted:</div>'
    + diffHtml
    + '<div class="ckpt-preview-actions">'
    + '<button class="btn btn-secondary" id="ckptCancelBtn">Cancel</button>'
    + '<button class="btn btn-primary" style="width:auto;padding:7px 16px" id="ckptConfirmBtn">Restore Files</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  document.getElementById('ckptCancelBtn').onclick = function() { modal.remove(); };
  document.getElementById('ckptConfirmBtn').onclick = function() {
    modal.remove();
    vscode.postMessage({ command: 'rollbackTo', checkpointId: window._pendingRollbackId });
  };
}

window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.type === 'checkpointList') { renderCheckpoints(msg.checkpoints || []); }
  if (msg.type === 'rollbackPreview') { showRollbackPreview(msg.diffs || []); }
  if (msg.type === 'rollbackPreviewFailed') { showError('Preview failed: ' + msg.error); }
  if (msg.type === 'rollbackComplete') {
    allCkpts = [];
    vscode.postMessage({ command: 'listCheckpoints' });
    showSuccess('Files restored to checkpoint.');
  }
  if (msg.type === 'rollbackFailed') { showError('Rollback failed: ' + msg.error); }
  if (msg.type === 'checkpointCreated') {
    allCkpts = [];
    if (ckptList.classList.contains('open')) { vscode.postMessage({ command: 'listCheckpoints' }); }
  }
  if (msg.type === 'showByollmDisclaimer') {
    document.getElementById('byollmOverlay').classList.remove('hidden');
  }
  if (msg.type === 'usageUpdate') {
    var wrap = document.getElementById('usageBarWrap');
    if (wrap) {
      wrap.style.display = 'flex';
      var pct = msg.limit > 0 ? Math.min(100, Math.round(msg.used / msg.limit * 100)) : 0;
      document.getElementById('usageBarFill').style.width = pct + '%';
      document.getElementById('usageBarLabel').textContent =
        msg.used + ' / ' + msg.limit + ' requests';
      var resetDate = new Date(msg.resetAt);
      var nowMs = Date.now();
      var hoursLeft = Math.ceil((resetDate.getTime() - nowMs) / 3600000);
      document.getElementById('usageBarReset').textContent =
        hoursLeft > 0 ? ('Resets in ' + (hoursLeft > 1 ? hoursLeft + 'h' : '<1h')) : '';
    }
  }
});

document.getElementById('byollmOkBtn').onclick = function() {
  document.getElementById('byollmOverlay').classList.add('hidden');
  vscode.postMessage({ command: 'byollmDisclaimerDismissed' });
};
})();
</script>
</body></html>`;
}
