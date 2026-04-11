/**
 * PR Review Orchestrator
 *
 * Chains DiffReviewer + SecurityScanner + StaticAnalysis into a single
 * categorized finding list, then enriches with LLM analysis for logic /
 * regression-risk findings that static tools cannot detect.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { SecurityScanner } from './securityScanner';
import { StaticAnalysis } from './staticAnalysis';
import { LLMClient, LLMProvider } from '../llm/llmClient';
import { OpenKodePolicy } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type FindingCategory = 'logic' | 'regression' | 'security' | 'missing-test' | 'style';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface PRFinding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  file: string;
  line?: number;
  title: string;
  detail: string;
  /** Suggested fix snippet or null if not available */
  suggestedFix?: string;
  source: 'static' | 'security' | 'llm';
}

export interface PRReviewResult {
  prTitle?: string;
  branch?: string;
  baseRef?: string;
  changedFiles: string[];
  findings: PRFinding[];
  riskScore: number;        // 0–100
  passed: boolean;          // false if critical/high findings or policy blocks
  summary: string;
  reviewedAt: number;
}

export interface PRReviewOptions {
  workspaceRoot: string;
  branch?: string;
  baseRef?: string;
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  policy?: OpenKodePolicy;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export class PRReviewOrchestrator {
  private readonly options: PRReviewOptions;

  constructor(options: PRReviewOptions) {
    this.options = options;
  }

  async review(): Promise<PRReviewResult> {
    const { workspaceRoot, branch, baseRef = 'HEAD~1' } = this.options;

    const changedFiles = this.getChangedFiles(workspaceRoot, baseRef);
    const diff = this.getDiff(workspaceRoot, baseRef);

    const findings: PRFinding[] = [];

    // ── Static analysis ───────────────────────────────────────────────────
    try {
      const staticAnalyzer = new StaticAnalysis({ projectRoot: workspaceRoot });
      const staticResult = await staticAnalyzer.runLinters(changedFiles);
      for (const issue of staticResult.issues ?? []) {
        findings.push({
          id: `static-${findings.length}`,
          category: 'style',
          severity: this.mapStaticSeverity(issue.severity),
          file: issue.file,
          line: issue.line,
          title: issue.ruleId ?? 'Style issue',
          detail: issue.message,
          source: 'static',
        });
      }
    } catch { /* static analysis unavailable */ }

    // ── Security scan ─────────────────────────────────────────────────────
    try {
      const secScanner = new SecurityScanner({ projectRoot: workspaceRoot });
      const secResult = await secScanner.scanSecurity(changedFiles);
      for (const issue of secResult.issues ?? []) {
        findings.push({
          id: `sec-${findings.length}`,
          category: 'security',
          severity: issue.severity,
          file: issue.file,
          line: issue.line,
          title: `${issue.type}: ${issue.message}`,
          detail: issue.remediation,
          source: 'security',
        });
      }
    } catch { /* security scan unavailable */ }

    // ── LLM enrichment ────────────────────────────────────────────────────
    try {
      const llmFindings = await this.runLLMReview(diff, changedFiles);
      findings.push(...llmFindings);
    } catch { /* LLM unavailable */ }

    // ── Compute risk + pass/fail ──────────────────────────────────────────
    const riskScore = this.computeRiskScore(findings);
    const passed = this.checkPassed(findings, riskScore);

    return {
      branch,
      baseRef,
      changedFiles,
      findings,
      riskScore,
      passed,
      summary: this.buildSummary(findings, riskScore),
      reviewedAt: Date.now(),
    };
  }

  private async runLLMReview(diff: string, changedFiles: string[]): Promise<PRFinding[]> {
    const { provider, apiKey, model } = this.options;
    const client = new LLMClient({ provider, apiKey, model });

    const fileList = changedFiles.slice(0, 10).join('\n');
    const truncatedDiff = diff.length > 8000 ? diff.substring(0, 8000) + '\n...(truncated)' : diff;

    const response = await client.generate({
      systemPrompt: `You are a senior engineer doing a code review. Analyze the diff and return ONLY a JSON array of findings.
Each finding: { "category": "logic"|"regression"|"missing-test", "severity": "critical"|"high"|"medium"|"low", "file": string, "line": number|null, "title": string, "detail": string, "suggestedFix": string|null }
Focus on: logic errors, missing null checks, regression risks, missing test coverage for changed behaviour. Do NOT report style issues.`,
      userPrompt: `Changed files:\n${fileList}\n\nDiff:\n${truncatedDiff}`,
      responseFormat: 'json',
    });

    const raw = this.parseFindings(response.raw);
    return raw.map((f: Record<string, unknown>, i: number) => ({
      id: `llm-${i}`,
      category: (f.category as FindingCategory) ?? 'logic',
      severity: (f.severity as FindingSeverity) ?? 'medium',
      file: (f.file as string) ?? '',
      line: (f.line as number | undefined) ?? undefined,
      title: (f.title as string) ?? 'LLM finding',
      detail: (f.detail as string) ?? '',
      suggestedFix: (f.suggestedFix as string | undefined) ?? undefined,
      source: 'llm' as const,
    }));
  }

  private parseFindings(raw: string): Record<string, unknown>[] {
    try {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\[[\s\S]*\])/);
      const json = match ? match[1] : raw;
      const parsed = JSON.parse(json.trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private getChangedFiles(root: string, baseRef: string): string[] {
    try {
      const output = execSync(`git diff --name-only ${baseRef}`, {
        cwd: root, encoding: 'utf-8', timeout: 5000
      });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private getDiff(root: string, baseRef: string): string {
    try {
      return execSync(`git diff ${baseRef}`, {
        cwd: root, encoding: 'utf-8', timeout: 5000, maxBuffer: 10 * 1024 * 1024
      });
    } catch {
      return '';
    }
  }

  private mapStaticSeverity(s: string): FindingSeverity {
    if (s === 'error') { return 'high'; }
    if (s === 'warning') { return 'medium'; }
    return 'low';
  }

  private computeRiskScore(findings: PRFinding[]): number {
    const weights: Record<FindingSeverity, number> = {
      critical: 40, high: 20, medium: 8, low: 3, info: 1
    };
    const raw = findings.reduce((sum, f) => sum + (weights[f.severity] ?? 0), 0);
    return Math.min(100, raw);
  }

  private checkPassed(findings: PRFinding[], riskScore: number): boolean {
    const policy = this.options.policy;
    if (!policy) { return riskScore < 60; }

    if (policy.security.posture === 'strict') {
      if (findings.some(f => f.category === 'security')) { return false; }
    } else if (policy.security.posture === 'standard') {
      if (findings.some(f => f.category === 'security' && (f.severity === 'critical' || f.severity === 'high'))) {
        return false;
      }
    }

    if (policy.verification.riskThreshold === 'low' && riskScore > 20) { return false; }
    if (policy.verification.riskThreshold === 'medium' && riskScore > 50) { return false; }
    return true;
  }

  private buildSummary(findings: PRFinding[], riskScore: number): string {
    const counts: Record<FindingCategory, number> = {
      logic: 0, regression: 0, security: 0, 'missing-test': 0, style: 0
    };
    for (const f of findings) { counts[f.category]++; }
    const parts = (Object.entries(counts) as [FindingCategory, number][])
      .filter(([, n]) => n > 0)
      .map(([cat, n]) => `${n} ${cat}`);
    return `Risk score: ${riskScore}/100. ${parts.length ? parts.join(', ') + '.' : 'No issues found.'}`;
  }
}
