/**
 * OpenKode Workflow Modes
 * =======================
 * 
 * Implements the 4 core workflow modes for Spec-Driven Development:
 * 1. Precision Mode - Single-phase tactical changes
 * 2. Blueprint Mode - Multi-phase decomposition
 * 3. Visionary Mode - High-level intent with ticket generation
 * 4. Rocket Mode - Fully automated execution
 */

import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import { IntentCaptureSystem, IntentInput, CapturedIntent, PRD } from '../spec/intentCapture';
import { Decomposer, Epic, Phase, Ticket, Task, DecompositionResult, TicketType } from '../spec/decomposer';
import { HandoffProtocol, HandoffPayload, ExecutionResult, PhaseType } from '../agent-handoff/handoffProtocol';
import { AgentConfig } from '../agent-handoff/agentRegistry';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../utils/configManager';
import { ErrorHandler, OpenKodeError } from '../utils/errorHandler';
import { VibeEngine, VibeResult } from '../vibe/vibeEngine';
import { LLMProvider } from '../types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  /** Success status */
  success: boolean;
  /** Workflow mode used */
  mode: WorkflowMode;
  /** Execution result data */
  data: {
    intent?: CapturedIntent;
    prd?: PRD;
    epic?: Epic;
    phases?: Phase[];
    tickets?: Ticket[];
    handoffResults?: ExecutionResult[];
  };
  /** Execution metrics */
  metrics: WorkflowMetrics;
  /** Errors if any */
  errors?: OpenKodeError[];
  /** Warnings */
  warnings: string[];
}

/**
 * Workflow execution metrics
 */
export interface WorkflowMetrics {
  /** Start timestamp */
  startTime: Date;
  /** End timestamp */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Phases executed */
  phasesExecuted: number;
  /** Tickets completed */
  ticketsCompleted: number;
  /** Handoffs performed */
  handoffsPerformed: number;
}

/**
 * Workflow mode types
 */
export type WorkflowMode = 'precision' | 'blueprint' | 'visionary' | 'rocket';

/**
 * Workflow context passed through execution
 */
export interface WorkflowContext {
  /** Session identifier */
  sessionId: string;
  /** Project root directory */
  projectRoot: string;
  /** User preferences */
  userPreferences?: {
    autoCommit?: boolean;
    codingStyle?: string;
    testFramework?: string;
  };
  /** VSCode extension context */
  extensionContext?: vscode.ExtensionContext;
}

/**
 * Plan mode options
 */
export interface PrecisionModeOptions {
  /** Skip verification step */
  skipVerification?: boolean;
  /** Auto-execute without confirmation */
  autoExecute?: boolean;
  /** Files to include in context */
  contextFiles?: string[];
}

/**
 * Phases mode options
 */
export interface BlueprintModeOptions {
  /** Execute phases sequentially (default: true) */
  sequential?: boolean;
  /** Specific phases to execute (empty = all) */
  targetPhases?: string[];
  /** Skip completed phases */
  skipCompleted?: boolean;
  /** Parallel execution within phases */
  parallelTickets?: boolean;
}

/**
 * Epic mode options
 */
export interface VisionaryModeOptions {
  /** Generate tickets with acceptance criteria */
  generateTickets?: boolean;
  /** Create overview dashboard */
  createDashboard?: boolean;
  /** Track end-to-end execution */
  trackExecution?: boolean;
  /** Epic priority */
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * YOLO mode options
 */
export interface RocketModeOptions {
  /** Auto-select workflow mode */
  autoSelectMode?: boolean;
  /** Auto-commit changes */
  autoCommit?: boolean;
  /** Dynamic strategy adjustment */
  dynamicAdjustment?: boolean;
  /** Maximum autonomy level (1-5) */
  autonomyLevel?: number;
  /** Rollback on failure */
  rollbackOnFailure?: boolean;
}

/**
 * Workflow state for tracking progress
 */
export interface WorkflowState {
  mode: WorkflowMode;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentPhase?: string;
  currentTicket?: string;
  completedPhases: string[];
  completedTickets: string[];
  failedItems: string[];
  progress: number;
}

// ============================================================================
// BASE WORKFLOW CLASS
// ============================================================================

/**
 * Abstract base class for all workflow modes
 */
export abstract class BaseWorkflow extends EventEmitter {
  protected logger: Logger;
  protected config: ConfigManager;
  protected errorHandler: ErrorHandler;
  protected intentCapture: IntentCaptureSystem;
  protected decomposer: Decomposer;
  protected handoffProtocol: HandoffProtocol;
  protected state: WorkflowState;
  protected context: WorkflowContext;

  constructor(context: WorkflowContext) {
    super();
    this.context = context;
    this.logger = new Logger('Workflow');
    this.config = ConfigManager.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.intentCapture = new IntentCaptureSystem();
    this.decomposer = new Decomposer();
    this.handoffProtocol = new HandoffProtocol();
    
    this.state = {
      mode: this.getMode(),
      status: 'idle',
      completedPhases: [],
      completedTickets: [],
      failedItems: [],
      progress: 0
    };

    this.setupEventHandlers();
  }

  /**
   * Get the workflow mode identifier
   */
  abstract getMode(): WorkflowMode;

  /**
   * Execute the workflow
   */
  abstract execute(input: IntentInput, options?: unknown): Promise<WorkflowResult>;

  /**
   * Setup event handlers for subsystems
   */
  private setupEventHandlers(): void {
    this.handoffProtocol.on('handoff:completed', (event) => {
      this.emit('handoff:completed', event);
      this.logger.debug(`Handoff completed: ${event.handoffId}`);
    });

    this.handoffProtocol.on('handoff:failed', (event) => {
      this.emit('handoff:failed', event);
      this.logger.error(`Handoff failed: ${event.handoffId}`, event.error);
    });
  }

  /**
   * Create initial workflow result structure
   */
  protected createResult(): WorkflowResult {
    return {
      success: false,
      mode: this.getMode(),
      data: {},
      metrics: {
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
        phasesExecuted: 0,
        ticketsCompleted: 0,
        handoffsPerformed: 0
      },
      warnings: []
    };
  }

  /**
   * Finalize workflow result with metrics
   */
  protected finalizeResult(result: WorkflowResult): WorkflowResult {
    result.metrics.endTime = new Date();
    result.metrics.durationMs = result.metrics.endTime.getTime() - result.metrics.startTime.getTime();
    result.success = result.errors === undefined || result.errors.length === 0;
    return result;
  }

  /**
   * Update workflow state
   */
  protected updateState(updates: Partial<WorkflowState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('state:changed', this.state);
  }

  /**
   * Get current workflow state
   */
  getState(): WorkflowState {
    return { ...this.state };
  }

  /**
   * Execute handoff to agent
   */
  protected async executeHandoff(
    phase: PhaseType,
    prompt: string,
    agent: AgentConfig,
    files?: string[]
  ): Promise<ExecutionResult> {
    const payload = this.handoffProtocol.prepareHandoff({
      phase,
      targetAgent: agent,
      prompt,
      context: {
        projectRoot: this.context.projectRoot,
        workingDirectory: this.context.projectRoot,
        phaseContext: {
          phase,
          data: {}
        },
        sessionId: this.context.sessionId,
        userPreferences: this.context.userPreferences
      },
      files: files?.map(f => ({
        path: f,
        includeMode: 'reference'
      }))
    });

    this.emit('handoff:started', { handoffId: payload.handoffId });
    return this.handoffProtocol.executeHandoff(payload);
  }
}

// ============================================================================
// PRECISION MODE - Single-phase tactical changes
// ============================================================================

/**
 * Precision Mode Workflow
 * 
 * For single-phase tactical changes:
 * - Capture intent from user input
 * - Generate tactical plan with files to touch
 * - Hand off to agent for execution
 * - Verify results
 */
export class PrecisionModeWorkflow extends BaseWorkflow {
  getMode(): WorkflowMode {
    return 'precision';
  }

  async execute(input: IntentInput, options: PrecisionModeOptions = {}): Promise<WorkflowResult> {
    const result = this.createResult();
    this.updateState({ status: 'running' });

    this.logger.info('Starting Precision Mode workflow', { input: input.description });
    this.emit('workflow:started', { mode: 'precision', input });

    try {
      // Step 1: Capture Intent
      this.emit('step:started', { step: 'captureIntent' });
      const capturedIntent = this.intentCapture.captureIntent(input);
      result.data.intent = capturedIntent;
      this.logger.info('Intent captured', { intentId: capturedIntent.id });
      this.emit('step:completed', { step: 'captureIntent', intent: capturedIntent });

      // Step 2: Generate PRD
      this.emit('step:started', { step: 'generatePRD' });
      const prd = this.intentCapture.generatePRD(capturedIntent, `Plan: ${input.description}`);
      result.data.prd = prd;
      this.logger.info('PRD generated', { prdId: prd.id });
      this.emit('step:completed', { step: 'generatePRD', prd });

      // Step 3: Create simple decomposition (single phase)
      this.emit('step:started', { step: 'decompose' });
      const decomposition = this.decomposer.decomposeEpic(capturedIntent, prd);
      result.data.epic = decomposition.epic;
      
      // For plan mode, we only use the implementation phase
      const implementationPhase = decomposition.epic.phases.find(p => p.type === 'implementation');
      if (implementationPhase) {
        result.data.phases = [implementationPhase];
        result.data.tickets = implementationPhase.tickets;
      }
      this.emit('step:completed', { step: 'decompose', epic: decomposition.epic });

      // Step 4: Generate tactical plan
      this.emit('step:started', { step: 'generatePlan' });
      const tacticalPlan = this.generateTacticalPlan(capturedIntent, implementationPhase);
      this.logger.info('Tactical plan generated', { 
        filesToTouch: tacticalPlan.filesToTouch,
        estimatedComplexity: tacticalPlan.complexity 
      });
      this.emit('step:completed', { step: 'generatePlan', plan: tacticalPlan });

      // Step 5: Execute plan using VibeEngine
      if (!options.skipVerification || options.autoExecute) {
        this.emit('step:started', { step: 'executePlan' });
        
        // Get LLM configuration from extension context
        const provider = this.context.extensionContext?.globalState.get<string>('openkode.selectedProvider') as LLMProvider;
        const apiKey = provider ? await this.context.extensionContext?.secrets.get(`openkode.apiKey.${provider}`) : undefined;
        
        if (!provider || !apiKey) {
          throw new Error('LLM provider and API key not configured. Please set up your API key in the OpenKode panel.');
        }
        
        const llmConfig = { provider, apiKey };
        const workspaceRoot = this.context.projectRoot;
        
        const vibeEngine = new VibeEngine({ llmConfig, workspaceRoot });
        const prompt = `Implement the following feature based on the tactical plan:

Intent: ${capturedIntent.description}
Requirements: ${capturedIntent.requirements.join(', ')}

Tactical Plan: ${tacticalPlan.title}
Steps: ${tacticalPlan.steps.map(s => `${s.stepNumber}. ${s.title}: ${s.description}`).join('\n')}

Please generate all necessary code files to implement this feature. Focus on:
1. Clean, maintainable code
2. Proper error handling
3. Following best practices for the technology stack
4. Complete implementation that can run immediately`;

        const vibeResult = await vibeEngine.generate(prompt);

        result.data.handoffResults = [{
          handoffId: `handoff-${Date.now()}`,
          status: vibeResult.success ? 'success' : 'failure',
          exitCode: vibeResult.success ? 0 : 1,
          stdout: vibeResult.success ? `Created ${vibeResult.filesCreated.length} files` : '',
          stderr: vibeResult.error || '',
          artifacts: vibeResult.filesCreated.map(f => ({
            type: 'file' as const,
            path: f,
            content: ''
          })),
          changes: {
            filesCreated: vibeResult.filesCreated,
            filesModified: vibeResult.filesUpdated,
            filesDeleted: [],
            linesAdded: 0,
            linesRemoved: 0,
            testsAdded: 0,
            testsModified: 0
          },
          metadata: {
            startedAt: new Date(),
            endedAt: new Date(),
            durationMs: vibeResult.latency,
            agentId: 'vibe-engine',
            command: 'generate'
          },
          result: vibeResult,
          executionTime: vibeResult.latency
        }];
        result.metrics.handoffsPerformed = 1;

        if (vibeResult.success) {
          this.logger.info('Plan execution completed successfully', { 
            filesCreated: vibeResult.filesCreated.length,
            filesUpdated: vibeResult.filesUpdated.length
          });
        } else {
          this.logger.error('Plan execution failed', vibeResult.error);
          result.warnings.push(`Execution failed: ${vibeResult.error || 'Unknown error'}`);
        }
        
        this.emit('step:completed', { step: 'executeHandoff', result: vibeResult });
      }

      // Step 6: Verify results (unless skipped)
      if (!options.skipVerification) {
        this.emit('step:started', { step: 'verify' });
        await this.verifyResults(result);
        this.emit('step:completed', { step: 'verify' });
      }

      result.metrics.phasesExecuted = 1;
      result.metrics.ticketsCompleted = result.data.tickets?.length || 0;

    } catch (error) {
      this.updateState({ status: 'failed' });
      const handledError = this.errorHandler.handle(error, 'PlanMode.execute');
      result.errors = [handledError];
      this.logger.error('Precision Mode workflow failed', handledError);
      this.emit('workflow:failed', { error: handledError });
    }

    this.updateState({ status: 'completed', progress: 100 });
    this.emit('workflow:completed', { result });
    return this.finalizeResult(result);
  }

  /**
   * Generate tactical plan from intent
   */
  private generateTacticalPlan(intent: CapturedIntent, phase?: Phase): {
    filesToTouch: string[];
    complexity: 'low' | 'medium' | 'high';
    approach: string;
    risks: string[];
    title: string;
    steps: { stepNumber: number; title: string; description: string }[];
  } {
    const description = intent.originalInput.description.toLowerCase();
    
    // Infer files to touch from description
    const filesToTouch: string[] = [];
    const filePatterns = [
      /(\w+\.(ts|js|tsx|jsx|py|java|go|rs))/gi,
      /(?:in|to|from)\s+(?:the\s+)?(\w+\/(?:\w+\/)*\w+\.?\w*)/gi,
      /(?:file|module|component)\s+(\w+)/gi
    ];

    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        if (match[1] && !filesToTouch.includes(match[1])) {
          filesToTouch.push(match[1]);
        }
      }
    }

    // Determine complexity
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    if (intent.requirements.length <= 2 && filesToTouch.length <= 3) {
      complexity = 'low';
    } else if (intent.requirements.length > 8 || filesToTouch.length > 10) {
      complexity = 'high';
    }

    // Identify risks
    const risks: string[] = [];
    if (description.includes('refactor')) {
      risks.push('Refactoring may break existing functionality');
    }
    if (description.includes('database') || description.includes('migration')) {
      risks.push('Database changes require careful migration planning');
    }
    if (complexity === 'high') {
      risks.push('High complexity increases risk of bugs');
    }

    return {
      filesToTouch,
      complexity,
      approach: this.determineApproach(intent, complexity),
      risks,
      title: `Tactical Plan: ${intent.description}`,
      steps: intent.requirements.map((req, index) => ({
        stepNumber: index + 1,
        title: req.description || `Step ${index + 1}`,
        description: req.description || 'Implementation step'
      }))
    };
  }

  /**
   * Determine implementation approach
   */
  private determineApproach(intent: CapturedIntent, complexity: string): string {
    if (complexity === 'low') {
      return 'Direct implementation with minimal ceremony';
    } else if (complexity === 'medium') {
      return 'Test-driven implementation with code review';
    } else {
      return 'Phased implementation with comprehensive testing';
    }
  }

  /**
   * Verify execution results
   */
  private async verifyResults(result: WorkflowResult): Promise<void> {
    // Verify acceptance criteria
    const intent = result.data.intent;
    if (intent && intent.acceptanceCriteria.length > 0) {
      this.logger.info(`Verifying ${intent.acceptanceCriteria.length} acceptance criteria`);
      // In a real implementation, this would run actual verification
    }
  }
}

// ============================================================================
// BLUEPRINT MODE - Multi-phase decomposition
// ============================================================================

/**
 * Blueprint Mode Workflow
 * 
 * For complex features requiring multiple phases:
 * - Break complex features into logical phases
 * - Execute phases sequentially
 * - Track progress across phases
 * - Handle dependencies between phases
 */
export class BlueprintModeWorkflow extends BaseWorkflow {
  getMode(): WorkflowMode {
    return 'blueprint';
  }

  async execute(input: IntentInput, options: BlueprintModeOptions = {}): Promise<WorkflowResult> {
    const result = this.createResult();
    this.updateState({ status: 'running' });

    this.logger.info('Starting Blueprint Mode workflow', { input: input.description });
    this.emit('workflow:started', { mode: 'blueprint', input });

    try {
      // Step 1: Capture Intent
      this.emit('step:started', { step: 'captureIntent' });
      const capturedIntent = this.intentCapture.captureIntent(input);
      result.data.intent = capturedIntent;
      this.emit('step:completed', { step: 'captureIntent', intent: capturedIntent });

      // Step 2: Generate PRD
      this.emit('step:started', { step: 'generatePRD' });
      const prd = this.intentCapture.generatePRD(capturedIntent);
      result.data.prd = prd;
      this.emit('step:completed', { step: 'generatePRD', prd });

      // Step 3: Decompose into phases
      this.emit('step:started', { step: 'decompose' });
      const decomposition = this.decomposer.decomposeEpic(capturedIntent, prd);
      result.data.epic = decomposition.epic;
      result.data.phases = decomposition.epic.phases;
      
      // Collect all tickets
      const allTickets: Ticket[] = [];
      for (const phase of decomposition.epic.phases) {
        allTickets.push(...phase.tickets);
      }
      result.data.tickets = allTickets;
      
      this.logger.info(`Decomposed into ${decomposition.epic.phases.length} phases with ${allTickets.length} tickets`);
      this.emit('step:completed', { step: 'decompose', decomposition });

      // Step 4: Execute phases
      const phasesToExecute = options.targetPhases && options.targetPhases.length > 0
        ? decomposition.epic.phases.filter(p => options.targetPhases?.includes(p.id))
        : decomposition.epic.phases;

      const handoffResults: ExecutionResult[] = [];
      let completedPhases = 0;
      let completedTickets = 0;

      for (const phase of phasesToExecute) {
        // Check if we should skip completed phases
        if (options.skipCompleted && phase.status === 'completed') {
          this.logger.info(`Skipping completed phase: ${phase.name}`);
          continue;
        }

        // Check dependencies
        if (phase.dependencies.length > 0) {
          const unmetDeps = phase.dependencies.filter(dep => 
            !this.state.completedPhases.includes(dep)
          );
          if (unmetDeps.length > 0) {
            this.logger.warn(`Phase ${phase.name} has unmet dependencies: ${unmetDeps.join(', ')}`);
            result.warnings.push(`Skipped phase ${phase.name} - unmet dependencies`);
            continue;
          }
        }

        this.updateState({ currentPhase: phase.id });
        this.emit('phase:started', { phase });

        // Execute phase
        const phaseResult = await this.executePhase(phase, options);
        handoffResults.push(...phaseResult);

        // Update state
        this.state.completedPhases.push(phase.id);
        completedPhases++;
        completedTickets += phase.tickets.length;

        this.emit('phase:completed', { phase, results: phaseResult });
        
        // Update progress
        const progress = (completedPhases / phasesToExecute.length) * 100;
        this.updateState({ progress });
      }

      result.data.handoffResults = handoffResults;
      result.metrics.phasesExecuted = completedPhases;
      result.metrics.ticketsCompleted = completedTickets;
      result.metrics.handoffsPerformed = handoffResults.length;

    } catch (error) {
      this.updateState({ status: 'failed' });
      const handledError = this.errorHandler.handle(error, 'BlueprintMode.execute');
      result.errors = [handledError];
      this.logger.error('Blueprint Mode workflow failed', handledError);
      this.emit('workflow:failed', { error: handledError });
    }

    this.updateState({ status: 'completed', progress: 100 });
    this.emit('workflow:completed', { result });
    return this.finalizeResult(result);
  }

  /**
   * Execute a single phase
   */
  private async executePhase(phase: Phase, options: BlueprintModeOptions): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    this.logger.info(`Executing phase: ${phase.name}`, {
      ticketCount: phase.tickets.length,
      type: phase.type
    });

    // Execute tickets in phase
    if (options.parallelTickets) {
      // Execute tickets in parallel
      const ticketPromises = phase.tickets.map(ticket => this.executeTicket(ticket, phase));
      const ticketResults = await Promise.all(ticketPromises);
      results.push(...ticketResults);
    } else {
      // Execute tickets sequentially
      for (const ticket of phase.tickets) {
        const ticketResult = await this.executeTicket(ticket, phase);
        results.push(ticketResult);
      }
    }

    return results;
  }

  /**
   * Execute a single ticket
   */
  private async executeTicket(ticket: Ticket, phase: Phase): Promise<ExecutionResult> {
    this.updateState({ currentTicket: ticket.id });
    this.emit('ticket:started', { ticket, phase });

    // Get LLM configuration from extension context
    const provider = this.context.extensionContext?.globalState.get<string>('openkode.selectedProvider') as LLMProvider;
    const apiKey = provider ? await this.context.extensionContext?.secrets.get(`openkode.apiKey.${provider}`) : undefined;
    
    if (!provider || !apiKey) {
      throw new Error('LLM provider and API key not configured. Please set up your API key in the OpenKode panel.');
    }
    
    const llmConfig = { provider, apiKey };
    const workspaceRoot = this.context.projectRoot;
    
    const vibeEngine = new VibeEngine({ llmConfig, workspaceRoot });
    const vibeResult = await vibeEngine.generate(this.buildTicketPrompt(ticket, phase));

    const result: ExecutionResult = {
      handoffId: `handoff-${Date.now()}`,
      status: vibeResult.success ? 'success' : 'failure',
      exitCode: vibeResult.success ? 0 : 1,
      stdout: vibeResult.success ? `Created ${vibeResult.filesCreated.length} files` : '',
      stderr: vibeResult.error || '',
      artifacts: vibeResult.filesCreated.map(f => ({
        type: 'file' as const,
        path: f,
        content: ''
      })),
      changes: {
        filesCreated: vibeResult.filesCreated,
        filesModified: vibeResult.filesUpdated,
        filesDeleted: [],
        linesAdded: 0,
        linesRemoved: 0,
        testsAdded: 0,
        testsModified: 0
      },
      metadata: {
        startedAt: new Date(),
        endedAt: new Date(),
        durationMs: vibeResult.latency,
        agentId: 'vibe-engine',
        command: 'generate'
      },
      result: vibeResult,
      executionTime: vibeResult.latency
    };

    if (result.status === 'success') {
      this.state.completedTickets.push(ticket.id);
    } else {
      this.state.failedItems.push(ticket.id);
    }

    this.emit('ticket:completed', { ticket, result });
    return result;
  }

  /**
   * Build prompt for ticket execution
   */
  private buildTicketPrompt(ticket: Ticket, phase: Phase): string {
    return `Implement the following ticket:

Ticket: ${ticket.title}
Description: ${ticket.description || 'No description'}
Phase: ${phase.name}
Acceptance Criteria: ${ticket.acceptanceCriteria?.join(', ') || 'None defined'}

Please generate all necessary code files to implement this ticket. Focus on:
1. Clean, maintainable code
2. Proper error handling
3. Following best practices
4. Complete implementation`;
  }

  /**
   * Map phase type to handoff phase type
   */
  private mapPhaseType(type: Phase['type']): PhaseType {
    const mapping: Record<string, PhaseType> = {
      'discovery': 'discovery',
      'design': 'blueprint',
      'implementation': 'execution',
      'testing': 'verification',
      'deployment': 'delivery',
      'documentation': 'delivery',
      'review': 'verification'
    };
    return mapping[type] || 'execution';
  }
}

// ============================================================================
// VISIONARY MODE - High-level intent with ticket generation
// ============================================================================

/**
 * Visionary Mode Workflow
 * 
 * For high-level requirements with full ticket generation:
 * - Capture visionary-level requirements
 * - Generate tickets with acceptance criteria
 * - Track end-to-end execution
 * - Provide overview dashboard
 */
export class VisionaryModeWorkflow extends BaseWorkflow {
  getMode(): WorkflowMode {
    return 'visionary';
  }

  async execute(input: IntentInput, options: VisionaryModeOptions = {}): Promise<WorkflowResult> {
    const result = this.createResult();
    this.updateState({ status: 'running' });

    this.logger.info('Starting Visionary Mode workflow', { input: input.description });
    this.emit('workflow:started', { mode: 'visionary', input });

    try {
      // Step 1: Capture Epic Intent
      this.emit('step:started', { step: 'captureEpic' });
      const capturedIntent = this.intentCapture.captureIntent({
        ...input,
        priority: options.priority || input.priority || 'high'
      });
      result.data.intent = capturedIntent;
      this.emit('step:completed', { step: 'captureEpic', intent: capturedIntent });

      // Step 2: Generate comprehensive PRD
      this.emit('step:started', { step: 'generatePRD' });
      const prd = this.intentCapture.generatePRD(capturedIntent, `Epic: ${input.description}`);
      result.data.prd = prd;
      this.emit('step:completed', { step: 'generatePRD', prd });

      // Step 3: Decompose into full epic structure
      this.emit('step:started', { step: 'decomposeEpic' });
      const decomposition = this.decomposer.decomposeEpic(capturedIntent, prd);
      result.data.epic = decomposition.epic;
      result.data.phases = decomposition.epic.phases;
      
      // Collect all tickets with full details
      const allTickets: Ticket[] = [];
      for (const phase of decomposition.epic.phases) {
        allTickets.push(...phase.tickets);
        
        // Enhance tickets with acceptance criteria if requested
        if (options.generateTickets) {
          for (const ticket of phase.tickets) {
            ticket.acceptanceCriteria = this.generateAcceptanceCriteria(ticket, capturedIntent);
          }
        }
      }
      result.data.tickets = allTickets;
      
      this.logger.info(`Epic decomposed into ${decomposition.epic.phases.length} phases with ${allTickets.length} tickets`);
      this.emit('step:completed', { step: 'decomposeEpic', decomposition });

      // Step 4: Create dashboard if requested
      if (options.createDashboard) {
        this.emit('step:started', { step: 'createDashboard' });
        await this.createDashboard(decomposition.epic);
        this.emit('step:completed', { step: 'createDashboard' });
      }

      // Step 5: Track execution if requested
      if (options.trackExecution) {
        this.emit('step:started', { step: 'trackExecution' });
        const executionResults = await this.trackEpicExecution(decomposition.epic);
        result.data.handoffResults = executionResults;
        result.metrics.handoffsPerformed = executionResults.length;
        this.emit('step:completed', { step: 'trackExecution', results: executionResults });
      }

      result.metrics.phasesExecuted = decomposition.epic.phases.length;
      result.metrics.ticketsCompleted = allTickets.filter(t => t.status === 'completed').length;

    } catch (error) {
      this.updateState({ status: 'failed' });
      const handledError = this.errorHandler.handle(error, 'VisionaryMode.execute');
      result.errors = [handledError];
      this.logger.error('Visionary Mode workflow failed', handledError);
      this.emit('workflow:failed', { error: handledError });
    }

    this.updateState({ status: 'completed', progress: 100 });
    this.emit('workflow:completed', { result });
    return this.finalizeResult(result);
  }

  /**
   * Generate acceptance criteria for a ticket
   */
  private generateAcceptanceCriteria(ticket: Ticket, intent: CapturedIntent): string[] {
    const criteria: string[] = [...ticket.acceptanceCriteria];
    
    // Add type-specific criteria
    switch (ticket.type) {
      case 'feature':
        criteria.push('Code follows project style guidelines');
        criteria.push('Unit tests cover main functionality');
        criteria.push('No console errors or warnings');
        break;
      case 'bug':
        criteria.push('Bug is reproducible and fixed');
        criteria.push('Regression test added');
        criteria.push('No new bugs introduced');
        break;
      case 'test':
        criteria.push('All tests pass consistently');
        criteria.push('Tests cover edge cases');
        criteria.push('Test documentation is complete');
        break;
      case 'docs':
        criteria.push('Documentation is accurate and complete');
        criteria.push('Code examples are tested');
        criteria.push('Links are valid');
        break;
    }

    return [...new Set(criteria)]; // Remove duplicates
  }

  /**
   * Create overview dashboard
   */
  private async createDashboard(epic: Epic): Promise<void> {
    const dashboard = {
      epic: {
        id: epic.id,
        title: epic.title,
        description: epic.description,
        complexity: epic.complexity,
        priority: epic.priority,
        status: epic.status
      },
      phases: epic.phases.map(phase => ({
        id: phase.id,
        name: phase.name,
        type: phase.type,
        status: phase.status,
        ticketCount: phase.tickets.length,
        estimatedDuration: phase.estimatedDuration,
        progress: this.calculatePhaseProgress(phase)
      })),
      summary: {
        totalPhases: epic.phases.length,
        totalTickets: epic.phases.reduce((sum, p) => sum + p.tickets.length, 0),
        totalTasks: epic.phases.reduce((sum, p) => 
          sum + p.tickets.reduce((tSum, t) => tSum + t.tasks.length, 0), 0
        ),
        estimatedEffort: this.calculateTotalEffort(epic)
      }
    };

    this.logger.info('Dashboard created', dashboard);
    this.emit('dashboard:created', { dashboard });
  }

  /**
   * Calculate phase progress
   */
  private calculatePhaseProgress(phase: Phase): number {
    if (phase.tickets.length === 0) return 0;
    const completedTickets = phase.tickets.filter(t => t.status === 'completed').length;
    return Math.round((completedTickets / phase.tickets.length) * 100);
  }

  /**
   * Calculate total estimated effort
   */
  private calculateTotalEffort(epic: Epic): number {
    return epic.phases.reduce((sum, phase) => 
      sum + phase.tickets.reduce((tSum, ticket) => tSum + ticket.estimatedEffort, 0), 0
    );
  }

  /**
   * Track epic execution
   */
  private async trackEpicExecution(epic: Epic): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const phase of epic.phases) {
      this.updateState({ currentPhase: phase.id });
      
      for (const ticket of phase.tickets) {
        const agent = this.selectAgentForTicketType(ticket.type);
        const prompt = this.buildEpicTicketPrompt(ticket, phase, epic);
        
        const result = await this.executeHandoff(
          this.mapPhaseType(phase.type),
          prompt,
          agent,
          ticket.relatedFiles
        );
        
        results.push(result);
        
        // Update ticket status based on result
        ticket.status = result.status === 'success' ? 'completed' : 'blocked';
      }
    }

    return results;
  }

  /**
   * Select agent based on ticket type
   */
  private selectAgentForTicketType(type: TicketType): AgentConfig {
    return this.selectAgentForTicket({ type } as Ticket);
  }

  /**
   * Map phase type to handoff phase type
   */
  private mapPhaseType(type: Phase['type']): PhaseType {
    const mapping: Record<string, PhaseType> = {
      'discovery': 'discovery',
      'design': 'blueprint',
      'implementation': 'execution',
      'testing': 'verification',
      'deployment': 'delivery',
      'documentation': 'delivery',
      'review': 'verification'
    };
    return mapping[type] || 'execution';
  }

  /**
   * Select agent based on ticket
   */
  private selectAgentForTicket(ticket: Ticket): AgentConfig {
    const agentTypes: Record<string, AgentConfig> = {
      'feature': {
        id: 'feature-coder',
        name: 'Feature Coder',
        type: 'custom',
        version: '1.0.0',
        description: 'Agent for implementing new features',
        capabilities: {
          multiFileEdit: true,
          terminalAccess: true,
          webSearch: false,
          codeIndexing: true,
          gitIntegration: true,
          testExecution: true,
          lspSupport: true,
          contextWindow: 128000,
          streamingSupport: true,
          fileCreation: true,
          fileDeletion: true,
          canCreateFiles: true,
          canModifyFiles: true,
          canRunCommands: false,
          canAccessWeb: false
        },
        enabled: true,
        priority: 2,
        execution: {
          command: 'echo',
          args: ['Feature implementation'],
          timeoutMs: 300000,
          envVars: {},
          shell: 'bash'
        }
      },
      'test': {
        id: 'test-writer',
        name: 'Test Writer',
        type: 'custom',
        version: '1.0.0',
        description: 'Agent for writing tests',
        capabilities: {
          multiFileEdit: true,
          terminalAccess: true,
          webSearch: false,
          codeIndexing: true,
          gitIntegration: true,
          testExecution: true,
          lspSupport: true,
          contextWindow: 128000,
          streamingSupport: true,
          fileCreation: true,
          fileDeletion: true,
          canCreateFiles: true,
          canModifyFiles: true,
          canRunCommands: false,
          canAccessWeb: false
        },
        enabled: true,
        priority: 1,
        execution: {
          command: 'echo',
          args: ['Test implementation'],
          timeoutMs: 180000,
          envVars: {},
          shell: 'bash'
        }
      },
      'docs': {
        id: 'doc-writer',
        name: 'Documentation Writer',
        type: 'custom',
        version: '1.0.0',
        description: 'Agent for writing documentation',
        capabilities: {
          multiFileEdit: true,
          terminalAccess: true,
          webSearch: false,
          codeIndexing: true,
          gitIntegration: true,
          testExecution: true,
          lspSupport: true,
          contextWindow: 128000,
          streamingSupport: true,
          fileCreation: true,
          fileDeletion: true,
          canCreateFiles: true,
          canModifyFiles: true,
          canRunCommands: false,
          canAccessWeb: false
        },
        enabled: true,
        priority: 1,
        execution: {
          command: 'echo',
          args: ['Documentation'],
          timeoutMs: 120000,
          envVars: {},
          shell: 'bash'
        }
      }
    };

    return agentTypes[ticket.type] || agentTypes['feature'];
  }

  /**
   * Build prompt for epic ticket
   */
  private buildEpicTicketPrompt(ticket: Ticket, phase: Phase, epic: Epic): string {
    return `# Epic: ${epic.title}

## Phase: ${phase.name}
### Phase Exit Criteria
${phase.exitCriteria.map(ec => `- ${ec}`).join('\n')}

## Ticket: ${ticket.title}
**Type:** ${ticket.type}
**Priority:** ${ticket.priority}
**Estimated Effort:** ${ticket.estimatedEffort} points

### Description
${ticket.description}

### Acceptance Criteria
${ticket.acceptanceCriteria.map(ac => `- [ ] ${ac}`).join('\n')}

### Tasks
${ticket.tasks.map(t => `- [ ] ${t.description} (${t.estimatedHours}h)`).join('\n')}

Please complete this ticket ensuring all acceptance criteria are met.
`;
  }
}

// ============================================================================
// ROCKET MODE - Fully automated execution
// ============================================================================

/**
 * Rocket Mode Workflow
 * 
 * For fully automated execution with minimal intervention:
 * - Auto-select appropriate workflow
 * - Execute with minimal human intervention
 * - Auto-commit changes
 * - Dynamic strategy adjustment
 */
export class RocketModeWorkflow extends BaseWorkflow {
  getMode(): WorkflowMode {
    return 'rocket';
  }

  async execute(input: IntentInput, options: RocketModeOptions = {}): Promise<WorkflowResult> {
    const result = this.createResult();
    this.updateState({ status: 'running' });

    const autonomyLevel = options.autonomyLevel || 3;
    this.logger.info('Starting Rocket Mode workflow', { 
      input: input.description,
      autonomyLevel 
    });
    this.emit('workflow:started', { mode: 'rocket', input, autonomyLevel });

    try {
      // Step 1: Analyze and auto-select workflow
      this.emit('step:started', { step: 'autoSelect' });
      const selection = this.autoSelectWorkflow(input);
      this.logger.info(`Auto-selected workflow: ${selection.mode}`, selection.reasoning);
      this.emit('step:completed', { step: 'autoSelect', selection });

      // Step 2: Execute selected workflow with YOLO enhancements
      this.emit('step:started', { step: 'execute' });
      
      let subResult: WorkflowResult;
      const subOptions = this.buildSubOptions(selection.mode, options);
      
      switch (selection.mode) {
        case 'precision':
          subResult = await new PrecisionModeWorkflow(this.context).execute(input, subOptions as PrecisionModeOptions);
          break;
        case 'blueprint':
          subResult = await new BlueprintModeWorkflow(this.context).execute(input, subOptions as BlueprintModeOptions);
          break;
        case 'visionary':
          subResult = await new VisionaryModeWorkflow(this.context).execute(input, subOptions as VisionaryModeOptions);
          break;
        default:
          subResult = await new PrecisionModeWorkflow(this.context).execute(input, subOptions as PrecisionModeOptions);
      }

      // Merge sub-result into main result
      result.data = subResult.data;
      result.warnings = subResult.warnings;
      if (subResult.errors) {
        result.errors = subResult.errors;
      }
      this.emit('step:completed', { step: 'execute', subResult });

      // Step 3: Auto-commit if enabled and successful
      if (options.autoCommit && subResult.success) {
        this.emit('step:started', { step: 'autoCommit' });
        await this.autoCommitChanges(input, result);
        this.emit('step:completed', { step: 'autoCommit' });
      }

      // Step 4: Dynamic adjustment if needed
      if (options.dynamicAdjustment && !subResult.success) {
        this.emit('step:started', { step: 'adjustStrategy' });
        const adjustedResult = await this.adjustStrategy(input, options, result);
        if (adjustedResult) {
          result.data = adjustedResult.data;
          result.warnings.push(...adjustedResult.warnings);
        }
        this.emit('step:completed', { step: 'adjustStrategy', adjustedResult });
      }

      // Step 5: Rollback on failure if enabled
      if (options.rollbackOnFailure && !subResult.success) {
        this.emit('step:started', { step: 'rollback' });
        await this.rollbackChanges();
        this.emit('step:completed', { step: 'rollback' });
      }

      result.metrics = subResult.metrics;

    } catch (error) {
      this.updateState({ status: 'failed' });
      const handledError = this.errorHandler.handle(error, 'RocketMode.execute');
      result.errors = [handledError];
      this.logger.error('Rocket Mode workflow failed', handledError);
      this.emit('workflow:failed', { error: handledError });

      // Attempt rollback on critical failure
      if (options.rollbackOnFailure) {
        await this.rollbackChanges();
      }
    }

    this.updateState({ status: 'completed', progress: 100 });
    this.emit('workflow:completed', { result });
    return this.finalizeResult(result);
  }

  /**
   * Auto-select appropriate workflow based on input analysis
   */
  private autoSelectWorkflow(input: IntentInput): {
    mode: WorkflowMode;
    confidence: number;
    reasoning: string[];
  } {
    const description = input.description.toLowerCase();
    const reasoning: string[] = [];
    let precisionScore = 0;
    let blueprintScore = 0;
    let visionaryScore = 0;

    // Analyze description for complexity indicators
    const wordCount = description.split(/\s+/).length;
    const sentenceCount = description.split(/[.!?]+/).length;

    // Precision mode indicators (simple, tactical)
    if (wordCount < 30) {
      precisionScore += 2;
      reasoning.push('Short description suggests simple change');
    }
    if (description.includes('fix') || description.includes('bug')) {
      precisionScore += 2;
      reasoning.push('Bug fix typically requires precision mode');
    }
    if (description.includes('quick') || description.includes('simple')) {
      precisionScore += 1;
      reasoning.push('Explicit simplicity indicator');
    }

    // Blueprint mode indicators (multi-step)
    if (wordCount > 50 && wordCount < 150) {
      blueprintScore += 2;
      reasoning.push('Medium description suggests multi-phase work');
    }
    if (description.includes('and then') || description.includes('followed by')) {
      blueprintScore += 2;
      reasoning.push('Sequential indicators found');
    }
    if (description.includes('first') && description.includes('then')) {
      blueprintScore += 1;
      reasoning.push('Multiple steps indicated');
    }

    // Visionary mode indicators (large, complex)
    if (wordCount > 150) {
      visionaryScore += 2;
      reasoning.push('Long description suggests visionary-level work');
    }
    if (description.includes('visionary') || description.includes('feature')) {
      visionaryScore += 2;
      reasoning.push('Visionary/feature terminology detected');
    }
    if (description.includes('system') || description.includes('architecture')) {
      visionaryScore += 1;
      reasoning.push('System-level change indicated');
    }
    if (sentenceCount > 5) {
      visionaryScore += 1;
      reasoning.push('Multiple sentences suggest complexity');
    }

    // Determine winner
    let selectedMode: WorkflowMode = 'precision';
    let confidence = 0.5;

    if (visionaryScore >= blueprintScore && visionaryScore >= precisionScore && visionaryScore > 0) {
      selectedMode = 'visionary';
      confidence = 0.5 + (visionaryScore * 0.1);
    } else if (blueprintScore >= precisionScore && blueprintScore > 0) {
      selectedMode = 'blueprint';
      confidence = 0.5 + (blueprintScore * 0.1);
    } else {
      selectedMode = 'precision';
      confidence = 0.5 + (precisionScore * 0.1);
    }

    return {
      mode: selectedMode,
      confidence: Math.min(confidence, 0.95),
      reasoning
    };
  }

  /**
   * Build sub-workflow options based on mode
   */
  private buildSubOptions(mode: WorkflowMode, rocketOptions: RocketModeOptions): unknown {
    const baseOptions = {
      autoExecute: true,
      skipVerification: rocketOptions.autonomyLevel && rocketOptions.autonomyLevel >= 4
    };

    switch (mode) {
      case 'precision':
        return {
          ...baseOptions,
          skipVerification: rocketOptions.autonomyLevel && rocketOptions.autonomyLevel >= 3
        } as PrecisionModeOptions;
      
      case 'blueprint':
        return {
          sequential: true,
          skipCompleted: true,
          parallelTickets: rocketOptions.autonomyLevel && rocketOptions.autonomyLevel >= 4
        } as BlueprintModeOptions;
      
      case 'visionary':
        return {
          generateTickets: true,
          createDashboard: true,
          trackExecution: rocketOptions.autonomyLevel && rocketOptions.autonomyLevel >= 2
        } as VisionaryModeOptions;
      
      default:
        return baseOptions;
    }
  }

  /**
   * Auto-commit changes
   */
  private async autoCommitChanges(input: IntentInput, result: WorkflowResult): Promise<void> {
    this.logger.info('Auto-committing changes');
    
    // Generate commit message
    const commitMessage = this.generateCommitMessage(input, result);
    
    // In a real implementation, this would execute git commands
    this.emit('commit:created', { message: commitMessage });
    this.logger.info(`Commit message: ${commitMessage}`);
  }

  /**
   * Generate commit message from result
   */
  private generateCommitMessage(input: IntentInput, result: WorkflowResult): string {
    const epic = result.data.epic;
    const intent = result.data.intent;
    
    let message = '';
    
    if (epic) {
      message = `feat: ${epic.title}`;
    } else if (intent) {
      const firstSentence = intent.originalInput.description.split(/[.!?]/)[0];
      message = `feat: ${firstSentence.substring(0, 50)}`;
    } else {
      message = `feat: ${input.description.substring(0, 50)}`;
    }

    // Add scope if available
    if (input.tags && input.tags.length > 0) {
      message = message.replace('feat:', `feat(${input.tags[0]}):`);
    }

    return message;
  }

  /**
   * Adjust strategy on failure
   */
  private async adjustStrategy(
    input: IntentInput,
    options: RocketModeOptions,
    currentResult: WorkflowResult
  ): Promise<WorkflowResult | null> {
    this.logger.info('Attempting strategy adjustment');
    
    // Try with more conservative approach
    const adjustedOptions: RocketModeOptions = {
      ...options,
      autonomyLevel: Math.max(1, (options.autonomyLevel || 3) - 1),
      autoSelectMode: false
    };

    // Retry with precision mode (most conservative)
    try {
      return await new PrecisionModeWorkflow(this.context).execute(input, {
        autoExecute: false,
        skipVerification: false
      });
    } catch (error) {
      this.logger.error('Strategy adjustment failed', error);
      return null;
    }
  }

  /**
   * Rollback changes on failure
   */
  private async rollbackChanges(): Promise<void> {
    this.logger.warn('Rolling back changes');
    
    // In a real implementation, this would:
    // 1. Check for uncommitted changes
    // 2. Stash or revert them
    // 3. Notify user
    
    this.emit('rollback:completed', {});
  }
}

// ============================================================================
// WORKFLOW FACTORY
// ============================================================================

/**
 * Factory for creating workflow instances
 */
export class WorkflowFactory {
  /**
   * Create a workflow instance for the specified mode
   */
  static create(mode: WorkflowMode, context: WorkflowContext): BaseWorkflow {
    switch (mode) {
      case 'precision':
        return new PrecisionModeWorkflow(context);
      case 'blueprint':
        return new BlueprintModeWorkflow(context);
      case 'visionary':
        return new VisionaryModeWorkflow(context);
      case 'rocket':
        return new RocketModeWorkflow(context);
      default:
        throw new Error(`Unknown workflow mode: ${mode}`);
    }
  }

  /**
   * Get available workflow modes
   */
  static getAvailableModes(): { mode: WorkflowMode; name: string; description: string }[] {
    return [
      {
        mode: 'precision',
        name: 'Precision Mode',
        description: 'Single-phase tactical changes for quick fixes and small features'
      },
      {
        mode: 'blueprint',
        name: 'Blueprint Mode',
        description: 'Multi-phase decomposition for complex features with dependencies'
      },
      {
        mode: 'visionary',
        name: 'Visionary Mode',
        description: 'High-level intent with full ticket generation and tracking'
      },
      {
        mode: 'rocket',
        name: 'Rocket Mode',
        description: 'Fully automated execution with minimal human intervention'
      }
    ];
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  BaseWorkflow,
  PrecisionModeWorkflow,
  BlueprintModeWorkflow,
  VisionaryModeWorkflow,
  RocketModeWorkflow,
  WorkflowFactory
};
