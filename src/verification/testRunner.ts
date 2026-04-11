/**
 * OpenKode Test Runner
 * Test discovery, execution, coverage analysis, and validation
 */

import {
  TestResult,
  TestSuiteResult,
  TestRunResult,
  CoverageResult,
  FileCoverage,
  TestSummary,
  IndividualTest,
  TestError,
  TestConfig,
  UncoveredRange,
  SlowTest,
} from './types';
import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, resolve, relative } from 'path';

export interface TestRunnerOptions {
  config?: TestConfig;
  projectRoot?: string;
  testFramework?: 'jest' | 'vitest' | 'mocha' | 'ava' | 'tap';
  testPattern?: string;
  coverageReporter?: 'json' | 'lcov' | 'text' | 'html';
  parallel?: boolean;
  bail?: number;
  verbose?: boolean;
}

export interface TestDiscoveryResult {
  testFiles: string[];
  testCount: number;
  suiteCount: number;
}

export interface JestOutput {
  numFailedTestSuites: number;
  numFailedTests: number;
  numPassedTestSuites: number;
  numPassedTests: number;
  numPendingTestSuites: number;
  numPendingTests: number;
  numTotalTestSuites: number;
  numTotalTests: number;
  startTime: number;
  success: boolean;
  testResults: JestTestResult[];
  coverageMap?: JestCoverageMap;
}

export interface JestTestResult {
  name: string;
  status: 'passed' | 'failed' | 'pending';
  startTime: number;
  endTime: number;
  assertionResults: JestAssertionResult[];
  message?: string;
}

export interface JestAssertionResult {
  ancestorTitles: string[];
  failureMessages: string[];
  fullName: string;
  location?: { column: number; line: number };
  status: 'passed' | 'failed' | 'pending';
  title: string;
  duration?: number;
}

export interface JestCoverageMap {
  [filePath: string]: JestFileCoverage;
}

export interface JestFileCoverage {
  path: string;
  statementMap: Record<string, { start: { line: number; column: number }; end: { line: number; column: number } }>;
  fnMap: Record<string, { name: string; line: number }>;
  branchMap: Record<string, { line: number; type: string; locations: unknown[] }>;
  s: Record<string, number>;
  f: Record<string, number>;
  b: Record<string, number[]>;
}

export interface VitestOutput {
  testResults: VitestTestResult[];
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
}

export interface VitestTestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  file: string;
  error?: string;
}

/**
 * TestRunner - Comprehensive test execution and analysis
 * Supports multiple test frameworks with unified interface
 */
export class TestRunner {
  private options: TestRunnerOptions;
  private config: TestConfig;
  private projectRoot: string;
  private testFramework: 'jest' | 'vitest' | 'mocha' | 'ava' | 'tap';

  constructor(options: TestRunnerOptions = {}) {
    this.options = {
      projectRoot: process.cwd(),
      testFramework: 'jest',
      testPattern: '**/*.test.{ts,tsx,js,jsx}',
      coverageReporter: 'json',
      parallel: true,
      bail: 0,
      verbose: false,
      ...options,
    };

    this.projectRoot = resolve(this.options.projectRoot!);
    this.testFramework = this.options.testFramework!;
    this.config = options.config ?? {
      enabled: true,
      testCommand: this.getDefaultTestCommand(),
      coverageCommand: this.getDefaultCoverageCommand(),
      coverageThreshold: 80,
      timeout: 300000,
      parallel: true,
    };
  }

  /**
   * Main entry point: discover and run tests
   */
  async runTests(testFiles?: string[]): Promise<TestResult> {
    const files = testFiles ?? (await this.discoverTests()).testFiles;

    if (files.length === 0) {
      return {
        passed: true,
        suite: this.createEmptySuite(),
        coverage: this.createEmptyCoverage(),
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          passRate: 100,
          duration: 0,
          coverage: 0,
          flakyTests: [],
          slowTests: [],
        },
      };
    }

    const startTime = Date.now();

    // Run tests based on framework
    let suite: TestSuiteResult;
    switch (this.testFramework) {
      case 'jest':
        suite = await this.runJestTests(files);
        break;
      case 'vitest':
        suite = await this.runVitestTests(files);
        break;
      case 'mocha':
        suite = await this.runMochaTests(files);
        break;
      default:
        suite = await this.runGenericTests(files);
    }

    const duration = Date.now() - startTime;

    // Get coverage
    const coverage = await this.getCoverage();

    // Validate results
    const validated = this.validateResults(suite, coverage);

    // Generate summary
    const summary = this.generateSummary(suite, coverage, duration);

    return {
      passed: validated.valid && suite.failed === 0,
      suite,
      coverage,
      summary,
    };
  }

  /**
   * Discover test files in the project
   */
  async discoverTests(): Promise<TestDiscoveryResult> {
    const { glob } = await import('glob') as any;
    const testFiles: string[] = [];

    const patterns = this.options.testPattern!.split(',').map(p => p.trim());

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'build/**'],
        absolute: true,
      });
      testFiles.push(...matches);
    }

    const uniqueFiles = [...new Set(testFiles)];

    // Estimate test count (rough approximation)
    let testCount = 0;
    for (const file of uniqueFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const matches = content.match(/\b(it|test|describe)\s*\(/g);
        testCount += matches?.length ?? 0;
      } catch {
        // Skip unreadable files
      }
    }

    return {
      testFiles: uniqueFiles,
      testCount,
      suiteCount: uniqueFiles.length,
    };
  }

  /**
   * Get code coverage data
   */
  async getCoverage(): Promise<CoverageResult> {
    const coveragePath = join(this.projectRoot, 'coverage', 'coverage-final.json');

    if (!existsSync(coveragePath)) {
      // Try alternative paths
      const altPaths = [
        join(this.projectRoot, 'coverage', 'coverage-summary.json'),
        join(this.projectRoot, 'coverage', 'lcov-report', 'coverage-summary.json'),
      ];

      for (const path of altPaths) {
        if (existsSync(path)) {
          return this.parseCoverageFile(path);
        }
      }

      return this.createEmptyCoverage();
    }

    return this.parseCoverageFile(coveragePath);
  }

  /**
   * Validate test results against thresholds
   */
  validateResults(suite: TestSuiteResult, coverage?: CoverageResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check pass rate
    const passRate = suite.total > 0 ? (suite.passed / suite.total) * 100 : 100;
    if (passRate < 100) {
      errors.push(`Pass rate ${passRate.toFixed(1)}% is below 100%`);
    }

    // Check coverage threshold
    if (coverage && coverage.overall < this.config.coverageThreshold) {
      errors.push(`Coverage ${coverage.overall.toFixed(1)}% is below threshold ${this.config.coverageThreshold}%`);
    }

    // Check for critical test failures
    const criticalFailures = suite.tests.filter(t => t.status === 'failed' && t.error?.message?.includes('critical'));
    if (criticalFailures.length > 0) {
      errors.push(`${criticalFailures.length} critical test failures`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Run Jest tests
   */
  private async runJestTests(files: string[]): Promise<TestSuiteResult> {
    const command = [
      'npx jest',
      '--json',
      '--outputFile=jest-results.json',
      '--testLocationInResults',
      this.options.verbose ? '--verbose' : '',
      this.options.parallel ? '--maxWorkers=50%' : '--runInBand',
      this.options.bail! > 0 ? `--bail=${this.options.bail}` : '',
      ...files,
    ].filter(Boolean);

    try {
      execSync(command.join(' '), {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: this.config.timeout,
        stdio: this.options.verbose ? 'inherit' : 'pipe',
      });
    } catch {
      // Jest exits with error code if tests fail, but still produces output
    }

    const resultsPath = join(this.projectRoot, 'jest-results.json');
    if (!existsSync(resultsPath)) {
      throw new Error('Jest did not produce results file');
    }

    const output: JestOutput = JSON.parse(readFileSync(resultsPath, 'utf-8'));
    return this.convertJestOutput(output);
  }

  /**
   * Run Vitest tests
   */
  private async runVitestTests(files: string[]): Promise<TestSuiteResult> {
    const command = [
      'npx vitest run',
      '--reporter=json',
      '--outputFile=vitest-results.json',
      this.options.parallel ? '' : '--pool=forks',
      ...files,
    ].filter(Boolean);

    try {
      execSync(command.join(' '), {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: this.config.timeout,
        stdio: this.options.verbose ? 'inherit' : 'pipe',
      });
    } catch {
      // Vitest exits with error code if tests fail
    }

    const resultsPath = join(this.projectRoot, 'vitest-results.json');
    if (!existsSync(resultsPath)) {
      throw new Error('Vitest did not produce results file');
    }

    const output: VitestOutput = JSON.parse(readFileSync(resultsPath, 'utf-8'));
    return this.convertVitestOutput(output);
  }

  /**
   * Run Mocha tests
   */
  private async runMochaTests(files: string[]): Promise<TestSuiteResult> {
    const command = [
      'npx mocha',
      '--reporter=json',
      '--timeout=10000',
      ...files,
    ];

    let output: string;
    try {
      output = execSync(command.join(' '), {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: this.config.timeout,
      });
    } catch (error) {
      output = (error as { stdout: string }).stdout ?? '{}';
    }

    // Parse Mocha JSON output
    const mochaResults = JSON.parse(output || '{}');
    return this.convertMochaOutput(mochaResults);
  }

  /**
   * Run generic tests using configured command
   */
  private async runGenericTests(files: string[]): Promise<TestSuiteResult> {
    try {
      execSync(`${this.config.testCommand} ${files.join(' ')}`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: this.config.timeout,
      });

      return this.createEmptySuite();
    } catch (error) {
      throw new Error(`Test execution failed: ${error}`);
    }
  }

  /**
   * Parse coverage file
   */
  private parseCoverageFile(path: string): CoverageResult {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content);

    // Handle different coverage formats
    if (data.total) {
      // coverage-summary.json format
      return {
        overall: data.total.lines.pct,
        lines: data.total.lines.pct,
        functions: data.total.functions.pct,
        branches: data.total.branches.pct,
        statements: data.total.statements.pct,
        files: Object.entries(data)
          .filter(([key]) => key !== 'total')
          .map(([path, cov]: [string, unknown]) => ({
            path,
            lines: (cov as { lines: { pct: number } }).lines.pct,
            functions: (cov as { functions: { pct: number } }).functions.pct,
            branches: (cov as { branches: { pct: number } }).branches.pct,
            statements: (cov as { statements: { pct: number } }).statements.pct,
            uncoveredLines: [],
          })),
        uncovered: [],
      };
    }

    // coverage-final.json format (Istanbul)
    const files: FileCoverage[] = [];
    let totalStatements = 0;
    let coveredStatements = 0;

    for (const [filePath, fileCov] of Object.entries(data as Record<string, JestFileCoverage>)) {
      const s = fileCov.s;
      const fileTotal = Object.values(s).length;
      const fileCovered = Object.values(s).filter(v => v > 0).length;

      totalStatements += fileTotal;
      coveredStatements += fileCovered;

      const uncoveredLines = Object.entries(s)
        .filter(([, v]) => v === 0)
        .map(([k]) => parseInt(k, 10));

      files.push({
        path: filePath,
        lines: fileTotal > 0 ? (fileCovered / fileTotal) * 100 : 100,
        functions: 0, // Would need fnMap calculation
        branches: 0, // Would need branchMap calculation
        statements: fileTotal > 0 ? (fileCovered / fileTotal) * 100 : 100,
        uncoveredLines,
      });
    }

    return {
      overall: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 100,
      lines: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 100,
      functions: 0,
      branches: 0,
      statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 100,
      files,
      uncovered: this.extractUncoveredRanges(files),
    };
  }

  /**
   * Convert Jest output to our format
   */
  private convertJestOutput(output: JestOutput): TestSuiteResult {
    const tests: IndividualTest[] = [];

    for (const suite of output.testResults) {
      for (const test of suite.assertionResults) {
        tests.push({
          id: `${suite.name}::${test.fullName}`,
          name: test.title,
          fullName: test.fullName,
          status: test.status === 'pending' ? 'pending' : test.status,
          duration: test.duration ?? 0,
          file: suite.name,
          line: test.location?.line,
          error: test.failureMessages.length > 0
            ? { message: test.failureMessages.join('\n') }
            : undefined,
          assertions: test.failureMessages.length > 0 ? 0 : 1,
        });
      }
    }

    return {
      name: 'Jest Test Suite',
      total: output.numTotalTests,
      passed: output.numPassedTests,
      failed: output.numFailedTests,
      skipped: output.numPendingTests,
      pending: output.numPendingTests,
      duration: output.testResults.reduce((sum, r) => sum + (r.endTime - r.startTime), 0),
      tests,
    };
  }

  /**
   * Convert Vitest output to our format
   */
  private convertVitestOutput(output: VitestOutput): TestSuiteResult {
    const tests: IndividualTest[] = output.testResults.map(t => ({
      id: `${t.file}::${t.name}`,
      name: t.name,
      fullName: t.name,
      status: t.status === 'skipped' ? 'skipped' : t.status === 'passed' ? 'passed' : 'failed',
      duration: t.duration,
      file: t.file,
      error: t.error ? { message: t.error } : undefined,
      assertions: 1,
    }));

    return {
      name: 'Vitest Test Suite',
      total: output.numTotalTests,
      passed: output.numPassedTests,
      failed: output.numFailedTests,
      skipped: output.numPendingTests,
      pending: output.numPendingTests,
      duration: tests.reduce((sum, t) => sum + t.duration, 0),
      tests,
    };
  }

  /**
   * Convert Mocha output to our format
   */
  private convertMochaOutput(output: unknown): TestSuiteResult {
    // Simplified Mocha conversion
    return {
      name: 'Mocha Test Suite',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      duration: 0,
      tests: [],
    };
  }

  /**
   * Generate test summary
   */
  private generateSummary(suite: TestSuiteResult, coverage: CoverageResult, duration: number): TestSummary {
    const passRate = suite.total > 0 ? (suite.passed / suite.total) * 100 : 100;

    // Identify slow tests
    const slowThreshold = 1000; // 1 second
    const slowTests: SlowTest[] = suite.tests
      .filter(t => t.duration > slowThreshold)
      .map(t => ({
        name: t.name,
        duration: t.duration,
        threshold: slowThreshold,
      }));

    // Identify potentially flaky tests (would need historical data)
    const flakyTests: string[] = [];

    return {
      total: suite.total,
      passed: suite.passed,
      failed: suite.failed,
      skipped: suite.skipped,
      passRate,
      duration,
      coverage: coverage.overall,
      flakyTests,
      slowTests,
    };
  }

  /**
   * Extract uncovered ranges from file coverage
   */
  private extractUncoveredRanges(files: FileCoverage[]): UncoveredRange[] {
    const uncovered: UncoveredRange[] = [];

    for (const file of files) {
      if (file.uncoveredLines.length === 0) continue;

      // Group consecutive lines into ranges
      let start = file.uncoveredLines[0];
      let end = start;

      for (let i = 1; i < file.uncoveredLines.length; i++) {
        if (file.uncoveredLines[i] === end + 1) {
          end = file.uncoveredLines[i];
        } else {
          uncovered.push({
            file: file.path,
            start,
            end,
            type: 'line',
          });
          start = file.uncoveredLines[i];
          end = start;
        }
      }

      uncovered.push({
        file: file.path,
        start,
        end,
        type: 'line',
      });
    }

    return uncovered;
  }

  /**
   * Create empty suite result
   */
  private createEmptySuite(): TestSuiteResult {
    return {
      name: 'Empty Test Suite',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      duration: 0,
      tests: [],
    };
  }

  /**
   * Create empty coverage result
   */
  private createEmptyCoverage(): CoverageResult {
    return {
      overall: 0,
      lines: 0,
      functions: 0,
      branches: 0,
      statements: 0,
      files: [],
      uncovered: [],
    };
  }

  /**
   * Get default test command
   */
  private getDefaultTestCommand(): string {
    switch (this.testFramework) {
      case 'jest':
        return 'npx jest';
      case 'vitest':
        return 'npx vitest run';
      case 'mocha':
        return 'npx mocha';
      default:
        return 'npm test';
    }
  }

  /**
   * Get default coverage command
   */
  private getDefaultCoverageCommand(): string {
    switch (this.testFramework) {
      case 'jest':
        return 'npx jest --coverage';
      case 'vitest':
        return 'npx vitest run --coverage';
      default:
        return 'npm run test:coverage';
    }
  }

  /**
   * Watch mode for continuous testing
   */
  async watchTests(onResult?: (result: TestResult) => void): Promise<void> {
    const command = this.testFramework === 'vitest'
      ? 'npx vitest'
      : 'npx jest --watch';

    const child = spawn(command, {
      cwd: this.projectRoot,
      stdio: 'inherit',
      shell: true,
    });

    return new Promise((resolve, reject) => {
      child.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Test watch exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Run tests with coverage
   */
  async runTestsWithCoverage(testFiles?: string[]): Promise<TestResult> {
    // Run tests with coverage flag
    const files = testFiles ?? (await this.discoverTests()).testFiles;

    const command = `${this.config.coverageCommand} ${files.join(' ')}`;

    try {
      execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: this.config.timeout,
      });
    } catch {
      // Tests may fail but coverage is still generated
    }

    return this.runTests(files);
  }
}

export default TestRunner;
