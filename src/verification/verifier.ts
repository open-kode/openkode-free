/**
 * OpenKode Verifier
 * Main verification orchestrator with multi-modal verification pipeline
 */

import {
  VerificationResult,
  VerificationStage,
  VerificationMode,
  VerificationConfig,
  VerificationThresholds,
  VerificationSummary,
  VerificationReport,
  ReportArtifact,
  DiffReviewResult,
  RegressionResult,
  StaticAnalysisResult,
  SecurityResult,
  TestResult,
  ReviewComment,
  SecurityIssue,
  TestRunResult,
} from './types';

import { DiffReviewer, DiffReviewerOptions } from './diffReviewer';
import { RegressionDetector, RegressionDetectorOptions } from './regressionDetector';
import { StaticAnalysis, StaticAnalysisOptions } from './staticAnalysis';
import { SecurityScanner, SecurityScannerOptions } from './securityScanner';
import { TestRunner, TestRunnerOptions } from './testRunner';

import { EventEmitter } from 'events';

export interface VerifierOptions {
  config?: VerificationConfig;
  projectRoot?: string;
  diffOptions?: DiffReviewerOptions;
  regressionOptions?: RegressionDetectorOptions;
  staticOptions?: StaticAnalysisOptions;
  securityOptions?: SecurityScannerOptions;
  testOptions?: TestRunnerOptions;
  onProgress?: (stage: VerificationStage, message: string) => void;
  onStageComplete?: (stage: VerificationStage, result: unknown) => void;
}

export interface VerificationPipeline {
  stages: VerificationStage[];
  currentStage: number;
  results: Map<VerificationStage, unknown>;
}

export interface AggregatedIssues {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  byCategory: Record<string, number>;
}

/**
 * Verifier - Main orchestrator for the verification pipeline
 * Coordinates all verification modules and aggregates results
 */
export class Verifier extends EventEmitter {
  private options: VerifierOptions;
  private config: VerificationConfig;
  private projectRoot: string;

  // Sub-modules
  private diffReviewer: DiffReviewer;
  private regressionDetector: RegressionDetector;
  private staticAnalysis: StaticAnalysis;
  private securityScanner: SecurityScanner;
  private testRunner: TestRunner;

  constructor(options: VerifierOptions = {}) {
    super();

    this.options = {
      projectRoot: process.cwd(),
      ...options,
    };

    this.projectRoot = this.options.projectRoot!;

    this.config = options.config ?? {
      mode: VerificationMode.FULL,
      thresholds: {
        minScore: 70,
        maxIssues: 50,
        maxCriticalIssues: 0,
        minCoverage: 80,
        maxRegressions: 0,
      },
      linters: [],
      security: {
        enabled: true,
        secretPatterns: [],
        severityThreshold: 'low',
        excludePaths: ['node_modules', '.git'],
      },
      test: {
        enabled: true,
        testCommand: 'npm test',
        coverageCommand: 'npm run test:coverage',
        coverageThreshold: 80,
        timeout: 300000,
        parallel: true,
      },
      diff: {
        enabled: true,
        maxFiles: 50,
        maxLines: 5000,
        excludePatterns: ['*.lock', 'node_modules/**'],
      },
      regression: {
        enabled: true,
        comparisonStrategy: 'smart',
      },
    };

    // Initialize sub-modules
    this.diffReviewer = new DiffReviewer(options.diffOptions);
    this.regressionDetector = new RegressionDetector(options.regressionOptions);
    this.staticAnalysis = new StaticAnalysis(options.staticOptions);
    this.securityScanner = new SecurityScanner(options.securityOptions);
    this.testRunner = new TestRunner(options.testOptions);
  }

  /**
   * Main entry point: run full verification pipeline
   */
  async verify(context?: {
    diff?: string;
    baselineResults?: TestRunResult;
    files?: string[];
  }): Promise<VerificationResult> {
    const startTime = Date.now();
    const results: VerificationResult['results'] = {};

    this.emit('start', { timestamp: new Date() });

    try {
      // Stage 1: Diff Review (if diff provided)
      if (this.config.diff.enabled && context?.diff) {
        this.setStage(VerificationStage.DIFF_REVIEW);
        this.emit('stageStart', VerificationStage.DIFF_REVIEW);

        results.diffReview = await this.diffReviewer.reviewDiff(context.diff, {
          planId: 'current',
        });

        this.emit('stageComplete', VerificationStage.DIFF_REVIEW, results.diffReview);
      }

      // Stage 2: Static Analysis
      if (this.shouldRunStage('static')) {
        this.setStage(VerificationStage.STATIC_ANALYSIS);
        this.emit('stageStart', VerificationStage.STATIC_ANALYSIS);

        results.staticAnalysis = await this.staticAnalysis.runLinters(context?.files);

        this.emit('stageComplete', VerificationStage.STATIC_ANALYSIS, results.staticAnalysis);
      }

      // Stage 3: Security Scan
      if (this.shouldRunStage('security')) {
        this.setStage(VerificationStage.SECURITY_SCAN);
        this.emit('stageStart', VerificationStage.SECURITY_SCAN);

        results.security = await this.securityScanner.scanSecurity(context?.files);

        this.emit('stageComplete', VerificationStage.SECURITY_SCAN, results.security);
      }

      // Stage 4: Test Execution
      if (this.shouldRunStage('test')) {
        this.setStage(VerificationStage.TEST_EXECUTION);
        this.emit('stageStart', VerificationStage.TEST_EXECUTION);

        const testResult = await this.testRunner.runTests();
        results.tests = testResult;

        this.emit('stageComplete', VerificationStage.TEST_EXECUTION, testResult);
      }

      // Stage 5: Regression Check (if baseline provided)
      if (this.config.regression.enabled && context?.baselineResults && results.tests) {
        this.setStage(VerificationStage.REGRESSION_CHECK);
        this.emit('stageStart', VerificationStage.REGRESSION_CHECK);

        results.regression = await this.regressionDetector.detectRegressions(
          {
            runId: Date.now().toString(),
            timestamp: new Date(),
            suite: results.tests.suite,
            coverage: results.tests.coverage,
          },
          context.baselineResults
        );

        this.emit('stageComplete', VerificationStage.REGRESSION_CHECK, results.regression);
      }

      // Stage 6: Aggregation
      this.setStage(VerificationStage.AGGREGATION);
      this.emit('stageStart', VerificationStage.AGGREGATION);

      const summary = this.aggregateResults(results);
      const passed = this.determinePassFail(results, summary);
      const score = this.calculateOverallScore(results);

      this.setStage(VerificationStage.COMPLETE);

      const duration = Date.now() - startTime;
      const report = this.generateReport(results, summary, passed, score);

      const result: VerificationResult = {
        passed,
        score,
        stage: VerificationStage.COMPLETE,
        timestamp: new Date(),
        duration,
        results,
        summary,
        report,
      };

      this.emit('complete', result);

      return result;
    } catch (error) {
      this.setStage(VerificationStage.FAILED);

      const failedResult: VerificationResult = {
        passed: false,
        score: 0,
        stage: VerificationStage.FAILED,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        results,
        summary: this.createErrorSummary(error as Error),
      };

      this.emit('error', error);
      return failedResult;
    }
  }

  /**
   * Aggregate results from all verification stages
   */
  aggregateResults(results: VerificationResult['results']): VerificationSummary {
    const aggregated: VerificationSummary = {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warningCount: 0,
      criticalIssues: 0,
      recommendations: [],
    };

    // Aggregate diff review results
    if (results.diffReview) {
      aggregated.totalChecks++;
      if (results.diffReview.passed) {
        aggregated.passedChecks++;
      } else {
        aggregated.failedChecks++;
      }
      aggregated.warningCount += results.diffReview.comments.filter(
        c => c.severity === 'medium' || c.severity === 'low'
      ).length;
      aggregated.criticalIssues += results.diffReview.comments.filter(
        c => c.severity === 'critical'
      ).length;
      aggregated.recommendations.push(...this.extractRecommendations(results.diffReview));
    }

    // Aggregate static analysis results
    if (results.staticAnalysis) {
      aggregated.totalChecks++;
      if (results.staticAnalysis.passed) {
        aggregated.passedChecks++;
      } else {
        aggregated.failedChecks++;
      }
      aggregated.warningCount += results.staticAnalysis.summary.warnings;
      aggregated.criticalIssues += results.staticAnalysis.summary.errors;
      aggregated.recommendations.push(...this.extractStaticRecommendations(results.staticAnalysis));
    }

    // Aggregate security results
    if (results.security) {
      aggregated.totalChecks++;
      if (results.security.passed) {
        aggregated.passedChecks++;
      } else {
        aggregated.failedChecks++;
      }
      aggregated.warningCount += results.security.summary.highCount;
      aggregated.criticalIssues += results.security.summary.criticalCount;
      aggregated.recommendations.push(...this.extractSecurityRecommendations(results.security));
    }

    // Aggregate test results
    if (results.tests) {
      aggregated.totalChecks++;
      if (results.tests.passed) {
        aggregated.passedChecks++;
      } else {
        aggregated.failedChecks++;
      }
      aggregated.warningCount += results.tests.summary.slowTests.length;
      aggregated.recommendations.push(...this.extractTestRecommendations(results.tests));
    }

    // Aggregate regression results
    if (results.regression) {
      aggregated.totalChecks++;
      if (results.regression.passed) {
        aggregated.passedChecks++;
      } else {
        aggregated.failedChecks++;
      }
      aggregated.criticalIssues += results.regression.regressions.filter(
        r => r.severity === 'critical'
      ).length;
      aggregated.recommendations.push(...this.extractRegressionRecommendations(results.regression));
    }

    return aggregated;
  }

  /**
   * Generate verification report
   */
  generateReport(
    results: VerificationResult['results'],
    summary: VerificationSummary,
    passed: boolean,
    score: number
  ): VerificationReport {
    const artifacts: ReportArtifact[] = [];

    // Generate markdown report
    const markdown = this.generateMarkdownReport(results, summary, passed, score);

    // Generate JSON report
    const json = JSON.stringify(
      {
        passed,
        score,
        summary,
        results,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    );

    // Collect artifacts
    if (results.diffReview) {
      artifacts.push({
        type: 'diff',
        path: 'diff-review.json',
        content: JSON.stringify(results.diffReview, null, 2),
      });
    }

    if (results.staticAnalysis) {
      artifacts.push({
        type: 'lint',
        path: 'static-analysis.json',
        content: JSON.stringify(results.staticAnalysis, null, 2),
      });
    }

    if (results.security) {
      artifacts.push({
        type: 'security',
        path: 'security-scan.json',
        content: JSON.stringify(results.security, null, 2),
      });
    }

    if (results.tests?.coverage) {
      artifacts.push({
        type: 'coverage',
        path: 'coverage.json',
        content: JSON.stringify(results.tests.coverage, null, 2),
      });
    }

    return {
      markdown,
      json,
      artifacts,
    };
  }

  /**
   * Quick verification mode - runs only essential checks
   */
  async verifyQuick(files?: string[]): Promise<VerificationResult> {
    const originalMode = this.config.mode;
    this.config.mode = VerificationMode.QUICK;

    const result = await this.verify({ files });

    this.config.mode = originalMode;
    return result;
  }

  /**
   * Security-only verification
   */
  async verifySecurity(files?: string[]): Promise<VerificationResult> {
    const originalMode = this.config.mode;
    this.config.mode = VerificationMode.SECURITY_ONLY;

    const result = await this.verify({ files });

    this.config.mode = originalMode;
    return result;
  }

  /**
   * Test-only verification
   */
  async verifyTests(): Promise<VerificationResult> {
    const originalMode = this.config.mode;
    this.config.mode = VerificationMode.TESTS_ONLY;

    const result = await this.verify();

    this.config.mode = originalMode;
    return result;
  }

  /**
   * Diff-only verification
   */
  async verifyDiff(diff: string): Promise<VerificationResult> {
    const originalMode = this.config.mode;
    this.config.mode = VerificationMode.DIFF_ONLY;

    const result = await this.verify({ diff });

    this.config.mode = originalMode;
    return result;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private currentStage: VerificationStage = VerificationStage.IDLE;

  private setStage(stage: VerificationStage): void {
    this.currentStage = stage;
    this.emit('stage', stage);
  }

  private shouldRunStage(stage: string): boolean {
    const mode = this.config.mode;

    switch (mode) {
      case VerificationMode.FULL:
        return true;
      case VerificationMode.QUICK:
        return ['security', 'test'].includes(stage);
      case VerificationMode.SECURITY_ONLY:
        return stage === 'security';
      case VerificationMode.TESTS_ONLY:
        return stage === 'test';
      case VerificationMode.DIFF_ONLY:
        return false;
      default:
        return true;
    }
  }

  private determinePassFail(
    results: VerificationResult['results'],
    summary: VerificationSummary
  ): boolean {
    const thresholds = this.config.thresholds;

    // Check critical issues
    if (summary.criticalIssues > thresholds.maxCriticalIssues) {
      return false;
    }

    // Check overall score
    const score = this.calculateOverallScore(results);
    if (score < thresholds.minScore) {
      return false;
    }

    // Check individual stage results
    if (results.security && !results.security.passed) {
      return false;
    }

    if (results.tests && !results.tests.passed && this.config.test.enabled) {
      return false;
    }

    if (results.regression && !results.regression.passed) {
      return false;
    }

    return true;
  }

  private calculateOverallScore(results: VerificationResult['results']): number {
    const scores: number[] = [];

    if (results.diffReview) scores.push(results.diffReview.score);
    if (results.staticAnalysis) scores.push(results.staticAnalysis.score);
    if (results.security) scores.push(results.security.score);
    if (results.tests) {
      const testScore = results.tests.summary.passRate;
      const coverageScore = results.tests.summary.coverage;
      scores.push((testScore + coverageScore) / 2);
    }

    if (scores.length === 0) return 100;

    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  private createErrorSummary(error: Error): VerificationSummary {
    return {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 1,
      warningCount: 0,
      criticalIssues: 1,
      recommendations: [`Verification failed with error: ${error.message}`],
    };
  }

  private extractRecommendations(diffReview: DiffReviewResult): string[] {
    const recommendations: string[] = [];

    if (diffReview.comments.length > 0) {
      recommendations.push(`Address ${diffReview.comments.length} review comments`);
    }

    if (!diffReview.alignment.aligned) {
      recommendations.push('Review plan alignment - some items may be missing or extra');
    }

    return recommendations;
  }

  private extractStaticRecommendations(staticAnalysis: StaticAnalysisResult): string[] {
    const recommendations: string[] = [];

    if (staticAnalysis.summary.fixableIssues > 0) {
      recommendations.push(`Apply ${staticAnalysis.summary.fixableIssues} auto-fixable issues`);
    }

    if (staticAnalysis.summary.errors > 0) {
      recommendations.push(`Fix ${staticAnalysis.summary.errors} linting errors`);
    }

    return recommendations;
  }

  private extractSecurityRecommendations(security: SecurityResult): string[] {
    const recommendations: string[] = [];

    if (security.secrets.length > 0) {
      recommendations.push(`Remove ${security.secrets.length} detected secrets from code`);
    }

    if (security.summary.criticalCount > 0) {
      recommendations.push(`Address ${security.summary.criticalCount} critical security issues immediately`);
    }

    security.risks.forEach(risk => {
      recommendations.push(`${risk.type}: ${risk.mitigation}`);
    });

    return recommendations;
  }

  private extractTestRecommendations(tests: TestResult): string[] {
    const recommendations: string[] = [];

    if (tests.summary.coverage < this.config.thresholds.minCoverage) {
      recommendations.push(`Increase code coverage from ${tests.summary.coverage.toFixed(1)}% to ${this.config.thresholds.minCoverage}%`);
    }

    if (tests.summary.slowTests.length > 0) {
      recommendations.push(`Optimize ${tests.summary.slowTests.length} slow tests`);
    }

    if (tests.summary.flakyTests.length > 0) {
      recommendations.push(`Stabilize ${tests.summary.flakyTests.length} flaky tests`);
    }

    return recommendations;
  }

  private extractRegressionRecommendations(regression: RegressionResult): string[] {
    const recommendations: string[] = [];

    if (regression.regressions.length > 0) {
      recommendations.push(`Investigate ${regression.regressions.length} detected regressions`);
    }

    if (regression.breakingChanges.length > 0) {
      recommendations.push(`Review ${regression.breakingChanges.length} breaking changes`);
    }

    return recommendations;
  }

  private generateMarkdownReport(
    results: VerificationResult['results'],
    summary: VerificationSummary,
    passed: boolean,
    score: number
  ): string {
    const lines: string[] = [];

    lines.push('# OpenKode Verification Report');
    lines.push('');
    lines.push(`**Status:** ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    lines.push(`**Score:** ${score}/100`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total Checks: ${summary.totalChecks}`);
    lines.push(`- Passed: ${summary.passedChecks}`);
    lines.push(`- Failed: ${summary.failedChecks}`);
    lines.push(`- Warnings: ${summary.warningCount}`);
    lines.push(`- Critical Issues: ${summary.criticalIssues}`);
    lines.push('');

    if (summary.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      for (const rec of summary.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }

    // Diff Review Section
    if (results.diffReview) {
      lines.push('## Diff Review');
      lines.push('');
      lines.push(`**Score:** ${results.diffReview.score}/100`);
      lines.push(`**Alignment:** ${results.diffReview.alignment.aligned ? '✅ Aligned' : '⚠️ Deviations detected'}`);
      lines.push(`**Comments:** ${results.diffReview.comments.length}`);
      lines.push('');

      if (results.diffReview.comments.length > 0) {
        lines.push('### Comments');
        lines.push('');
        for (const comment of results.diffReview.comments.slice(0, 10)) {
          const icon = comment.severity === 'critical' ? '🔴' : comment.severity === 'high' ? '🟠' : '🟡';
          lines.push(`${icon} **${comment.file}:${comment.line}** - ${comment.message}`);
        }
        if (results.diffReview.comments.length > 10) {
          lines.push(`\n*... and ${results.diffReview.comments.length - 10} more comments*`);
        }
        lines.push('');
      }
    }

    // Static Analysis Section
    if (results.staticAnalysis) {
      lines.push('## Static Analysis');
      lines.push('');
      lines.push(`**Score:** ${results.staticAnalysis.score}/100`);
      lines.push(`**Issues:** ${results.staticAnalysis.summary.totalIssues} (${results.staticAnalysis.summary.errors} errors, ${results.staticAnalysis.summary.warnings} warnings)`);
      lines.push('');
    }

    // Security Section
    if (results.security) {
      lines.push('## Security Scan');
      lines.push('');
      lines.push(`**Score:** ${results.security.score}/100`);
      lines.push(`**Issues:** ${results.security.summary.totalIssues} (${results.security.summary.criticalCount} critical, ${results.security.summary.highCount} high)`);
      lines.push(`**Secrets Found:** ${results.security.summary.secretsFound}`);
      lines.push('');

      if (results.security.secrets.length > 0) {
        lines.push('### Detected Secrets');
        lines.push('');
        for (const secret of results.security.secrets.slice(0, 5)) {
          lines.push(`- **${secret.type}** in ${secret.file}:${secret.line} (${secret.confidence} confidence)`);
        }
        lines.push('');
      }
    }

    // Tests Section
    if (results.tests) {
      lines.push('## Test Results');
      lines.push('');
      lines.push(`**Status:** ${results.tests.passed ? '✅ Passed' : '❌ Failed'}`);
      lines.push(`**Pass Rate:** ${results.tests.summary.passRate.toFixed(1)}%`);
      lines.push(`**Coverage:** ${results.tests.summary.coverage.toFixed(1)}%`);
      lines.push(`**Duration:** ${(results.tests.summary.duration / 1000).toFixed(2)}s`);
      lines.push('');
    }

    // Regression Section
    if (results.regression) {
      lines.push('## Regression Check');
      lines.push('');
      lines.push(`**Status:** ${results.regression.passed ? '✅ No regressions' : '⚠️ Regressions detected'}`);
      lines.push(`**Regressions:** ${results.regression.regressions.length}`);
      lines.push(`**Breaking Changes:** ${results.regression.breakingChanges.length}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run full verification
 */
export async function verify(options?: VerifierOptions): Promise<VerificationResult> {
  const verifier = new Verifier(options);
  return verifier.verify();
}

/**
 * Run quick verification
 */
export async function verifyQuick(options?: VerifierOptions): Promise<VerificationResult> {
  const verifier = new Verifier(options);
  return verifier.verifyQuick();
}

/**
 * Run security verification
 */
export async function verifySecurity(options?: VerifierOptions): Promise<VerificationResult> {
  const verifier = new Verifier(options);
  return verifier.verifySecurity();
}

/**
 * Run test verification
 */
export async function verifyTests(options?: VerifierOptions): Promise<VerificationResult> {
  const verifier = new Verifier(options);
  return verifier.verifyTests();
}

/**
 * Run diff verification
 */
export async function verifyDiff(diff: string, options?: VerifierOptions): Promise<VerificationResult> {
  const verifier = new Verifier(options);
  return verifier.verifyDiff(diff);
}

export default Verifier;
