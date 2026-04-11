/**
 * License check — OpenKode Pro license validation.
 *
 * Validates the Pro license token against the OpenKode licensing server.
 * In Free edition this module is present but all validation paths are no-ops
 * since the Free tier requires no license.
 *
 * In Pro edition (`OPENKODE_EDITION=pro`), call `validateLicense()` on
 * activation and cache the result in SecretStorage.
 */
import * as vscode from 'vscode';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LicenseStatus = {
  valid: boolean;
  edition: 'free' | 'pro' | 'team';
  /** ISO 8601 expiry date, or undefined for lifetime/subscription licenses. */
  expiresAt?: string;
  /** Human-readable reason when `valid === false`. */
  reason?: string;
  /** Seat count for Team licenses. */
  seats?: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const LICENSE_SECRET_KEY = 'openkode.licenseKey';
const LICENSE_CACHE_KEY  = 'openkode.licenseStatus';
const LICENSING_ENDPOINT = 'https://api.openkode.dev/v1/license/validate';

let _secrets: vscode.SecretStorage | undefined;

/**
 * Inject the SecretStorage instance.  Must be called from `activate()` alongside
 * `initSettings()` (or right after it).
 */
export function initLicenseCheck(secrets: vscode.SecretStorage): void {
  _secrets = secrets;
}

// ─── Free-edition short-circuit ──────────────────────────────────────────────

/**
 * Returns `true` when running as OpenKode Pro/Team.
 * Free builds always return `false` here — no network call is made.
 */
function isProBuild(): boolean {
  return process.env['OPENKODE_EDITION'] === 'pro';
}

// ─── License storage helpers ─────────────────────────────────────────────────

/**
 * Store a Pro license key in SecretStorage.
 * Only accessible from Pro edition; no-ops silently in Free.
 */
export async function saveLicenseKey(key: string): Promise<void> {
  if (!isProBuild() || !_secrets) return;
  await _secrets.store(LICENSE_SECRET_KEY, key);
}

/**
 * Retrieve the stored Pro license key, or `undefined` if none is saved.
 */
export async function getLicenseKey(): Promise<string | undefined> {
  if (!isProBuild() || !_secrets) return undefined;
  return _secrets.get(LICENSE_SECRET_KEY);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate the stored license key against the OpenKode licensing server.
 *
 * - **Free edition**: immediately resolves `{ valid: true, edition: 'free' }` —
 *   no network call, no UI.
 * - **Pro edition**: calls the licensing endpoint, caches the result in
 *   `globalState`, and shows an error notification if the license is invalid
 *   or expired.
 *
 * @param context  Extension context for globalState caching.
 * @returns        Current license status.
 */
export async function validateLicense(
  context: vscode.ExtensionContext,
): Promise<LicenseStatus> {
  if (!isProBuild()) {
    return { valid: true, edition: 'free' };
  }

  const key = await getLicenseKey();
  if (!key) {
    const status: LicenseStatus = {
      valid: false,
      edition: 'pro',
      reason: 'No license key found. Run "OpenKode: Activate Pro License" to enter your key.',
    };
    await _cacheStatus(context, status);
    _warnInvalid(status.reason!);
    return status;
  }

  try {
    const res = await fetch(LICENSING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const status: LicenseStatus = {
        valid: false,
        edition: 'pro',
        reason: `License server returned HTTP ${res.status}.`,
      };
      await _cacheStatus(context, status);
      _warnInvalid(status.reason!);
      return status;
    }

    const data = (await res.json()) as LicenseStatus;
    await _cacheStatus(context, data);

    if (!data.valid) _warnInvalid(data.reason ?? 'License is invalid or expired.');
    return data;
  } catch {
    // Network unavailable — use cached status to avoid blocking activation.
    const cached = context.globalState.get<LicenseStatus>(LICENSE_CACHE_KEY);
    if (cached) return cached;
    return { valid: false, edition: 'pro', reason: 'License server unreachable.' };
  }
}

/**
 * Register the "OpenKode: Activate Pro License" command so users can enter
 * their key without going to settings.
 */
export function registerLicenseCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('openkode.activateProLicense', async () => {
      const key = await vscode.window.showInputBox({
        title: 'OpenKode: Activate Pro License',
        prompt: 'Enter your OpenKode Pro license key (from openkode.dev/dashboard).',
        password: true,
        ignoreFocusOut: true,
      });
      if (!key) return;

      await saveLicenseKey(key);
      const status = await validateLicense(context);

      if (status.valid) {
        vscode.window.showInformationMessage(
          `✅ OpenKode Pro activated! Edition: ${status.edition}` +
          (status.expiresAt ? ` (expires ${status.expiresAt})` : ''),
        );
      } else {
        vscode.window.showErrorMessage(
          `OpenKode Pro activation failed: ${status.reason}`,
        );
      }
    }),
  );
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function _cacheStatus(
  context: vscode.ExtensionContext,
  status: LicenseStatus,
): Promise<void> {
  await context.globalState.update(LICENSE_CACHE_KEY, status);
}

function _warnInvalid(reason: string): void {
  vscode.window.showWarningMessage(
    `OpenKode Pro license: ${reason} Some features are disabled.`,
    'Activate License',
    'Upgrade at openkode.dev',
  ).then((action) => {
    if (action === 'Upgrade at openkode.dev') {
      vscode.env.openExternal(vscode.Uri.parse('https://openkode.dev/pro'));
    } else if (action === 'Activate License') {
      vscode.commands.executeCommand('openkode.activateProLicense');
    }
  });
}
