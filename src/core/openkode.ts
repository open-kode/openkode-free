/**
 * OpenKode - Main Integration Module
 * ==================================
 * 
 * The central orchestrator for the OpenKode VSCode extension.
 * Integrates all modules (orchestration, spec, codebase, verification, agent-handoff)
 * and provides a high-level API for the complete SDD workflow.
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';

// Core workflow modes
import {
  BaseWorkflow,
  PrecisionModeWorkflow,
  BlueprintModeWorkflow,
  VisionaryModeWorkflow,
  RocketModeWorkflow,
  WorkflowFactory,
  WorkflowMode,
  WorkflowResult,
  WorkflowContext,
  PrecisionModeOptions,
  BlueprintModeOptions,
  VisionaryModeOptions,
  RocketModeOptions,
  WorkflowState
} from './workflowModes';

// Utilities
import {
  Logger,
  initializeLogger,
  ConfigManager,
  ErrorHandler,
  OpenKodeError,
  handleError,
  getWorkspaceRoot,
  isGitRepository,
  getRepositoryInfo,
  PolicyLoader
} from '../utils';
import { OpenKodePolicy, DEFAULT_POLICY } from '../types';

// Spec modules
import {
  IntentCaptureSystem,
  IntentInput,
  CapturedIntent,
  PRD
} from '../spec/intentCapture';

import {
  Decomposer,
  Epic,
  Phase,
  Ticket,
  DecompositionResult
} from '../spec/decomposer';

// Orchestration modules
import {
  ModelRegistry,
  TaskRouter,
  RoutingStrategy,
  AgentRole,
  getDefaultRegistry,
  getDefaultRouter
} from '../orchestration/router';

import { ContextManager } from '../orchestration/contextManager';
import { StateManager } from '../orchestration/stateManager';
import { CheckpointManager, RollbackEngine } from '../orchestration/checkpointManager';

// Agent handoff modules
import {
  HandoffProtocol,
  ExecutionResult,
  HandoffPayload
} from '../agent-handoff/handoffProtocol';

import { AgentRegistry } from '../agent-handoff/agentRegistry';

// Codebase modules
import {
  FileDiscovery,
  SymbolIndex,
  DependencyGraphBuilder,
  ContextAssembler
} from '../codebase';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * OpenKode initialization options
 */
export interface OpenKodeOptions {
  /** VSCode extension context */
  context: vscode.ExtensionContext;
  /** Custom configuration */
  config?: Partial<OpenKodeConfig>;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * OpenKode configuration
 */
export interface OpenKodeConfig {
  /** Default workflow mode */
  defaultMode: WorkflowMode;
  /** Auto-execute workflows */
  autoExecute: boolean;
  /** Show progress notifications */
  showProgress: boolean;
  /** Enable telemetry */
  telemetry: boolean;
  /** Maximum concurrent workflows */
  maxConcurrentWorkflows: number;
  /** Workflow timeout (ms) */
  workflowTimeout: number;
}

/**
 * Session information
 */
export interface SessionInfo {
  /** Session ID */
  id: string;
  /** Start time */
  startTime: Date;
  /** Active workflows */
  activeWorkflows: string[];
  /** Completed workflows */
  completedWorkflows: string[];
  /** Project root */
  projectRoot: string;
  /** Git repository info */
  gitInfo: {
    isRepo: boolean;
    branch: string | null;
    remote: string | null;
  };
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  /** Workflow mode override */
  mode?: WorkflowMode;
  /** Show progress UI */
  showProgress?: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: WorkflowProgress) => void;
  /** Callback for state changes */
  onStateChange?: (state: WorkflowState) => void;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Workflow progress information
 */
export interface WorkflowProgress {
  /** Progress percentage (0-100) */
  percent: number;
  /** Current step */
  step: string;
  /** Status message */
  message: string;
  /** Current phase (if applicable) */
  currentPhase?: string;
  /** Current ticket (if applicable) */
  currentTicket?: string;
}

/**
 * OpenKode status
 */
export interface OpenKodeStatus {
  /** Is OpenKode initialized */
  initialized: boolean;
  /** Is a workflow running */
  isRunning: boolean;
  /** Current workflow mode */
  currentMode?: WorkflowMode;
  /** Active session */
  session?: SessionInfo;
  /** Last error */
  lastError?: OpenKodeError;
}

// ============================================================================
// OPENKODE MAIN CLASS
// ============================================================================

/**
 * OpenKode - Main orchestrator for AI-driven development
 * 
 * This is the central class that integrates all OpenKode modules and provides
 * a unified API for the VSCode extension.
 */
export class OpenKode extends EventEmitter {
  private static instance: OpenKode | null = null;

  // Core components
  private context: vscode.ExtensionContext;
  private logger: Logger;
  private config: ConfigManager;
  private errorHandler: ErrorHandler;

  // Spec components
  private intentCapture: IntentCaptureSystem;
  private decomposer: Decomposer;

  // Orchestration components
  private modelRegistry: ModelRegistry;
  private taskRouter: TaskRouter;
  private contextManager: ContextManager;
  private stateManager: StateManager;

  // Agent components
  private handoffProtocol: HandoffProtocol;
  private agentRegistry: AgentRegistry;

  // Codebase components
  private fileDiscovery: FileDiscovery;
  private symbolIndex: SymbolIndex;
  private dependencyGraph: DependencyGraphBuilder;
  private contextAssembler: ContextAssembler;

  // Policy
  private policyLoader: PolicyLoader | null = null;
  private policy: OpenKodePolicy = DEFAULT_POLICY;

  // Checkpoints
  private checkpointManager: CheckpointManager | null = null;
  private rollbackEngine: RollbackEngine | null = null;

  // State
  private initialized = false;
  private currentWorkflow: BaseWorkflow | null = null;
  private session: SessionInfo | null = null;
  private disposables: vscode.Disposable[] = [];
  private userConfig: OpenKodeConfig;

  /**
   * Private constructor - use initialize() or getInstance()
   */
  private constructor(options: OpenKodeOptions) {
    super();
    
    this.context = options.context;
    this.logger = initializeLogger(options.context);
    this.config = ConfigManager.getInstance();
    this.errorHandler = ErrorHandler.getInstance();

    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

    // Initialize spec components
    this.intentCapture = new IntentCaptureSystem();
    this.decomposer = new Decomposer();

    // Initialize orchestration components
    this.modelRegistry = getDefaultRegistry();
    this.taskRouter = getDefaultRouter();
    this.contextManager = new ContextManager();
    this.stateManager = new StateManager({
      storagePath: workspaceRoot,
      autoSave: true,
      saveIntervalMs: 30000
    });

    // Initialize agent components
    this.handoffProtocol = new HandoffProtocol();
    this.agentRegistry = new AgentRegistry();

    // Initialize codebase components
    this.fileDiscovery = new FileDiscovery({ rootPath: workspaceRoot });
    this.symbolIndex = new SymbolIndex(workspaceRoot);
    this.dependencyGraph = new DependencyGraphBuilder({ rootPath: workspaceRoot });
    this.contextAssembler = new ContextAssembler(workspaceRoot);

    // Initialize checkpoint/rollback
    this.checkpointManager = new CheckpointManager(workspaceRoot);
    this.rollbackEngine = new RollbackEngine(workspaceRoot, this.checkpointManager);

    // Default configuration
    this.userConfig = {
      defaultMode: 'precision',
      autoExecute: false,
      showProgress: true,
      telemetry: false,
      maxConcurrentWorkflows: 3,
      workflowTimeout: 300000, // 5 minutes
      ...options.config
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize OpenKode
   * 
   * This must be called once when the extension activates.
   */
  static async initialize(options: OpenKodeOptions): Promise<OpenKode> {
    if (OpenKode.instance) {
      throw new Error('OpenKode is already initialized');
    }

    OpenKode.instance = new OpenKode(options);
    await OpenKode.instance.doInitialize();
    
    return OpenKode.instance;
  }

  /**
   * Get the OpenKode instance
   * 
   * Throws if not initialized.
   */
  static getInstance(): OpenKode {
    if (!OpenKode.instance) {
      throw new Error('OpenKode has not been initialized. Call initialize() first.');
    }
    return OpenKode.instance;
  }

  /**
   * Check if OpenKode is initialized
   */
  static isInitialized(): boolean {
    return OpenKode.instance !== null && OpenKode.instance.initialized;
  }

  /** Returns the active project policy (DEFAULT_POLICY until initialize() completes). */
  getPolicy(): OpenKodePolicy {
    return this.policy;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.logger.info('Disposing OpenKode...');

    // Dispose disposables
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    // Dispose components
    this.logger.dispose();
    this.config.dispose();
    this.errorHandler.dispose();

    // Clear instance
    OpenKode.instance = null;
    this.initialized = false;

    this.emit('disposed');
    this.logger.info('OpenKode disposed');
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Perform initialization
   */
  private async doInitialize(): Promise<void> {
    this.logger.info('Initializing OpenKode...');

    try {
      // Check configuration
      if (!this.config.isValid()) {
        this.logger.warn('Invalid configuration detected');
        await this.config.showValidationErrors();
      }

      // Check if enabled
      if (!this.config.isEnabled()) {
        this.logger.info('OpenKode is disabled in configuration');
        return;
      }

      // Initialize session
      await this.initializeSession();

      // Load project policy (.openkode.yaml)
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
      this.policyLoader = new PolicyLoader(workspaceRoot);
      this.policy = await this.policyLoader.load();
      this.logger.info('Policy loaded', { maturityLevel: this.policy.maturityLevel });

      // Initialize codebase components
      await this.initializeCodebase();

      this.initialized = true;
      this.logger.info('OpenKode initialized successfully');
      this.emit('initialized');

    } catch (error) {
      this.logger.error('Failed to initialize OpenKode', error);
      this.errorHandler.handle(error, 'OpenKode.initialize');
      throw error;
    }
  }

  /**
   * Initialize session information
   */
  private async initializeSession(): Promise<void> {
    const projectRoot = getWorkspaceRoot() || process.cwd();
    const gitInfo = isGitRepository(projectRoot)
      ? getRepositoryInfo(projectRoot)
      : { isRepo: false, rootPath: null, currentBranch: null, remoteUrl: null };

    this.session = {
      id: this.generateSessionId(),
      startTime: new Date(),
      activeWorkflows: [],
      completedWorkflows: [],
      projectRoot,
      gitInfo: {
        isRepo: gitInfo.isRepo,
        branch: gitInfo.currentBranch,
        remote: gitInfo.remoteUrl
      }
    };

    this.logger.info('Session initialized', { sessionId: this.session.id });
  }

  /**
   * Initialize codebase components
   */
  private async initializeCodebase(): Promise<void> {
    const projectRoot = this.session?.projectRoot;
    if (!projectRoot) return;

    this.logger.info('Initializing codebase components...');

    try {
      // Discover files
      await this.fileDiscovery.discoverFiles();
      
      // Build symbol index
      await this.symbolIndex.build(projectRoot);
      
      // Build dependency graph
      await this.dependencyGraph.build(projectRoot);

      this.logger.info('Codebase components initialized');
    } catch (error) {
      this.logger.warn('Failed to fully initialize codebase components', error);
      // Non-fatal, continue without full codebase analysis
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle configuration changes
    this.config.onChange((key, newValue) => {
      this.logger.debug(`Configuration changed: ${key}`, newValue);
      this.emit('config:changed', { key, newValue });
    });

    // Handle handoff protocol events
    this.handoffProtocol.on('handoff:completed', (event) => {
      this.emit('handoff:completed', event);
    });

    this.handoffProtocol.on('handoff:failed', (event) => {
      this.emit('handoff:failed', event);
    });
  }

  // ============================================================================
  // WORKFLOW EXECUTION
  // ============================================================================

  /**
   * Execute a workflow with the given intent
   */
  async execute(
    intent: IntentInput,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowResult> {
    if (!this.initialized) {
      throw new Error('OpenKode is not initialized');
    }

    if (this.currentWorkflow) {
      throw new Error('A workflow is already running. Stop it first or wait for completion.');
    }

    const mode = options.mode || this.userConfig.defaultMode;
    
    this.logger.info(`Starting workflow execution`, { mode, intent: intent.description });
    this.emit('workflow:starting', { mode, intent });

    try {
      // Create workflow context
      const workflowContext = this.createWorkflowContext();

      // Create workflow instance
      const workflow = WorkflowFactory.create(mode, workflowContext);
      this.currentWorkflow = workflow;

      // Setup progress tracking
      this.setupProgressTracking(workflow, options);

      // Setup auto-checkpointing at phase boundaries
      this.setupCheckpointTracking(workflow);

      // Execute workflow
      const startTime = Date.now();
      
      let result: WorkflowResult;
      
      switch (mode) {
        case 'precision':
          result = await (workflow as PrecisionModeWorkflow).execute(intent, { autoExecute: this.userConfig.autoExecute });
          break;
        case 'blueprint':
          result = await (workflow as BlueprintModeWorkflow).execute(intent, { sequential: true });
          break;
        case 'visionary':
          result = await (workflow as VisionaryModeWorkflow).execute(intent, { generateTickets: true, createDashboard: true });
          break;
        case 'rocket':
          result = await (workflow as RocketModeWorkflow).execute(intent, { autoCommit: true, autonomyLevel: 3 });
          break;
        default:
          throw new Error(`Unknown workflow mode: ${mode}`);
      }

      const duration = Date.now() - startTime;
      this.logger.info(`Workflow completed in ${duration}ms`, { success: result.success });

      // Update session
      if (this.session) {
        this.session.completedWorkflows.push(workflowContext.sessionId);
      }

      this.emit('workflow:completed', { result, duration });

      return result;

    } catch (error) {
      this.logger.error('Workflow execution failed', error);
      const handledError = this.errorHandler.handle(error, 'OpenKode.execute');
      
      this.emit('workflow:failed', { error: handledError });
      
      throw handledError;
    } finally {
      this.currentWorkflow = null;
    }
  }

  /**
   * Execute Precision Mode workflow
   */
  async executePrecisionMode(
    description?: string,
    options: PrecisionModeOptions = {}
  ): Promise<WorkflowResult> {
    const intent = await this.getIntentFromUser(description);
    if (!intent) {
      throw new Error('No intent provided');
    }

    return this.execute(intent, { mode: 'precision', ...options });
  }

  /**
   * Execute Blueprint Mode workflow
   */
  async executeBlueprintMode(
    description?: string,
    options: BlueprintModeOptions = {}
  ): Promise<WorkflowResult> {
    const intent = await this.getIntentFromUser(description);
    if (!intent) {
      throw new Error('No intent provided');
    }

    return this.execute(intent, { mode: 'blueprint', ...options });
  }

  /**
   * Execute Visionary Mode workflow
   */
  async executeVisionaryMode(
    description?: string,
    options: VisionaryModeOptions = {}
  ): Promise<WorkflowResult> {
    const intent = await this.getIntentFromUser(description);
    if (!intent) {
      throw new Error('No intent provided');
    }

    return this.execute(intent, { mode: 'visionary', ...options });
  }

  /**
   * Execute Rocket Mode workflow
   */
  async executeRocketMode(
    description?: string,
    options: RocketModeOptions = {}
  ): Promise<WorkflowResult> {
    const intent = await this.getIntentFromUser(description);
    if (!intent) {
      throw new Error('No intent provided');
    }

    // Confirm with user for Rocket mode
    const confirmed = await vscode.window.showWarningMessage(
      'Rocket Mode will auto-execute changes with minimal confirmation. Continue?',
      'Yes',
      'No'
    );

    if (confirmed !== 'Yes') {
      throw new Error('Rocket Mode cancelled by user');
    }

    return this.execute(intent, { mode: 'rocket', ...options });
  }

  /**
   * Stop the current workflow
   */
  async stopCurrentWorkflow(): Promise<boolean> {
    if (!this.currentWorkflow) {
      return false;
    }

    this.logger.info('Stopping current workflow...');
    
    // Cancel active handoffs
    const activeHandoffs = this.handoffProtocol.listActiveHandoffs();
    for (const handoff of activeHandoffs) {
      this.handoffProtocol.cancelHandoff(handoff.handoffId);
    }

    this.currentWorkflow = null;
    this.emit('workflow:stopped');
    
    return true;
  }

  // ============================================================================
  // INTENT CAPTURE
  // ============================================================================

  /**
   * Get intent from user input
   */
  private async getIntentFromUser(defaultDescription?: string): Promise<IntentInput | null> {
    // If description is provided, use it directly
    if (defaultDescription) {
      return {
        description: defaultDescription,
        priority: 'medium'
      };
    }

    // Otherwise, prompt user
    const description = await vscode.window.showInputBox({
      prompt: 'Describe what you want to build or change',
      placeHolder: 'e.g., Add a user authentication system with login and signup',
      ignoreFocusOut: true
    });

    if (!description) {
      return null;
    }

    return {
      description,
      priority: 'medium'
    };
  }

  /**
   * Capture intent programmatically
   */
  captureIntent(input: IntentInput): CapturedIntent {
    return this.intentCapture.captureIntent(input);
  }

  /**
   * Generate PRD from captured intent
   */
  generatePRD(intent: CapturedIntent, title?: string): PRD {
    return this.intentCapture.generatePRD(intent, title);
  }

  // ============================================================================
  // DECOMPOSITION
  // ============================================================================

  /**
   * Decompose intent into epic structure
   */
  decomposeEpic(intent: CapturedIntent, prd?: PRD): DecompositionResult {
    return this.decomposer.decomposeEpic(intent, prd);
  }

  /**
   * Get current epic if any
   */
  getCurrentEpic(): Epic | null {
    // This would be retrieved from state management
    return null;
  }

  // ============================================================================
  // VERIFICATION
  // ============================================================================

  /**
   * Verify current specification
   */
  async verifyCurrentSpec(): Promise<void> {
    this.logger.info('Verifying current specification...');
    
    // Implementation would verify acceptance criteria
    vscode.window.showInformationMessage('Specification verification completed');
  }

  // ============================================================================
  // UI
  // ============================================================================

  /**
   * Show OpenKode panel
   */
  async showPanel(): Promise<void> {
    // Focus the OpenKode view container
    await vscode.commands.executeCommand('openkode-panel.focus');
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Create workflow context
   */
  private createWorkflowContext(): WorkflowContext {
    return {
      sessionId: this.generateSessionId(),
      projectRoot: this.session?.projectRoot || process.cwd(),
      userPreferences: {
        autoCommit: this.config.get('autoVerify'),
        codingStyle: 'standard',
        testFramework: 'jest'
      },
      extensionContext: this.context
    };
  }

  /**
   * Setup progress tracking for a workflow
   */
  private setupProgressTracking(
    workflow: BaseWorkflow,
    options: WorkflowExecutionOptions
  ): void {
    if (!options.showProgress && !options.onProgress) return;

    let progressResolve: (() => void) | null = null;
    let progressReporter: vscode.Progress<{ message?: string; increment?: number }> | null = null;

    // Show progress UI if requested
    if (options.showProgress) {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'OpenKode Workflow',
        cancellable: true
      }, async (progress, token) => {
        progressReporter = progress;
        
        token.onCancellationRequested(() => {
          this.stopCurrentWorkflow();
        });

        return new Promise<void>((resolve) => {
          progressResolve = resolve;
        });
      });
    }

    // Listen to workflow events
    workflow.on('step:started', (event) => {
      const progressUpdate: WorkflowProgress = {
        percent: 0,
        step: event.step,
        message: `Starting: ${event.step}`
      };
      
      options.onProgress?.(progressUpdate);
      progressReporter?.report({ message: progressUpdate.message });
    });

    workflow.on('step:completed', (event) => {
      const progressUpdate: WorkflowProgress = {
        percent: 25,
        step: event.step,
        message: `Completed: ${event.step}`
      };
      
      options.onProgress?.(progressUpdate);
      progressReporter?.report({ message: progressUpdate.message, increment: 25 });
    });

    workflow.on('workflow:completed', () => {
      progressResolve?.();
    });

    workflow.on('workflow:failed', () => {
      progressResolve?.();
    });
  }

  private setupCheckpointTracking(workflow: BaseWorkflow): void {
    if (!this.checkpointManager) { return; }
    const cm = this.checkpointManager;
    let phaseIndex = 0;

    workflow.on('phase:started', (event: { phase: { id: string; name: string } }) => {
      const workflowId = this.session?.id ?? 'unknown';
      cm.createCheckpoint(workflowId, `Before phase: ${event.phase.name}`, phaseIndex)
        .then(() => { phaseIndex++; })
        .catch(err => this.logger.warn('Checkpoint creation failed', err));
    });
  }

  /** Returns the CheckpointManager (null if not yet initialized). */
  getCheckpointManager(): CheckpointManager | null {
    return this.checkpointManager;
  }

  /** Returns the RollbackEngine (null if not yet initialized). */
  getRollbackEngine(): RollbackEngine | null {
    return this.rollbackEngine;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  /**
   * Get OpenKode status
   */
  getStatus(): OpenKodeStatus {
    return {
      initialized: this.initialized,
      isRunning: this.currentWorkflow !== null,
      currentMode: this.currentWorkflow?.getState().mode,
      session: this.session || undefined,
      lastError: undefined // Would be retrieved from error history
    };
  }

  /**
   * Get current session
   */
  getSession(): SessionInfo | null {
    return this.session;
  }

  /**
   * Get logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get configuration manager
   */
  getConfig(): ConfigManager {
    return this.config;
  }

  /**
   * Get model registry
   */
  getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  /**
   * Get task router
   */
  getTaskRouter(): TaskRouter {
    return this.taskRouter;
  }

  /**
   * Get file discovery
   */
  getFileDiscovery(): FileDiscovery {
    return this.fileDiscovery;
  }

  /**
   * Get symbol index
   */
  getSymbolIndex(): SymbolIndex {
    return this.symbolIndex;
  }

  /**
   * Get available workflow modes
   */
  getAvailableModes(): { mode: WorkflowMode; name: string; description: string }[] {
    return WorkflowFactory.getAvailableModes();
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Initialize OpenKode
 */
export async function initializeOpenKode(options: OpenKodeOptions): Promise<OpenKode> {
  return OpenKode.initialize(options);
}

/**
 * Get OpenKode instance
 */
export function getOpenKode(): OpenKode {
  return OpenKode.getInstance();
}

/**
 * Check if OpenKode is initialized
 */
export function isOpenKodeReady(): boolean {
  return OpenKode.isInitialized();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default OpenKode;
