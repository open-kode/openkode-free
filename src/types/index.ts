/**
 * OpenKode Core Types
 * 
 * Type definitions for the OpenKode extension.
 */

// ============================================
// Mode Types
// ============================================

/**
 * OpenKode execution modes
 */
export type OpenKodeMode = 'precision' | 'blueprint' | 'visionary' | 'rocket';

// ============================================
// Epic/Phase/Ticket Types
// ============================================

/**
 * Ticket status
 */
export type TicketStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'failed';

/**
 * Phase status
 */
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

/**
 * Issue severity
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * Ticket definition
 */
export interface Ticket {
    id: string;
    name: string;
    description?: string;
    status: TicketStatus;
    files?: string[];
    dependencies?: string[];
    estimatedTime?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Phase definition
 */
export interface Phase {
    id: string;
    name: string;
    description?: string;
    status: PhaseStatus;
    tickets?: Ticket[];
    files?: string[];
    dependencies?: string[];
    estimatedTime?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Plan phase (alias for Phase)
 */
export type PlanPhase = Phase;

/**
 * Epic definition
 */
export interface Epic {
    id: string;
    name: string;
    description?: string;
    phases: Phase[];
    status: PhaseStatus;
    metadata?: Record<string, unknown>;
}

/**
 * Specification plan
 */
export interface SpecPlan {
    id: string;
    name: string;
    description?: string;
    version: string;
    phases: Phase[];
    metadata?: Record<string, unknown>;
}

// ============================================
// Verification Types
// ============================================

/**
 * Verification issue
 */
export interface VerificationIssue {
    id: string;
    severity: IssueSeverity;
    message: string;
    description?: string;
    filePath?: string;
    line?: number;
    column?: number;
    codeSnippet?: string;
    suggestedFix?: string;
    ruleId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Verification result
 */
export interface VerificationResult {
    success: boolean;
    issues: VerificationIssue[];
    summary?: {
        total: number;
        errors: number;
        warnings: number;
        info: number;
    };
    metadata?: Record<string, unknown>;
}

// ============================================
// File Change Types
// ============================================

/**
 * File change type
 */
export type FileChangeType = 'create' | 'modify' | 'delete' | 'rename';

/**
 * File change entry
 */
export interface FileChange {
    type: FileChangeType;
    path: string;
    oldPath?: string;
    content?: string;
    diff?: string;
}

// ============================================
// Execution Types
// ============================================

/**
 * Execution context
 */
export interface ExecutionContext {
    mode: OpenKodeMode;
    epicId?: string;
    phaseId?: string;
    ticketId?: string;
    workspaceRoot: string;
    options?: Record<string, unknown>;
}

/**
 * Execution result
 */
export interface ExecutionResult {
    success: boolean;
    phaseId: string;
    changes: FileChange[];
    verification?: VerificationResult;
    error?: string;
    duration: number;
}

// ============================================
// LLM Types
// ============================================

/**
 * LLM provider type
 */
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'kimi' | 'deepseek' | 'openrouter' | 'azure' | 'custom';

/**
 * LLM configuration
 */
export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

/**
 * LLM message
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * LLM response
 */
export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
    finishReason?: string;
}

// ============================================
// Configuration Types
// ============================================

/**
 * OpenKode configuration
 */
export interface OpenKodeConfig {
    llm: LLMConfig;
    verification: {
        enabled: boolean;
        autoFix: boolean;
        maxIterations: number;
    };
    execution: {
        parallel: boolean;
        maxConcurrency: number;
        timeout: number;
    };
    ui: {
        showProgress: boolean;
        autoOpenResults: boolean;
        groupByFile: boolean;
    };
}

// ============================================
// Event Types
// ============================================

/**
 * Progress event
 */
export interface ProgressEvent {
    phaseId: string;
    message: string;
    percent: number;
}

/**
 * Status change event
 */
export interface StatusChangeEvent {
    type: 'phase' | 'ticket' | 'epic';
    id: string;
    oldStatus: string;
    newStatus: string;
}

// ============================================
// Utility Types
// ============================================

/**
 * Nullable type
 */
export type Nullable<T> = T | null | undefined;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Event handler type
 */
export type EventHandler<T = void> = (data: T) => void | Promise<void>;

// ============================================
// Policy & Governance Types
// ============================================

/** Adoption maturity levels — gates what capabilities are available per repo. */
export type MaturityLevel = 'observe' | 'assisted-plan' | 'selective-execute' | 'full-orchestration';

/** Project-level policy loaded from .openkode.yaml */
export interface OpenKodePolicy {
  maturityLevel: MaturityLevel;
  requiredChecks: string[];            // e.g. ['lint', 'typecheck', 'test:unit']
  verification: {
    minCoverage: number;               // 0–100
    riskThreshold: 'low' | 'medium' | 'high';
    failOnSecurityFindings: boolean;
  };
  budget: {
    perRunUsd: number;                 // hard-stop per single run, 0 = unlimited
    perSpecUsd: number;
    hardStop: boolean;
  };
  routing: {
    preferredProvider: string;         // LLMProvider
    fallbackProviders: string[];
    taskOverrides: Record<string, string>; // e.g. { plan: 'anthropic', verify: 'openai' }
  };
  security: {
    posture: 'strict' | 'standard' | 'permissive';
    blockedPatterns: string[];
  };
}

/** Default policy used when no .openkode.yaml is present */
export const DEFAULT_POLICY: OpenKodePolicy = {
  maturityLevel: 'assisted-plan',
  requiredChecks: ['lint', 'typecheck', 'test:unit'],
  verification: { minCoverage: 70, riskThreshold: 'medium', failOnSecurityFindings: true },
  budget: { perRunUsd: 0, perSpecUsd: 0, hardStop: false },
  routing: { preferredProvider: 'openai', fallbackProviders: ['anthropic'], taskOverrides: {} },
  security: { posture: 'standard', blockedPatterns: [] },
};

// ============================================
// Traceability Types
// ============================================

/** Coverage status of a single acceptance criterion. */
export type CoverageStatus = 'covered' | 'partial' | 'missing';

/** Link from a requirement/ticket to the evidence that it was implemented. */
export interface TraceLink {
  id: string;
  specId: string;
  requirementId: string;           // acceptance criterion id within the spec
  requirementText: string;
  changedFiles: string[];
  testFiles: string[];
  status: CoverageStatus;
  verifiedAt?: number;
  evidence?: string;               // free-text from LLM or static analysis
}

// ============================================
// Timeline Types
// ============================================

export type TimelineEventType =
  | 'human-edit'
  | 'ai-generation'
  | 'verification'
  | 'checkpoint'
  | 'rollback'
  | 'pr-review';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: number;
  actor: 'human' | 'ai' | 'system';
  workflowId?: string;
  phaseId?: string;
  files: string[];
  summary: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Checkpoint Types
// ============================================

export interface Checkpoint {
  id: string;
  workflowId: string;
  label: string;
  createdAt: number;
  gitHead?: string;                // git commit SHA at checkpoint time
  fileSnapshots: Record<string, string>; // relative path → content
  phaseIndex: number;
}

// ============================================
// External Library Types (Optional - may not be installed)
// ============================================
