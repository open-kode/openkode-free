/**
 * Engine-level types for the OpenKode LLM-driven Verification Engine.
 *
 * These complement (not replace) the rich structural types in ./types.ts.
 * While types.ts covers static analysis, git diffs, and test runners,
 * these types represent the LLM review pass that understands *intent* —
 * checking implementation against the original PRD and phase plan.
 *
 * Design rationale: The LLM Verifier produces human-readable, intent-aware
 * feedback that mechanical linters cannot. A linter sees `any` as a warning;
 * the LLM Verifier sees "you implemented a POST endpoint but the spec said GET"
 * as a Critical deviation.
 */

// ─── Core result types ────────────────────────────────────────────────────────

/**
 * Severity levels for LLM-derived verification issues.
 *
 * - `Critical`  Spec or plan deviation that must be fixed before merge.
 * - `Warning`   Potential problem or missed requirement — review recommended.
 * - `Info`      Neutral observation (style, minor pattern, note).
 * - `Praise`    Something the LLM explicitly recognised as well-done.
 */
export type LlmIssueSeverity = 'Critical' | 'Warning' | 'Info' | 'Praise';

/**
 * A single issue or observation produced by the LLM Verifier.
 */
export interface LlmVerificationIssue {
  /** Classification of the finding. */
  severity: LlmIssueSeverity;
  /** Workspace-relative file path, or "general" for project-wide findings. */
  file: string;
  /** 1-based line number, if the LLM could identify one. */
  line?: number;
  /** Human-readable description of the finding. */
  message: string;
  /** Suggested remediation, if the LLM provided one. */
  suggestion?: string;
}

/**
 * The top-level result from the LLM Verification Engine.
 */
export interface LlmVerificationResult {
  /** Short executive summary (1–3 sentences). */
  summary: string;
  /** All findings, ordered: Critical → Warning → Info → Praise. */
  issues: LlmVerificationIssue[];
  /**
   * Overall verification score from 0 (completely off-spec) to 100 (perfect).
   * Computed from issue severity counts; Critical issues cap the score at 50.
   */
  score: number;
  /** ISO timestamp of when verification ran. */
  timestamp: string;
  /** How long the LLM call took, in milliseconds. */
  durationMs: number;
  /** Which LLM profile was used (for audit trail). */
  profileLabel: string;
  /** The diff or context that was verified (truncated for display). */
  contextSummary: string;
}

/**
 * Input context fed to the LLM Verifier.
 * All fields are optional — the engine gracefully handles partial context.
 */
export interface VerificationContext {
  /**
   * Git diff or workspace snapshot to verify.
   * If omitted, the engine tries to capture the diff automatically.
   */
  diff?: string;
  /** The original PRD / spec markdown. */
  specMarkdown?: string;
  /** The tactical plan for the active phase, in markdown or JSON. */
  planMarkdown?: string;
  /** Name of the active phase (e.g. "Phase 2 — Auth Service"). */
  activePhase?: string;
  /** Explicit list of files to focus on. Falls back to all changed files. */
  filesToVerify?: string[];
  /**
   * Optional system prompt override for the LLM call.
   * Defaults to the built-in Verifier system prompt.
   */
  systemPromptOverride?: string;
}

// ─── Score computation ────────────────────────────────────────────────────────

/**
 * Compute a 0–100 score from a list of LLM issues.
 *
 * Deductions:
 *  - Critical: −20 per issue (max 5 → floor at 0)
 *  - Warning:  −5  per issue
 *  - Info:     −1  per issue
 *  - Praise:   +2  per issue (maximum bonus +10)
 *
 * A single Critical issue caps the maximum possible score at 60.
 */
export function computeVerificationScore(issues: LlmVerificationIssue[]): number {
  const criticals = issues.filter((i) => i.severity === 'Critical').length;
  const warnings  = issues.filter((i) => i.severity === 'Warning').length;
  const infos     = issues.filter((i) => i.severity === 'Info').length;
  const praises   = issues.filter((i) => i.severity === 'Praise').length;

  let score = 100;
  score -= criticals * 20;
  score -= warnings  * 5;
  score -= infos     * 1;
  score += Math.min(praises * 2, 10);

  // Any Critical issue caps the ceiling
  if (criticals > 0) {
    score = Math.min(score, 60);
  }

  return Math.max(0, Math.min(100, score));
}

// ─── LLM response parsing ─────────────────────────────────────────────────────

/**
 * Parse the raw LLM text response into a structured LlmVerificationResult.
 *
 * The prompt instructs the LLM to return JSON wrapped in a markdown code fence.
 * This function tries JSON first, then falls back to a best-effort plain-text parse.
 *
 * @param raw          Raw LLM response string.
 * @param profileLabel The active profile label (for audit metadata).
 * @param durationMs   How long the LLM call took.
 * @param contextSummary  One-line summary of what was verified.
 */
export function parseLlmVerificationResponse(
  raw: string,
  profileLabel: string,
  durationMs: number,
  contextSummary: string,
): LlmVerificationResult {
  const now = new Date().toISOString();

  // Try to extract JSON from a ```json ... ``` fence
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonCandidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      summary?: string;
      issues?: Array<{
        severity?: string;
        file?: string;
        line?: number;
        message?: string;
        suggestion?: string;
      }>;
      score?: number;
    };

    const issues: LlmVerificationIssue[] = (parsed.issues ?? []).map((item) => ({
      severity: normaliseSeverity(item.severity ?? 'Info'),
      file: item.file ?? 'general',
      line: item.line,
      message: item.message ?? '',
      suggestion: item.suggestion,
    }));

    const score = typeof parsed.score === 'number'
      ? Math.max(0, Math.min(100, parsed.score))
      : computeVerificationScore(issues);

    return {
      summary: parsed.summary ?? 'Verification complete.',
      issues,
      score,
      timestamp: now,
      durationMs,
      profileLabel,
      contextSummary,
    };
  } catch {
    // Fallback: treat the entire response as a single Info issue
    return {
      summary: 'Verification complete (unstructured response).',
      issues: [
        {
          severity: 'Info',
          file: 'general',
          message: raw.slice(0, 500),
        },
      ],
      score: 75,
      timestamp: now,
      durationMs,
      profileLabel,
      contextSummary,
    };
  }
}

/** Coerce any string into a valid LlmIssueSeverity. */
function normaliseSeverity(raw: string): LlmIssueSeverity {
  const upper = raw.toUpperCase();
  if (upper === 'CRITICAL' || upper === 'ERROR') return 'Critical';
  if (upper === 'WARNING' || upper === 'WARN')    return 'Warning';
  if (upper === 'PRAISE' || upper === 'GOOD')     return 'Praise';
  return 'Info';
}
