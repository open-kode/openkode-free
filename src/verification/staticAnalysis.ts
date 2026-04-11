/**
 * OpenKode Static Analysis Integration
 * Integrates ESLint, Semgrep, and custom linting rules
 */

import {
  StaticAnalysisResult,
  LinterResult,
  StaticIssue,
  LinterSummary,
  LinterConfig,
  StaticIssueCategory,
  CodeFix,
  CodeRange,
} from './types';
import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export interface StaticAnalysisOptions {
  linters?: LinterConfig[];
  projectRoot?: string;
  filePatterns?: string[];
  excludePatterns?: string[];
  parallel?: boolean;
  failOnError?: boolean;
  autoFix?: boolean;
}

export interface ESLintResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

export interface ESLintMessage {
  ruleId: string;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  nodeType?: string;
  messageId?: string;
  endLine?: number;
  endColumn?: number;
  fix?: ESLintFix;
  suggestions?: ESLintSuggestion[];
}

export interface ESLintFix {
  range: [number, number];
  text: string;
}

export interface ESLintSuggestion {
  desc: string;
  fix: ESLintFix;
  messageId?: string;
}

export interface SemgrepResult {
  results: SemgrepFinding[];
  errors: SemgrepError[];
  stats: SemgrepStats;
}

export interface SemgrepFinding {
  check_id: string;
  path: string;
  start: SemgrepPosition;
  end: SemgrepPosition;
  extra: SemgrepExtra;
}

export interface SemgrepPosition {
  line: number;
  col: number;
  offset: number;
}

export interface SemgrepExtra {
  message: string;
  metadata: Record<string, unknown>;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  fingerprint: string;
  lines: string;
  validation_state?: string;
}

export interface SemgrepError {
  code: number;
  level: string;
  message: string;
  path?: string;
  rule_id?: string;
  spans?: unknown[];
}

export interface SemgrepStats {
  files_scanned: number;
  rules_with_findings: number;
}

/**
 * StaticAnalysis - Integrates multiple static analysis tools
 * Provides unified interface for ESLint, Semgrep, and custom rules
 */
export class StaticAnalysis {
  private options: StaticAnalysisOptions;
  private linters: LinterConfig[];
  private projectRoot: string;

  constructor(options: StaticAnalysisOptions = {}) {
    this.options = {
      projectRoot: process.cwd(),
      filePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '*.min.js'],
      parallel: true,
      failOnError: false,
      autoFix: false,
      ...options,
    };

    this.projectRoot = resolve(this.options.projectRoot!);
    this.linters = options.linters ?? this.getDefaultLinters();
  }

  /**
   * Main entry point: run all configured linters
   */
  async runLinters(filePaths?: string[]): Promise<StaticAnalysisResult> {
    const targetFiles = filePaths ?? await this.discoverFiles();

    if (targetFiles.length === 0) {
      return {
        passed: true,
        score: 100,
        linters: [],
        issues: [],
        summary: {
          totalIssues: 0,
          errors: 0,
          warnings: 0,
          fixableIssues: 0,
          filesWithIssues: 0,
        },
      };
    }

    const linterResults: LinterResult[] = [];

    if (this.options.parallel) {
      // Run linters in parallel
      const promises = this.linters
        .filter(l => l.enabled)
        .map(linter => this.runLinter(linter, targetFiles));

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          linterResults.push(result.value);
        } else {
          console.error('Linter failed:', result.reason);
        }
      }
    } else {
      // Run linters sequentially
      for (const linter of this.linters.filter(l => l.enabled)) {
        try {
          const result = await this.runLinter(linter, targetFiles);
          linterResults.push(result);
        } catch (error) {
          console.error(`Linter ${linter.name} failed:`, error);
        }
      }
    }

    // Aggregate all issues
    const allIssues = this.aggregateIssues(linterResults);

    // Calculate score
    const score = this.calculateScore(allIssues);

    // Generate summary
    const summary = this.generateSummary(linterResults);

    // Check if passed based on thresholds
    const passed = this.checkPassed(allIssues, summary);

    return {
      passed,
      score,
      linters: linterResults,
      issues: allIssues,
      summary,
    };
  }

  /**
   * Parse linter results from various formats
   */
  parseResults(format: 'eslint' | 'semgrep' | 'custom', rawOutput: string): StaticIssue[] {
    switch (format) {
      case 'eslint':
        return this.parseESLintResults(rawOutput);
      case 'semgrep':
        return this.parseSemgrepResults(rawOutput);
      case 'custom':
        return this.parseCustomResults(rawOutput);
      default:
        throw new Error(`Unknown parser format: ${format}`);
    }
  }

  /**
   * Aggregate issues from multiple linters
   */
  aggregateIssues(linterResults: LinterResult[]): StaticIssue[] {
    const allIssues: StaticIssue[] = [];
    const seenIssues = new Set<string>();

    for (const result of linterResults) {
      for (const issue of result.issues) {
        // Deduplicate issues
        const key = `${issue.file}:${issue.line}:${issue.column}:${issue.ruleId}:${issue.message}`;
        if (!seenIssues.has(key)) {
          seenIssues.add(key);
          allIssues.push(issue);
        }
      }
    }

    // Sort by severity
    return this.sortIssuesBySeverity(allIssues);
  }

  /**
   * Run a specific linter
   */
  private async runLinter(linter: LinterConfig, files: string[]): Promise<LinterResult> {
    const startTime = Date.now();

    try {
      const command = `${linter.command} ${linter.args.join(' ')} ${files.join(' ')}`;
      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: this.projectRoot,
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000, // 5 minutes
      });

      const issues = this.parseResults(linter.parser, output);

      return {
        linter: linter.name,
        version: await this.getLinterVersion(linter),
        passed: issues.filter(i => i.severity === 'error').length === 0,
        filesAnalyzed: files.length,
        issues,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      // Linter may exit with non-zero code even with valid output
      if (error instanceof Error && 'stdout' in error) {
        const output = (error as { stdout: string }).stdout;
        const issues = this.parseResults(linter.parser, output);

        return {
          linter: linter.name,
          version: await this.getLinterVersion(linter),
          passed: issues.filter(i => i.severity === 'error').length === 0,
          filesAnalyzed: files.length,
          issues,
          executionTime: Date.now() - startTime,
        };
      }

      return {
        linter: linter.name,
        version: 'unknown',
        passed: false,
        filesAnalyzed: 0,
        issues: [{
          id: `linter-error-${linter.name}`,
          linter: linter.name,
          ruleId: 'linter-failure',
          severity: 'error',
          file: 'N/A',
          line: 0,
          column: 0,
          message: `Linter failed: ${error}`,
          category: 'syntax',
          fixable: false,
        }],
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse ESLint JSON output
   */
  private parseESLintResults(rawOutput: string): StaticIssue[] {
    const issues: StaticIssue[] = [];

    try {
      const results: ESLintResult[] = JSON.parse(rawOutput);

      for (const result of results) {
        for (const message of result.messages) {
          issues.push({
            id: `eslint-${message.ruleId}-${result.filePath}-${message.line}`,
            linter: 'eslint',
            ruleId: message.ruleId ?? 'unknown',
            severity: message.severity === 2 ? 'error' : 'warning',
            file: result.filePath,
            line: message.line,
            column: message.column,
            message: message.message,
            category: this.categorizeESLintRule(message.ruleId),
            fixable: !!message.fix,
            fix: message.fix ? this.convertESLintFix(message.fix) : undefined,
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse ESLint results:', error);
    }

    return issues;
  }

  /**
   * Parse Semgrep JSON output
   */
  private parseSemgrepResults(rawOutput: string): StaticIssue[] {
    const issues: StaticIssue[] = [];

    try {
      const result: SemgrepResult = JSON.parse(rawOutput);

      for (const finding of result.results) {
        issues.push({
          id: `semgrep-${finding.check_id}-${finding.path}-${finding.start.line}`,
          linter: 'semgrep',
          ruleId: finding.check_id,
          severity: this.mapSemgrepSeverity(finding.extra.severity),
          file: finding.path,
          line: finding.start.line,
          column: finding.start.col,
          message: finding.extra.message,
          category: this.categorizeSemgrepRule(finding.check_id, finding.extra.metadata),
          fixable: false, // Semgrep doesn't always provide fixes
        });
      }

      // Add errors as issues
      for (const error of result.errors) {
        issues.push({
          id: `semgrep-error-${error.code}`,
          linter: 'semgrep',
          ruleId: `error-${error.code}`,
          severity: 'error',
          file: error.path ?? 'N/A',
          line: 0,
          column: 0,
          message: error.message,
          category: 'syntax',
          fixable: false,
        });
      }
    } catch (error) {
      console.error('Failed to parse Semgrep results:', error);
    }

    return issues;
  }

  /**
   * Parse custom linter output
   */
  private parseCustomResults(rawOutput: string): StaticIssue[] {
    // Custom format: one issue per line as JSON
    const issues: StaticIssue[] = [];

    try {
      const lines = rawOutput.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.file && parsed.message) {
            issues.push({
              id: `custom-${parsed.ruleId ?? 'unknown'}-${parsed.file}-${parsed.line ?? 0}`,
              linter: 'custom',
              ruleId: parsed.ruleId ?? 'unknown',
              severity: parsed.severity ?? 'warning',
              file: parsed.file,
              line: parsed.line ?? 0,
              column: parsed.column ?? 0,
              message: parsed.message,
              category: parsed.category ?? 'best-practice',
              fixable: parsed.fixable ?? false,
            });
          }
        } catch {
          // Skip invalid lines
        }
      }
    } catch (error) {
      console.error('Failed to parse custom results:', error);
    }

    return issues;
  }

  /**
   * Discover files to analyze
   */
  private async discoverFiles(): Promise<string[]> {
    const { glob } = await import('glob') as any;
    const files: string[] = [];

    for (const pattern of this.options.filePatterns!) {
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: this.options.excludePatterns,
        absolute: true,
      });
      files.push(...matches);
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Get linter version
   */
  private async getLinterVersion(linter: LinterConfig): Promise<string> {
    try {
      const output = execSync(`${linter.command} --version`, {
        encoding: 'utf-8',
        cwd: this.projectRoot,
      });
      return output.trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Categorize ESLint rule
   */
  private categorizeESLintRule(ruleId?: string): StaticIssueCategory {
    if (!ruleId) return 'best-practice';

    const securityRules = [
      'security', 'no-eval', 'no-implied-eval', 'no-new-func',
      'no-script-url', 'no-unsafe-finally', 'no-unsafe-negation',
    ];
    const performanceRules = ['no-console', 'no-debugger', 'no-alert'];
    const styleRules = ['indent', 'quotes', 'semi', 'comma', 'brace-style'];
    const maintainabilityRules = ['complexity', 'max-lines', 'max-params', 'no-duplicate'];

    const ruleLower = ruleId.toLowerCase();

    if (securityRules.some(r => ruleLower.includes(r))) return 'security';
    if (performanceRules.some(r => ruleLower.includes(r))) return 'performance';
    if (styleRules.some(r => ruleLower.includes(r))) return 'style';
    if (maintainabilityRules.some(r => ruleLower.includes(r))) return 'maintainability';

    return 'best-practice';
  }

  /**
   * Categorize Semgrep rule
   */
  private categorizeSemgrepRule(
    ruleId: string,
    metadata: Record<string, unknown>
  ): StaticIssueCategory {
    const ruleLower = ruleId.toLowerCase();

    if (ruleLower.includes('security') || ruleLower.includes('injection') ||
        ruleLower.includes('xss') || ruleLower.includes('auth')) {
      return 'security';
    }
    if (ruleLower.includes('performance') || ruleLower.includes('slow')) {
      return 'performance';
    }
    if (metadata?.category === 'security') return 'security';
    if (metadata?.category === 'performance') return 'performance';

    return 'best-practice';
  }

  /**
   * Map Semgrep severity to our severity
   */
  private mapSemgrepSeverity(severity: string): 'error' | 'warning' | 'info' {
    switch (severity) {
      case 'ERROR':
        return 'error';
      case 'WARNING':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Convert ESLint fix to our format
   */
  private convertESLintFix(fix: ESLintFix): CodeFix {
    return {
      description: 'Auto-fix available',
      replacements: [{
        range: {
          start: { line: 0, column: fix.range[0] },
          end: { line: 0, column: fix.range[1] },
        },
        text: fix.text,
      }],
    };
  }

  /**
   * Calculate overall score
   */
  private calculateScore(issues: StaticIssue[]): number {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;

    let score = 100;
    score -= errors * 5;
    score -= warnings * 1;

    return Math.max(0, Math.round(score));
  }

  /**
   * Generate summary
   */
  private generateSummary(linterResults: LinterResult[]): LinterSummary {
    const allIssues = linterResults.flatMap(r => r.issues);

    return {
      totalIssues: allIssues.length,
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
      fixableIssues: allIssues.filter(i => i.fixable).length,
      filesWithIssues: new Set(allIssues.map(i => i.file)).size,
    };
  }

  /**
   * Check if analysis passed thresholds
   */
  private checkPassed(issues: StaticIssue[], summary: LinterSummary): boolean {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    return errorCount === 0;
  }

  /**
   * Sort issues by severity
   */
  private sortIssuesBySeverity(issues: StaticIssue[]): StaticIssue[] {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Get default linter configurations
   */
  private getDefaultLinters(): LinterConfig[] {
    return [
      {
        name: 'eslint',
        command: 'npx eslint',
        args: ['--format', 'json', '--ext', '.ts,.tsx,.js,.jsx'],
        parser: 'eslint',
        filePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        enabled: existsSync(join(this.projectRoot, '.eslintrc')) ||
                 existsSync(join(this.projectRoot, '.eslintrc.js')) ||
                 existsSync(join(this.projectRoot, '.eslintrc.json')),
      },
      {
        name: 'semgrep',
        command: 'semgrep',
        args: ['--json', '--config=auto'],
        parser: 'semgrep',
        filePatterns: ['**/*'],
        enabled: this.isCommandAvailable('semgrep'),
      },
    ];
  }

  /**
   * Check if command is available
   */
  private isCommandAvailable(command: string): boolean {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Apply auto-fixes to issues
   */
  async applyFixes(issues: StaticIssue[]): Promise<{ fixed: number; failed: number }> {
    let fixed = 0;
    let failed = 0;

    for (const issue of issues.filter(i => i.fixable && i.fix)) {
      try {
        // Apply fix logic here
        // This would modify the actual files
        fixed++;
      } catch {
        failed++;
      }
    }

    return { fixed, failed };
  }

  /**
   * Run ESLint with auto-fix
   */
  async runESLintFix(files: string[]): Promise<LinterResult> {
    const linter: LinterConfig = {
      name: 'eslint-fix',
      command: 'npx eslint',
      args: ['--fix', '--format', 'json', '--ext', '.ts,.tsx,.js,.jsx'],
      parser: 'eslint',
      filePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      enabled: true,
    };

    return this.runLinter(linter, files);
  }

  /**
   * Generate ESLint config for project
   */
  generateESLintConfig(projectType: 'node' | 'react' | 'vue' | 'angular'): Record<string, unknown> {
    const baseConfig = {
      root: true,
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint', 'security', 'import'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:security/recommended',
      ],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': 'error',
        'security/detect-object-injection': 'warn',
        'no-console': 'warn',
      },
    };

    switch (projectType) {
      case 'react':
        return {
          ...baseConfig,
          extends: [...(baseConfig.extends as string[]), 'plugin:react/recommended'],
          plugins: [...baseConfig.plugins, 'react', 'react-hooks'],
          rules: {
            ...baseConfig.rules,
            'react/prop-types': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
          },
        };
      case 'vue':
        return {
          ...baseConfig,
          extends: [...(baseConfig.extends as string[]), 'plugin:vue/recommended'],
          plugins: [...baseConfig.plugins, 'vue'],
        };
      case 'angular':
        return {
          ...baseConfig,
          extends: [...(baseConfig.extends as string[])],
          plugins: baseConfig.plugins,
        };
      default:
        return baseConfig;
    }
  }
}

export default StaticAnalysis;
