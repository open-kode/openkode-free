/**
 * Agent Service - High-level interface for agent handoff
 * 
 * Integrates agent routing with OpenKode's mode system
 */

import { AgentRouter, AgentType, HandoffRequest, HandoffResult } from '../agent-handoff/agentRouter';
import { LLMConfig } from '../llm/llmClient';
import { TerminalController } from './terminalController';

export interface AgentTask {
  prompt: string;
  mode: 'code' | 'fix' | 'explain' | 'test' | 'refactor';
  context?: {
    currentFile?: string;
    selectedCode?: string;
  };
  preferredAgent?: AgentType;
  readonly?: boolean;
}

export class AgentService {
  private router: AgentRouter;
  private terminal: TerminalController;

  constructor(llmConfig: LLMConfig) {
    this.router = new AgentRouter(llmConfig);
    this.terminal = new TerminalController();
  }

  /**
   * Execute a task using the best available agent
   */
  async executeTask(
    task: AgentTask,
    workspaceRoot: string,
    onProgress?: (msg: string) => void
  ): Promise<HandoffResult> {
    // Detect available agents first
    onProgress?.('Detecting available agents...');
    const available = await this.router.detectAvailableAgents();
    
    console.log('[AgentService] Available agents:', available);

    // Build handoff request
    const request: HandoffRequest = {
      task: this.buildTaskPrompt(task),
      context: {
        workspaceRoot,
        currentFile: task.context?.currentFile,
        selectedCode: task.context?.selectedCode
      },
      constraints: {
        readonly: task.readonly || false
      }
    };

    onProgress?.(`Routing to ${task.preferredAgent || 'best available'} agent...`);

    // Route to agent
    const result = await this.router.routeTask(request, task.preferredAgent);

    // Post-process results
    if (result.success) {
      onProgress?.(`Task completed by ${result.agent}`);
      
      if (result.filesCreated.length > 0) {
        onProgress?.(`Created: ${result.filesCreated.join(', ')}`);
      }
      if (result.filesModified.length > 0) {
        onProgress?.(`Modified: ${result.filesModified.join(', ')}`);
      }
    } else {
      onProgress?.(`Error: ${result.error}`);
    }

    return result;
  }

  /**
   * Quick code generation with external agent
   */
  async quickGenerate(
    prompt: string,
    workspaceRoot: string,
    options: {
      agent?: AgentType;
      file?: string;
    } = {}
  ): Promise<HandoffResult> {
    return this.executeTask({
      prompt,
      mode: 'code',
      preferredAgent: options.agent,
      context: options.file ? { currentFile: options.file } : undefined
    }, workspaceRoot);
  }

  /**
   * Fix code using external agent
   */
  async fixCode(
    error: string,
    file: string,
    workspaceRoot: string,
    options: {
      agent?: AgentType;
    } = {}
  ): Promise<HandoffResult> {
    return this.executeTask({
      prompt: `Fix this error: ${error}`,
      mode: 'fix',
      preferredAgent: options.agent,
      context: { currentFile: file }
    }, workspaceRoot);
  }

  /**
   * Explain code using external agent
   */
  async explainCode(
    code: string,
    workspaceRoot: string,
    options: {
      agent?: AgentType;
    } = {}
  ): Promise<HandoffResult> {
    return this.executeTask({
      prompt: 'Explain this code in detail',
      mode: 'explain',
      preferredAgent: options.agent,
      context: { selectedCode: code },
      readonly: true
    }, workspaceRoot);
  }

  /**
   * Get list of available agents
   */
  async getAvailableAgents(): Promise<AgentType[]> {
    return this.router.detectAvailableAgents();
  }

  /**
   * Check if specific agent is available
   */
  async isAgentAvailable(agent: AgentType): Promise<boolean> {
    const available = await this.getAvailableAgents();
    return available.includes(agent);
  }

  /**
   * Run npm install via terminal
   */
  async npmInstall(workspaceRoot: string, packages?: string[]) {
    return this.terminal.npmInstall(workspaceRoot, packages);
  }

  /**
   * Run git commands
   */
  async git(command: string, args: string[], cwd?: string) {
    return this.terminal.git(command, args, cwd);
  }

  /**
   * Run build command
   */
  async build(workspaceRoot: string, command: string = 'npm run build') {
    return this.terminal.build(workspaceRoot, command);
  }

  /**
   * Run tests
   */
  async test(workspaceRoot: string, command: string = 'npm test') {
    return this.terminal.test(workspaceRoot, command);
  }

  private buildTaskPrompt(task: AgentTask): string {
    const modePrefixes: Record<string, string> = {
      code: 'Generate code to:',
      fix: 'Fix the following issue:',
      explain: 'Explain the following:',
      test: 'Write tests for:',
      refactor: 'Refactor the following:'
    };

    return `${modePrefixes[task.mode] || ''} ${task.prompt}`;
  }
}

export const createAgentService = (llmConfig: LLMConfig) => new AgentService(llmConfig);
