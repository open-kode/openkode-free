/**
 * Handoff Protocol - Standardized Agent Handoff Interface
 * 
 * Provides standardized handoff mechanisms for AI coding agents including:
 * - Environment variable injection for context passing
 * - Markdown spec format standardization
 * - Two-way communication protocol
 */

import { EventEmitter } from 'events';
import { AgentConfig } from './agentRegistry';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Phase types in the OpenKode workflow
 */
export type PhaseType = 
  | 'discovery' 
  | 'strategy' 
  | 'blueprint' 
  | 'execution' 
  | 'verification' 
  | 'delivery';

/**
 * Handoff payload - Standardized data passed to agents
 */
export interface HandoffPayload {
  /** Unique handoff identifier */
  handoffId: string;
  /** Phase being handed off */
  phase: PhaseType;
  /** Target agent configuration */
  targetAgent: AgentConfig;
  /** Source agent (if applicable) */
  sourceAgent?: AgentConfig;
  /** Prompt/instruction for the agent */
  prompt: string;
  /** Context data */
  context: HandoffContext;
  /** Files to include */
  files?: HandoffFile[];
  /** Expected outputs */
  expectedOutputs?: ExpectedOutput[];
  /** Handoff metadata */
  metadata: HandoffMetadata;
}

/**
 * Handoff context data
 */
export interface HandoffContext {
  /** Project root directory */
  projectRoot: string;
  /** Current working directory */
  workingDirectory: string;
  /** Phase-specific context */
  phaseContext: PhaseContext;
  /** Previous phase results */
  previousResults?: PreviousPhaseResult[];
  /** Environment variables */
  envVars: Record<string, string>;
  /** Session ID */
  sessionId: string;
  /** User preferences */
  userPreferences?: UserPreferences;
}

/**
 * Phase-specific context
 */
export interface PhaseContext {
  /** Phase type */
  phase: PhaseType;
  /** Phase-specific data */
  data: Record<string, unknown>;
  /** Requirements for this phase */
  requirements?: string[];
  /** Constraints for this phase */
  constraints?: string[];
  /** Success criteria */
  successCriteria?: string[];
}

/**
 * Previous phase result
 */
export interface PreviousPhaseResult {
  /** Phase type */
  phase: PhaseType;
  /** Result status */
  status: 'success' | 'partial' | 'failure';
  /** Output artifacts */
  artifacts: string[];
  /** Summary of results */
  summary: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * User preferences
 */
export interface UserPreferences {
  /** Preferred coding style */
  codingStyle?: string;
  /** Test framework preference */
  testFramework?: string;
  /** Documentation level */
  documentationLevel?: 'minimal' | 'standard' | 'comprehensive';
  /** Code review preferences */
  codeReviewEnabled?: boolean;
  /** Auto-commit preference */
  autoCommit?: boolean;
}

/**
 * File reference in handoff
 */
export interface HandoffFile {
  /** File path (relative to project root) */
  path: string;
  /** File content (optional, for small files) */
  content?: string;
  /** File hash for verification */
  hash?: string;
  /** File metadata */
  metadata?: {
    size?: number;
    lastModified?: Date;
    language?: string;
  };
  /** Include mode */
  includeMode: 'full' | 'reference' | 'summary';
}

/**
 * Expected output specification
 */
export interface ExpectedOutput {
  /** Output type */
  type: 'file' | 'directory' | 'json' | 'markdown' | 'test' | 'command';
  /** Expected path */
  path?: string;
  /** Description */
  description: string;
  /** Required fields (for JSON) */
  requiredFields?: string[];
  /** Validation schema */
  validationSchema?: Record<string, unknown>;
}

/**
 * Handoff metadata
 */
export interface HandoffMetadata {
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp */
  expiresAt?: Date;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Retry count */
  retryCount: number;
  /** Maximum retries */
  maxRetries: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Tags */
  tags: string[];
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Execution result from agent
 */
export interface ExecutionResult {
  /** Handoff ID */
  handoffId: string;
  /** Execution status */
  status: 'success' | 'partial' | 'failure' | 'timeout' | 'cancelled';
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Output artifacts */
  artifacts: ExecutionArtifact[];
  /** Changes made */
  changes: ChangeSummary;
  /** Execution metadata */
  metadata: ExecutionMetadata;
  /** Error details (if failure) */
  error?: ExecutionError;
  /** Vibe result (when using VibeEngine) */
  result?: unknown;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * Execution artifact
 */
export interface ExecutionArtifact {
  /** Artifact type */
  type: 'file' | 'directory' | 'log' | 'report';
  /** Artifact path */
  path: string;
  /** Artifact content (for small artifacts) */
  content?: string;
  /** Artifact size */
  size?: number;
  /** MIME type */
  mimeType?: string;
}

/**
 * Change summary
 */
export interface ChangeSummary {
  /** Files created */
  filesCreated: string[];
  /** Files modified */
  filesModified: string[];
  /** Files deleted */
  filesDeleted: string[];
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
  /** Tests added */
  testsAdded: number;
  /** Tests modified */
  testsModified: number;
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  /** Start timestamp */
  startedAt: Date;
  /** End timestamp */
  endedAt: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Agent used */
  agentId: string;
  /** Command executed */
  command: string;
  /** Resource usage */
  resources?: ResourceUsage;
}

/**
 * Resource usage statistics
 */
export interface ResourceUsage {
  /** CPU usage percentage */
  cpuPercent?: number;
  /** Memory usage in MB */
  memoryMb?: number;
  /** Disk I/O */
  diskIo?: {
    readBytes: number;
    writeBytes: number;
  };
}

/**
 * Execution error details
 */
export interface ExecutionError {
  /** Error type */
  type: 'parse' | 'runtime' | 'timeout' | 'validation' | 'unknown';
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Suggested fixes */
  suggestedFixes?: string[];
}

/**
 * Environment variable mapping for OpenKode
 */
export interface OpenKodeEnvVars {
  /** Session ID */
  TRAYCER_SESSION_ID: string;
  /** Phase ID */
  TRAYCER_PHASE_ID: string;
  /** Handoff ID */
  TRAYCER_HANDOFF_ID: string;
  /** Project root */
  TRAYCER_PROJECT_ROOT: string;
  /** Working directory */
  TRAYCER_WORKING_DIR: string;
  /** Prompt content */
  TRAYCER_PROMPT: string;
  /** Expected outputs (JSON) */
  TRAYCER_EXPECTED_OUTPUTS?: string;
  /** Context data (JSON) */
  TRAYCER_CONTEXT?: string;
  /** User preferences (JSON) */
  TRAYCER_USER_PREFS?: string;
  /** Previous results (JSON) */
  TRAYCER_PREVIOUS_RESULTS?: string;
  /** Timeout in seconds */
  TRAYCER_TIMEOUT_SEC?: string;
  /** Priority level */
  TRAYCER_PRIORITY?: string;
  /** Debug mode */
  TRAYCER_DEBUG?: string;
}

/**
 * Handoff options
 */
export interface HandoffOptions {
  /** Skip validation */
  skipValidation?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Custom timeout override */
  timeoutMs?: number;
  /** Additional environment variables */
  additionalEnvVars?: Record<string, string>;
  /** Callback for progress updates */
  onProgress?: (progress: HandoffProgress) => void;
}

/**
 * Handoff progress update
 */
export interface HandoffProgress {
  /** Progress percentage (0-100) */
  percent: number;
  /** Current stage */
  stage: 'preparing' | 'executing' | 'parsing' | 'completing';
  /** Status message */
  message: string;
  /** Current artifact being processed */
  currentArtifact?: string;
}

/**
 * Markdown spec format for handoff
 */
export interface MarkdownSpec {
  /** Document title */
  title: string;
  /** Document version */
  version: string;
  /** Frontmatter data */
  frontmatter: Record<string, unknown>;
  /** Sections */
  sections: MarkdownSection[];
  /** Code blocks */
  codeBlocks: CodeBlock[];
}

/**
 * Markdown section
 */
export interface MarkdownSection {
  /** Section level (1-6) */
  level: number;
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Subsections */
  subsections?: MarkdownSection[];
}

/**
 * Code block in markdown
 */
export interface CodeBlock {
  /** Language identifier */
  language: string;
  /** Code content */
  code: string;
  /** Block metadata */
  metadata?: {
    filename?: string;
    executable?: boolean;
    expectedOutput?: string;
  };
}

// ============================================================================
// HANDOFF PROTOCOL CLASS
// ============================================================================

/**
 * Handoff Protocol - Manages standardized agent handoffs
 */
export class HandoffProtocol extends EventEmitter {
  private activeHandoffs: Map<string, HandoffPayload> = new Map();
  private handoffResults: Map<string, ExecutionResult> = new Map();

  /**
   * Prepare a handoff payload
   * @param config Handoff configuration
   * @returns Prepared handoff payload
   */
  prepareHandoff(config: {
    phase: PhaseType;
    targetAgent: AgentConfig;
    prompt: string;
    context: Omit<HandoffContext, 'envVars'>;
    files?: HandoffFile[];
    expectedOutputs?: ExpectedOutput[];
    options?: HandoffOptions;
  }): HandoffPayload {
    const handoffId = this.generateHandoffId();
    
    const payload: HandoffPayload = {
      handoffId,
      phase: config.phase,
      targetAgent: config.targetAgent,
      prompt: config.prompt,
      context: {
        ...config.context,
        envVars: this.buildEnvVars(handoffId, config),
      },
      files: config.files || [],
      expectedOutputs: config.expectedOutputs || [],
      metadata: {
        createdAt: new Date(),
        priority: 'medium',
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: config.targetAgent.execution.timeoutMs,
        tags: [config.phase, config.targetAgent.type],
      },
    };

    this.activeHandoffs.set(handoffId, payload);
    this.emit('handoff:prepared', { handoffId, payload });

    return payload;
  }

  /**
   * Build environment variables for handoff
   * @param handoffId Handoff ID
   * @param config Handoff configuration
   * @returns Environment variables
   */
  private buildEnvVars(
    handoffId: string,
    config: {
      phase: PhaseType;
      targetAgent: AgentConfig;
      prompt: string;
      context: Omit<HandoffContext, 'envVars'>;
      files?: HandoffFile[];
      expectedOutputs?: ExpectedOutput[];
      options?: HandoffOptions;
    }
  ): Record<string, string> {
    const envVars: Record<string, string> = {
      TRAYCER_SESSION_ID: config.context.sessionId,
      TRAYCER_PHASE_ID: config.phase,
      TRAYCER_HANDOFF_ID: handoffId,
      TRAYCER_PROJECT_ROOT: config.context.projectRoot,
      TRAYCER_WORKING_DIR: config.context.workingDirectory,
      TRAYCER_PROMPT: config.prompt,
      TRAYCER_TIMEOUT_SEC: String(
        Math.floor((config.options?.timeoutMs || config.targetAgent.execution.timeoutMs) / 1000)
      ),
      TRAYCER_PRIORITY: 'medium',
    };

    // Add optional JSON-encoded variables
    if (config.expectedOutputs && config.expectedOutputs.length > 0) {
      envVars.TRAYCER_EXPECTED_OUTPUTS = JSON.stringify(config.expectedOutputs);
    }

    if (config.context.phaseContext) {
      envVars.TRAYCER_CONTEXT = JSON.stringify(config.context.phaseContext);
    }

    if (config.context.userPreferences) {
      envVars.TRAYCER_USER_PREFS = JSON.stringify(config.context.userPreferences);
    }

    if (config.context.previousResults && config.context.previousResults.length > 0) {
      envVars.TRAYCER_PREVIOUS_RESULTS = JSON.stringify(config.context.previousResults);
    }

    // Merge with additional env vars from options
    if (config.options?.additionalEnvVars) {
      Object.assign(envVars, config.options.additionalEnvVars);
    }

    // Merge with agent-specific env vars
    Object.assign(envVars, config.targetAgent.execution.envVars);

    return envVars as Record<string, string>;
  }

  /**
   * Execute a handoff to an agent
   * @param payload Handoff payload
   * @param options Handoff options
   * @returns Execution result
   */
  async executeHandoff(
    payload: HandoffPayload,
    options: HandoffOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    this.emit('handoff:started', { handoffId: payload.handoffId });

    if (options.onProgress) {
      options.onProgress({
        percent: 0,
        stage: 'preparing',
        message: 'Preparing handoff execution...',
      });
    }

    try {
      // Validate payload if not skipped
      if (!options.skipValidation) {
        this.validatePayload(payload);
      }

      // Dry run mode - return mock result
      if (options.dryRun) {
        return this.createDryRunResult(payload, startTime);
      }

      if (options.onProgress) {
        options.onProgress({
          percent: 25,
          stage: 'executing',
          message: `Executing with ${payload.targetAgent.name}...`,
        });
      }

      // Execute based on agent type
      const result = await this.executeWithAgent(payload, options);

      if (options.onProgress) {
        options.onProgress({
          percent: 75,
          stage: 'parsing',
          message: 'Parsing execution results...',
        });
      }

      // Store result
      this.handoffResults.set(payload.handoffId, result);
      this.activeHandoffs.delete(payload.handoffId);

      if (options.onProgress) {
        options.onProgress({
          percent: 100,
          stage: 'completing',
          message: 'Handoff completed',
        });
      }

      this.emit('handoff:completed', { handoffId: payload.handoffId, result });

      return result;
    } catch (error) {
      const failedResult = this.createErrorResult(
        payload,
        startTime,
        error instanceof Error ? error : new Error(String(error))
      );

      this.handoffResults.set(payload.handoffId, failedResult);
      this.activeHandoffs.delete(payload.handoffId);

      this.emit('handoff:failed', { handoffId: payload.handoffId, error, result: failedResult });

      return failedResult;
    }
  }

  /**
   * Execute handoff with specific agent
   * @param payload Handoff payload
   * @param options Handoff options
   * @returns Execution result
   */
  private async executeWithAgent(
    payload: HandoffPayload,
    options: HandoffOptions
  ): Promise<ExecutionResult> {
    const { spawn } = await import('child_process');
    
    const agent = payload.targetAgent;
    const timeoutMs = options.timeoutMs || agent.execution.timeoutMs;

    // Build command
    const command = agent.execution.command;
    const args = [...agent.execution.args];

    // Add prompt as argument if supported
    if (agent.type === 'claude-code' || agent.type === 'aider') {
      args.push('--message', payload.prompt);
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const child = spawn(command, args, {
        cwd: payload.context.workingDirectory,
        env: { ...process.env, ...payload.context.envVars },
        shell: agent.execution.shell,
        timeout: timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const endTime = Date.now();
        
        const result: ExecutionResult = {
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
            agentId: agent.id,
            command: `${command} ${args.join(' ')}`,
          },
        };

        resolve(result);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Receive results from an external agent
   * @param handoffId Handoff ID
   * @param result Execution result
   */
  receiveResults(handoffId: string, result: ExecutionResult): void {
    this.handoffResults.set(handoffId, result);
    this.activeHandoffs.delete(handoffId);

    this.emit('handoff:received', { handoffId, result });
  }

  /**
   * Get handoff result
   * @param handoffId Handoff ID
   * @returns Execution result or undefined
   */
  getResult(handoffId: string): ExecutionResult | undefined {
    return this.handoffResults.get(handoffId);
  }

  /**
   * Get active handoff
   * @param handoffId Handoff ID
   * @returns Handoff payload or undefined
   */
  getActiveHandoff(handoffId: string): HandoffPayload | undefined {
    return this.activeHandoffs.get(handoffId);
  }

  /**
   * List all active handoffs
   * @returns Array of active handoff payloads
   */
  listActiveHandoffs(): HandoffPayload[] {
    return Array.from(this.activeHandoffs.values());
  }

  /**
   * Cancel an active handoff
   * @param handoffId Handoff ID
   * @returns True if cancelled
   */
  cancelHandoff(handoffId: string): boolean {
    const handoff = this.activeHandoffs.get(handoffId);
    
    if (handoff) {
      this.activeHandoffs.delete(handoffId);
      
      const cancelledResult: ExecutionResult = {
        handoffId,
        status: 'cancelled',
        exitCode: -1,
        stdout: '',
        stderr: 'Handoff cancelled by user',
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
          startedAt: new Date(),
          endedAt: new Date(),
          durationMs: 0,
          agentId: handoff.targetAgent.id,
          command: '',
        },
      };

      this.handoffResults.set(handoffId, cancelledResult);
      this.emit('handoff:cancelled', { handoffId });

      return true;
    }

    return false;
  }

  /**
   * Convert handoff payload to Markdown spec
   * @param payload Handoff payload
   * @returns Markdown specification
   */
  toMarkdownSpec(payload: HandoffPayload): MarkdownSpec {
    const sections: MarkdownSection[] = [
      {
        level: 1,
        title: 'Handoff Specification',
        content: `Phase: ${payload.phase}\nAgent: ${payload.targetAgent.name}`,
      },
      {
        level: 2,
        title: 'Context',
        content: this.formatContextForMarkdown(payload.context),
      },
      {
        level: 2,
        title: 'Instructions',
        content: payload.prompt,
      },
    ];

    if (payload.expectedOutputs && payload.expectedOutputs.length > 0) {
      sections.push({
        level: 2,
        title: 'Expected Outputs',
        content: payload.expectedOutputs
          .map(o => `- **${o.type}**: ${o.description}${o.path ? ` (${o.path})` : ''}`)
          .join('\n'),
      });
    }

    return {
      title: `OpenKode Handoff - ${payload.phase}`,
      version: '1.0.0',
      frontmatter: {
        handoffId: payload.handoffId,
        phase: payload.phase,
        agent: payload.targetAgent.id,
        createdAt: payload.metadata.createdAt.toISOString(),
      },
      sections,
      codeBlocks: [],
    };
  }

  /**
   * Parse Markdown spec to handoff payload
   * @param markdown Markdown content
   * @returns Partial handoff payload
   */
  parseMarkdownSpec(markdown: string): Partial<HandoffPayload> {
    // Extract frontmatter
    const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter: Record<string, unknown> = frontmatterMatch
      ? this.parseYaml(frontmatterMatch[1])
      : {};

    // Extract sections
    const sections = this.extractSections(markdown);

    // Find instructions section
    const instructionsSection = sections.find(s => 
      s.title.toLowerCase().includes('instructions') || 
      s.title.toLowerCase().includes('prompt')
    );

    return {
      handoffId: frontmatter.handoffId as string || this.generateHandoffId(),
      phase: (frontmatter.phase as PhaseType) || 'execution',
      prompt: instructionsSection?.content || '',
      metadata: {
        createdAt: frontmatter.createdAt 
          ? new Date(frontmatter.createdAt as string) 
          : new Date(),
        priority: 'medium',
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: 300000,
        tags: [],
      },
    };
  }

  /**
   * Validate handoff payload
   * @param payload Handoff payload
   */
  private validatePayload(payload: HandoffPayload): void {
    if (!payload.handoffId) {
      throw new Error('Handoff ID is required');
    }

    if (!payload.targetAgent) {
      throw new Error('Target agent is required');
    }

    if (!payload.prompt || payload.prompt.trim() === '') {
      throw new Error('Prompt is required');
    }

    if (!payload.context?.projectRoot) {
      throw new Error('Project root is required in context');
    }

    if (!payload.context?.sessionId) {
      throw new Error('Session ID is required in context');
    }
  }

  /**
   * Generate unique handoff ID
   * @returns Handoff ID
   */
  private generateHandoffId(): string {
    return `handoff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create dry run result
   * @param payload Handoff payload
   * @param startTime Start timestamp
   * @returns Mock execution result
   */
  private createDryRunResult(payload: HandoffPayload, startTime: number): ExecutionResult {
    const endTime = Date.now();

    return {
      handoffId: payload.handoffId,
      status: 'success',
      exitCode: 0,
      stdout: '[DRY RUN] Handoff would execute with:\n' +
        `Agent: ${payload.targetAgent.name}\n` +
        `Command: ${payload.targetAgent.execution.command}\n` +
        `Working Directory: ${payload.context.workingDirectory}`,
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
        command: `${payload.targetAgent.execution.command} [DRY RUN]`,
      },
    };
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
        command: payload.targetAgent.execution.command,
      },
      error: {
        type: 'unknown',
        message: error.message,
        stack: error.stack,
      },
    };
  }

  /**
   * Format context for markdown
   * @param context Handoff context
   * @returns Formatted context string
   */
  private formatContextForMarkdown(context: HandoffContext): string {
    return `
- **Project Root**: ${context.projectRoot}
- **Working Directory**: ${context.workingDirectory}
- **Session ID**: ${context.sessionId}
- **Phase**: ${context.phaseContext.phase}
`.trim();
  }

  /**
   * Parse YAML frontmatter
   * @param yaml YAML content
   * @returns Parsed object
   */
  private parseYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const line of yaml.split('\n')) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Extract sections from markdown
   * @param markdown Markdown content
   * @returns Array of sections
   */
  private extractSections(markdown: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const lines = markdown.split('\n');
    
    let currentSection: MarkdownSection | null = null;
    let contentLines: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = contentLines.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          level: headerMatch[1].length,
          title: headerMatch[2],
          content: '',
        };
        contentLines = [];
      } else if (currentSection) {
        contentLines.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = contentLines.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalProtocol: HandoffProtocol | null = null;

/**
 * Get the global handoff protocol instance
 * @returns HandoffProtocol singleton
 */
export function getHandoffProtocol(): HandoffProtocol {
  if (!globalProtocol) {
    globalProtocol = new HandoffProtocol();
  }
  return globalProtocol;
}

/**
 * Reset the global protocol (useful for testing)
 */
export function resetHandoffProtocol(): void {
  globalProtocol = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default HandoffProtocol;
