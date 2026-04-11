/**
 * Telemetry — opt-in anonymous usage tracking.
 *
 * Privacy guarantees:
 *  - Disabled by default. User must explicitly enable via setting or prompt.
 *  - Only event *names* are sent — no code, prompts, file names, or personal data.
 *  - Endpoint: GitHub-hosted serverless function (or simple HTTP beacon).
 *
 * Usage:
 *   telemetry.init(context);
 *   telemetry.track('verification.run');
 *   telemetry.track('handoff', { agent: 'cursor' });
 */
import * as vscode from 'vscode';

// ─── Types ────────────────────────────────────────────────────────────────────

type TelemetryPayload = {
  event: string;
  /** Allowed meta: non-personal categorical values only. */
  meta?: Record<string, string | number | boolean>;
  /** OpenKode extension version — helps correlate event to release. */
  version: string;
  /** Random session ID (UUID) — reset every activation, never stored. */
  sessionId: string;
};

// ─── Singleton ────────────────────────────────────────────────────────────────

class Telemetry {
  private static _instance: Telemetry;
  private _enabled = false;
  private _sessionId = crypto.randomUUID();
  private _version = 'unknown';
  private _queue: TelemetryPayload[] = [];
  private _flushing = false;

  /** Telemetry beacon endpoint — replace with your own before publishing. */
  private static readonly ENDPOINT =
    'https://openkode-telemetry.vercel.app/api/event';

  private constructor() {}

  static getInstance(): Telemetry {
    if (!Telemetry._instance) {
      Telemetry._instance = new Telemetry();
    }
    return Telemetry._instance;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Initialise telemetry. Must be called once from `activate()`.
   *
   * @param context  Extension context — used to read config and register
   *                 `openkode.toggleTelemetry` + `openkode.sendFeedback` commands.
   */
  init(context: vscode.ExtensionContext): void {
    this._version = context.extension.packageJSON?.version ?? 'unknown';
    this._refreshEnabled();

    // Watch for config changes (user toggles the setting)
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('openkode.telemetry.enabled')) {
          this._refreshEnabled();
        }
      }),
    );

    // Register toggle command
    context.subscriptions.push(
      vscode.commands.registerCommand('openkode.toggleTelemetry', () =>
        this._toggleCommand(),
      ),
    );

    // Register "Send Feedback" — opens a pre-filled GitHub issue
    context.subscriptions.push(
      vscode.commands.registerCommand('openkode.sendFeedback', () => {
        const uri = vscode.Uri.parse(
          'https://github.com/openkode/openkode-vscode/issues/new' +
          '?template=feedback.yml&labels=feedback',
        );
        vscode.env.openExternal(uri);
      }),
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Record an anonymous event. No-ops when telemetry is disabled.
   *
   * @param event  Short dot-separated event name, e.g. `"verification.run"`.
   * @param meta   Optional categorical metadata — no PII, no paths.
   */
  track(event: string, meta?: Record<string, string | number | boolean>): void {
    if (!this._enabled) return;

    this._queue.push({
      event,
      meta,
      version: this._version,
      sessionId: this._sessionId,
    });

    // Fire-and-forget flush
    this._flush().catch(() => {/* silently ignore network errors */});
  }

  /** Whether telemetry is currently enabled. */
  get isEnabled(): boolean {
    return this._enabled;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _refreshEnabled(): void {
    this._enabled = vscode.workspace
      .getConfiguration('openkode')
      .get<boolean>('telemetry.enabled') ?? false;
  }

  private async _flush(): Promise<void> {
    if (this._flushing || this._queue.length === 0) return;
    this._flushing = true;
    const batch = this._queue.splice(0);
    try {
      // Use fetch (available in VS Code extension host ≥ 1.85)
      await fetch(Telemetry.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        // Short timeout so a dead endpoint never blocks the extension
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // Network unavailable or endpoint down — drop silently
    } finally {
      this._flushing = false;
    }
  }

  private async _toggleCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('openkode');
    const next = !this._enabled;

    await cfg.update(
      'telemetry.enabled',
      next,
      vscode.ConfigurationTarget.Global,
    );

    vscode.window.showInformationMessage(
      next
        ? 'OpenKode: Anonymous telemetry enabled. Thank you for helping improve OpenKode!'
        : 'OpenKode: Telemetry disabled.',
    );
  }
}

// ─── Exported singleton ───────────────────────────────────────────────────────

export const telemetry = Telemetry.getInstance();
