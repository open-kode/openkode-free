/**
 * Custom Agent - Custom CLI Agent Support
 * 
 * Provides support for custom CLI agents including:
 * - Template system for custom agents
 * - Shell script execution
 * - Flag configuration (--dangerous, --force, etc.)
 * - Configuration validation
 */

import { EventEmitter } from 'events';
import { AgentConfig, AgentCapabilities, AgentExecutionConfig } from './agentRegistry';
import { HandoffPayload, ExecutionResult } from './handoffProtocol';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Custom agent template
 */
export interface CustomAgentTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Base agent configuration */
  baseConfig: Partial<AgentConfig>;
  /** Template variables */
  variables: TemplateVariable[];
  /** Command template */
  commandTemplate: CommandTemplate;
  /** Flag definitions */
  flags: FlagDefinition[];
  /** Validation rules */
  validationRules: ValidationRule[];
  /** Pre-execution hooks */
  preExecutionHooks?: HookFunction[];
  /** Post-execution hooks */
  postExecutionHooks?: HookFunction[];
}

/**
 * Template variable
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable description */
  description: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'path';
  /** Default value */
  defaultValue?: unknown;
  /** Required */
  required: boolean;
  /** Validation pattern (for strings) */
  pattern?: string;
  /** Allowed values */
  enum?: unknown[];
  /** Environment variable to read from */
  envVar?: string;
}

/**
 * Command template
 */
export interface CommandTemplate {
  /** Base command */
  baseCommand: string;
  /** Argument templates */
  argTemplates: ArgTemplate[];
  /** Environment variable templates */
  envVarTemplates: Record<string, string>;
  /** Working directory template */
  workingDirTemplate?: string;
}

/**
 * Argument template
 */
export interface ArgTemplate {
  /** Argument template */
  template: string;
  /** Condition for inclusion */
  condition?: string;
  /** Position */
  position: number;
}

/**
 * Flag definition
 */
export interface FlagDefinition {
  /** Flag name */
  name: string;
  /** Flag short form (e.g., -f) */
  shortForm?: string;
  /** Flag description */
  description: string;
  /** Flag type */
  type: 'boolean' | 'string' | 'number' | 'array';
  /** Default value */
  defaultValue?: unknown;
  /** Dangerous flag (requires confirmation) */
  dangerous: boolean;
  /** Category */
  category: 'safety' | 'behavior' | 'output' | 'input' | 'advanced';
  /** Mutually exclusive with other flags */
  mutuallyExclusive?: string[];
  /** Requires other flags */
  requires?: string[];
}

/**
 * Validation rule
 */
export interface ValidationRule {
  /** Rule type */
  type: 'required' | 'pattern' | 'range' | 'custom';
  /** Field to validate */
  field: string;
  /** Error message */
  message: string;
  /** Pattern (for pattern type) */
  pattern?: RegExp;
  /** Min value (for range type) */
  min?: number;
  /** Max value (for range type) */
  max?: number;
  /** Custom validator function */
  validator?: (value: unknown) => boolean;
}

/**
 * Hook function
 */
export type HookFunction = (
  context: HookContext
) => Promise<void> | void;

/**
 * Hook context
 */
export interface HookContext {
  /** Agent configuration */
  agentConfig: AgentConfig;
  /** Handoff payload */
  payload?: HandoffPayload;
  /** Execution result */
  result?: ExecutionResult;
  /** Variables */
  variables: Record<string, unknown>;
  /** Utilities */
  utils: {
    log: (message: string) => void;
    exec: (command: string) => Promise<string>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  };
}

/**
 * Custom agent configuration
 */
export interface CustomAgentConfig {
  /** Agent ID */
  id: string;
  /** Agent name */
  name: string;
  /** Agent description */
  description: string;
  /** Template ID (if using template) */
  templateId?: string;
  /** Custom command configuration */
  command?: CustomCommandConfig;
  /** Flag values */
  flags: Record<string, unknown>;
  /** Variable values */
  variables: Record<string, unknown>;
  /** Capabilities */
  capabilities: Partial<AgentCapabilities>;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Shell to use */
  shell?: string;
}

/**
 * Custom command configuration
 */
export interface CustomCommandConfig {
  /** Command to execute */
  command: string;
  /** Arguments */
  args: string[];
  /** Environment variables */
  envVars: Record<string, string>;
  /** Working directory */
  workingDirectory?: string;
}

/**
 * Shell script configuration
 */
export interface ShellScriptConfig {
  /** Script content */
  script: string;
  /** Script interpreter */
  interpreter: 'bash' | 'sh' | 'zsh' | 'powershell' | 'python' | 'node';
  /** Script arguments */
  args: string[];
  /** Environment variables */
  envVars: Record<string, string>;
  /** Working directory */
  workingDirectory?: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Execution options for custom agents
 */
export interface CustomAgentExecutionOptions {
  /** Confirm dangerous operations */
  confirmDangerous?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Capture output */
  captureOutput?: boolean;
  /** Stream output */
  streamOutput?: boolean;
  /** Custom timeout override */
  timeoutMs?: number;
  /** Additional environment variables */
  additionalEnvVars?: Record<string, string>;
  /** Callback for progress */
  onProgress?: (progress: CustomAgentProgress) => void;
}

/**
 * Custom agent progress
 */
export interface CustomAgentProgress {
  /** Progress stage */
  stage: 'validating' | 'preparing' | 'executing' | 'processing' | 'completing';
  /** Progress percentage (0-100) */
  percent: number;
  /** Status message */
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Field with error */
  field: string;
  /** Error message */
  message: string;
  /** Rule that failed */
  rule: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Field with warning */
  field: string;
  /** Warning message */
  message: string;
  /** Suggested action */
  suggestion?: string;
}

// ============================================================================
// BUILT-IN TEMPLATES
// ============================================================================

/**
 * Aider template
 */
export const AIDER_TEMPLATE: CustomAgentTemplate = {
  id: 'aider',
  name: 'Aider Template',
  description: 'Template for Aider AI pair programming',
  baseConfig: {
    type: 'custom',
    execution: {
      command: 'aider',
      args: ['--no-pretty', '--yes'],
      envVars: {},
      timeoutMs: 600000,
    },
    capabilities: {
      multiFileEdit: true,
      terminalAccess: true,
      webSearch: false,
      codeIndexing: false,
      gitIntegration: true,
      testExecution: true,
      lspSupport: false,
      contextWindow: 128000,
      streamingSupport: false,
      fileCreation: true,
      fileDeletion: true,
    },
  },
  variables: [
    {
      name: 'model',
      description: 'AI model to use',
      type: 'string',
      defaultValue: 'claude-3-5-sonnet',
      required: false,
      enum: ['claude-3-5-sonnet', 'claude-3-opus', 'gpt-4', 'gpt-4o'],
    },
    {
      name: 'apiKey',
      description: 'API key for the model',
      type: 'string',
      required: false,
      envVar: 'ANTHROPIC_API_KEY',
    },
  ],
  commandTemplate: {
    baseCommand: 'aider',
    argTemplates: [
      { template: '--model {{model}}', position: 0, condition: 'model' },
      { template: '--message "{{message}}"', position: 1 },
    ],
    envVarTemplates: {
      ANTHROPIC_API_KEY: '{{apiKey}}',
    },
  },
  flags: [
    {
      name: 'dangerous-auto-accept',
      shortForm: '-d',
      description: 'Automatically accept all changes without confirmation',
      type: 'boolean',
      defaultValue: false,
      dangerous: true,
      category: 'safety',
    },
    {
      name: 'no-pretty',
      description: 'Disable pretty output formatting',
      type: 'boolean',
      defaultValue: true,
      dangerous: false,
      category: 'output',
    },
    {
      name: 'yes',
      shortForm: '-y',
      description: 'Answer yes to all prompts',
      type: 'boolean',
      defaultValue: true,
      dangerous: false,
      category: 'behavior',
    },
  ],
  validationRules: [
    {
      type: 'required',
      field: 'message',
      message: 'Message is required for Aider',
    },
  ],
};

/**
 * Generic shell script template
 */
export const SHELL_SCRIPT_TEMPLATE: CustomAgentTemplate = {
  id: 'shell-script',
  name: 'Shell Script Template',
  description: 'Template for executing custom shell scripts',
  baseConfig: {
    type: 'custom',
    execution: {
      command: 'bash',
      args: [],
      envVars: {},
      timeoutMs: 300000,
    },
    capabilities: {
      multiFileEdit: true,
      terminalAccess: true,
      webSearch: false,
      codeIndexing: false,
      gitIntegration: false,
      testExecution: true,
      lspSupport: false,
      contextWindow: 0,
      streamingSupport: true,
      fileCreation: true,
      fileDeletion: true,
    },
  },
  variables: [
    {
      name: 'script',
      description: 'Shell script content or path',
      type: 'string',
      required: true,
    },
    {
      name: 'interpreter',
      description: 'Script interpreter',
      type: 'string',
      defaultValue: 'bash',
      required: false,
      enum: ['bash', 'sh', 'zsh', 'powershell'],
    },
    {
      name: 'args',
      description: 'Script arguments',
      type: 'array',
      defaultValue: [],
      required: false,
    },
  ],
  commandTemplate: {
    baseCommand: '{{interpreter}}',
    argTemplates: [
      { template: '{{script}}', position: 0 },
      { template: '{{args}}', position: 1, condition: 'args' },
    ],
    envVarTemplates: {},
  },
  flags: [
    {
      name: 'force',
      shortForm: '-f',
      description: 'Force execution without checks',
      type: 'boolean',
      defaultValue: false,
      dangerous: true,
      category: 'safety',
    },
    {
      name: 'verbose',
      shortForm: '-v',
      description: 'Enable verbose output',
      type: 'boolean',
      defaultValue: false,
      dangerous: false,
      category: 'output',
    },
  ],
  validationRules: [
    {
      type: 'required',
      field: 'script',
      message: 'Script is required',
    },
  ],
};

/**
 * Python script template
 */
export const PYTHON_SCRIPT_TEMPLATE: CustomAgentTemplate = {
  id: 'python-script',
  name: 'Python Script Template',
  description: 'Template for executing Python scripts',
  baseConfig: {
    type: 'custom',
    execution: {
      command: 'python3',
      args: [],
      envVars: {},
      timeoutMs: 300000,
    },
    capabilities: {
      multiFileEdit: true,
      terminalAccess: true,
      webSearch: false,
      codeIndexing: false,
      gitIntegration: false,
      testExecution: true,
      lspSupport: false,
      contextWindow: 0,
      streamingSupport: true,
      fileCreation: true,
      fileDeletion: true,
    },
  },
  variables: [
    {
      name: 'script',
      description: 'Python script content or path',
      type: 'path',
      required: true,
    },
    {
      name: 'pythonPath',
      description: 'Python executable path',
      type: 'string',
      defaultValue: 'python3',
      required: false,
    },
    {
      name: 'args',
      description: 'Script arguments',
      type: 'array',
      defaultValue: [],
      required: false,
    },
  ],
  commandTemplate: {
    baseCommand: '{{pythonPath}}',
    argTemplates: [
      { template: '{{script}}', position: 0 },
      { template: '{{args}}', position: 1, condition: 'args' },
    ],
    envVarTemplates: {
      PYTHONPATH: '{{workingDirectory}}',
    },
  },
  flags: [
    {
      name: 'unbuffered',
      shortForm: '-u',
      description: 'Run in unbuffered mode',
      type: 'boolean',
      defaultValue: true,
      dangerous: false,
      category: 'behavior',
    },
  ],
  validationRules: [
    {
      type: 'required',
      field: 'script',
      message: 'Script is required',
    },
  ],
};

// ============================================================================
// CUSTOM AGENT CLASS
// ============================================================================

/**
 * Custom Agent - Manages custom CLI agent execution
 */
export class CustomAgent extends EventEmitter {
  private templates: Map<string, CustomAgentTemplate> = new Map();

  constructor() {
    super();
    this.registerBuiltInTemplates();
  }

  /**
   * Register built-in templates
   */
  private registerBuiltInTemplates(): void {
    this.registerTemplate(AIDER_TEMPLATE);
    this.registerTemplate(SHELL_SCRIPT_TEMPLATE);
    this.registerTemplate(PYTHON_SCRIPT_TEMPLATE);
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  /**
   * Define a new template
   * @param template Template definition
   * @returns Registered template
   */
  defineTemplate(template: CustomAgentTemplate): CustomAgentTemplate {
    // Validate template
    this.validateTemplate(template);

    this.templates.set(template.id, template);
    this.emit('template:defined', { templateId: template.id, template });

    return template;
  }

  /**
   * Register a template (alias for defineTemplate)
   * @param template Template definition
   * @returns Registered template
   */
  registerTemplate(template: CustomAgentTemplate): CustomAgentTemplate {
    return this.defineTemplate(template);
  }

  /**
   * Get template by ID
   * @param templateId Template ID
   * @returns Template or undefined
   */
  getTemplate(templateId: string): CustomAgentTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all templates
   * @returns Array of templates
   */
  listTemplates(): CustomAgentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Remove a template
   * @param templateId Template ID
   * @returns True if removed
   */
  removeTemplate(templateId: string): boolean {
    const existed = this.templates.has(templateId);
    
    if (existed) {
      this.templates.delete(templateId);
      this.emit('template:removed', { templateId });
    }

    return existed;
  }

  // ============================================================================
  // AGENT CONFIGURATION
  // ============================================================================

  /**
   * Create agent configuration from template
   * @param templateId Template ID
   * @param config Custom configuration
   * @returns Agent configuration
   */
  createAgentFromTemplate(
    templateId: string,
    config: Partial<CustomAgentConfig>
  ): AgentConfig {
    const template = this.templates.get(templateId);
    
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Build execution config from template
    const executionConfig = this.buildExecutionConfig(template, config);

    // Build capabilities from template and config
    const capabilities = {
      ...template.baseConfig.capabilities,
      ...config.capabilities,
    };

    return {
      id: config.id || `${templateId}-${Date.now()}`,
      type: 'custom',
      name: config.name || template.name,
      description: config.description || template.description,
      version: '1.0.0',
      execution: executionConfig,
      capabilities: capabilities as AgentCapabilities,
      enabled: true,
      priority: 50,
      metadata: {
        templateId,
        flags: config.flags || {},
        variables: config.variables || {},
      },
    };
  }

  /**
   * Build execution configuration from template
   * @param template Template
   * @param config Custom configuration
   * @returns Execution configuration
   */
  private buildExecutionConfig(
    template: CustomAgentTemplate,
    config: Partial<CustomAgentConfig>
  ): AgentExecutionConfig {
    const variables = { ...config.variables };
    const flags = { ...config.flags };

    // Process command template
    let command = template.commandTemplate.baseCommand;
    command = this.interpolateTemplate(command, variables);

    // Process argument templates
    const args: string[] = [];
    const sortedArgs = [...template.commandTemplate.argTemplates].sort(
      (a, b) => a.position - b.position
    );

    for (const argTemplate of sortedArgs) {
      // Check condition
      if (argTemplate.condition && !variables[argTemplate.condition]) {
        continue;
      }

      let arg = this.interpolateTemplate(argTemplate.template, variables);
      
      // Handle array expansion
      if (arg.includes('{{args}}') && Array.isArray(variables.args)) {
        arg = arg.replace('{{args}}', (variables.args as string[]).join(' '));
      }

      args.push(arg);
    }

    // Add flags
    for (const flagDef of template.flags) {
      const flagValue = flags[flagDef.name] ?? flagDef.defaultValue;
      
      if (flagValue !== undefined && flagValue !== false) {
        if (flagDef.type === 'boolean' && flagValue === true) {
          args.push(flagDef.shortForm ? `-${flagDef.shortForm}` : `--${flagDef.name}`);
        } else if (flagDef.type !== 'boolean') {
          args.push(`--${flagDef.name}`, String(flagValue));
        }
      }
    }

    // Process environment variables
    const envVars: Record<string, string> = {};
    for (const [key, envTemplate] of Object.entries(template.commandTemplate.envVarTemplates)) {
      envVars[key] = this.interpolateTemplate(envTemplate, variables);
    }

    return {
      command,
      args,
      envVars,
      timeoutMs: config.timeoutMs || template.baseConfig.execution?.timeoutMs || 300000,
      shell: config.shell || '/bin/bash',
    };
  }

  /**
   * Interpolate template variables
   * @param template Template string
   * @param variables Variable values
   * @returns Interpolated string
   */
  private interpolateTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }

  // ============================================================================
  // EXECUTION
  // ============================================================================

  /**
   * Execute custom agent
   * @param agentConfig Agent configuration
   * @param payload Handoff payload
   * @param options Execution options
   * @returns Execution result
   */
  async executeCustom(
    agentConfig: AgentConfig,
    payload: HandoffPayload,
    options: CustomAgentExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const opts = {
      confirmDangerous: false,
      dryRun: false,
      captureOutput: true,
      streamOutput: true,
      ...options,
    };

    this.emit('custom:executing', { handoffId: payload.handoffId, agentId: agentConfig.id });

    // Validate configuration
    const validation = this.validateConfig(agentConfig);
    
    if (!validation.valid) {
      return this.createValidationErrorResult(
        payload,
        startTime,
        agentConfig,
        validation.errors
      );
    }

    // Check for dangerous flags
    const dangerousFlags = this.getDangerousFlags(agentConfig);
    
    if (dangerousFlags.length > 0 && !opts.confirmDangerous) {
      return this.createDangerousFlagResult(
        payload,
        startTime,
        agentConfig,
        dangerousFlags
      );
    }

    // Run pre-execution hooks
    const template = this.getTemplateFromAgent(agentConfig);
    
    if (template?.preExecutionHooks) {
      for (const hook of template.preExecutionHooks) {
        await hook({
          agentConfig,
          payload,
          variables: {},
          utils: this.createHookUtils(),
        });
      }
    }

    // Execute
    if (opts.dryRun) {
      return this.createDryRunResult(payload, startTime, agentConfig);
    }

    try {
      const result = await this.executeCommand(agentConfig, payload, opts);

      // Run post-execution hooks
      if (template?.postExecutionHooks) {
        for (const hook of template.postExecutionHooks) {
          await hook({
            agentConfig,
            payload,
            result,
            variables: {},
            utils: this.createHookUtils(),
          });
        }
      }

      this.emit('custom:completed', { handoffId: payload.handoffId, result });

      return result;
    } catch (error) {
      const failedResult = this.createErrorResult(
        payload,
        startTime,
        agentConfig,
        error instanceof Error ? error : new Error(String(error))
      );

      this.emit('custom:failed', { handoffId: payload.handoffId, error, result: failedResult });

      return failedResult;
    }
  }

  /**
   * Execute shell script
   * @param config Shell script configuration
   * @param payload Handoff payload
   * @param options Execution options
   * @returns Execution result
   */
  async executeShellScript(
    config: ShellScriptConfig,
    payload: HandoffPayload,
    options: CustomAgentExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const opts = {
      confirmDangerous: false,
      dryRun: false,
      captureOutput: true,
      streamOutput: true,
      ...options,
    };

    const { spawn } = await import('child_process');

    // Determine interpreter
    const interpreters: Record<string, string> = {
      bash: 'bash',
      sh: 'sh',
      zsh: 'zsh',
      powershell: 'powershell',
      python: 'python3',
      node: 'node',
    };

    const interpreter = interpreters[config.interpreter] || config.interpreter;

    // Write script to temp file if needed
    let scriptPath = config.script;
    
    if (config.script.includes('\n') || config.script.includes(' ')) {
      const { writeFile, mkdtemp } = await import('fs/promises');
      const { tmpdir } = await import('os');
      const { join } = await import('path');

      const tempDir = await mkdtemp(join(tmpdir(), 'openkode-'));
      scriptPath = join(tempDir, `script.${config.interpreter}`);
      await writeFile(scriptPath, config.script);
    }

    return new Promise((resolve, reject) => {
      const args = [scriptPath, ...config.args];
      
      const child = spawn(interpreter, args, {
        cwd: config.workingDirectory || payload.context.workingDirectory,
        env: { ...process.env, ...config.envVars, ...payload.context.envVars },
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      if (opts.captureOutput) {
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
          stderr: 'Script execution timed out',
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
            agentId: 'shell-script',
            command: `${interpreter} ${args.join(' ')}`,
          },
        });
      }, config.timeoutMs);

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
            agentId: 'shell-script',
            command: `${interpreter} ${args.join(' ')}`,
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
  // VALIDATION
  // ============================================================================

  /**
   * Validate agent configuration
   * @param config Agent configuration
   * @returns Validation result
   */
  validateConfig(config: AgentConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required fields
    if (!config.id) {
      errors.push({ field: 'id', message: 'Agent ID is required', rule: 'required' });
    }

    if (!config.execution?.command) {
      errors.push({ field: 'execution.command', message: 'Command is required', rule: 'required' });
    }

    if (config.execution?.timeoutMs && config.execution.timeoutMs <= 0) {
      errors.push({ field: 'execution.timeoutMs', message: 'Timeout must be positive', rule: 'range' });
    }

    // Check template-specific rules
    const template = this.getTemplateFromAgent(config);
    
    if (template) {
      for (const rule of template.validationRules) {
        const value = this.getNestedValue(config as unknown as Record<string, unknown>, rule.field);
        
        if (rule.type === 'required' && (value === undefined || value === null || value === '')) {
          errors.push({ field: rule.field, message: rule.message, rule: rule.type });
        }

        if (rule.type === 'pattern' && rule.pattern && typeof value === 'string') {
          if (!rule.pattern.test(value)) {
            errors.push({ field: rule.field, message: rule.message, rule: rule.type });
          }
        }

        if (rule.type === 'range' && typeof value === 'number') {
          if ((rule.min !== undefined && value < rule.min) || 
              (rule.max !== undefined && value > rule.max)) {
            errors.push({ field: rule.field, message: rule.message, rule: rule.type });
          }
        }

        if (rule.type === 'custom' && rule.validator && !rule.validator(value)) {
          errors.push({ field: rule.field, message: rule.message, rule: rule.type });
        }
      }
    }

    // Warn about dangerous flags
    const dangerousFlags = this.getDangerousFlags(config);
    
    if (dangerousFlags.length > 0) {
      warnings.push({
        field: 'flags',
        message: `Dangerous flags enabled: ${dangerousFlags.join(', ')}`,
        suggestion: 'Review these flags before execution',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate template
   * @param template Template to validate
   */
  private validateTemplate(template: CustomAgentTemplate): void {
    if (!template.id) {
      throw new Error('Template ID is required');
    }

    if (!template.commandTemplate?.baseCommand) {
      throw new Error('Command template base command is required');
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get template from agent configuration
   * @param config Agent configuration
   * @returns Template or undefined
   */
  private getTemplateFromAgent(config: AgentConfig): CustomAgentTemplate | undefined {
    const templateId = config.metadata?.templateId as string;
    
    if (templateId) {
      return this.templates.get(templateId);
    }

    return undefined;
  }

  /**
   * Get dangerous flags from agent configuration
   * @param config Agent configuration
   * @returns Array of dangerous flag names
   */
  private getDangerousFlags(config: AgentConfig): string[] {
    const template = this.getTemplateFromAgent(config);
    
    if (!template) return [];

    const dangerous: string[] = [];
    const flags = config.metadata?.flags as Record<string, unknown> || {};

    for (const flagDef of template.flags) {
      if (flagDef.dangerous && flags[flagDef.name] === true) {
        dangerous.push(flagDef.name);
      }
    }

    return dangerous;
  }

  /**
   * Get nested value from object
   * @param obj Object
   * @param path Dot-separated path
   * @returns Value or undefined
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Create hook utilities
   * @returns Hook utilities
   */
  private createHookUtils(): HookContext['utils'] {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const fs = require('fs/promises');

    return {
      log: (message: string) => this.emit('custom:log', { message }),
      exec: (command: string) => execAsync(command),
      readFile: (path: string) => fs.readFile(path, 'utf-8'),
      writeFile: (path: string, content: string) => fs.writeFile(path, content, 'utf-8'),
    };
  }

  /**
   * Execute command for agent
   * @param agentConfig Agent configuration
   * @param payload Handoff payload
   * @param options Execution options
   * @returns Execution result
   */
  private async executeCommand(
    agentConfig: AgentConfig,
    payload: HandoffPayload,
    options: CustomAgentExecutionOptions
  ): Promise<ExecutionResult> {
    const { spawn } = await import('child_process');
    const startTime = Date.now();

    const { command, args, envVars, timeoutMs, shell } = agentConfig.execution;

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: payload.context.workingDirectory,
        env: { ...process.env, ...envVars, ...payload.context.envVars, ...options.additionalEnvVars },
        shell: shell || true,
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
            agentId: agentConfig.id,
            command: `${command} ${args.join(' ')}`,
          },
        });
      }, options.timeoutMs || timeoutMs);

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
            agentId: agentConfig.id,
            command: `${command} ${args.join(' ')}`,
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
  // RESULT CREATORS
  // ============================================================================

  /**
   * Create dry run result
   * @param payload Handoff payload
   * @param startTime Start timestamp
   * @param agentConfig Agent configuration
   * @returns Dry run execution result
   */
  private createDryRunResult(
    payload: HandoffPayload,
    startTime: number,
    agentConfig: AgentConfig
  ): ExecutionResult {
    const endTime = Date.now();

    return {
      handoffId: payload.handoffId,
      status: 'success',
      exitCode: 0,
      stdout: `[DRY RUN] Would execute:\n` +
        `Command: ${agentConfig.execution.command}\n` +
        `Args: ${agentConfig.execution.args.join(' ')}\n` +
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
        agentId: agentConfig.id,
        command: `${agentConfig.execution.command} [DRY RUN]`,
      },
    };
  }

  /**
   * Create validation error result
   * @param payload Handoff payload
   * @param startTime Start timestamp
   * @param agentConfig Agent configuration
   * @param errors Validation errors
   * @returns Validation error execution result
   */
  private createValidationErrorResult(
    payload: HandoffPayload,
    startTime: number,
    agentConfig: AgentConfig,
    errors: ValidationError[]
  ): ExecutionResult {
    const endTime = Date.now();

    return {
      handoffId: payload.handoffId,
      status: 'failure',
      exitCode: -1,
      stdout: '',
      stderr: `Validation failed:\n${errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}`,
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
        agentId: agentConfig.id,
        command: agentConfig.execution.command,
      },
      error: {
        type: 'validation',
        message: 'Configuration validation failed',
        suggestedFixes: errors.map(e => `Fix ${e.field}: ${e.message}`),
      },
    };
  }

  /**
   * Create dangerous flag result
   * @param payload Handoff payload
   * @param startTime Start timestamp
   * @param agentConfig Agent configuration
   * @param dangerousFlags Dangerous flags
   * @returns Dangerous flag execution result
   */
  private createDangerousFlagResult(
    payload: HandoffPayload,
    startTime: number,
    agentConfig: AgentConfig,
    dangerousFlags: string[]
  ): ExecutionResult {
    const endTime = Date.now();

    return {
      handoffId: payload.handoffId,
      status: 'failure',
      exitCode: -1,
      stdout: '',
      stderr: `Dangerous flags require confirmation: ${dangerousFlags.join(', ')}`,
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
        agentId: agentConfig.id,
        command: agentConfig.execution.command,
      },
      error: {
        type: 'runtime',
        message: 'Dangerous flags require confirmation',
        suggestedFixes: ['Set confirmDangerous: true to proceed with dangerous flags'],
      },
    };
  }

  /**
   * Create error result
   * @param payload Handoff payload
   * @param startTime Start timestamp
   * @param agentConfig Agent configuration
   * @param error Error object
   * @returns Error execution result
   */
  private createErrorResult(
    payload: HandoffPayload,
    startTime: number,
    agentConfig: AgentConfig,
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
        agentId: agentConfig.id,
        command: agentConfig.execution.command,
      },
      error: {
        type: 'runtime',
        message: error.message,
        stack: error.stack,
      },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalCustomAgent: CustomAgent | null = null;

/**
 * Get the global custom agent instance
 * @returns CustomAgent singleton
 */
export function getCustomAgent(): CustomAgent {
  if (!globalCustomAgent) {
    globalCustomAgent = new CustomAgent();
  }
  return globalCustomAgent;
}

/**
 * Reset the global custom agent (useful for testing)
 */
export function resetCustomAgent(): void {
  globalCustomAgent = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CustomAgent;
