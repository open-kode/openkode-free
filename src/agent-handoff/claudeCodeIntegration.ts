/**
 * Claude Code Integration - Claude Code CLI Integration
 * 
 * Provides integration with Anthropic's Claude Code CLI including:
 * - CLI wrapper for Claude Code
 * - Process spawning and management
 * - Output parsing and handling
 * - Error handling and recovery
 */

import { EventEmitter } from 'events';
import { HandoffPayload, ExecutionResult, ExecutionArtifact } from './handoffProtocol';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Claude Code configuration
 */
export interface ClaudeCodeConfig {
  /** Claude Code executable path */
  executablePath: string;
  /** API key (or use ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Default model */
  defaultModel: 'claude-3-5-sonnet' | 'claude-3-opus' | 'claude-3-haiku';
  /** Max tokens per request */
  maxTokens: number;
  /** Temperature */
  temperature: number;
  /** Enable debug mode */
  debug: boolean;
  /** Enable verbose output */
  verbose: boolean;
  /** Auto-confirm dangerous operations */
  autoConfirm: boolean;
  /** Enable git integration */
  gitIntegration: boolean;
  /** Shell to use */
  shell: string;
}

/**
 * Claude Code process options
 */
export interface ClaudeCodeProcessOptions {
  /** Working directory */
  cwd: string;
  /** Environment variables */
  envVars: Record<string, string>;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Capture stdout */
  captureStdout: boolean;
  /** Capture stderr */
  captureStderr: boolean;
  /** Stream output */
  streamOutput: boolean;
  /** Callback for stdout data */
  onStdout?: (data: string) => void;
  /** Callback for stderr data */
  onStderr?: (data: string) => void;
  /** Callback for progress */
  onProgress?: (progress: ClaudeCodeProgress) => void;
}

/**
 * Claude Code progress update
 */
export interface ClaudeCodeProgress {
  /** Progress stage */
  stage: 'initializing' | 'thinking' | 'coding' | 'testing' | 'completing';
  /** Progress message */
  message: string;
  /** Progress percentage (0-100) */
  percent: number;
  /** Current file being processed */
  currentFile?: string;
  /** Files processed */
  filesProcessed?: number;
  /** Total files */
  totalFiles?: number;
}

/**
 * Claude Code output
 */
export interface ClaudeCodeOutput {
  /** Output type */
  type: 'text' | 'code' | 'file' | 'command' | 'error' | 'warning' | 'success';
  /** Output content */
  content: string;
  /** Associated file */
  file?: string;
  /** Code language */
  language?: string;
  /** Whether content is complete */
  isComplete: boolean;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Parsed Claude Code result
 */
export interface ParsedClaudeCodeResult {
  /** Success status */
  success: boolean;
  /** Parsed outputs */
  outputs: ClaudeCodeOutput[];
  /** Files modified */
  filesModified: string[];
  /** Files created */
  filesCreated: string[];
  /** Commands executed */
  commandsExecuted: string[];
  /** Errors encountered */
  errors: string[];
  /** Warnings */
  warnings: string[];
  /** Summary */
  summary?: string;
}

/**
 * Claude Code error types
 */
export type ClaudeCodeErrorType =
  | 'api_error'
  | 'rate_limit'
  | 'timeout'
  | 'parse_error'
  | 'execution_error'
  | 'permission_denied'
  | 'context_length_exceeded'
  | 'unknown';

/**
 * Claude Code error
 */
export interface ClaudeCodeError {
  /** Error type */
  type: ClaudeCodeErrorType;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Retryable */
  retryable: boolean;
  /** Suggested action */
  suggestedAction?: string;
}

/**
 * Claude Code integration options
 */
export interface ClaudeCodeIntegrationOptions {
  /** Wait for completion */
  waitForCompletion?: boolean;
  /** Timeout override */
  timeoutMs?: number;
  /** Stream output */
  streamOutput?: boolean;
  /** Auto-confirm */
  autoConfirm?: boolean;
  /** Max retries */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
}

/**
 * Claude Code message format
 */
export interface ClaudeCodeMessage {
  /** Message role */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Attached files */
  files?: string[];
}

// ============================================================================
// CLAUDE CODE INTEGRATION CLASS
// ============================================================================

/**
 * Claude Code Integration - Manages Claude Code CLI integration
 */
export class ClaudeCodeIntegration extends EventEmitter {
  private config: ClaudeCodeConfig;
  private activeProcesses: Map<string, import('child_process').ChildProcess> = new Map();
  private isAvailable: boolean = false;
  private outputHistory: ClaudeCodeOutput[] = [];

  constructor(config?: Partial<ClaudeCodeConfig>) {
    super();

    this.config = {
      executablePath: config?.executablePath || this.detectClaudeCodePath(),
      apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
      defaultModel: config?.defaultModel || 'claude-3-5-sonnet',
      maxTokens: config?.maxTokens || 4096,
      temperature: config?.temperature || 0.7,
      debug: config?.debug || false,
      verbose: config?.verbose || false,
      autoConfirm: config?.autoConfirm || false,
      gitIntegration: config?.gitIntegration !== false,
      shell: config?.shell || '/bin/bash',
    };

    this.checkAvailability();
  }

  // ============================================================================
  // AVAILABILITY AND DETECTION
  // ============================================================================

  /**
   * Detect Claude Code executable path
   * @returns Detected path or default
   */
  private detectClaudeCodePath(): string {
    const platform = process.platform;

    const paths: Record<string, string[]> = {
      darwin: [
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        '/usr/bin/claude',
      ],
      linux: [
        '/usr/bin/claude',
        '/usr/local/bin/claude',
        '/snap/bin/claude',
      ],
      win32: [
        'C:\\Program Files\\Claude\\claude.exe',
        'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Claude\\claude.exe',
      ],
    };

    const platformPaths = paths[platform] || paths.linux;
    return platformPaths[0] || 'claude';
  }

  /**
   * Check if Claude Code is available
   * @returns True if available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('claude --version', { timeout: 5000 });
      this.isAvailable = true;
      this.emit('claude:available', { version: stdout.trim() });
      return true;
    } catch {
      this.isAvailable = false;
      this.emit('claude:unavailable');
      return false;
    }
  }

  /**
   * Get availability status
   * @returns True if Claude Code is available
   */
  getAvailability(): boolean {
    return this.isAvailable;
  }

  // ============================================================================
  // MAIN HANDOFF METHOD
  // ============================================================================

  /**
   * Spawn Claude Code with handoff payload
   * @param payload Handoff payload
   * @param options Integration options
   * @returns Execution result
   */
  async spawnClaudeCode(
    payload: HandoffPayload,
    options: ClaudeCodeIntegrationOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const opts = {
      waitForCompletion: true,
      timeoutMs: payload.targetAgent.execution.timeoutMs,
      streamOutput: true,
      autoConfirm: this.config.autoConfirm,
      maxRetries: 3,
      retryDelayMs: 5000,
      ...options,
    };

    this.emit('claude:spawning', { handoffId: payload.handoffId });

    // Ensure Claude Code is available
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        return this.createErrorResult(
          payload,
          startTime,
          {
            type: 'unknown',
            message: 'Claude Code is not available on this system',
            retryable: false,
          }
        );
      }
    }

    // Build process options
    const processOptions: ClaudeCodeProcessOptions = {
      cwd: payload.context.workingDirectory,
      envVars: {
        ...payload.context.envVars,
        ANTHROPIC_API_KEY: this.config.apiKey || '',
        CLAUDE_CODE_DEBUG: this.config.debug ? '1' : '0',
        CLAUDE_CODE_VERBOSE: this.config.verbose ? '1' : '0',
      },
      timeoutMs: opts.timeoutMs,
      captureStdout: true,
      captureStderr: true,
      streamOutput: opts.streamOutput,
      onProgress: opts.streamOutput
        ? (progress) => this.emit('claude:progress', { handoffId: payload.handoffId, progress })
        : undefined,
    };

    // Execute with retry logic
    let lastError: ClaudeCodeError | undefined;
    
    for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
      try {
        const result = await this.executeWithClaudeCode(
          payload,
          processOptions,
          opts
        );

        this.emit('claude:completed', { handoffId: payload.handoffId, result });
        return result;
      } catch (error) {
        lastError = this.parseError(error);

        if (!lastError.retryable || attempt === opts.maxRetries - 1) {
          break;
        }

        this.emit('claude:retry', {
          handoffId: payload.handoffId,
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          error: lastError,
        });

        await this.sleep(opts.retryDelayMs);
      }
    }

    const failedResult = this.createErrorResult(
      payload,
      startTime,
      lastError || {
        type: 'unknown',
        message: 'Unknown error occurred',
        retryable: false,
      }
    );

    this.emit('claude:failed', { handoffId: payload.handoffId, error: lastError, result: failedResult });

    return failedResult;
  }

  /**
   * Execute with Claude Code
   * @param payload Handoff payload
   * @param processOptions Process options
   * @param integrationOptions Integration options
   * @returns Execution result
   */
  private async executeWithClaudeCode(
    payload: HandoffPayload,
    processOptions: ClaudeCodeProcessOptions,
    integrationOptions: Required<ClaudeCodeIntegrationOptions>
  ): Promise<ExecutionResult> {
    const { spawn } = await import('child_process');
    const startTime = Date.now();

    // Build command arguments
    const args = this.buildCommandArgs(payload, integrationOptions);

    return new Promise((resolve, reject) => {
      const child = spawn(this.config.executablePath, args, {
        cwd: processOptions.cwd,
        env: { ...process.env, ...processOptions.envVars },
        shell: this.config.shell,
        stdio: processOptions.streamOutput ? 'pipe' : 'pipe',
      });

      const processId = `claude-${Date.now()}`;
      this.activeProcesses.set(processId, child);

      let stdout = '';
      let stderr = '';

      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;

        if (processOptions.streamOutput && processOptions.onStdout) {
          processOptions.onStdout(chunk);
        }

        this.emit('claude:stdout', { processId, data: chunk });
      });

      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;

        if (processOptions.streamOutput && processOptions.onStderr) {
          processOptions.onStderr(chunk);
        }

        this.emit('claude:stderr', { processId, data: chunk });
      });

      // Set timeout
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);

        this.activeProcesses.delete(processId);

        reject(new Error('Execution timed out'));
      }, processOptions.timeoutMs);

      // Handle process completion
      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        this.activeProcesses.delete(processId);

        const endTime = Date.now();
        const parsedOutput = this.parseOutput(stdout, stderr);

        const result: ExecutionResult = {
          handoffId: payload.handoffId,
          status: code === 0 ? 'success' : signal ? 'cancelled' : 'failure',
          exitCode: code || 0,
          stdout,
          stderr,
          artifacts: this.extractArtifacts(parsedOutput),
          changes: this.summarizeChanges(parsedOutput),
          metadata: {
            startedAt: new Date(startTime),
            endedAt: new Date(endTime),
            durationMs: endTime - startTime,
            agentId: payload.targetAgent.id,
            command: `${this.config.executablePath} ${args.join(' ')}`,
          },
        };

        resolve(result);
      });

      // Handle process errors
      child.on('error', (error) => {
        clearTimeout(timeout);
        this.activeProcesses.delete(processId);
        reject(error);
      });
    });
  }

  /**
   * Build command arguments for Claude Code
   * @param payload Handoff payload
   * @param options Integration options
   * @returns Command arguments
   */
  private buildCommandArgs(
    payload: HandoffPayload,
    options: Required<ClaudeCodeIntegrationOptions>
  ): string[] {
    const args: string[] = [];

    // Add message/prompt
    args.push('--message', payload.prompt);

    // Add auto-confirm flag
    if (options.autoConfirm) {
      args.push('--dangerous-auto-accept');
    }

    // Add verbose flag
    if (this.config.verbose) {
      args.push('--verbose');
    }

    // Add debug flag
    if (this.config.debug) {
      args.push('--debug');
    }

    // Add files if specified
    if (payload.files && payload.files.length > 0) {
      for (const file of payload.files) {
        args.push('--file', file.path);
      }
    }

    return args;
  }

  // ============================================================================
  // OUTPUT PARSING
  // ============================================================================

  /**
   * Parse Claude Code output
   * @param stdout Standard output
   * @param stderr Standard error
   * @returns Parsed result
   */
  parseOutput(stdout: string, stderr: string): ParsedClaudeCodeResult {
    const outputs: ClaudeCodeOutput[] = [];
    const filesModified: string[] = [];
    const filesCreated: string[] = [];
    const commandsExecuted: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Parse stdout
    const lines = stdout.split('\n');

    for (const line of lines) {
      // Detect file modifications
      const fileModMatch = line.match(/(?:Modified|Updated|Changed):?\s*(.+)/i);
      if (fileModMatch) {
        filesModified.push(fileModMatch[1].trim());
      }

      // Detect file creations
      const fileCreateMatch = line.match(/(?:Created|Added|New file):?\s*(.+)/i);
      if (fileCreateMatch) {
        filesCreated.push(fileCreateMatch[1].trim());
      }

      // Detect command execution
      const cmdMatch = line.match(/(?:Running|Executing|Command):?\s*[`$](.+)[`$]?/i);
      if (cmdMatch) {
        commandsExecuted.push(cmdMatch[1].trim());
      }

      // Detect errors
      if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
        errors.push(line);
      }

      // Detect warnings
      if (line.toLowerCase().includes('warning')) {
        warnings.push(line);
      }

      // Build output entries
      if (line.trim()) {
        outputs.push({
          type: this.detectOutputType(line),
          content: line,
          isComplete: true,
          timestamp: new Date(),
        });
      }
    }

    // Parse stderr for errors
    if (stderr) {
      errors.push(...stderr.split('\n').filter(l => l.trim()));
    }

    return {
      success: errors.length === 0,
      outputs,
      filesModified,
      filesCreated,
      commandsExecuted,
      errors,
      warnings,
      summary: this.extractSummary(outputs),
    };
  }

  /**
   * Detect output type from line
   * @param line Output line
   * @returns Output type
   */
  private detectOutputType(line: string): ClaudeCodeOutput['type'] {
    const lower = line.toLowerCase();

    if (lower.includes('error') || lower.includes('failed')) return 'error';
    if (lower.includes('warning')) return 'warning';
    if (lower.includes('success') || lower.includes('completed')) return 'success';
    if (lower.includes('$') || lower.includes('`')) return 'command';
    if (lower.includes('```') || lower.includes('function') || lower.includes('class')) {
      return 'code';
    }

    return 'text';
  }

  /**
   * Extract summary from outputs
   * @param outputs Parsed outputs
   * @returns Summary string
   */
  private extractSummary(outputs: ClaudeCodeOutput[]): string | undefined {
    // Look for summary indicators
    const summaryIndicators = ['summary:', 'completed:', 'done!', 'result:'];
    
    for (const output of outputs) {
      const lower = output.content.toLowerCase();
      if (summaryIndicators.some(ind => lower.includes(ind))) {
        return output.content;
      }
    }

    return undefined;
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Parse error to ClaudeCodeError
   * @param error Error object
   * @returns Parsed error
   */
  handleErrors(error: unknown): ClaudeCodeError {
    return this.parseError(error);
  }

  /**
   * Parse error
   * @param error Error object
   * @returns Parsed error
   */
  private parseError(error: unknown): ClaudeCodeError {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    // API errors
    if (lowerMessage.includes('api error') || lowerMessage.includes('anthropic')) {
      return {
        type: 'api_error',
        message,
        retryable: true,
        suggestedAction: 'Check API key and network connection',
      };
    }

    // Rate limit
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      return {
        type: 'rate_limit',
        message,
        retryable: true,
        suggestedAction: 'Wait before retrying',
      };
    }

    // Timeout
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return {
        type: 'timeout',
        message,
        retryable: true,
        suggestedAction: 'Increase timeout or reduce request complexity',
      };
    }

    // Context length
    if (lowerMessage.includes('context') || lowerMessage.includes('too long')) {
      return {
        type: 'context_length_exceeded',
        message,
        retryable: false,
        suggestedAction: 'Reduce input size or split into smaller requests',
      };
    }

    // Permission
    if (lowerMessage.includes('permission') || lowerMessage.includes('denied')) {
      return {
        type: 'permission_denied',
        message,
        retryable: false,
        suggestedAction: 'Check file permissions and API access',
      };
    }

    // Default
    return {
      type: 'unknown',
      message,
      retryable: false,
    };
  }

  /**
   * Get suggested fix for error
   * @param error Claude Code error
   * @returns Suggested fix
   */
  getSuggestedFix(error: ClaudeCodeError): string {
    const fixes: Record<ClaudeCodeErrorType, string> = {
      api_error: 'Verify your ANTHROPIC_API_KEY is set correctly and has not expired.',
      rate_limit: 'Wait a few moments before retrying your request.',
      timeout: 'Increase the timeout setting or break your request into smaller parts.',
      parse_error: 'Check the format of your input and try again.',
      execution_error: 'Review the error output and fix any issues in your code.',
      permission_denied: 'Ensure you have the necessary permissions for this operation.',
      context_length_exceeded: 'Reduce the amount of context or files included in your request.',
      unknown: 'Try the operation again or check the documentation for help.',
    };

    return error.suggestedAction || fixes[error.type];
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Extract artifacts from parsed output
   * @param parsed Parsed output
   * @returns Execution artifacts
   */
  private extractArtifacts(parsed: ParsedClaudeCodeResult): ExecutionArtifact[] {
    const artifacts: ExecutionArtifact[] = [];

    for (const file of parsed.filesCreated) {
      artifacts.push({
        type: 'file',
        path: file,
        mimeType: this.getMimeType(file),
      });
    }

    for (const file of parsed.filesModified) {
      artifacts.push({
        type: 'file',
        path: file,
        mimeType: this.getMimeType(file),
      });
    }

    return artifacts;
  }

  /**
   * Summarize changes from parsed output
   * @param parsed Parsed output
   * @returns Change summary
   */
  private summarizeChanges(parsed: ParsedClaudeCodeResult): ExecutionResult['changes'] {
    return {
      filesCreated: parsed.filesCreated,
      filesModified: parsed.filesModified,
      filesDeleted: [],
      linesAdded: 0, // Would need git diff to calculate
      linesRemoved: 0,
      testsAdded: parsed.filesCreated.filter(f => 
        f.includes('.test.') || f.includes('.spec.')
      ).length,
      testsModified: parsed.filesModified.filter(f => 
        f.includes('.test.') || f.includes('.spec.')
      ).length,
    };
  }

  /**
   * Get MIME type from file path
   * @param path File path
   * @returns MIME type
   */
  private getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      ts: 'text/typescript',
      tsx: 'text/typescript-jsx',
      js: 'application/javascript',
      jsx: 'text/jsx',
      json: 'application/json',
      md: 'text/markdown',
      css: 'text/css',
      html: 'text/html',
      py: 'text/x-python',
    };

    return mimeTypes[ext || ''] || 'text/plain';
  }

  /**
   * Create error result
   * @param payload Handoff payload
   * @param startTime Start timestamp
   * @param error Claude Code error
   * @returns Error execution result
   */
  private createErrorResult(
    payload: HandoffPayload,
    startTime: number,
    error: ClaudeCodeError
  ): ExecutionResult {
    const endTime = Date.now();

    return {
      handoffId: payload.handoffId,
      status: 'failure',
      exitCode: -1,
      stdout: '',
      stderr: error.message,
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
      metadata: {
        startedAt: new Date(startTime),
        endedAt: new Date(endTime),
        durationMs: endTime - startTime,
        agentId: payload.targetAgent.id,
        command: this.config.executablePath,
      },
      error: {
        type: error.type === 'parse_error' ? 'parse' : 
              error.type === 'timeout' ? 'timeout' : 'runtime',
        message: error.message,
        suggestedFixes: [this.getSuggestedFix(error)],
      },
    };
  }

  /**
   * Sleep utility
   * @param ms Milliseconds
   * @returns Promise that resolves after ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // GETTERS AND SETTERS
  // ============================================================================

  /**
   * Get Claude Code configuration
   * @returns Current configuration
   */
  getConfig(): ClaudeCodeConfig {
    return { ...this.config };
  }

  /**
   * Update Claude Code configuration
   * @param config Partial configuration update
   */
  updateConfig(config: Partial<ClaudeCodeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get active processes
   * @returns Array of active process IDs
   */
  getActiveProcesses(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Kill an active process
   * @param processId Process ID
   * @param force Use SIGKILL
   */
  killProcess(processId: string, force: boolean = false): boolean {
    const process = this.activeProcesses.get(processId);
    
    if (process) {
      process.kill(force ? 'SIGKILL' : 'SIGTERM');
      this.activeProcesses.delete(processId);
      return true;
    }

    return false;
  }

  /**
   * Kill all active processes
   * @param force Use SIGKILL
   */
  killAllProcesses(force: boolean = false): void {
    for (const [id, process] of this.activeProcesses) {
      process.kill(force ? 'SIGKILL' : 'SIGTERM');
      this.activeProcesses.delete(id);
    }
  }

  /**
   * Get output history
   * @returns Output history
   */
  getOutputHistory(): ClaudeCodeOutput[] {
    return [...this.outputHistory];
  }

  /**
   * Clear output history
   */
  clearOutputHistory(): void {
    this.outputHistory = [];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalIntegration: ClaudeCodeIntegration | null = null;

/**
 * Get the global Claude Code integration instance
 * @returns ClaudeCodeIntegration singleton
 */
export function getClaudeCodeIntegration(config?: Partial<ClaudeCodeConfig>): ClaudeCodeIntegration {
  if (!globalIntegration) {
    globalIntegration = new ClaudeCodeIntegration(config);
  }
  return globalIntegration;
}

/**
 * Reset the global integration (useful for testing)
 */
export function resetClaudeCodeIntegration(): void {
  globalIntegration = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ClaudeCodeIntegration;
