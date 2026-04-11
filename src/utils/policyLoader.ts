/**
 * PolicyLoader — reads, validates, and merges .openkode.yaml
 *
 * Precedence (highest wins):
 *   runtime overrides > project .openkode.yaml > DEFAULT_POLICY
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { OpenKodePolicy, DEFAULT_POLICY, MaturityLevel } from '../types';

const POLICY_FILE = '.openkode.yaml';

const VALID_MATURITY: MaturityLevel[] = [
  'observe', 'assisted-plan', 'selective-execute', 'full-orchestration'
];

export class PolicyLoader {
  private readonly workspaceRoot: string;
  private cached: OpenKodePolicy | null = null;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Load the policy for this workspace.
   * Returns DEFAULT_POLICY if no .openkode.yaml is present or it has errors.
   */
  async load(overrides: Partial<OpenKodePolicy> = {}): Promise<OpenKodePolicy> {
    const fromFile = await this.readFile();
    const merged = this.merge(DEFAULT_POLICY, fromFile, overrides);
    this.cached = merged;
    return merged;
  }

  /** Returns the last loaded policy (throws if load() hasn't been called). */
  get(): OpenKodePolicy {
    if (!this.cached) {
      throw new Error('PolicyLoader.get() called before load()');
    }
    return this.cached;
  }

  /** Invalidate cache so next load() re-reads the file. */
  invalidate(): void {
    this.cached = null;
  }

  private async readFile(): Promise<Partial<OpenKodePolicy>> {
    const filePath = path.join(this.workspaceRoot, POLICY_FILE);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml.load(raw) as Record<string, unknown>;
      return this.validate(parsed);
    } catch (err: unknown) {
      // File not found or parse error — use defaults silently
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[PolicyLoader] Failed to parse ${POLICY_FILE}:`, err);
      }
      return {};
    }
  }

  private validate(raw: Record<string, unknown>): Partial<OpenKodePolicy> {
    const out: Partial<OpenKodePolicy> = {};

    if (typeof raw.maturityLevel === 'string' && VALID_MATURITY.includes(raw.maturityLevel as MaturityLevel)) {
      out.maturityLevel = raw.maturityLevel as MaturityLevel;
    }

    if (Array.isArray(raw.requiredChecks) && raw.requiredChecks.every(x => typeof x === 'string')) {
      out.requiredChecks = raw.requiredChecks as string[];
    }

    if (raw.verification && typeof raw.verification === 'object') {
      const v = raw.verification as Record<string, unknown>;
      out.verification = {
        ...DEFAULT_POLICY.verification,
        ...(typeof v.minCoverage === 'number' ? { minCoverage: Math.max(0, Math.min(100, v.minCoverage)) } : {}),
        ...(v.riskThreshold === 'low' || v.riskThreshold === 'medium' || v.riskThreshold === 'high'
          ? { riskThreshold: v.riskThreshold } : {}),
        ...(typeof v.failOnSecurityFindings === 'boolean' ? { failOnSecurityFindings: v.failOnSecurityFindings } : {}),
      };
    }

    if (raw.budget && typeof raw.budget === 'object') {
      const b = raw.budget as Record<string, unknown>;
      out.budget = {
        ...DEFAULT_POLICY.budget,
        ...(typeof b.perRunUsd === 'number' ? { perRunUsd: Math.max(0, b.perRunUsd) } : {}),
        ...(typeof b.perSpecUsd === 'number' ? { perSpecUsd: Math.max(0, b.perSpecUsd) } : {}),
        ...(typeof b.hardStop === 'boolean' ? { hardStop: b.hardStop } : {}),
      };
    }

    if (raw.routing && typeof raw.routing === 'object') {
      const r = raw.routing as Record<string, unknown>;
      out.routing = {
        ...DEFAULT_POLICY.routing,
        ...(typeof r.preferredProvider === 'string' ? { preferredProvider: r.preferredProvider } : {}),
        ...(Array.isArray(r.fallbackProviders) ? { fallbackProviders: r.fallbackProviders as string[] } : {}),
        ...(r.taskOverrides && typeof r.taskOverrides === 'object'
          ? { taskOverrides: r.taskOverrides as Record<string, string> } : {}),
      };
    }

    if (raw.security && typeof raw.security === 'object') {
      const s = raw.security as Record<string, unknown>;
      const posture = s.posture;
      out.security = {
        ...DEFAULT_POLICY.security,
        ...(posture === 'strict' || posture === 'standard' || posture === 'permissive'
          ? { posture } : {}),
        ...(Array.isArray(s.blockedPatterns) ? { blockedPatterns: s.blockedPatterns as string[] } : {}),
      };
    }

    return out;
  }

  private merge(
    base: OpenKodePolicy,
    fromFile: Partial<OpenKodePolicy>,
    overrides: Partial<OpenKodePolicy>
  ): OpenKodePolicy {
    return {
      maturityLevel: overrides.maturityLevel ?? fromFile.maturityLevel ?? base.maturityLevel,
      requiredChecks: overrides.requiredChecks ?? fromFile.requiredChecks ?? base.requiredChecks,
      verification: { ...base.verification, ...fromFile.verification, ...overrides.verification },
      budget:       { ...base.budget,       ...fromFile.budget,       ...overrides.budget },
      routing:      { ...base.routing,      ...fromFile.routing,      ...overrides.routing },
      security:     { ...base.security,     ...fromFile.security,     ...overrides.security },
    };
  }
}
