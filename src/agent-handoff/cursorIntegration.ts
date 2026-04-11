/**
 * Cursor Integration - Cursor IDE Specific Integration
 * 
 * Provides integration with Cursor IDE including:
 * - VSCode extension API integration
 * - Composer mode support
 * - Cursor command execution
 * - Output reading and parsing
 */

import { EventEmitter } from 'events';
import { HandoffPayload, ExecutionResult, ExecutionArtifact } from './handoffProtocol';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Cursor-specific configuration
 */
export interface CursorConfig {
  /** VSCode/Cursor executable path */
  executablePath: string;
  /** Extension ID for Cursor AI */
  extensionId: string;
  /** Composer mode settings */
  composer: ComposerSettings;
  /** Workspace settings */
  workspace: CursorWorkspaceSettings;
  /** AI model preferences */
  modelPreferences: CursorModelPreferences;
}

/**
 * Composer mode settings
 */
export interface ComposerSettings {
  /** Enable composer mode */
  enabled: boolean;
  /** Auto-apply changes */
  autoApply: boolean;
  /** Show diff before applying */
  showDiff: boolean;
  /** Context window size */
  contextWindow: number;
  /** Include file tree */
  includeFileTree: boolean;
  /** Include open files */
  includeOpenFiles: boolean;
}

/**
 * Cursor workspace settings
 */
export interface CursorWorkspaceSettings {
  /** Indexing enabled */
  indexingEnabled: boolean;
  /** Files to exclude from indexing */
  excludePatterns: string[];
  /** Files to include in indexing */
  includePatterns: string[];
  /** Maximum file size for indexing (bytes) */
  maxFileSize: number;
}

/**
 * Cursor model preferences
 */
export interface CursorModelPreferences {
  /** Default model */
  defaultModel: 'claude-3.5-sonnet' | 'claude-3-opus' | 'gpt-4' | 'gpt-4o' | 'cursor-small';
  /** Long context model */
  longContextModel: string;
  /** Fast model for simple tasks */
  fastModel: string;
}

/**
 * Cursor command types
 */
export type CursorCommandType = 
  | 'openFile'
  | 'openComposer'
  | 'sendMessage'
  | 'applyEdit'
  | 'runCommand'
  | 'focusWindow'
  | 'closeTab'
  | 'saveAll';

/**
 * Cursor command payload
 */
export interface CursorCommand {
  /** Command type */
  type: CursorCommandType;
  /** Command arguments */
  args: Record<string, unknown>;
  /** Command ID for tracking */
  commandId: string;
  /** Priority */
  priority: 'low' | 'normal' | 'high';
}

/**
 * Composer message
 */
export interface ComposerMessage {
  /** Message ID */
  id: string;
  /** Message content */
  content: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Attached files */
  attachedFiles?: string[];
  /** Message context */
  context?: {
    currentFile?: string;
    selection?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
  /** Timestamp */
  timestamp: Date;
}

/**
 * Composer session
 */
export interface ComposerSession {
  /** Session ID */
  sessionId: string;
  /** Session title */
  title: string;
  /** Messages in session */
  messages: ComposerMessage[];
  /** Associated files */
  associatedFiles: string[];
  /** Session state */
  state: 'active' | 'paused' | 'completed';
  /** Created timestamp */
  createdAt: Date;
  /** Last updated */
  updatedAt: Date;
}

/**
 * Cursor output/response
 */
export interface CursorOutput {
  /** Output type */
  type: 'message' | 'edit' | 'command' | 'error' | 'progress';
  /** Output content */
  content: string;
  /** Associated file (for edits) */
  file?: string;
  /** Edit diff (for edits) */
  diff?: string;
  /** Progress percentage */
  progress?: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Cursor integration options
 */
export interface CursorIntegrationOptions {
  /** Wait for completion */
  waitForCompletion?: boolean;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Use composer mode */
  useComposer?: boolean;
  /** Auto-apply changes */
  autoApply?: boolean;
  /** Capture output */
  captureOutput?: boolean;
  /** Focus window after sending */
  focusWindow?: boolean;
}

/**
 * Cursor file edit
 */
export interface CursorFileEdit {
  /** File path */
  path: string;
  /** Edit type */
  editType: 'create' | 'modify' | 'delete';
  /** Original content (for modify) */
  originalContent?: string;
  /** New content */
  newContent?: string;
  /** Diff patch */
  diff?: string;
  /** Line range */
  lineRange?: {
    start: number;
    end: number;
  };
}

// ============================================================================
// CURSOR INTEGRATION CLASS
// ============================================================================

/**
 * Cursor Integration - Manages Cursor IDE integration
 */
export class CursorIntegration extends EventEmitter {
  private config: CursorConfig;
  private activeSessions: Map<string, ComposerSession> = new Map();
  private outputBuffer: CursorOutput[] = [];
  private isAvailable: boolean = false;

  constructor(config?: Partial<CursorConfig>) {
    super();
    
    this.config = {
      executablePath: config?.executablePath || this.detectCursorPath(),
      extensionId: config?.extensionId || 'anysphere.cursor',
      composer: {
        enabled: true,
        autoApply: false,
        showDiff: true,
        contextWindow: 200000,
        includeFileTree: true,
        includeOpenFiles: true,
        ...config?.composer,
      },
      workspace: {
        indexingEnabled: true,
        excludePatterns: ['node_modules', '.git', 'dist', 'build', '.cursor'],
        includePatterns: ['**/*'],
        maxFileSize: 1024 * 1024, // 1MB
        ...config?.workspace,
      },
      modelPreferences: {
        defaultModel: 'claude-3.5-sonnet',
        longContextModel: 'claude-3-opus',
        fastModel: 'cursor-small',
        ...config?.modelPreferences,
      },
    };

    this.checkAvailability();
  }

  // ============================================================================
  // AVAILABILITY AND DETECTION
  // ============================================================================

  /**
   * Detect Cursor executable path
   * @returns Detected path or default
   */
  private detectCursorPath(): string {
    const platform = process.platform;
    
    const paths: Record<string, string[]> = {
      darwin: [
        '/Applications/Cursor.app/Contents/MacOS/Cursor',
        '/usr/local/bin/cursor',
        '/opt/homebrew/bin/cursor',
      ],
      linux: [
        '/usr/bin/cursor',
        '/usr/local/bin/cursor',
        '/snap/bin/cursor',
      ],
      win32: [
        'C:\\Program Files\\Cursor\\Cursor.exe',
        'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Cursor\\Cursor.exe',
      ],
    };

    const platformPaths = paths[platform] || paths.linux;
    
    // Return first path (actual detection would check existence)
    return platformPaths[0] || 'cursor';
  }

  /**
   * Check if Cursor is available
   * @returns True if available
   */
  private async checkAvailability(): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync('cursor --version', { timeout: 5000 });
      this.isAvailable = true;
      return true;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Get availability status
   * @returns True if Cursor is available
   */
  getAvailability(): boolean {
    return this.isAvailable;
  }

  // ============================================================================
  // MAIN HANDOFF METHOD
  // ============================================================================

  /**
   * Send handoff to Cursor
   * @param payload Handoff payload
   * @param options Integration options
   * @returns Execution result
   */
  async sendToCursor(
    payload: HandoffPayload,
    options: CursorIntegrationOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const opts = {
      waitForCompletion: true,
      timeoutMs: 300000,
      useComposer: true,
      autoApply: false,
      captureOutput: true,
      focusWindow: true,
      ...options,
    };

    this.emit('cursor:sending', { handoffId: payload.handoffId });

    try {
      // Ensure Cursor is available
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          throw new Error('Cursor is not available on this system');
        }
      }

      // Open project in Cursor if needed
      await this.openProject(payload.context.projectRoot);

      let result: ExecutionResult;

      if (opts.useComposer) {
        // Use Composer mode
        result = await this.sendViaComposer(payload, opts);
      } else {
        // Use direct command
        result = await this.sendViaCommand(payload, opts);
      }

      this.emit('cursor:completed', { handoffId: payload.handoffId, result });

      return result;
    } catch (error) {
      const failedResult = this.createErrorResult(
        payload,
        startTime,
        error instanceof Error ? error : new Error(String(error))
      );

      this.emit('cursor:failed', { handoffId: payload.handoffId, error, result: failedResult });

      return failedResult;
    }
  }

  /**
   * Send via Composer mode
   * @param payload Handoff payload
   * @param options Integration options
   * @returns Execution result
   */
  private async sendViaComposer(
    payload: HandoffPayload,
    options: Required<CursorIntegrationOptions>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Create composer session
    const session = await this.createComposerSession(payload);

    // Send message to composer
    const message: ComposerMessage = {
      id: `msg-${Date.now()}`,
      content: this.formatPromptForComposer(payload),
      role: 'user',
      attachedFiles: payload.files?.map(f => f.path),
      timestamp: new Date(),
    };

    await this.sendComposerMessage(session.sessionId, message);

    if (options.waitForCompletion) {
      // Wait for response
      const response = await this.waitForComposerResponse(
        session.sessionId,
        options.timeoutMs
      );

      // Parse response and extract changes
      const changes = this.parseComposerResponse(response);

      const endTime = Date.now();

      return {
        handoffId: payload.handoffId,
        status: 'success',
        exitCode: 0,
        stdout: response.map(r => r.content).join('\n'),
        stderr: '',
        artifacts: this.extractArtifacts(changes),
        changes: this.summarizeChanges(changes),
        metadata: {
          startedAt: new Date(startTime),
          endedAt: new Date(endTime),
          durationMs: endTime - startTime,
          agentId: payload.targetAgent.id,
          command: 'cursor:composer',
        },
      };
    }

    // Return immediate result if not waiting
    const endTime = Date.now();

    return {
      handoffId: payload.handoffId,
      status: 'success',
      exitCode: 0,
      stdout: 'Composer session created, message sent',
      stderr: '',
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
        command: 'cursor:composer',
      },
    };
  }

  /**
   * Send via direct command
   * @param payload Handoff payload
   * @param options Integration options
   * @returns Execution result
   */
  private async sendViaCommand(
    payload: HandoffPayload,
    options: Required<CursorIntegrationOptions>
  ): Promise<ExecutionResult> {
    const { spawn } = await import('child_process');
    const startTime = Date.now();

    // Build command arguments
    const args: string[] = [
      '--reuse-window',
      payload.context.projectRoot,
    ];

    if (options.focusWindow) {
      args.push('--goto', payload.context.workingDirectory);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.config.executablePath, args, {
        cwd: payload.context.workingDirectory,
        env: { ...process.env, ...payload.context.envVars },
        detached: !options.waitForCompletion,
      });

      let stdout = '';
      let stderr = '';

      if (options.captureOutput) {
        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      // Set timeout
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        
        const endTime = Date.now();
        resolve({
          handoffId: payload.handoffId,
          status: 'timeout',
          exitCode: -1,
          stdout,
          stderr: 'Execution timed out',
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
            command: `${this.config.executablePath} ${args.join(' ')}`,
          },
        });
      }, options.timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeout);
        const endTime = Date.now();

        resolve({
          handoffId: payload.handoffId,
          status: code === 0 ? 'success' : 'failure',
          exitCode: code || 0,
          stdout,
          stderr,
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
            command: `${this.config.executablePath} ${args.join(' ')}`,
          },
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // ============================================================================
  // COMPOSER MODE METHODS
  // ============================================================================

  /**
   * Create a new Composer session
   * @param payload Handoff payload
   * @returns Composer session
   */
  private async createComposerSession(payload: HandoffPayload): Promise<ComposerSession> {
    const sessionId = `composer-${Date.now()}`;
    
    const session: ComposerSession = {
      sessionId,
      title: `OpenKode - ${payload.phase}`,
      messages: [],
      associatedFiles: payload.files?.map(f => f.path) || [],
      state: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.activeSessions.set(sessionId, session);

    // Open Composer in Cursor
    await this.executeCursorCommand({
      type: 'openComposer',
      args: { sessionId, title: session.title },
      commandId: `cmd-${Date.now()}`,
      priority: 'high',
    });

    return session;
  }

  /**
   * Send message to Composer session
   * @param sessionId Session ID
   * @param message Composer message
   */
  private async sendComposerMessage(
    sessionId: string,
    message: ComposerMessage
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Composer session ${sessionId} not found`);
    }

    session.messages.push(message);
    session.updatedAt = new Date();

    await this.executeCursorCommand({
      type: 'sendMessage',
      args: {
        sessionId,
        message: message.content,
        attachedFiles: message.attachedFiles,
      },
      commandId: `cmd-${Date.now()}`,
      priority: 'normal',
    });
  }

  /**
   * Wait for Composer response
   * @param sessionId Session ID
   * @param timeoutMs Timeout in milliseconds
   * @returns Array of outputs
   */
  private async waitForComposerResponse(
    sessionId: string,
    timeoutMs: number
  ): Promise<CursorOutput[]> {
    return new Promise((resolve) => {
      const outputs: CursorOutput[] = [];
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        // Check for timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          resolve(outputs);
          return;
        }

        // Poll for new outputs (in real implementation, this would use IPC or file watching)
        const newOutputs = this.pollComposerOutput(sessionId);
        outputs.push(...newOutputs);

        // Check if response is complete
        if (this.isComposerResponseComplete(outputs)) {
          clearInterval(checkInterval);
          resolve(outputs);
        }
      }, 1000);
    });
  }

  /**
   * Poll Composer for new output
   * @param sessionId Session ID
   * @returns New outputs
   */
  private pollComposerOutput(sessionId: string): CursorOutput[] {
    // In real implementation, this would read from Cursor's output channel
    // or a shared file/socket
    void sessionId;
    return [];
  }

  /**
   * Check if Composer response is complete
   * @param outputs Current outputs
   * @returns True if complete
   */
  private isComposerResponseComplete(outputs: CursorOutput[]): boolean {
    // Check for completion indicators
    const lastOutput = outputs[outputs.length - 1];
    
    if (!lastOutput) return false;

    // Look for completion markers
    const completionMarkers = [
      'Done!',
      'Completed successfully',
      'All changes applied',
    ];

    return completionMarkers.some(marker => 
      lastOutput.content.includes(marker)
    );
  }

  // ============================================================================
  // OUTPUT READING
  // ============================================================================

  /**
   * Read Cursor output
   * @param sessionId Session ID (optional)
   * @returns Cursor outputs
   */
  async readCursorOutput(sessionId?: string): Promise<CursorOutput[]> {
    if (sessionId) {
      // Return outputs for specific session
      return this.outputBuffer.filter(o => 
        o.timestamp >= (this.activeSessions.get(sessionId)?.createdAt || new Date(0))
      );
    }

    return [...this.outputBuffer];
  }

  /**
   * Clear output buffer
   */
  clearOutputBuffer(): void {
    this.outputBuffer = [];
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Open project in Cursor
   * @param projectPath Project path
   */
  private async openProject(projectPath: string): Promise<void> {
    await this.executeCursorCommand({
      type: 'openFile',
      args: { path: projectPath },
      commandId: `cmd-${Date.now()}`,
      priority: 'high',
    });
  }

  /**
   * Execute a Cursor command
   * @param command Cursor command
   */
  private async executeCursorCommand(command: CursorCommand): Promise<void> {
    // In real implementation, this would use VSCode extension API
    // or command-line interface
    this.emit('cursor:command', command);
  }

  /**
   * Format prompt for Composer
   * @param payload Handoff payload
   * @returns Formatted prompt
   */
  private formatPromptForComposer(payload: HandoffPayload): string {
    const sections: string[] = [
      `# ${payload.phase.toUpperCase()} Phase`,
      '',
      payload.prompt,
      '',
    ];

    if (payload.files && payload.files.length > 0) {
      sections.push('## Related Files');
      sections.push('');
      for (const file of payload.files) {
        sections.push(`- ${file.path}`);
      }
      sections.push('');
    }

    if (payload.expectedOutputs && payload.expectedOutputs.length > 0) {
      sections.push('## Expected Outputs');
      sections.push('');
      for (const output of payload.expectedOutputs) {
        sections.push(`- ${output.type}: ${output.description}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Parse Composer response
   * @param outputs Cursor outputs
   * @returns File edits
   */
  private parseComposerResponse(outputs: CursorOutput[]): CursorFileEdit[] {
    const edits: CursorFileEdit[] = [];

    for (const output of outputs) {
      if (output.type === 'edit' && output.file) {
        edits.push({
          path: output.file,
          editType: 'modify',
          diff: output.diff || '',
        });
      }
    }

    return edits;
  }

  /**
   * Extract artifacts from edits
   * @param edits File edits
   * @returns Execution artifacts
   */
  private extractArtifacts(edits: CursorFileEdit[]): ExecutionArtifact[] {
    return edits.map(edit => ({
      type: 'file',
      path: edit.path,
      mimeType: this.getMimeType(edit.path),
    }));
  }

  /**
   * Summarize changes
   * @param edits File edits
   * @returns Change summary
   */
  private summarizeChanges(edits: CursorFileEdit[]): ExecutionResult['changes'] {
    const summary: ExecutionResult['changes'] = {
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
      linesAdded: 0,
      linesRemoved: 0,
      testsAdded: 0,
      testsModified: 0,
    };

    for (const edit of edits) {
      switch (edit.editType) {
        case 'create':
          summary.filesCreated.push(edit.path);
          break;
        case 'modify':
          summary.filesModified.push(edit.path);
          if (edit.diff) {
            const { added, removed } = this.countDiffLines(edit.diff);
            summary.linesAdded += added;
            summary.linesRemoved += removed;
          }
          break;
        case 'delete':
          summary.filesDeleted.push(edit.path);
          break;
      }

      // Check if test file
      if (edit.path.includes('.test.') || edit.path.includes('.spec.')) {
        if (edit.editType === 'create') {
          summary.testsAdded++;
        } else if (edit.editType === 'modify') {
          summary.testsModified++;
        }
      }
    }

    return summary;
  }

  /**
   * Count lines in diff
   * @param diff Diff string
   * @returns Line counts
   */
  private countDiffLines(diff: string): { added: number; removed: number } {
    const lines = diff.split('\n');
    let added = 0;
    let removed = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
      }
    }

    return { added, removed };
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
      rs: 'text/x-rust',
      go: 'text/x-go',
    };

    return mimeTypes[ext || ''] || 'text/plain';
  }

  /**
   * Create error result
   * @param payload Handoff payload
   * @param startTime Start timestamp
   * @param error Error object
   * @returns Error execution result
   */
  private createErrorResult(
    payload: HandoffPayload,
    startTime: number,
    error: Error
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
        command: 'cursor',
      },
      error: {
        type: 'runtime',
        message: error.message,
        stack: error.stack,
      },
    };
  }

  // ============================================================================
  // GETTERS AND SETTERS
  // ============================================================================

  /**
   * Get Cursor configuration
   * @returns Current configuration
   */
  getConfig(): CursorConfig {
    return { ...this.config };
  }

  /**
   * Update Cursor configuration
   * @param config Partial configuration update
   */
  updateConfig(config: Partial<CursorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get active Composer sessions
   * @returns Array of active sessions
   */
  getActiveSessions(): ComposerSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Close a Composer session
   * @param sessionId Session ID
   */
  closeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    
    if (session) {
      session.state = 'completed';
      this.activeSessions.delete(sessionId);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalIntegration: CursorIntegration | null = null;

/**
 * Get the global Cursor integration instance
 * @returns CursorIntegration singleton
 */
export function getCursorIntegration(config?: Partial<CursorConfig>): CursorIntegration {
  if (!globalIntegration) {
    globalIntegration = new CursorIntegration(config);
  }
  return globalIntegration;
}

/**
 * Reset the global integration (useful for testing)
 */
export function resetCursorIntegration(): void {
  globalIntegration = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CursorIntegration;
