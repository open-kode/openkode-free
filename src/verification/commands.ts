/**
 * Verification Commands — VS Code command implementations.
 *
 * Commands registered here:
 *  - openkode.runVerification       — Run LLM verification on current changes
 *  - openkode.toggleAutoVerify      — Toggle auto-verify on file save
 *  - openkode.testVerification      — Run against a mock diff (test/demo)
 *
 * "openkode.showVerificationReport" is registered by report-panel.ts.
 *
 * Register all commands by calling registerVerificationCommands() from activate().
 */
import * as vscode from 'vscode';
import { verificationEngine } from './verification-engine';
import { refreshVerificationPanel } from './report-panel';
import type { VerificationContext } from './engine-types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Diagnostic collection — owned here, applied by the engine. */
let _diagnosticCollection: vscode.DiagnosticCollection | undefined;

/** File-save listener disposable (for auto-verify mode). */
let _saveListener: vscode.Disposable | undefined;

/** Status bar item showing last verification score. */
let _scoreBar: vscode.StatusBarItem | undefined;

function getOrCreateDiagnosticCollection(): vscode.DiagnosticCollection {
  if (!_diagnosticCollection) {
    _diagnosticCollection = vscode.languages.createDiagnosticCollection('openkode-verifier');
  }
  return _diagnosticCollection;
}

/**
 * Update the status bar item with the latest verification score.
 */
function updateScoreBar(score: number): void {
  if (!_scoreBar) return;
  const icon = score >= 85 ? '$(pass)' : score >= 65 ? '$(warning)' : '$(error)';
  _scoreBar.text = `${icon} Verify: ${score}/100`;
  _scoreBar.tooltip = `OpenKode Verification Score: ${score}/100\nClick to view report`;
  _scoreBar.command = 'openkode.showVerificationReport';
  _scoreBar.show();
}

// ─── Command: Run Verification ────────────────────────────────────────────────

/**
 * "OpenKode: Run Verification"
 *
 * Captures the current workspace diff, calls the LLM Verifier, shows
 * a progress notification, and updates the report panel + status bar.
 */
export async function runVerification(ctx?: VerificationContext): Promise<void> {
  if (verificationEngine.isRunning()) {
    vscode.window.showWarningMessage('OpenKode: Verification is already running…');
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'OpenKode: Running verification…',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Capturing changes…' });

      let result;
      try {
        result = await verificationEngine.runVerification(ctx ?? {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`OpenKode Verification failed: ${msg}`);
        return;
      }

      progress.report({ message: 'Applying diagnostics…' });

      // Apply inline diagnostics
      if (workspaceRoot) {
        verificationEngine.applyDiagnostics(
          result,
          getOrCreateDiagnosticCollection(),
          workspaceRoot,
        );
      }

      // Update status bar
      updateScoreBar(result.score);

      // Refresh tree panel
      refreshVerificationPanel();

      // Notification with quick actions
      const criticals = result.issues.filter((i) => i.severity === 'Critical').length;
      const action = await vscode.window.showInformationMessage(
        `OpenKode Verify: ${result.score}/100 — ${result.summary}`,
        'View Report',
        'Dismiss',
      );

      if (action === 'View Report') {
        await vscode.commands.executeCommand('openkode.showVerificationReport');
      }
    },
  );
}

// ─── Command: Toggle Auto-Verify ─────────────────────────────────────────────

/**
 * "OpenKode: Toggle Auto-Verify on Save"
 *
 * When enabled, runs verification automatically whenever a TypeScript/
 * JavaScript/Python file is saved inside the workspace.
 */
export async function toggleAutoVerify(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('openkode');
  const current = cfg.get<boolean>('verification.autoVerifyOnSave') ?? false;
  const next = !current;

  await cfg.update(
    'verification.autoVerifyOnSave',
    next,
    vscode.ConfigurationTarget.Global,
  );

  if (next) {
    activateAutoVerify();
    vscode.window.showInformationMessage('OpenKode: Auto-Verify on Save enabled.');
  } else {
    deactivateAutoVerify();
    vscode.window.showInformationMessage('OpenKode: Auto-Verify on Save disabled.');
  }
}

/**
 * Start listening for file save events.
 * Called from toggleAutoVerify() and from activate() if the setting is already on.
 */
export function activateAutoVerify(): void {
  if (_saveListener) return; // Already active

  _saveListener = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    // Only trigger on source files, not config/lock files
    const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'];
    const ext = doc.uri.fsPath.slice(doc.uri.fsPath.lastIndexOf('.'));
    if (!relevantExtensions.includes(ext)) return;

    // Debounce: don't re-trigger if already running
    if (verificationEngine.isRunning()) return;

    await runVerification();
  });
}

/**
 * Stop the file-save listener.
 */
export function deactivateAutoVerify(): void {
  _saveListener?.dispose();
  _saveListener = undefined;
}

// ─── Command: Test Verification (Mock Diff) ───────────────────────────────────

const MOCK_DIFF = `diff --git a/src/routes/auth.ts b/src/routes/auth.ts
index abc1234..def5678 100644
--- a/src/routes/auth.ts
+++ b/src/routes/auth.ts
@@ -45,6 +45,20 @@ router.post('/login', async (req, res) => {
+  // TODO: add rate limiting
+  const { email, password } = req.body;
+  const user = await db.findUserByEmail(email);
+  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
+  const valid = await bcrypt.compare(password, user.passwordHash);
+  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
+  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
+  res.json({ token });`;

const MOCK_SPEC = `## Phase 1 — Authentication Service
**Requirement**: Implement JWT login endpoint POST /auth/login.
**Acceptance Criteria**:
- Returns 200 + access token on success
- Returns 401 on invalid credentials
- Token expires in 15 minutes
- Input validation on email (must be valid email format)
- Rate limiting: max 5 attempts per minute per IP`;

/**
 * "OpenKode: Test Verification (Mock Diff)"
 *
 * Runs the verification engine against a hardcoded diff and spec so
 * developers can confirm the pipeline is wired correctly without needing
 * real Git changes.
 */
export async function testVerification(): Promise<void> {
  await runVerification({
    diff: MOCK_DIFF,
    specMarkdown: MOCK_SPEC,
    activePhase: 'Phase 1 — Authentication Service',
  });
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Register all verification commands and set up the score status bar item.
 * Call once from `activate()`.
 *
 * @param context  VS Code extension context.
 */
export function registerVerificationCommands(context: vscode.ExtensionContext): void {
  // Score status bar item (priority 98 — just below router bar at 99)
  _scoreBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
  _scoreBar.text = '$(pass) Verify: —';
  _scoreBar.tooltip = 'OpenKode Verification — no results yet';
  _scoreBar.command = 'openkode.showVerificationReport';
  context.subscriptions.push(_scoreBar);

  const diagCollection = getOrCreateDiagnosticCollection();
  context.subscriptions.push(diagCollection);

  context.subscriptions.push(
    vscode.commands.registerCommand('openkode.runVerification',  () => runVerification()),
    vscode.commands.registerCommand('openkode.toggleAutoVerify', toggleAutoVerify),
    vscode.commands.registerCommand('openkode.testVerification', testVerification),
  );

  // Restore auto-verify state from settings on activation
  const autoVerify = vscode.workspace
    .getConfiguration('openkode')
    .get<boolean>('verification.autoVerifyOnSave') ?? false;

  if (autoVerify) activateAutoVerify();

  // Dispose the save listener on extension deactivation
  context.subscriptions.push({
    dispose: () => {
      deactivateAutoVerify();
      _diagnosticCollection?.dispose();
    },
  });
}
