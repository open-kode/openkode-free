/**
 * Agent Router - Route tasks to external CLI agents
 * 
 * Supports:
 * - Cursor CLI (cursor.com)
 * - GitHub Copilot CLI (gh copilot)
 * - Generic CLI tools
 * - Direct OpenKode execution (fallback)
 */

import { TerminalController } from '../core/terminalController';
import { LLMClient, LLMConfig } from '../llm/llmClient';
import { VibeEngine } from '../vibe/vibeEngine';

export type AgentType = 'openkode' | 'cursor' | 'copilot' | 'codex' | 'aider' | 'generic';

export interface AgentCapabilities {
  canCreateFiles: boolean;
  canModifyFiles: boolean;
  canRunCommands: boolean;
  canAccessWeb: boolean;
  maxContextLength: number;
  supportsStreaming: boolean;
}

export interface AgentConfig {
  name: string;
  type: AgentType;
  command: string;
  args: string[];
  capabilities: AgentCapabilities;
  envVars?: Record<string, string>;
  workingDirectory?: string;
}

export interface HandoffRequest {
  task: string;
  context: {
    workspaceRoot: string;
    currentFile?: string;
    selectedCode?: string;
    conversationHistory?: string[];
  };
  constraints: {
    readonly: boolean;
    allowedFiles?: string[];
    blockedFiles?: string[];
  };
}

export interface HandoffResult {
  success: boolean;
  agent: AgentType;
  output: string;
  filesCreated: string[];
  filesModified: string[];
  commandsExecuted: string[];
  error?: string;
  duration: number;
}

// Pre-configured agents
export const BuiltInAgents: Record<string, AgentConfig> = {
  cursor: {
    name: 'Cursor',
    type: 'cursor',
    command: 'cursor',
    args: ['--cli'],
    capabilities: {
      canCreateFiles: true,
      canModifyFiles: true,
      canRunCommands: false,
      canAccessWeb: true,
      maxContextLength: 128000,
      supportsStreaming: true
    }
  },
  
  copilot: {
    name: 'GitHub Copilot',
    type: 'copilot',
    command: 'gh',
    args: ['copilot', 'suggest'],
    capabilities: {
      canCreateFiles: false,
      canModifyFiles: false,
      canRunCommands: false,
      canAccessWeb: true,
      maxContextLength: 8000,
      supportsStreaming: false
    }
  },
  
  codex: {
    name: 'OpenAI Codex',
    type: 'codex',
    command: 'codex',
    args: [],
    capabilities: {
      canCreateFiles: true,
      canModifyFiles: true,
      canRunCommands: true,
      canAccessWeb: false,
      maxContextLength: 128000,
      supportsStreaming: true
    }
  },
  
  aider: {
    name: 'Aider',
    type: 'aider',
    command: 'aider',
    args: [],
    capabilities: {
      canCreateFiles: true,
      canModifyFiles: true,
      canRunCommands: true,
      canAccessWeb: true,
      maxContextLength: 128000,
      supportsStreaming: true
    }
  }
};

export class AgentRouter {
  private terminal: TerminalController;
  private customAgents: Map<string, AgentConfig> = new Map();
  private llmConfig: LLMConfig;

  constructor(llmConfig: LLMConfig) {
    this.terminal = new TerminalController();
    this.llmConfig = llmConfig;
  }

  /**
   * Check which agents are available on the system
   */
  async detectAvailableAgents(): Promise<AgentType[]> {
    const available: AgentType[] = ['openkode']; // OpenKode is always available
    
    const checks = [
      { type: 'cursor' as AgentType, cmd: 'cursor' },
      { type: 'copilot' as AgentType, cmd: 'gh' },
      { type: 'codex' as AgentType, cmd: 'codex' },
      { type: 'aider' as AgentType, cmd: 'aider' }
    ];

    for (const check of checks) {
      if (await this.terminal.commandExists(check.cmd)) {
        available.push(check.type);
      }
    }

    return available;
  }

  /**
   * Route a task to the best available agent
   */
  async routeTask(
    request: HandoffRequest,
    preferredAgent?: AgentType
  ): Promise<HandoffResult> {
    const startTime = Date.now();

    // Determine which agent to use
    const agent = await this.selectAgent(request, preferredAgent);
    
    console.log(`[AgentRouter] Routing task to ${agent.name}`);

    try {
      switch (agent.type) {
        case 'cursor':
          return await this.handoffToCursor(request, agent);
        case 'copilot':
          return await this.handoffToCopilot(request, agent);
        case 'codex':
          return await this.handoffToCodex(request, agent);
        case 'aider':
          return await this.handoffToAider(request, agent);
        case 'generic':
          return await this.handoffToGeneric(request, agent);
        case 'openkode':
        default:
          return await this.executeWithOpenKode(request);
      }
    } catch (error) {
      return {
        success: false,
        agent: agent.type,
        output: '',
        filesCreated: [],
        filesModified: [],
        commandsExecuted: [],
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Hand off to Cursor CLI
   */
  private async handoffToCursor(
    request: HandoffRequest,
    config: AgentConfig
  ): Promise<HandoffResult> {
    const startTime = Date.now();
    
    // Build cursor command with context
    const prompt = this.buildPrompt(request);
    const args = [...config.args, '--prompt', prompt];
    
    if (request.context.currentFile) {
      args.push('--file', request.context.currentFile);
    }

    console.log(`[AgentRouter] Executing Cursor with args:`, args);

    const result = await this.terminal.executeCommand(
      config.command,
      args,
      { cwd: request.context.workspaceRoot }
    );

    // Parse Cursor output for file changes
    const { filesCreated, filesModified } = this.parseFileChanges(result.stdout);

    return {
      success: result.success,
      agent: 'cursor',
      output: result.stdout,
      filesCreated,
      filesModified,
      commandsExecuted: [`${config.command} ${args.join(' ')}`],
      error: result.stderr || undefined,
      duration: Date.now() - startTime
    };
  }

  /**
   * Hand off to GitHub Copilot CLI
   */
  private async handoffToCopilot(
    request: HandoffRequest,
    config: AgentConfig
  ): Promise<HandoffResult> {
    const startTime = Date.now();
    
    // Copilot is more limited - it suggests but doesn't modify
    const prompt = this.buildPrompt(request);
    const args = [...config.args, '-t', prompt];

    console.log(`[AgentRouter] Executing Copilot with args:`, args);

    const result = await this.terminal.executeCommand(
      config.command,
      args,
      { cwd: request.context.workspaceRoot }
    );

    // Copilot doesn't modify files directly - it suggests
    // We need to apply the suggestions ourselves
    const suggestions = this.parseCopilotSuggestions(result.stdout);

    return {
      success: result.success,
      agent: 'copilot',
      output: result.stdout,
      filesCreated: [],
      filesModified: [],
      commandsExecuted: [`${config.command} ${args.join(' ')}`],
      suggestions,
      error: result.stderr || undefined,
      duration: Date.now() - startTime
    } as HandoffResult;
  }

  /**
   * Hand off to OpenAI Codex CLI
   */
  private async handoffToCodex(
    request: HandoffRequest,
    config: AgentConfig
  ): Promise<HandoffResult> {
    const startTime = Date.now();
    
    const prompt = this.buildPrompt(request);
    const args = [...config.args, prompt];

    if (request.context.currentFile) {
      args.push('--file', request.context.currentFile);
    }

    console.log(`[AgentRouter] Executing Codex with args:`, args);

    const result = await this.terminal.executeCommand(
      config.command,
      args,
      { cwd: request.context.workspaceRoot, timeout: 300000 } // 5 min timeout
    );

    const { filesCreated, filesModified } = this.parseFileChanges(result.stdout);

    return {
      success: result.success,
      agent: 'codex',
      output: result.stdout,
      filesCreated,
      filesModified,
      commandsExecuted: [`${config.command} ${args.join(' ')}`],
      error: result.stderr || undefined,
      duration: Date.now() - startTime
    };
  }

  /**
   * Hand off to Aider CLI
   */
  private async handoffToAider(
    request: HandoffRequest,
    config: AgentConfig
  ): Promise<HandoffResult> {
    const startTime = Date.now();
    
    const prompt = this.buildPrompt(request);
    const args = [...config.args, prompt];

    // Aider works with git - ensure we're in a git repo
    const gitCheck = await this.terminal.executeCommand('git', ['rev-parse', '--git-dir'], {
      cwd: request.context.workspaceRoot
    });

    if (!gitCheck.success) {
      return {
        success: false,
        agent: 'aider',
        output: '',
        filesCreated: [],
        filesModified: [],
        commandsExecuted: [],
        error: 'Aider requires a git repository. Please initialize git first.',
        duration: Date.now() - startTime
      };
    }

    console.log(`[AgentRouter] Executing Aider with args:`, args);

    const result = await this.terminal.executeCommand(
      config.command,
      args,
      { cwd: request.context.workspaceRoot, timeout: 300000 }
    );

    const { filesCreated, filesModified } = this.parseFileChanges(result.stdout);

    return {
      success: result.success,
      agent: 'aider',
      output: result.stdout,
      filesCreated,
      filesModified,
      commandsExecuted: [`${config.command} ${args.join(' ')}`],
      error: result.stderr || undefined,
      duration: Date.now() - startTime
    };
  }

  /**
   * Hand off to generic CLI tool
   */
  private async handoffToGeneric(
    request: HandoffRequest,
    config: AgentConfig
  ): Promise<HandoffResult> {
    const startTime = Date.now();
    
    const prompt = this.buildPrompt(request);
    const args = [...config.args, prompt];

    const result = await this.terminal.executeCommand(
      config.command,
      args,
      { 
        cwd: config.workingDirectory || request.context.workspaceRoot,
        env: config.envVars 
      }
    );

    return {
      success: result.success,
      agent: 'generic',
      output: result.stdout,
      filesCreated: [],
      filesModified: [],
      commandsExecuted: [`${config.command} ${args.join(' ')}`],
      error: result.stderr || undefined,
      duration: Date.now() - startTime
    };
  }

  /**
   * Execute with OpenKode directly
   */
  private async executeWithOpenKode(request: HandoffRequest): Promise<HandoffResult> {
    const startTime = Date.now();
    
    try {
      // Use the stored LLM config from constructor
      const llmConfig = this.llmConfig;

      if (!llmConfig.apiKey) {
        return {
          success: false,
          agent: 'openkode',
          output: '',
          filesCreated: [],
          filesModified: [],
          commandsExecuted: [],
          error: 'No API key configured for OpenKode execution',
          duration: Date.now() - startTime
        };
      }

      // Use VibeEngine to execute the task
      const vibeEngine = new VibeEngine({
        llmConfig,
        workspaceRoot: request.context.workspaceRoot
      });

      const result = await vibeEngine.generate(request.task, request.context.conversationHistory);

      return {
        success: result.success,
        agent: 'openkode',
        output: result.description || 'Task completed',
        filesCreated: result.filesCreated,
        filesModified: result.filesUpdated,
        commandsExecuted: result.commands || [],
        error: result.error,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        agent: 'openkode',
        output: '',
        filesCreated: [],
        filesModified: [],
        commandsExecuted: [],
        error: error instanceof Error ? error.message : 'Unknown error in OpenKode execution',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Register a custom agent
   */
  registerAgent(name: string, config: AgentConfig): void {
    this.customAgents.set(name, config);
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(agentType: AgentType): AgentConfig | undefined {
    return BuiltInAgents[agentType] || this.customAgents.get(agentType);
  }

  /**
   * Select the best agent for the task
   */
  private async selectAgent(
    request: HandoffRequest,
    preferred?: AgentType
  ): Promise<AgentConfig> {
    // If preferred agent is specified and available, use it
    if (preferred && preferred !== 'openkode') {
      const agent = this.getAgentConfig(preferred);
      if (agent && await this.isAgentAvailable(agent)) {
        return agent;
      }
    }

    // Otherwise, select based on task characteristics
    const available = await this.detectAvailableAgents();

    // For file modifications, prefer Cursor or Codex
    if (!request.constraints.readonly && available.includes('cursor')) {
      return BuiltInAgents.cursor;
    }
    if (!request.constraints.readonly && available.includes('codex')) {
      return BuiltInAgents.codex;
    }

    // For git-based workflows, prefer Aider
    if (available.includes('aider')) {
      return BuiltInAgents.aider;
    }

    // Fallback to Copilot for suggestions
    if (available.includes('copilot')) {
      return BuiltInAgents.copilot;
    }

    // Default to OpenKode
    return {
      name: 'OpenKode',
      type: 'openkode',
      command: '',
      args: [],
      capabilities: {
        canCreateFiles: true,
        canModifyFiles: true,
        canRunCommands: true,
        canAccessWeb: true,
        maxContextLength: 128000,
        supportsStreaming: true
      }
    };
  }

  /**
   * Check if an agent is available
   */
  private async isAgentAvailable(config: AgentConfig): Promise<boolean> {
    if (config.type === 'openkode') return true;
    return this.terminal.commandExists(config.command);
  }

  /**
   * Build a prompt from the request
   */
  private buildPrompt(request: HandoffRequest): string {
    const parts: string[] = [request.task];

    if (request.context.selectedCode) {
      parts.push(`\n\nSelected code:\n${request.context.selectedCode}`);
    }

    if (request.context.currentFile) {
      parts.push(`\n\nCurrent file: ${request.context.currentFile}`);
    }

    if (request.constraints.readonly) {
      parts.push('\n\nNote: Read-only mode. Do not modify files.');
    }

    return parts.join('');
  }

  /**
   * Parse file changes from agent output
   */
  private parseFileChanges(output: string): { filesCreated: string[]; filesModified: string[] } {
    const filesCreated: string[] = [];
    const filesModified: string[] = [];

    // Common patterns for file changes
    const createdPatterns = [
      /created?:\s*(.+)/gi,
      /new file:\s*(.+)/gi,
      /\+\s+(.+\.(ts|js|tsx|jsx|py|go|rs))/gi
    ];

    const modifiedPatterns = [
      /modified?:\s*(.+)/gi,
      /updated?:\s*(.+)/gi,
      /changed:\s*(.+)/gi,
      /M\s+(.+)/g
    ];

    for (const pattern of createdPatterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const file = match[1].trim();
        if (file && !filesCreated.includes(file)) {
          filesCreated.push(file);
        }
      }
    }

    for (const pattern of modifiedPatterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const file = match[1].trim();
        if (file && !filesModified.includes(file) && !filesCreated.includes(file)) {
          filesModified.push(file);
        }
      }
    }

    return { filesCreated, filesModified };
  }

  /**
   * Parse Copilot suggestions (different format)
   */
  private parseCopilotSuggestions(output: string): string[] {
    // Copilot outputs suggestions as code blocks or text
    return output.split('\n').filter(line => line.trim().length > 0);
  }
}

export const createAgentRouter = (llmConfig: LLMConfig) => new AgentRouter(llmConfig);
