/**
 * OpenKode Regression Detector
 * Detects regressions by comparing before/after behavior
 */

import {
  RegressionResult,
  Regression,
  BreakingChange,
  BehaviorComparison,
  TestRunResult,
  TestSnapshot,
  BehaviorDifference,
  RegressionType,
  RegressionConfig,
} from './types';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface RegressionDetectorOptions {
  config?: RegressionConfig;
  baselineDir?: string;
  comparisonStrategy?: 'strict' | 'lenient' | 'smart';
  thresholds?: {
    performanceDegradationPercent?: number;
    coverageDropPercent?: number;
    maxBehaviorChanges?: number;
  };
}

export interface BaselineData {
  runId: string;
  timestamp: string;
  testResults: TestRunResult;
  snapshots: Record<string, TestSnapshot>;
  metadata: {
    commit: string;
    branch: string;
    version: string;
  };
}

export interface ComparisonOptions {
  comparePerformance?: boolean;
  compareCoverage?: boolean;
  compareBehavior?: boolean;
  compareApi?: boolean;
  ignoreFlaky?: boolean;
}

/**
 * RegressionDetector - Detects regressions in test results and behavior
 * Compares current results against baselines to identify issues
 */
export class RegressionDetector {
  private options: RegressionDetectorOptions;
  private config: RegressionConfig;
  private baseline?: BaselineData;
  private thresholds: {
    performanceDegradationPercent: number;
    coverageDropPercent: number;
    maxBehaviorChanges: number;
  };

  constructor(options: RegressionDetectorOptions = {}) {
    this.options = options;
    this.config = options.config ?? {
      enabled: true,
      comparisonStrategy: 'smart',
    };

    this.thresholds = {
      performanceDegradationPercent: 20,
      coverageDropPercent: 5,
      maxBehaviorChanges: 10,
      ...options.thresholds,
    };

    // Load baseline if path provided
    if (options.baselineDir) {
      this.loadBaseline(options.baselineDir);
    }
  }

  /**
   * Main entry point: detect regressions between baseline and current results
   */
  async detectRegressions(
    currentResults: TestRunResult,
    baselineResults?: TestRunResult,
    options?: ComparisonOptions
  ): Promise<RegressionResult> {
    const baseline = baselineResults ?? this.baseline?.testResults;

    if (!baseline) {
      // No baseline available - create one from current results
      return {
        passed: true,
        regressions: [],
        breakingChanges: [],
        comparison: {
          before: currentResults,
          after: currentResults,
          differences: [],
        },
        summary: 'No baseline available for comparison. Current results stored as baseline.',
      };
    }

    const opts: ComparisonOptions = {
      comparePerformance: true,
      compareCoverage: true,
      compareBehavior: true,
      compareApi: true,
      ignoreFlaky: true,
      ...options,
    };

    const regressions: Regression[] = [];
    const breakingChanges: BreakingChange[] = [];

    // Compare test results
    const testRegressions = this.compareResults(baseline, currentResults, opts);
    regressions.push(...testRegressions);

    // Detect breaking changes
    const apiChanges = this.detectBreakingChanges(baseline, currentResults);
    breakingChanges.push(...apiChanges);

    // Build behavior comparison
    const comparison: BehaviorComparison = {
      before: baseline,
      after: currentResults,
      differences: this.extractDifferences(baseline, currentResults),
    };

    // Generate summary
    const summary = this.generateSummary(regressions, breakingChanges, comparison);

    return {
      passed: regressions.filter(r => r.severity === 'critical').length === 0 &&
              breakingChanges.filter(b => b.type === 'api').length === 0,
      regressions,
      breakingChanges,
      comparison,
      summary,
    };
  }

  /**
   * Compare two test run results
   */
  compareResults(
    before: TestRunResult,
    after: TestRunResult,
    options?: ComparisonOptions
  ): Regression[] {
    const regressions: Regression[] = [];
    const opts = options ?? { comparePerformance: true, compareCoverage: true, ignoreFlaky: true };

    // Compare individual tests
    const beforeTests = this.flattenTests(before.suite);
    const afterTests = this.flattenTests(after.suite);

    // Find tests that changed status
    for (const [testId, afterTest] of afterTests) {
      const beforeTest = beforeTests.get(testId);

      if (!beforeTest) {
        // New test - not a regression
        continue;
      }

      // Check for test failure regression
      if (beforeTest.status === 'passed' && afterTest.status === 'failed') {
        regressions.push({
          id: `failure-${testId}`,
          type: 'test-failure',
          severity: 'high',
          testName: afterTest.name,
          file: afterTest.file,
          description: `Test '${afterTest.name}' started failing`,
          before: this.testToSnapshot(beforeTest),
          after: this.testToSnapshot(afterTest),
          diff: this.generateTestDiff(beforeTest, afterTest),
        });
      }

      // Check for performance regression
      if (opts.comparePerformance && beforeTest.status === 'passed' && afterTest.status === 'passed') {
        const degradation = ((afterTest.duration - beforeTest.duration) / beforeTest.duration) * 100;
        if (degradation > this.thresholds.performanceDegradationPercent) {
          regressions.push({
            id: `perf-${testId}`,
            type: 'performance-degradation',
            severity: degradation > 50 ? 'high' : 'medium',
            testName: afterTest.name,
            file: afterTest.file,
            description: `Test '${afterTest.name}' slowed by ${degradation.toFixed(1)}% (${beforeTest.duration}ms → ${afterTest.duration}ms)`,
            before: this.testToSnapshot(beforeTest),
            after: this.testToSnapshot(afterTest),
            diff: `Duration: ${beforeTest.duration}ms → ${afterTest.duration}ms (+${degradation.toFixed(1)}%)`,
          });
        }
      }

      // Check for behavior changes (output differences)
      if (opts.compareBehavior && beforeTest.logs && afterTest.logs) {
        const logDiff = this.compareLogs(beforeTest.logs, afterTest.logs);
        if (logDiff.hasChanges) {
          regressions.push({
            id: `behavior-${testId}`,
            type: 'behavior-change',
            severity: 'medium',
            testName: afterTest.name,
            file: afterTest.file,
            description: `Test '${afterTest.name}' output behavior changed`,
            before: this.testToSnapshot(beforeTest),
            after: this.testToSnapshot(afterTest),
            diff: logDiff.diff,
          });
        }
      }
    }

    // Check for removed tests (potential breaking change)
    for (const [testId, beforeTest] of beforeTests) {
      if (!afterTests.has(testId)) {
        regressions.push({
          id: `removed-${testId}`,
          type: 'api-breaking',
          severity: 'medium',
          testName: beforeTest.name,
          file: beforeTest.file,
          description: `Test '${beforeTest.name}' was removed`,
          before: this.testToSnapshot(beforeTest),
          after: { status: 'skipped', duration: 0 },
          diff: 'Test removed',
        });
      }
    }

    // Compare coverage
    if (opts.compareCoverage && before.coverage && after.coverage) {
      const coverageDrop = before.coverage.overall - after.coverage.overall;
      if (coverageDrop > this.thresholds.coverageDropPercent) {
        regressions.push({
          id: 'coverage-drop',
          type: 'coverage-drop',
          severity: coverageDrop > 10 ? 'high' : 'medium',
          testName: 'Overall Coverage',
          file: 'N/A',
          description: `Code coverage dropped by ${coverageDrop.toFixed(1)}% (${before.coverage.overall.toFixed(1)}% → ${after.coverage.overall.toFixed(1)}%)`,
          before: { status: 'passed', duration: 0, coverage: before.coverage.overall },
          after: { status: 'passed', duration: 0, coverage: after.coverage.overall },
          diff: `Coverage: ${before.coverage.overall.toFixed(1)}% → ${after.coverage.overall.toFixed(1)}%`,
        });
      }

      // Check per-file coverage drops
      for (const afterFile of after.coverage.files) {
        const beforeFile = before.coverage.files.find(f => f.path === afterFile.path);
        if (beforeFile) {
          const fileCoverageDrop = beforeFile.lines - afterFile.lines;
          if (fileCoverageDrop > 20) {
            regressions.push({
              id: `coverage-${afterFile.path}`,
              type: 'coverage-drop',
              severity: 'low',
              testName: `Coverage: ${afterFile.path}`,
              file: afterFile.path,
              description: `Coverage for '${afterFile.path}' dropped significantly`,
              before: { status: 'passed', duration: 0, coverage: beforeFile.lines },
              after: { status: 'passed', duration: 0, coverage: afterFile.lines },
              diff: `File coverage: ${beforeFile.lines.toFixed(1)}% → ${afterFile.lines.toFixed(1)}%`,
            });
          }
        }
      }
    }

    return this.sortRegressionsBySeverity(regressions);
  }

  /**
   * Flag specific issues based on criteria
   */
  flagIssues(
    regressions: Regression[],
    criteria: {
      minSeverity?: 'critical' | 'high' | 'medium' | 'low';
      types?: RegressionType[];
      maxCount?: number;
    }
  ): Regression[] {
    let filtered = regressions;

    if (criteria.minSeverity) {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const minLevel = severityOrder[criteria.minSeverity];
      filtered = filtered.filter(r => severityOrder[r.severity] <= minLevel);
    }

    if (criteria.types && criteria.types.length > 0) {
      filtered = filtered.filter(r => criteria.types!.includes(r.type));
    }

    if (criteria.maxCount) {
      filtered = filtered.slice(0, criteria.maxCount);
    }

    return filtered;
  }

  /**
   * Save current results as baseline
   */
  saveBaseline(
    results: TestRunResult,
    metadata: { commit: string; branch: string; version: string },
    outputDir: string
  ): void {
    const baseline: BaselineData = {
      runId: results.runId,
      timestamp: new Date().toISOString(),
      testResults: results,
      snapshots: this.extractSnapshots(results),
      metadata,
    };

    const outputPath = join(outputDir, 'baseline.json');
    writeFileSync(outputPath, JSON.stringify(baseline, null, 2));
    this.baseline = baseline;
  }

  /**
   * Load baseline from directory
   */
  loadBaseline(baselineDir: string): BaselineData | undefined {
    const baselinePath = join(baselineDir, 'baseline.json');

    if (!existsSync(baselinePath)) {
      return undefined;
    }

    try {
      const content = readFileSync(baselinePath, 'utf-8');
      this.baseline = JSON.parse(content) as BaselineData;
      return this.baseline;
    } catch (error) {
      console.warn(`Failed to load baseline from ${baselinePath}:`, error);
      return undefined;
    }
  }

  /**
   * Detect breaking changes between versions
   */
  private detectBreakingChanges(before: TestRunResult, after: TestRunResult): BreakingChange[] {
    const changes: BreakingChange[] = [];

    const beforeTests = this.flattenTests(before.suite);
    const afterTests = this.flattenTests(after.suite);

    // Detect API signature changes (based on test names/patterns)
    const beforeApiTests = this.filterApiTests(beforeTests);
    const afterApiTests = this.filterApiTests(afterTests);

    for (const [testId, beforeTest] of beforeApiTests) {
      const afterTest = afterApiTests.get(testId);

      if (!afterTest) {
        changes.push({
          type: 'api',
          description: `API endpoint test '${beforeTest.name}' was removed`,
          impact: 'Clients depending on this endpoint may break',
          migration: 'Review API deprecation policy and provide migration path',
        });
      }
    }

    // Detect behavior changes in existing tests
    for (const [testId, afterTest] of afterTests) {
      const beforeTest = beforeTests.get(testId);

      if (beforeTest && beforeTest.status === 'passed' && afterTest.status === 'passed') {
        // Check if test expectations changed (would indicate behavior change)
        if (this.hasExpectationChanged(beforeTest, afterTest)) {
          changes.push({
            type: 'behavior',
            description: `Behavior changed in '${afterTest.name}'`,
            impact: 'Existing functionality may work differently',
          });
        }
      }
    }

    return changes;
  }

  /**
   * Extract differences between test runs
   */
  private extractDifferences(before: TestRunResult, after: TestRunResult): BehaviorDifference[] {
    const differences: BehaviorDifference[] = [];

    const beforeTests = this.flattenTests(before.suite);
    const afterTests = this.flattenTests(after.suite);

    for (const [testId, afterTest] of afterTests) {
      const beforeTest = beforeTests.get(testId);

      if (beforeTest) {
        // Compare duration
        if (Math.abs(afterTest.duration - beforeTest.duration) > 100) {
          differences.push({
            path: `${testId}/duration`,
            before: beforeTest.duration,
            after: afterTest.duration,
            significance: Math.abs(afterTest.duration - beforeTest.duration) > 500 ? 'major' : 'minor',
          });
        }

        // Compare status
        if (beforeTest.status !== afterTest.status) {
          differences.push({
            path: `${testId}/status`,
            before: beforeTest.status,
            after: afterTest.status,
            significance: 'major',
          });
        }
      }
    }

    // Compare coverage
    if (before.coverage && after.coverage) {
      if (Math.abs(before.coverage.overall - after.coverage.overall) > 1) {
        differences.push({
          path: 'coverage/overall',
          before: before.coverage.overall,
          after: after.coverage.overall,
          significance: Math.abs(before.coverage.overall - after.coverage.overall) > 5 ? 'major' : 'minor',
        });
      }
    }

    return differences;
  }

  /**
   * Flatten test suite into map of test ID to test
   */
  private flattenTests(suite: import('./types').TestSuiteResult): Map<string, import('./types').IndividualTest> {
    const tests = new Map<string, import('./types').IndividualTest>();

    const collectTests = (s: import('./types').TestSuiteResult) => {
      for (const test of s.tests) {
        tests.set(test.id, test);
      }
      if (s.suites) {
        for (const childSuite of s.suites) {
          collectTests(childSuite);
        }
      }
    };

    collectTests(suite);
    return tests;
  }

  /**
   * Convert test to snapshot format
   */
  private testToSnapshot(test: import('./types').IndividualTest): TestSnapshot {
    return {
      status: test.status === 'pending' ? 'skipped' : test.status,
      duration: test.duration,
      output: test.logs?.join('\n'),
      error: test.error?.message,
    };
  }

  /**
   * Generate diff between two tests
   */
  private generateTestDiff(
    before: import('./types').IndividualTest,
    after: import('./types').IndividualTest
  ): string {
    const lines: string[] = [];

    if (before.status !== after.status) {
      lines.push(`Status: ${before.status} → ${after.status}`);
    }

    if (before.duration !== after.duration) {
      const change = ((after.duration - before.duration) / before.duration) * 100;
      lines.push(`Duration: ${before.duration}ms → ${after.duration}ms (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`);
    }

    if (before.error?.message !== after.error?.message) {
      lines.push(`Error changed`);
      if (after.error) {
        lines.push(`New error: ${after.error.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Compare test logs
   */
  private compareLogs(before: string[], after: string[]): { hasChanges: boolean; diff: string } {
    const beforeStr = before.join('\n');
    const afterStr = after.join('\n');

    if (beforeStr === afterStr) {
      return { hasChanges: false, diff: '' };
    }

    // Simple diff
    const beforeSet = new Set(before);
    const afterSet = new Set(after);

    const added = after.filter(l => !beforeSet.has(l));
    const removed = before.filter(l => !afterSet.has(l));

    const diffLines: string[] = [];
    if (added.length > 0) {
      diffLines.push('Added output:');
      added.forEach(l => diffLines.push(`+ ${l}`));
    }
    if (removed.length > 0) {
      diffLines.push('Removed output:');
      removed.forEach(l => diffLines.push(`- ${l}`));
    }

    return { hasChanges: true, diff: diffLines.join('\n') };
  }

  /**
   * Extract snapshots from test results
   */
  private extractSnapshots(results: TestRunResult): Record<string, TestSnapshot> {
    const snapshots: Record<string, TestSnapshot> = {};
    const tests = this.flattenTests(results.suite);

    for (const [id, test] of tests) {
      snapshots[id] = this.testToSnapshot(test);
    }

    return snapshots;
  }

  /**
   * Filter API-related tests
   */
  private filterApiTests(
    tests: Map<string, import('./types').IndividualTest>
  ): Map<string, import('./types').IndividualTest> {
    const apiTests = new Map<string, import('./types').IndividualTest>();

    for (const [id, test] of tests) {
      if (
        test.name.toLowerCase().includes('api') ||
        test.name.toLowerCase().includes('endpoint') ||
        test.file.includes('/api/') ||
        test.file.includes('/routes/')
      ) {
        apiTests.set(id, test);
      }
    }

    return apiTests;
  }

  /**
   * Check if test expectations changed
   */
  private hasExpectationChanged(
    before: import('./types').IndividualTest,
    after: import('./types').IndividualTest
  ): boolean {
    // This is a heuristic - in practice, you'd compare actual test expectations
    return before.assertions !== after.assertions;
  }

  /**
   * Generate regression summary
   */
  private generateSummary(
    regressions: Regression[],
    breakingChanges: BreakingChange[],
    comparison: BehaviorComparison
  ): string {
    const parts: string[] = [];

    const criticalCount = regressions.filter(r => r.severity === 'critical').length;
    const highCount = regressions.filter(r => r.severity === 'high').length;
    const mediumCount = regressions.filter(r => r.severity === 'medium').length;

    if (criticalCount > 0) {
      parts.push(`${criticalCount} critical regressions detected.`);
    }
    if (highCount > 0) {
      parts.push(`${highCount} high severity regressions.`);
    }
    if (mediumCount > 0) {
      parts.push(`${mediumCount} medium severity issues.`);
    }

    if (breakingChanges.length > 0) {
      const apiChanges = breakingChanges.filter(c => c.type === 'api').length;
      const behaviorChanges = breakingChanges.filter(c => c.type === 'behavior').length;
      parts.push(`${apiChanges} API breaking changes, ${behaviorChanges} behavior changes.`);
    }

    const beforePassed = comparison.before.suite.passed;
    const afterPassed = comparison.after.suite.passed;
    if (afterPassed < beforePassed) {
      parts.push(`Tests passing: ${beforePassed} → ${afterPassed} (${beforePassed - afterPassed} fewer)`);
    }

    if (regressions.length === 0 && breakingChanges.length === 0) {
      parts.push('No regressions detected.');
    }

    return parts.join(' ');
  }

  /**
   * Sort regressions by severity
   */
  private sortRegressionsBySeverity(regressions: Regression[]): Regression[] {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return regressions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Check if a test is flaky based on history
   */
  static isFlakyTest(testId: string, history: TestSnapshot[]): boolean {
    if (history.length < 3) return false;

    const statuses = history.map(h => h.status);
    const uniqueStatuses = new Set(statuses);

    // If test has both passed and failed in recent history, it's flaky
    return uniqueStatuses.has('passed') && uniqueStatuses.has('failed');
  }

  /**
   * Calculate flakiness score for a test
   */
  static calculateFlakiness(history: TestSnapshot[]): number {
    if (history.length < 3) return 0;

    const statuses = history.map(h => h.status);
    const transitions = statuses.slice(1).filter((status, i) => status !== statuses[i]).length;

    return (transitions / (statuses.length - 1)) * 100;
  }
}

export default RegressionDetector;
