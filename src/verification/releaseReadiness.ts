/**
 * ReleaseReadinessChecker
 *
 * Runs the required checks defined in the OpenKode policy and aggregates
 * results into a single release-readiness verdict.
 *
 * Checks run sequentially via execSync so they respect the project's
 * existing npm scripts (lint, typecheck, test:unit, etc.).
 */

import { execSync } from 'child_process';
import { OpenKodePolicy, DEFAULT_POLICY } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  durationMs: number;
  output?: string;
  error?: string;
}

export interface ReleaseReadinessResult {
  passed: boolean;
  checks: CheckResult[];
  coveragePercent?: number;
  coveragePassed?: boolean;
  riskScore?: number;
  summary: string;
  checkedAt: number;
}

export interface ReleaseReadinessOptions {
  workspaceRoot: string;
  policy?: OpenKodePolicy;
  /** Override the list of checks to run (default: policy.requiredChecks). */
  checks?: string[];
  /** Time-limit per check in ms (default: 60_000). */
  timeoutMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command map — maps requiredCheck names → npm script names
// ─────────────────────────────────────────────────────────────────────────────

const CHECK_COMMANDS: Record<string, string> = {
  lint:           'npm run lint --if-present',
  typecheck:      'npm run typecheck --if-present',
  'test:unit':    'npm run test:unit --if-present',
  'test:coverage':'npm run test:coverage --if-present',
  build:          'npm run compile --if-present',
};

// ─────────────────────────────────────────────────────────────────────────────
// Checker
// ─────────────────────────────────────────────────────────────────────────────

export class ReleaseReadinessChecker {
  private readonly options: ReleaseReadinessOptions;
  private readonly policy: OpenKodePolicy;

  constructor(options: ReleaseReadinessOptions) {
    this.options = options;
    this.policy = options.policy ?? DEFAULT_POLICY;
  }

  async check(): Promise<ReleaseReadinessResult> {
    const checksToRun = this.options.checks ?? this.policy.requiredChecks;
    const timeout = this.options.timeoutMs ?? 60_000;
    const results: CheckResult[] = [];

    for (const checkName of checksToRun) {
      results.push(this.runCheck(checkName, timeout));
    }

    const allPassed = results.every(r => r.status !== 'fail');
    const summary = this.buildSummary(results, allPassed);

    return {
      passed: allPassed,
      checks: results,
      summary,
      checkedAt: Date.now(),
    };
  }

  private runCheck(name: string, timeoutMs: number): CheckResult {
    const cmd = CHECK_COMMANDS[name] ?? `npm run ${name} --if-present`;
    const start = Date.now();
    try {
      const output = execSync(cmd, {
        cwd: this.options.workspaceRoot,
        encoding: 'utf-8',
        timeout: timeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return {
        name,
        status: 'pass',
        durationMs: Date.now() - start,
        output: output.trim().slice(0, 500),
      };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const detail = (e.stderr || e.stdout || e.message || String(err)).slice(0, 500);
      return {
        name,
        status: 'fail',
        durationMs: Date.now() - start,
        error: detail,
      };
    }
  }

  private buildSummary(checks: CheckResult[], allPassed: boolean): string {
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const verdict = allPassed ? 'READY' : 'NOT READY';
    return `Release ${verdict}: ${passed}/${checks.length} checks passed${failed > 0 ? `, ${failed} failed` : ''}.`;
  }
}
