/**
 * OpenKode Verification & Quality Guardrails System
 * Main exports for the verification module
 */

// ============================================================================
// Core Types
// ============================================================================

export {
  // Verification Result Types
  VerificationResult,
  VerificationStage,
  VerificationMode,
  VerificationConfig,
  VerificationThresholds,
  VerificationSummary,
  VerificationReport,
  ReportArtifact,

  // Diff Review Types
  DiffReviewResult,
  ReviewComment,
  ReviewCategory,
  PlanAlignmentResult,
  PlanDeviation,
  GitDiff,
  DiffFile,
  DiffHunk,
  DiffLine,
  DiffStats,

  // Regression Types
  RegressionResult,
  Regression,
  RegressionType,
  BreakingChange,
  BehaviorComparison,
  TestSnapshot,
  BehaviorDifference,

  // Static Analysis Types
  StaticAnalysisResult,
  LinterResult,
  StaticIssue,
  StaticIssueCategory,
  LinterSummary,
  LinterConfig,
  CodeFix,
  CodeRange,
  CodeReplacement,
  Position,

  // Security Types
  SecurityResult,
  SecurityIssue,
  SecurityIssueType,
  DetectedSecret,
  SecretType,
  SecurityRisk,
  SecuritySummary,
  SecurityConfig,

  // Test Types
  TestResult,
  TestSuiteResult,
  TestRunResult,
  IndividualTest,
  TestError,
  CoverageResult,
  FileCoverage,
  UncoveredRange,
  TestSummary,
  SlowTest,
} from './types';

// ============================================================================
// Classes
// ============================================================================

export { DiffReviewer, DiffReviewerOptions, PlanDocument, PlanItem } from './diffReviewer';
export { RegressionDetector, RegressionDetectorOptions, BaselineData } from './regressionDetector';
export { StaticAnalysis, StaticAnalysisOptions, ESLintResult, SemgrepResult } from './staticAnalysis';
export { SecurityScanner, SecurityScannerOptions, SecretPattern, ScanTarget } from './securityScanner';
export { TestRunner, TestRunnerOptions, TestDiscoveryResult, JestOutput, VitestOutput } from './testRunner';

// ============================================================================
// Main Verifier
// ============================================================================

export {
  Verifier,
  VerifierOptions,
  VerificationPipeline,
  AggregatedIssues,
  verify,
  verifyQuick,
  verifySecurity,
  verifyTests,
  verifyDiff,
} from './verifier';

// ============================================================================
// Release Readiness
// ============================================================================

export {
  ReleaseReadinessChecker,
  ReleaseReadinessOptions,
  ReleaseReadinessResult,
  CheckResult,
  CheckStatus,
} from './releaseReadiness';

// ============================================================================
// Default Export
// ============================================================================

export { Verifier as default } from './verifier';
