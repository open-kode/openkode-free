/**
 * OpenKode Verification & Quality Guardrails System
 * Core Type Definitions
 */

// ============================================================================
// Verification Result Types
// ============================================================================

export interface VerificationResult {
  passed: boolean;
  score: number; // 0-100
  stage: VerificationStage;
  timestamp: Date;
  duration: number; // ms
  results: {
    diffReview?: DiffReviewResult;
    regression?: RegressionResult;
    staticAnalysis?: StaticAnalysisResult;
    security?: SecurityResult;
    tests?: TestResult;
  };
  summary: VerificationSummary;
  report?: VerificationReport;
}

export interface VerificationSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  criticalIssues: number;
  recommendations: string[];
}

export interface VerificationReport {
  markdown: string;
  json: string;
  html?: string;
  artifacts: ReportArtifact[];
}

export interface ReportArtifact {
  type: 'diff' | 'coverage' | 'lint' | 'security' | 'test';
  path: string;
  content: string;
}

// ============================================================================
// Diff Review Types
// ============================================================================

export interface DiffReviewResult {
  passed: boolean;
  score: number;
  alignment: PlanAlignmentResult;
  comments: ReviewComment[];
  summary: string;
}

export interface ReviewComment {
  id: string;
  type: 'error' | 'warning' | 'suggestion' | 'praise';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
  suggestion?: string;
  category: ReviewCategory;
  ruleId?: string;
  autoFixable: boolean;
}

export type ReviewCategory =
  | 'spec-compliance'
  | 'plan-alignment'
  | 'code-quality'
  | 'performance'
  | 'security'
  | 'maintainability'
  | 'documentation';

export interface PlanAlignmentResult {
  aligned: boolean;
  score: number;
  planId: string;
  deviations: PlanDeviation[];
  coverage: number; // % of plan items addressed
}

export interface PlanDeviation {
  type: 'missing' | 'extra' | 'modified';
  planItem: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface GitDiff {
  files: DiffFile[];
  stats: DiffStats;
  raw: string;
}

export interface DiffFile {
  path: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  oldPath?: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  lineNumber?: number;
}

export interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

// ============================================================================
// Regression Detection Types
// ============================================================================

export interface RegressionResult {
  passed: boolean;
  regressions: Regression[];
  breakingChanges: BreakingChange[];
  comparison: BehaviorComparison;
  summary: string;
}

export interface Regression {
  id: string;
  type: RegressionType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  testName: string;
  file: string;
  description: string;
  before: TestSnapshot;
  after: TestSnapshot;
  diff: string;
}

export type RegressionType =
  | 'test-failure'
  | 'performance-degradation'
  | 'behavior-change'
  | 'api-breaking'
  | 'output-mismatch'
  | 'coverage-drop';

export interface BreakingChange {
  type: 'api' | 'behavior' | 'schema' | 'config';
  description: string;
  impact: string;
  migration?: string;
}

export interface BehaviorComparison {
  before: TestRunResult;
  after: TestRunResult;
  differences: BehaviorDifference[];
}

export interface BehaviorDifference {
  path: string;
  before: unknown;
  after: unknown;
  significance: 'major' | 'minor' | 'cosmetic';
}

export interface TestSnapshot {
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  output?: string;
  error?: string;
  coverage?: number;
}

// ============================================================================
// Static Analysis Types
// ============================================================================

export interface StaticAnalysisResult {
  passed: boolean;
  score: number;
  linters: LinterResult[];
  issues: StaticIssue[];
  summary: LinterSummary;
}

export interface LinterResult {
  linter: string;
  version: string;
  passed: boolean;
  filesAnalyzed: number;
  issues: StaticIssue[];
  executionTime: number;
}

export interface StaticIssue {
  id: string;
  linter: string;
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  message: string;
  category: StaticIssueCategory;
  fixable: boolean;
  fix?: CodeFix;
}

export type StaticIssueCategory =
  | 'syntax'
  | 'style'
  | 'best-practice'
  | 'performance'
  | 'security'
  | 'maintainability'
  | 'compatibility';

export interface CodeFix {
  description: string;
  replacements: CodeReplacement[];
}

export interface CodeReplacement {
  range: CodeRange;
  text: string;
}

export interface CodeRange {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  column: number;
}

export interface LinterSummary {
  totalIssues: number;
  errors: number;
  warnings: number;
  fixableIssues: number;
  filesWithIssues: number;
}

export interface LinterConfig {
  name: string;
  command: string;
  args: string[];
  parser: 'eslint' | 'semgrep' | 'custom';
  filePatterns: string[];
  enabled: boolean;
}

// ============================================================================
// Security Types
// ============================================================================

export interface SecurityResult {
  passed: boolean;
  score: number;
  issues: SecurityIssue[];
  secrets: DetectedSecret[];
  risks: SecurityRisk[];
  summary: SecuritySummary;
}

export interface SecurityIssue {
  id: string;
  type: SecurityIssueType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  file: string;
  line: number;
  column?: number;
  message: string;
  code: string;
  cwe?: string;
  owasp?: string;
  remediation: string;
  references: string[];
}

export type SecurityIssueType =
  | 'injection'
  | 'xss'
  | 'csrf'
  | 'auth-bypass'
  | 'data-exposure'
  | 'insecure-config'
  | 'dependency-vuln'
  | 'secret-leak'
  | 'path-traversal'
  | 'command-injection'
  | 'sql-injection'
  | 'unsafe-deserialization';

export interface DetectedSecret {
  id: string;
  type: SecretType;
  file: string;
  line: number;
  match: string;
  entropy: number;
  confidence: 'high' | 'medium' | 'low';
}

export type SecretType =
  | 'api-key'
  | 'password'
  | 'token'
  | 'private-key'
  | 'credential'
  | 'connection-string'
  | 'env-var';

export interface SecurityRisk {
  type: SecurityIssueType;
  level: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedFiles: string[];
  mitigation: string;
}

export interface SecuritySummary {
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  secretsFound: number;
  filesScanned: number;
  riskScore: number; // 0-100
}

// ============================================================================
// Test Types
// ============================================================================

export interface TestResult {
  passed: boolean;
  suite: TestSuiteResult;
  coverage: CoverageResult;
  summary: TestSummary;
}

export interface TestSuiteResult {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  duration: number;
  tests: IndividualTest[];
  suites?: TestSuiteResult[];
}

export interface IndividualTest {
  id: string;
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'error';
  duration: number;
  file: string;
  line?: number;
  error?: TestError;
  assertions: number;
  logs?: string[];
}

export interface TestError {
  message: string;
  stack?: string;
  actual?: unknown;
  expected?: unknown;
}

export interface CoverageResult {
  overall: number;
  lines: number;
  functions: number;
  branches: number;
  statements: number;
  files: FileCoverage[];
  uncovered: UncoveredRange[];
}

export interface FileCoverage {
  path: string;
  lines: number;
  functions: number;
  branches: number;
  statements: number;
  uncoveredLines: number[];
}

export interface UncoveredRange {
  file: string;
  start: number;
  end: number;
  type: 'line' | 'branch' | 'function';
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  duration: number;
  coverage: number;
  flakyTests: string[];
  slowTests: SlowTest[];
}

export interface SlowTest {
  name: string;
  duration: number;
  threshold: number;
}

export interface TestRunResult {
  runId: string;
  timestamp: Date;
  suite: TestSuiteResult;
  coverage: CoverageResult;
}

// ============================================================================
// Enums and Constants
// ============================================================================

export enum VerificationStage {
  IDLE = 'idle',
  DIFF_REVIEW = 'diff-review',
  STATIC_ANALYSIS = 'static-analysis',
  SECURITY_SCAN = 'security-scan',
  TEST_EXECUTION = 'test-execution',
  REGRESSION_CHECK = 'regression-check',
  AGGREGATION = 'aggregation',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

export enum VerificationMode {
  FULL = 'full',
  QUICK = 'quick',
  SECURITY_ONLY = 'security-only',
  TESTS_ONLY = 'tests-only',
  DIFF_ONLY = 'diff-only',
  CUSTOM = 'custom',
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface VerificationConfig {
  mode: VerificationMode;
  thresholds: VerificationThresholds;
  linters: LinterConfig[];
  security: SecurityConfig;
  test: TestConfig;
  diff: DiffConfig;
  regression: RegressionConfig;
}

export interface VerificationThresholds {
  minScore: number;
  maxIssues: number;
  maxCriticalIssues: number;
  minCoverage: number;
  maxRegressions: number;
}

export interface SecurityConfig {
  enabled: boolean;
  secretPatterns: RegExp[];
  severityThreshold: 'critical' | 'high' | 'medium' | 'low';
  excludePaths: string[];
}

export interface TestConfig {
  enabled: boolean;
  testCommand: string;
  coverageCommand: string;
  coverageThreshold: number;
  timeout: number;
  parallel: boolean;
}

export interface DiffConfig {
  enabled: boolean;
  maxFiles: number;
  maxLines: number;
  excludePatterns: string[];
}

export interface RegressionConfig {
  enabled: boolean;
  baselinePath?: string;
  comparisonStrategy: 'strict' | 'lenient' | 'smart';
}
