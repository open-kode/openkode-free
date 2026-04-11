/**
 * Result Parser - Result Parsing and Aggregation
 * 
 * Provides result parsing and aggregation including:
 * - Output format standardization
 * - Success/failure detection
 * - Change summary extraction
 * - Multi-result aggregation
 */

import { EventEmitter } from 'events';
import { ExecutionResult, ExecutionArtifact, ChangeSummary, ExecutionError } from './handoffProtocol';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Parse options
 */
export interface ParseOptions {
  /** Parser type */
  parserType?: 'auto' | 'json' | 'xml' | 'markdown' | 'text' | 'diff';
  /** Strict parsing */
  strict?: boolean;
  /** Extract artifacts */
  extractArtifacts?: boolean;
  /** Parse change summary */
  parseChanges?: boolean;
  /** Custom parsers */
  customParsers?: CustomParser[];
}

/**
 * Custom parser
 */
export interface CustomParser {
  /** Parser name */
  name: string;
  /** Test if parser can handle content */
  canParse: (content: string) => boolean;
  /** Parse function */
  parse: (content: string) => ParsedContent;
}

/**
 * Parsed content
 */
export interface ParsedContent {
  /** Parsed data */
  data: Record<string, unknown>;
  /** Artifacts found */
  artifacts: ExecutionArtifact[];
  /** Changes detected */
  changes: Partial<ChangeSummary>;
  /** Errors found */
  errors: ParsedError[];
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Parsed error
 */
export interface ParsedError {
  /** Error type */
  type: string;
  /** Error message */
  message: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** File path */
  file?: string;
  /** Error code */
  code?: string;
  /** Stack trace */
  stackTrace?: string;
}

/**
 * Aggregation options
 */
export interface AggregationOptions {
  /** Aggregation strategy */
  strategy?: 'sequential' | 'parallel' | 'weighted';
  /** Weights for weighted aggregation */
  weights?: Record<string, number>;
  /** Fail on any failure */
  failOnAnyFailure?: boolean;
  /** Include partial results */
  includePartial?: boolean;
}

/**
 * Aggregated result
 */
export interface AggregatedResult {
  /** Overall status */
  status: 'success' | 'partial' | 'failure';
  /** Individual results */
  results: ExecutionResult[];
  /** Combined artifacts */
  artifacts: ExecutionArtifact[];
  /** Combined changes */
  changes: ChangeSummary;
  /** Combined errors */
  errors: ExecutionError[];
  /** Execution metadata */
  metadata: {
    /** Total execution time */
    totalDurationMs: number;
    /** Start time */
    startedAt: Date;
    /** End time */
    endedAt: Date;
    /** Number of successful results */
    successCount: number;
    /** Number of failed results */
    failureCount: number;
    /** Number of partial results */
    partialCount: number;
  };
  /** Result summaries */
  summaries: string[];
}

/**
 * Change detection options
 */
export interface ChangeDetectionOptions {
  /** Detect file creations */
  detectCreations?: boolean;
  /** Detect file modifications */
  detectModifications?: boolean;
  /** Detect file deletions */
  detectDeletions?: boolean;
  /** Detect line changes */
  detectLineChanges?: boolean;
  /** Detect test changes */
  detectTestChanges?: boolean;
}

/**
 * File change
 */
export interface FileChange {
  /** Change type */
  type: 'created' | 'modified' | 'deleted';
  /** File path */
  path: string;
  /** Change details */
  details?: {
    /** Lines added */
    linesAdded?: number;
    /** Lines removed */
    linesRemoved?: number;
    /** Size change in bytes */
    sizeChange?: number;
    /** Is test file */
    isTest?: boolean;
  };
}

/**
 * Error detection patterns
 */
export interface ErrorDetectionPatterns {
  /** Error patterns */
  errorPatterns: RegExp[];
  /** Warning patterns */
  warningPatterns: RegExp[];
  /** Success patterns */
  successPatterns: RegExp[];
  /** Ignore patterns */
  ignorePatterns?: RegExp[];
}

/**
 * Parse result
 */
export interface ParseResult {
  /** Success status */
  success: boolean;
  /** Parsed artifacts */
  artifacts: ExecutionArtifact[];
  /** Change summary */
  changes: ChangeSummary;
  /** Detected errors */
  errors: ExecutionError[];
  /** Parsed metadata */
  metadata: Record<string, unknown>;
  /** Raw output preserved */
  rawOutput: {
    stdout: string;
    stderr: string;
  };
}

// ============================================================================
// RESULT PARSER CLASS
// ============================================================================

/**
 * Result Parser - Parses and aggregates execution results
 */
export class ResultParser extends EventEmitter {
  private customParsers: Map<string, CustomParser> = new Map();
  private errorPatterns: ErrorDetectionPatterns;

  constructor() {
    super();
    
    this.errorPatterns = {
      errorPatterns: [
        /error[:\s]/i,
        /exception[:\s]/i,
        /failed[:\s]/i,
        /failure[:\s]/i,
        /fatal[:\s]/i,
        /panic[:\s]/i,
        /\berr\b/i,
        /\[error\]/i,
        /✗|❌|✕/,
      ],
      warningPatterns: [
        /warning[:\s]/i,
        /warn[:\s]/i,
        /deprecated[:\s]/i,
        /\[warn\]/i,
        /⚠️|⚠/,
      ],
      successPatterns: [
        /success[:\s]/i,
        /passed[:\s]/i,
        /completed[:\s]/i,
        /done[:\s!]/i,
        /✓|✅|✔/,
        /\[success\]/i,
        /\[pass\]/i,
      ],
      ignorePatterns: [
        /node_modules/,
        /\.git\//,
      ],
    };
  }

  // ============================================================================
  // MAIN PARSE METHOD
  // ============================================================================

  /**
   * Parse execution result
   * @param result Execution result to parse
   * @param options Parse options
   * @returns Parsed result
   */
  parseResult(result: ExecutionResult, options: ParseOptions = {}): ParseResult {
    const opts = {
      parserType: 'auto' as const,
      strict: false,
      extractArtifacts: true,
      parseChanges: true,
      ...options,
    };

    this.emit('parser:started', { handoffId: result.handoffId });

    try {
      // Detect parser type if auto
      const parserType = opts.parserType === 'auto' 
        ? this.detectParserType(result)
        : opts.parserType;

      // Parse based on type
      let parsedContent: ParsedContent;

      switch (parserType) {
        case 'json':
          parsedContent = this.parseJson(result.stdout);
          break;
        case 'xml':
          parsedContent = this.parseXml(result.stdout);
          break;
        case 'markdown':
          parsedContent = this.parseMarkdown(result.stdout);
          break;
        case 'diff':
          parsedContent = this.parseDiff(result.stdout);
          break;
        case 'text':
        default:
          parsedContent = this.parseText(result);
          break;
      }

      // Try custom parsers
      if (opts.customParsers) {
        for (const parser of opts.customParsers) {
          if (parser.canParse(result.stdout)) {
            parsedContent = parser.parse(result.stdout);
            break;
          }
        }
      }

      // Build parse result
      const parseResult: ParseResult = {
        success: this.detectSuccess(result, parsedContent),
        artifacts: opts.extractArtifacts 
          ? [...result.artifacts, ...parsedContent.artifacts]
          : result.artifacts,
        changes: opts.parseChanges
          ? this.mergeChanges(result.changes, parsedContent.changes)
          : result.changes,
        errors: this.detectErrors(result, parsedContent),
        metadata: {
          ...result.metadata,
          ...parsedContent.metadata,
          parserType,
        },
        rawOutput: {
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };

      this.emit('parser:completed', { handoffId: result.handoffId, result: parseResult });

      return parseResult;
    } catch (error) {
      this.emit('parser:error', { handoffId: result.handoffId, error });

      // Return basic result on error
      return {
        success: result.status === 'success',
        artifacts: result.artifacts,
        changes: result.changes,
        errors: result.error ? [result.error] : [],
        metadata: result.metadata as unknown as Record<string, unknown>,
        rawOutput: {
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    }
  }

  // ============================================================================
  // AGGREGATION
  // ============================================================================

  /**
   * Aggregate multiple execution results
   * @param results Results to aggregate
   * @param options Aggregation options
   * @returns Aggregated result
   */
  aggregateChanges(
    results: ExecutionResult[],
    options: AggregationOptions = {}
  ): AggregatedResult {
    const opts = {
      strategy: 'sequential' as const,
      failOnAnyFailure: true,
      includePartial: true,
      ...options,
    };

    this.emit('aggregator:started', { resultCount: results.length });

    if (results.length === 0) {
      return this.createEmptyAggregatedResult();
    }

    // Calculate overall status
    let status: AggregatedResult['status'] = 'success';
    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failure').length;
    const partialCount = results.filter(r => r.status === 'partial').length;

    if (opts.failOnAnyFailure && failureCount > 0) {
      status = 'failure';
    } else if (failureCount > 0 || partialCount > 0) {
      status = partialCount > 0 ? 'partial' : 'failure';
    }

    // Combine artifacts
    const artifacts = this.deduplicateArtifacts(
      results.flatMap(r => r.artifacts)
    );

    // Combine changes
    const changes = this.aggregateChangeSummaries(results.map(r => r.changes));

    // Combine errors
    const errors = results
      .filter(r => r.error)
      .map(r => r.error!);

    // Calculate timing
    const startTimes = results.map(r => r.metadata.startedAt.getTime());
    const endTimes = results.map(r => r.metadata.endedAt.getTime());
    const startedAt = new Date(Math.min(...startTimes));
    const endedAt = new Date(Math.max(...endTimes));
    const totalDurationMs = endedAt.getTime() - startedAt.getTime();

    // Extract summaries
    const summaries = results
      .map(r => this.extractSummary(r))
      .filter((s): s is string => s !== undefined);

    const aggregated: AggregatedResult = {
      status,
      results,
      artifacts,
      changes,
      errors,
      metadata: {
        totalDurationMs,
        startedAt,
        endedAt,
        successCount,
        failureCount,
        partialCount,
      },
      summaries,
    };

    this.emit('aggregator:completed', { aggregated });

    return aggregated;
  }

  // ============================================================================
  // ERROR DETECTION
  // ============================================================================

  /**
   * Detect errors in result
   * @param result Execution result
   * @param parsed Parsed content
   * @returns Detected errors
   */
  detectErrors(result: ExecutionResult, parsed: ParsedContent): ExecutionError[] {
    const errors: ExecutionError[] = [];

    // Add explicit error from result
    if (result.error) {
      errors.push(result.error);
    }

    // Add parsed errors
    for (const parsedError of parsed.errors) {
      errors.push({
        type: this.classifyErrorType(parsedError.type),
        message: parsedError.message,
        stack: parsedError.stackTrace,
      });
    }

    // Scan stderr for errors
    const stderrErrors = this.scanForErrors(result.stderr);
    errors.push(...stderrErrors);

    // Scan stdout for errors if no explicit errors
    if (errors.length === 0 && result.stdout) {
      const stdoutErrors = this.scanForErrors(result.stdout);
      errors.push(...stdoutErrors);
    }

    return errors;
  }

  /**
   * Scan content for errors
   * @param content Content to scan
   * @returns Detected errors
   */
  private scanForErrors(content: string): ExecutionError[] {
    const errors: ExecutionError[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Check error patterns
      for (const pattern of this.errorPatterns.errorPatterns) {
        if (pattern.test(line)) {
          // Check if should be ignored
          const shouldIgnore = this.errorPatterns.ignorePatterns?.some(
            ignorePattern => ignorePattern.test(line)
          );

          if (!shouldIgnore) {
            errors.push({
              type: 'runtime',
              message: line.trim(),
            });
          }
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Classify error type from string
   * @param type Error type string
   * @returns Classified error type
   */
  private classifyErrorType(type: string): ExecutionError['type'] {
    const typeMap: Record<string, ExecutionError['type']> = {
      parse: 'parse',
      syntax: 'parse',
      runtime: 'runtime',
      execution: 'runtime',
      timeout: 'timeout',
      validation: 'validation',
    };

    return typeMap[type.toLowerCase()] || 'unknown';
  }

  // ============================================================================
  // SUCCESS DETECTION
  // ============================================================================

  /**
   * Detect success from result
   * @param result Execution result
   * @param parsed Parsed content
   * @returns True if successful
   */
  detectSuccess(result: ExecutionResult, parsed: ParsedContent): boolean {
    // Check explicit status
    if (result.status === 'success') {
      return true;
    }

    if (result.status === 'failure') {
      return false;
    }

    // Check exit code
    if (result.exitCode !== 0) {
      return false;
    }

    // Check for errors in output
    if (parsed.errors.length > 0) {
      return false;
    }

    // Check for success patterns
    const combined = result.stdout + result.stderr;
    
    for (const pattern of this.errorPatterns.successPatterns) {
      if (pattern.test(combined)) {
        return true;
      }
    }

    // Check for error patterns
    for (const pattern of this.errorPatterns.errorPatterns) {
      if (pattern.test(combined)) {
        return false;
      }
    }

    // Default to true if exit code is 0
    return true;
  }

  // ============================================================================
  // CHANGE DETECTION
  // ============================================================================

  /**
   * Detect changes from output
   * @param result Execution result
   * @param options Change detection options
   * @returns Detected file changes
   */
  detectChanges(
    result: ExecutionResult,
    options: ChangeDetectionOptions = {}
  ): FileChange[] {
    const opts = {
      detectCreations: true,
      detectModifications: true,
      detectDeletions: true,
      detectLineChanges: true,
      detectTestChanges: true,
      ...options,
    };

    const changes: FileChange[] = [];
    const output = result.stdout + '\n' + result.stderr;

    // Detect file creations
    if (opts.detectCreations) {
      const creationPatterns = [
        /created[:\s]+(.+)/i,
        /new file[:\s]+(.+)/i,
        /added[:\s]+(.+)/i,
        /create mode \d+ (.+)/i,
      ];

      for (const pattern of creationPatterns) {
        const matches = output.matchAll(new RegExp(pattern, 'gi'));
        for (const match of matches) {
          const path = match[1]?.trim();
          if (path) {
            changes.push({
              type: 'created',
              path,
              details: {
                isTest: this.isTestFile(path),
              },
            });
          }
        }
      }
    }

    // Detect file modifications
    if (opts.detectModifications) {
      const modificationPatterns = [
        /modified[:\s]+(.+)/i,
        /updated[:\s]+(.+)/i,
        /changed[:\s]+(.+)/i,
        /rewrite (.+)/i,
      ];

      for (const pattern of modificationPatterns) {
        const matches = output.matchAll(new RegExp(pattern, 'gi'));
        for (const match of matches) {
          const path = match[1]?.trim();
          if (path) {
            changes.push({
              type: 'modified',
              path,
              details: {
                isTest: this.isTestFile(path),
              },
            });
          }
        }
      }
    }

    // Detect file deletions
    if (opts.detectDeletions) {
      const deletionPatterns = [
        /deleted[:\s]+(.+)/i,
        /removed[:\s]+(.+)/i,
        /delete mode \d+ (.+)/i,
      ];

      for (const pattern of deletionPatterns) {
        const matches = output.matchAll(new RegExp(pattern, 'gi'));
        for (const match of matches) {
          const path = match[1]?.trim();
          if (path) {
            changes.push({
              type: 'deleted',
              path,
              details: {
                isTest: this.isTestFile(path),
              },
            });
          }
        }
      }
    }

    // Parse diff for line changes
    if (opts.detectLineChanges && output.includes('diff --git')) {
      const diffChanges = this.parseDiffChanges(output);
      changes.push(...diffChanges);
    }

    return changes;
  }

  /**
   * Parse diff for changes
   * @param diff Diff output
   * @returns File changes
   */
  private parseDiffChanges(diff: string): FileChange[] {
    const changes: FileChange[] = [];
    const files = diff.split('diff --git').slice(1);

    for (const file of files) {
      const pathMatch = file.match(/a\/(.+) b\/\1/);
      
      if (pathMatch) {
        const path = pathMatch[1];
        let linesAdded = 0;
        let linesRemoved = 0;

        const lines = file.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            linesAdded++;
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            linesRemoved++;
          }
        }

        changes.push({
          type: 'modified',
          path,
          details: {
            linesAdded,
            linesRemoved,
            isTest: this.isTestFile(path),
          },
        });
      }
    }

    return changes;
  }

  /**
   * Check if file is a test file
   * @param path File path
   * @returns True if test file
   */
  private isTestFile(path: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /__tests__/,
      /test_/,
      /_test\./,
    ];

    return testPatterns.some(pattern => pattern.test(path));
  }

  // ============================================================================
  // PARSER IMPLEMENTATIONS
  // ============================================================================

  /**
   * Detect parser type from result
   * @param result Execution result
   * @returns Detected parser type
   */
  private detectParserType(result: ExecutionResult): ParseOptions['parserType'] {
    const output = result.stdout.trim();

    // Check for JSON
    if ((output.startsWith('{') && output.endsWith('}')) ||
        (output.startsWith('[') && output.endsWith(']'))) {
      try {
        JSON.parse(output);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    // Check for XML
    if (output.startsWith('<?xml') || output.startsWith('<')) {
      return 'xml';
    }

    // Check for diff
    if (output.includes('diff --git') || output.includes('@@')) {
      return 'diff';
    }

    // Check for markdown
    if (output.includes('# ') || output.includes('```')) {
      return 'markdown';
    }

    return 'text';
  }

  /**
   * Parse JSON output
   * @param content JSON content
   * @returns Parsed content
   */
  private parseJson(content: string): ParsedContent {
    try {
      const data = JSON.parse(content);
      
      return {
        data,
        artifacts: this.extractArtifactsFromObject(data),
        changes: this.extractChangesFromObject(data),
        errors: this.extractErrorsFromObject(data),
        metadata: { parser: 'json' },
      };
    } catch (error) {
      return {
        data: {},
        artifacts: [],
        changes: {},
        errors: [{
          type: 'parse',
          message: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
        }],
        metadata: { parser: 'json', parseError: true },
      };
    }
  }

  /**
   * Parse XML output
   * @param content XML content
   * @returns Parsed content
   */
  private parseXml(content: string): ParsedContent {
    // Basic XML parsing - in production, use a proper XML parser
    const artifacts: ExecutionArtifact[] = [];
    const changes: Partial<ChangeSummary> = {};
    const errors: ParsedError[] = [];

    // Extract file references
    const fileMatches = content.matchAll(/<file[^>]*>([^<]*)<\/file>/gi);
    for (const match of fileMatches) {
      artifacts.push({
        type: 'file',
        path: match[1],
      });
    }

    // Extract errors
    const errorMatches = content.matchAll(/<error[^>]*>([^<]*)<\/error>/gi);
    for (const match of errorMatches) {
      errors.push({
        type: 'xml_error',
        message: match[1],
      });
    }

    return {
      data: { raw: content },
      artifacts,
      changes,
      errors,
      metadata: { parser: 'xml' },
    };
  }

  /**
   * Parse Markdown output
   * @param content Markdown content
   * @returns Parsed content
   */
  private parseMarkdown(content: string): ParsedContent {
    const artifacts: ExecutionArtifact[] = [];
    const changes: Partial<ChangeSummary> = {};

    // Extract code blocks as artifacts
    const codeBlockMatches = content.matchAll(/```(\w+)?\n([\s\S]*?)```/g);
    for (const match of codeBlockMatches) {
      const language = match[1] || 'text';
      artifacts.push({
        type: 'file',
        path: `snippet.${language}`,
        mimeType: this.getMimeType(language),
      });
    }

    // Extract file references
    const fileRefMatches = content.matchAll(/`([^`]+\.[\w]+)`/g);
    for (const match of fileRefMatches) {
      artifacts.push({
        type: 'file',
        path: match[1],
      });
    }

    return {
      data: { sections: this.extractMarkdownSections(content) },
      artifacts,
      changes,
      errors: [],
      metadata: { parser: 'markdown' },
    };
  }

  /**
   * Parse diff output
   * @param content Diff content
   * @returns Parsed content
   */
  private parseDiff(content: string): ParsedContent {
    const changes = this.parseDiffChanges(content);
    
    const changeSummary: Partial<ChangeSummary> = {
      filesCreated: changes.filter(c => c.type === 'created').map(c => c.path),
      filesModified: changes.filter(c => c.type === 'modified').map(c => c.path),
      filesDeleted: changes.filter(c => c.type === 'deleted').map(c => c.path),
      linesAdded: changes.reduce((sum, c) => sum + (c.details?.linesAdded || 0), 0),
      linesRemoved: changes.reduce((sum, c) => sum + (c.details?.linesRemoved || 0), 0),
    };

    return {
      data: { changes },
      artifacts: changes.map(c => ({ type: 'file', path: c.path })),
      changes: changeSummary,
      errors: [],
      metadata: { parser: 'diff' },
    };
  }

  /**
   * Parse text output
   * @param result Execution result
   * @returns Parsed content
   */
  private parseText(result: ExecutionResult): ParsedContent {
    const changes = this.detectChanges(result);
    
    return {
      data: { raw: result.stdout },
      artifacts: result.artifacts,
      changes: {
        filesCreated: changes.filter(c => c.type === 'created').map(c => c.path),
        filesModified: changes.filter(c => c.type === 'modified').map(c => c.path),
        filesDeleted: changes.filter(c => c.type === 'deleted').map(c => c.path),
      },
      errors: [],
      metadata: { parser: 'text' },
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Extract artifacts from object
   * @param obj Object to extract from
   * @returns Artifacts
   */
  private extractArtifactsFromObject(obj: Record<string, unknown>): ExecutionArtifact[] {
    const artifacts: ExecutionArtifact[] = [];

    // Look for common artifact patterns
    if (obj.artifacts && Array.isArray(obj.artifacts)) {
      for (const artifact of obj.artifacts) {
        if (typeof artifact === 'object' && artifact !== null) {
          artifacts.push({
            type: (artifact as Record<string, string>).type as ExecutionArtifact['type'] || 'file',
            path: (artifact as Record<string, string>).path || '',
            mimeType: (artifact as Record<string, string>).mimeType,
          });
        }
      }
    }

    // Look for files array
    if (obj.files && Array.isArray(obj.files)) {
      for (const file of obj.files) {
        if (typeof file === 'string') {
          artifacts.push({ type: 'file', path: file });
        }
      }
    }

    return artifacts;
  }

  /**
   * Extract changes from object
   * @param obj Object to extract from
   * @returns Changes
   */
  private extractChangesFromObject(obj: Record<string, unknown>): Partial<ChangeSummary> {
    const changes: Partial<ChangeSummary> = {};

    if (obj.changes && typeof obj.changes === 'object') {
      const changeObj = obj.changes as Record<string, unknown>;
      
      if (Array.isArray(changeObj.filesCreated)) {
        changes.filesCreated = changeObj.filesCreated as string[];
      }
      if (Array.isArray(changeObj.filesModified)) {
        changes.filesModified = changeObj.filesModified as string[];
      }
      if (Array.isArray(changeObj.filesDeleted)) {
        changes.filesDeleted = changeObj.filesDeleted as string[];
      }
      if (typeof changeObj.linesAdded === 'number') {
        changes.linesAdded = changeObj.linesAdded;
      }
      if (typeof changeObj.linesRemoved === 'number') {
        changes.linesRemoved = changeObj.linesRemoved;
      }
    }

    return changes;
  }

  /**
   * Extract errors from object
   * @param obj Object to extract from
   * @returns Errors
   */
  private extractErrorsFromObject(obj: Record<string, unknown>): ParsedError[] {
    const errors: ParsedError[] = [];

    if (obj.errors && Array.isArray(obj.errors)) {
      for (const error of obj.errors) {
        if (typeof error === 'object' && error !== null) {
          errors.push({
            type: (error as Record<string, string>).type || 'unknown',
            message: (error as Record<string, string>).message || String(error),
            file: (error as Record<string, string>).file,
            line: (error as Record<string, number>).line,
          });
        }
      }
    }

    if (obj.error && typeof obj.error === 'object') {
      const error = obj.error as Record<string, string>;
      errors.push({
        type: error.type || 'unknown',
        message: error.message || String(obj.error),
      });
    }

    return errors;
  }

  /**
   * Extract markdown sections
   * @param content Markdown content
   * @returns Sections
   */
  private extractMarkdownSections(content: string): Array<{ level: number; title: string }> {
    const sections: Array<{ level: number; title: string }> = [];
    const matches = content.matchAll(/^(#{1,6})\s+(.+)$/gm);

    for (const match of matches) {
      sections.push({
        level: match[1].length,
        title: match[2].trim(),
      });
    }

    return sections;
  }

  /**
   * Get MIME type from language
   * @param language Language identifier
   * @returns MIME type
   */
  private getMimeType(language: string): string {
    const mimeTypes: Record<string, string> = {
      typescript: 'text/typescript',
      ts: 'text/typescript',
      tsx: 'text/typescript-jsx',
      javascript: 'application/javascript',
      js: 'application/javascript',
      jsx: 'text/jsx',
      json: 'application/json',
      markdown: 'text/markdown',
      md: 'text/markdown',
      css: 'text/css',
      html: 'text/html',
      python: 'text/x-python',
      py: 'text/x-python',
    };

    return mimeTypes[language.toLowerCase()] || 'text/plain';
  }

  /**
   * Merge change summaries
   * @param base Base changes
   * @param additional Additional changes
   * @returns Merged changes
   */
  private mergeChanges(
    base: ChangeSummary,
    additional: Partial<ChangeSummary>
  ): ChangeSummary {
    return {
      filesCreated: [...base.filesCreated, ...(additional.filesCreated || [])],
      filesModified: [...base.filesModified, ...(additional.filesModified || [])],
      filesDeleted: [...base.filesDeleted, ...(additional.filesDeleted || [])],
      linesAdded: base.linesAdded + (additional.linesAdded || 0),
      linesRemoved: base.linesRemoved + (additional.linesRemoved || 0),
      testsAdded: base.testsAdded + (additional.testsAdded || 0),
      testsModified: base.testsModified + (additional.testsModified || 0),
    };
  }

  /**
   * Deduplicate artifacts
   * @param artifacts Artifacts to deduplicate
   * @returns Deduplicated artifacts
   */
  private deduplicateArtifacts(artifacts: ExecutionArtifact[]): ExecutionArtifact[] {
    const seen = new Set<string>();
    const deduplicated: ExecutionArtifact[] = [];

    for (const artifact of artifacts) {
      const key = `${artifact.type}:${artifact.path}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(artifact);
      }
    }

    return deduplicated;
  }

  /**
   * Aggregate change summaries
   * @param changes Change summaries to aggregate
   * @returns Aggregated changes
   */
  private aggregateChangeSummaries(changes: ChangeSummary[]): ChangeSummary {
    return changes.reduce(
      (acc, curr) => ({
        filesCreated: [...acc.filesCreated, ...curr.filesCreated],
        filesModified: [...acc.filesModified, ...curr.filesModified],
        filesDeleted: [...acc.filesDeleted, ...curr.filesDeleted],
        linesAdded: acc.linesAdded + curr.linesAdded,
        linesRemoved: acc.linesRemoved + curr.linesRemoved,
        testsAdded: acc.testsAdded + curr.testsAdded,
        testsModified: acc.testsModified + curr.testsModified,
      }),
      {
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        linesAdded: 0,
        linesRemoved: 0,
        testsAdded: 0,
        testsModified: 0,
      }
    );
  }

  /**
   * Extract summary from result
   * @param result Execution result
   * @returns Summary or undefined
   */
  private extractSummary(result: ExecutionResult): string | undefined {
    // Look for summary in stdout
    const lines = result.stdout.split('\n');
    
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('summary') || lower.includes('completed') || lower.includes('done')) {
        return line.trim();
      }
    }

    return undefined;
  }

  /**
   * Create empty aggregated result
   * @returns Empty aggregated result
   */
  private createEmptyAggregatedResult(): AggregatedResult {
    const now = new Date();
    
    return {
      status: 'success',
      results: [],
      artifacts: [],
      changes: {
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        linesAdded: 0,
        linesRemoved: 0,
        testsAdded: 0,
        testsModified: 0,
      },
      errors: [],
      metadata: {
        totalDurationMs: 0,
        startedAt: now,
        endedAt: now,
        successCount: 0,
        failureCount: 0,
        partialCount: 0,
      },
      summaries: [],
    };
  }

  // ============================================================================
  // CUSTOM PARSER REGISTRATION
  // ============================================================================

  /**
   * Register a custom parser
   * @param parser Custom parser
   */
  registerCustomParser(parser: CustomParser): void {
    this.customParsers.set(parser.name, parser);
  }

  /**
   * Unregister a custom parser
   * @param name Parser name
   * @returns True if unregistered
   */
  unregisterCustomParser(name: string): boolean {
    return this.customParsers.delete(name);
  }

  /**
   * Get custom parser
   * @param name Parser name
   * @returns Parser or undefined
   */
  getCustomParser(name: string): CustomParser | undefined {
    return this.customParsers.get(name);
  }

  /**
   * List custom parsers
   * @returns Array of custom parsers
   */
  listCustomParsers(): CustomParser[] {
    return Array.from(this.customParsers.values());
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalParser: ResultParser | null = null;

/**
 * Get the global result parser instance
 * @returns ResultParser singleton
 */
export function getResultParser(): ResultParser {
  if (!globalParser) {
    globalParser = new ResultParser();
  }
  return globalParser;
}

/**
 * Reset the global parser (useful for testing)
 */
export function resetResultParser(): void {
  globalParser = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ResultParser;
