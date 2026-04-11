/**
 * Agent Registry - Registration and Management for AI Coding Agents
 * 
 * Provides centralized registration, configuration, and capability detection
 * for supported AI coding agents: Cursor, Claude Code, Windsurf, Codex CLI,
 * Gemini CLI, and Aider.
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Supported AI coding agents
 */
export type AgentType = 
  | 'cursor' 
  | 'claude-code' 
  | 'windsurf' 
  | 'codex-cli' 
  | 'gemini-cli' 
  | 'aider'
  | 'custom';

/**
 * Agent capability flags
 */
export interface AgentCapabilities {
  /** Supports multi-file editing */
  multiFileEdit: boolean;
  /** Supports terminal/command execution */
  terminalAccess: boolean;
  /** Supports web search */
  webSearch: boolean;
  /** Supports codebase indexing */
  codeIndexing: boolean;
  /** Supports git operations */
  gitIntegration: boolean;
  /** Supports test execution */
  testExecution: boolean;
  /** Supports LSP/diagnostics */
  lspSupport: boolean;
  /** Maximum context window size */
  contextWindow: number;
  /** Supports streaming responses */
  streamingSupport: boolean;
  /** Supports file creation */
  fileCreation: boolean;
  /** Supports file deletion */
  fileDeletion: boolean;
  /** Can create new files */
  canCreateFiles?: boolean;
  /** Can modify existing files */
  canModifyFiles?: boolean;
  /** Can run shell commands */
  canRunCommands?: boolean;
  /** Can access the web */
  canAccessWeb?: boolean;
}

/**
 * Agent execution configuration
 */
export interface AgentExecutionConfig {
  /** Command to execute the agent */
  command: string;
  /** Default arguments */
  args: string[];
  /** Environment variables to inject */
  envVars: Record<string, string>;
  /** Working directory for execution */
  workingDirectory?: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Maximum memory allocation in MB */
  maxMemoryMb?: number;
  /** Shell to use for execution */
  shell?: string;
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Unique agent identifier */
  id: string;
  /** Agent type */
  type: AgentType;
  /** Human-readable name */
  name: string;
  /** Agent description */
  description: string;
  /** Agent version */
  version: string;
  /** Execution configuration */
  execution: AgentExecutionConfig;
  /** Agent capabilities */
  capabilities: AgentCapabilities;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Whether agent is enabled */
  enabled: boolean;
  /** Priority for agent selection (higher = preferred) */
  priority: number;
  /** Detection patterns for auto-discovery */
  detectionPatterns?: {
    /** Files that indicate agent presence */
    files?: string[];
    /** Commands that indicate agent presence */
    commands?: string[];
    /** Environment variables that indicate agent presence */
    envVars?: string[];
  };
}

/**
 * Agent registration options
 */
export interface AgentRegistrationOptions {
  /** Override existing agent with same ID */
  override?: boolean;
  /** Validate agent configuration */
  validate?: boolean;
  /** Auto-detect capabilities */
  autoDetect?: boolean;
}

/**
 * Agent detection result
 */
export interface AgentDetectionResult {
  /** Whether agent was detected */
  detected: boolean;
  /** Detected version */
  version?: string;
  /** Detection method used */
  method: 'file' | 'command' | 'envVar' | 'manual';
  /** Path to agent if detected */
  path?: string;
}

/**
 * Agent status
 */
export interface AgentStatus {
  /** Agent ID */
  id: string;
  /** Whether agent is registered */
  registered: boolean;
  /** Whether agent is available (detected on system) */
  available: boolean;
  /** Whether agent is currently enabled */
  enabled: boolean;
  /** Last detection result */
  lastDetection?: AgentDetectionResult;
  /** Last used timestamp */
  lastUsed?: Date;
  /** Usage count */
  usageCount: number;
}

// ============================================================================
// DEFAULT AGENT CONFIGURATIONS
// ============================================================================

/**
 * Default Cursor agent configuration
 */
export const DEFAULT_CURSOR_CONFIG: AgentConfig = {
  id: 'cursor',
  type: 'cursor',
  name: 'Cursor',
  description: 'Cursor IDE with AI-powered coding assistance',
  version: 'latest',
  execution: {
    command: 'cursor',
    args: ['--reuse-window'],
    envVars: {},
    timeoutMs: 300000,
    shell: '/bin/bash',
  },
  capabilities: {
    multiFileEdit: true,
    terminalAccess: true,
    webSearch: false,
    codeIndexing: true,
    gitIntegration: true,
    testExecution: true,
    lspSupport: true,
    contextWindow: 200000,
    streamingSupport: true,
    fileCreation: true,
    fileDeletion: true,
  },
  enabled: true,
  priority: 100,
  detectionPatterns: {
    files: ['.cursor/settings.json'],
    commands: ['cursor', 'cursor --version'],
    envVars: ['CURSOR_PATH'],
  },
};

/**
 * Default Claude Code agent configuration
 */
export const DEFAULT_CLAUDE_CODE_CONFIG: AgentConfig = {
  id: 'claude-code',
  type: 'claude-code',
  name: 'Claude Code',
  description: 'Anthropic Claude Code CLI for AI-powered development',
  version: 'latest',
  execution: {
    command: 'claude',
    args: [],
    envVars: {
      CLAUDE_CODE_DEBUG: '1',
    },
    timeoutMs: 600000,
    shell: '/bin/bash',
  },
  capabilities: {
    multiFileEdit: true,
    terminalAccess: true,
    webSearch: false,
    codeIndexing: false,
    gitIntegration: true,
    testExecution: true,
    lspSupport: false,
    contextWindow: 200000,
    streamingSupport: true,
    fileCreation: true,
    fileDeletion: true,
  },
  enabled: true,
  priority: 90,
  detectionPatterns: {
    commands: ['claude', 'claude --version'],
    envVars: ['ANTHROPIC_API_KEY'],
  },
};

/**
 * Default Windsurf agent configuration
 */
export const DEFAULT_WINDSURF_CONFIG: AgentConfig = {
  id: 'windsurf',
  type: 'windsurf',
  name: 'Windsurf',
  description: 'Codeium Windsurf IDE with AI coding features',
  version: 'latest',
  execution: {
    command: 'windsurf',
    args: [],
    envVars: {},
    timeoutMs: 300000,
    shell: '/bin/bash',
  },
  capabilities: {
    multiFileEdit: true,
    terminalAccess: true,
    webSearch: false,
    codeIndexing: true,
    gitIntegration: true,
    testExecution: true,
    lspSupport: true,
    contextWindow: 100000,
    streamingSupport: true,
    fileCreation: true,
    fileDeletion: true,
  },
  enabled: true,
  priority: 80,
  detectionPatterns: {
    files: ['.windsurf/settings.json'],
    commands: ['windsurf', 'windsurf --version'],
  },
};

/**
 * Default Codex CLI agent configuration
 */
export const DEFAULT_CODEX_CLI_CONFIG: AgentConfig = {
  id: 'codex-cli',
  type: 'codex-cli',
  name: 'OpenAI Codex CLI',
  description: 'OpenAI Codex CLI for AI-powered coding',
  version: 'latest',
  execution: {
    command: 'codex',
    args: [],
    envVars: {},
    timeoutMs: 300000,
    shell: '/bin/bash',
  },
  capabilities: {
    multiFileEdit: true,
    terminalAccess: true,
    webSearch: false,
    codeIndexing: false,
    gitIntegration: false,
    testExecution: true,
    lspSupport: false,
    contextWindow: 128000,
    streamingSupport: true,
    fileCreation: true,
    fileDeletion: true,
  },
  enabled: true,
  priority: 70,
  detectionPatterns: {
    commands: ['codex', 'codex --version'],
    envVars: ['OPENAI_API_KEY'],
  },
};

/**
 * Default Gemini CLI agent configuration
 */
export const DEFAULT_GEMINI_CLI_CONFIG: AgentConfig = {
  id: 'gemini-cli',
  type: 'gemini-cli',
  name: 'Google Gemini CLI',
  description: 'Google Gemini CLI for AI-powered development',
  version: 'latest',
  execution: {
    command: 'gemini',
    args: [],
    envVars: {},
    timeoutMs: 300000,
    shell: '/bin/bash',
  },
  capabilities: {
    multiFileEdit: true,
    terminalAccess: true,
    webSearch: true,
    codeIndexing: false,
    gitIntegration: false,
    testExecution: true,
    lspSupport: false,
    contextWindow: 1000000,
    streamingSupport: true,
    fileCreation: true,
    fileDeletion: true,
  },
  enabled: true,
  priority: 70,
  detectionPatterns: {
    commands: ['gemini', 'gemini --version'],
    envVars: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  },
};

/**
 * Default Aider agent configuration
 */
export const DEFAULT_AIDER_CONFIG: AgentConfig = {
  id: 'aider',
  type: 'aider',
  name: 'Aider',
  description: 'Aider - AI pair programming in your terminal',
  version: 'latest',
  execution: {
    command: 'aider',
    args: ['--no-pretty', '--yes'],
    envVars: {},
    timeoutMs: 600000,
    shell: '/bin/bash',
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
  enabled: true,
  priority: 60,
  detectionPatterns: {
    commands: ['aider', 'aider --version'],
    envVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
  },
};

// ============================================================================
// AGENT REGISTRY CLASS
// ============================================================================

/**
 * Agent Registry - Manages AI coding agent registrations
 */
export class AgentRegistry extends EventEmitter {
  private agents: Map<string, AgentConfig> = new Map();
  private statuses: Map<string, AgentStatus> = new Map();

  constructor() {
    super();
    this.registerDefaultAgents();
  }

  /**
   * Register default built-in agents
   */
  private registerDefaultAgents(): void {
    this.registerAgent(DEFAULT_CURSOR_CONFIG, { validate: false });
    this.registerAgent(DEFAULT_CLAUDE_CODE_CONFIG, { validate: false });
    this.registerAgent(DEFAULT_WINDSURF_CONFIG, { validate: false });
    this.registerAgent(DEFAULT_CODEX_CLI_CONFIG, { validate: false });
    this.registerAgent(DEFAULT_GEMINI_CLI_CONFIG, { validate: false });
    this.registerAgent(DEFAULT_AIDER_CONFIG, { validate: false });
  }

  /**
   * Register a new agent
   * @param config Agent configuration
   * @param options Registration options
   * @returns Registered agent config
   */
  registerAgent(
    config: AgentConfig,
    options: AgentRegistrationOptions = {}
  ): AgentConfig {
    const { override = false, validate = true, autoDetect = false } = options;

    // Validate configuration if requested
    if (validate) {
      this.validateConfig(config);
    }

    // Check for existing agent
    if (this.agents.has(config.id) && !override) {
      throw new Error(`Agent with ID '${config.id}' already registered. Use override option to replace.`);
    }

    // Auto-detect capabilities if requested
    if (autoDetect) {
      this.detectCapabilities(config);
    }

    // Register agent
    this.agents.set(config.id, { ...config });
    
    // Initialize status
    this.statuses.set(config.id, {
      id: config.id,
      registered: true,
      available: false,
      enabled: config.enabled,
      usageCount: 0,
    });

    this.emit('agent:registered', { id: config.id, config });

    return config;
  }

  /**
   * Unregister an agent
   * @param agentId Agent ID to unregister
   * @returns True if unregistered successfully
   */
  unregisterAgent(agentId: string): boolean {
    const existed = this.agents.has(agentId);
    
    if (existed) {
      this.agents.delete(agentId);
      this.statuses.delete(agentId);
      this.emit('agent:unregistered', { id: agentId });
    }

    return existed;
  }

  /**
   * Get agent configuration by ID
   * @param agentId Agent identifier
   * @returns Agent configuration or undefined
   */
  getAgent(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agent by type
   * @param type Agent type
   * @returns First matching agent or undefined
   */
  getAgentByType(type: AgentType): AgentConfig | undefined {
    for (const agent of this.agents.values()) {
      if (agent.type === type) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * List all registered agents
   * @param includeDisabled Include disabled agents
   * @returns Array of agent configurations
   */
  listAgents(includeDisabled = false): AgentConfig[] {
    const agents = Array.from(this.agents.values());
    
    if (!includeDisabled) {
      return agents.filter(a => a.enabled);
    }
    
    return agents;
  }

  /**
   * List agents by capability
   * @param capability Capability to filter by
   * @returns Array of agents with the capability
   */
  listAgentsByCapability<K extends keyof AgentCapabilities>(
    capability: K,
    value: AgentCapabilities[K] = true as AgentCapabilities[K]
  ): AgentConfig[] {
    return this.listAgents().filter(
      agent => agent.capabilities[capability] === value
    );
  }

  /**
   * Get the best agent for a task based on capabilities and priority
   * @param requiredCapabilities Required capabilities
   * @returns Best matching agent or undefined
   */
  getBestAgent(
    requiredCapabilities: Partial<AgentCapabilities> = {}
  ): AgentConfig | undefined {
    const candidates = this.listAgents().filter(agent => {
      return Object.entries(requiredCapabilities).every(
        ([key, value]) => agent.capabilities[key as keyof AgentCapabilities] === value
      );
    });

    // Sort by priority (descending)
    candidates.sort((a, b) => b.priority - a.priority);

    return candidates[0];
  }

  /**
   * Update agent configuration
   * @param agentId Agent ID
   * @param updates Partial configuration updates
   * @returns Updated agent config
   */
  updateAgent(
    agentId: string,
    updates: Partial<Omit<AgentConfig, 'id'>>
  ): AgentConfig {
    const existing = this.agents.get(agentId);
    
    if (!existing) {
      throw new Error(`Agent '${agentId}' not found`);
    }

    const updated = { ...existing, ...updates };
    this.agents.set(agentId, updated);

    this.emit('agent:updated', { id: agentId, config: updated });

    return updated;
  }

  /**
   * Enable an agent
   * @param agentId Agent ID
   */
  enableAgent(agentId: string): void {
    this.updateAgent(agentId, { enabled: true });
    
    const status = this.statuses.get(agentId);
    if (status) {
      status.enabled = true;
    }
  }

  /**
   * Disable an agent
   * @param agentId Agent ID
   */
  disableAgent(agentId: string): void {
    this.updateAgent(agentId, { enabled: false });
    
    const status = this.statuses.get(agentId);
    if (status) {
      status.enabled = false;
    }
  }

  /**
   * Get agent status
   * @param agentId Agent ID
   * @returns Agent status
   */
  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.statuses.get(agentId);
  }

  /**
   * Detect if an agent is available on the system
   * @param agentId Agent ID
   * @returns Detection result
   */
  async detectAgent(agentId: string): Promise<AgentDetectionResult> {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      return { detected: false, method: 'manual' };
    }

    // Check detection patterns
    const patterns = agent.detectionPatterns;
    
    if (patterns) {
      // Check for files
      if (patterns.files) {
        for (const file of patterns.files) {
          try {
            const fs = await import('fs/promises');
            await fs.access(file);
            return { detected: true, method: 'file', path: file };
          } catch {
            // Continue checking
          }
        }
      }

      // Check for commands
      if (patterns.commands) {
        const { exec } = await import('child_process');
        const util = await import('util');
        const execAsync = util.promisify(exec);

        for (const cmd of patterns.commands) {
          try {
            const { stdout } = await execAsync(cmd, { timeout: 5000 });
            return { 
              detected: true, 
              method: 'command', 
              version: stdout.trim(),
              path: cmd.split(' ')[0],
            };
          } catch {
            // Continue checking
          }
        }
      }

      // Check for environment variables
      if (patterns.envVars) {
        for (const envVar of patterns.envVars) {
          if (process.env[envVar]) {
            return { detected: true, method: 'envVar' };
          }
        }
      }
    }

    return { detected: false, method: 'manual' };
  }

  /**
   * Update agent availability status
   * @param agentId Agent ID
   */
  async updateAvailability(agentId: string): Promise<void> {
    const detection = await this.detectAgent(agentId);
    const status = this.statuses.get(agentId);

    if (status) {
      status.available = detection.detected;
      status.lastDetection = detection;
    }
  }

  /**
   * Record agent usage
   * @param agentId Agent ID
   */
  recordUsage(agentId: string): void {
    const status = this.statuses.get(agentId);
    
    if (status) {
      status.usageCount++;
      status.lastUsed = new Date();
    }
  }

  /**
   * Validate agent configuration
   * @param config Agent configuration
   */
  private validateConfig(config: AgentConfig): void {
    if (!config.id || config.id.trim() === '') {
      throw new Error('Agent ID is required');
    }

    if (!config.execution?.command) {
      throw new Error('Agent execution command is required');
    }

    if (config.execution.timeoutMs <= 0) {
      throw new Error('Agent timeout must be positive');
    }
  }

  /**
   * Auto-detect agent capabilities
   * @param config Agent configuration
   */
  private detectCapabilities(config: AgentConfig): void {
    // This would implement actual capability detection
    // For now, we trust the provided capabilities
    void config;
  }

  /**
   * Clear all registered agents
   */
  clear(): void {
    this.agents.clear();
    this.statuses.clear();
    this.emit('registry:cleared');
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    available: number;
    byType: Record<AgentType, number>;
  } {
    const agents = Array.from(this.agents.values());
    const statuses = Array.from(this.statuses.values());

    const byType: Record<AgentType, number> = {
      cursor: 0,
      'claude-code': 0,
      windsurf: 0,
      'codex-cli': 0,
      'gemini-cli': 0,
      aider: 0,
      custom: 0,
    };

    for (const agent of agents) {
      byType[agent.type]++;
    }

    return {
      total: agents.length,
      enabled: agents.filter(a => a.enabled).length,
      available: statuses.filter(s => s.available).length,
      byType,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalRegistry: AgentRegistry | null = null;

/**
 * Get the global agent registry instance
 * @returns AgentRegistry singleton
 */
export function getAgentRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetAgentRegistry(): void {
  globalRegistry = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default AgentRegistry;
