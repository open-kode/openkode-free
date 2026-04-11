/**
 * OpenKode Multi-Agent Orchestration Engine
 * 
 * A comprehensive orchestration system for managing multiple specialized LLM models
 * working together in coordinated workflows.
 * 
 * @module orchestration
 */

// ============================================================================
// ROUTER - Task routing and model selection
// ============================================================================

import { RoutingStrategy } from './router';

export {
  // Classes
  ModelRegistry,
  TaskRouter,
  // Enums
  ModelProvider,
  AgentRole,
  TaskPriority,
  RoutingStrategy,
  // Functions
  getDefaultRegistry,
  getDefaultRouter,
  createRouter,
  // Types
  type ModelCapabilities,
  type ModelCostProfile,
  type ModelPerformanceProfile,
  type RegisteredModel,
  type TaskRequirements,
  type RoutingDecision,
  type RoutingContext,
  type RouteRequest
} from './router';

// ============================================================================
// STATE MANAGER - Workflow state persistence
// ============================================================================

export {
  // Classes
  StateManager,
  // Enums
  WorkflowStatus,
  PhaseStatus,
  // Functions
  getDefaultStateManager,
  createStateManager,
  // Types
  type WorkflowPhase,
  type WorkflowState,
  type WorkflowDefinition,
  type StateManagerConfig,
  type WorkflowQuery,
  type WorkflowSnapshot
} from './stateManager';

// ============================================================================
// PARALLEL EXECUTOR - Concurrent task execution
// ============================================================================

export {
  // Classes
  ParallelExecutor,
  // Enums
  AggregationStrategy,
  // Functions
  createCancellationToken,
  getDefaultExecutor,
  createExecutor,
  // Types
  type ExecutionTask,
  type ExecutionResult,
  type ExecutionContext,
  type ParallelExecutionOptions,
  type FanOutOptions,
  type ExecutionProgress,
  type TaskHandler,
  type AggregationFunction,
  type CancellationToken
} from './parallelExecutor';

// ============================================================================
// CONTEXT MANAGER - Context window optimization
// ============================================================================

export {
  // Classes
  ContextManager,
  TokenCounter,
  SmartChunker,
  ContextCompressor,
  // Enums
  ChunkType,
  CompressionMethod,
  // Functions
  getDefaultContextManager,
  createContextManager,
  // Types
  type ContextChunk,
  type ChunkingOptions,
  type ContextBudget,
  type ContextAssembly,
  type RelevanceScore,
  type CompressionResult,
  type TokenizerConfig,
  type ContextManagerConfig
} from './contextManager';

// ============================================================================
// MODEL CLIENT - Unified LLM client
// ============================================================================

export {
  // Classes
  ModelClient,
  MultiProviderClient,
  CostTracker,
  MetricsCollector,
  // Enums
  LLMProvider,
  // Functions
  createModelClient,
  createMultiProviderClient,
  // Types
  type Message,
  type ToolCall,
  type ToolDefinition,
  type LLMRequest,
  type LLMResponse,
  type TokenUsage,
  type StreamChunk,
  type RequestCost,
  type RequestMetrics,
  type RetryConfig,
  type ModelClientConfig,
  type ProviderConfig
} from './modelClient';

// ============================================================================
// ORCHESTRATION ENGINE - Main orchestrator
// ============================================================================

import { EventEmitter } from 'events';
import { TaskRouter, RoutingDecision, RouteRequest, AgentRole } from './router';
import { StateManager, WorkflowState, WorkflowDefinition, WorkflowStatus } from './stateManager';
import { ParallelExecutor, ExecutionResult, ExecutionTask, FanOutOptions } from './parallelExecutor';
import { ContextManager, ContextBudget, ContextAssembly } from './contextManager';
import { ModelClient, MultiProviderClient, LLMResponse, LLMRequest, LLMProvider } from './modelClient';

export interface OrchestrationConfig {
  router: TaskRouter;
  stateManager: StateManager;
  parallelExecutor: ParallelExecutor;
  contextManager: ContextManager;
  modelClient: ModelClient | MultiProviderClient;
}

export interface OrchestratedTask {
  id: string;
  workflowId: string;
  phaseId: string;
  request: LLMRequest;
  routingDecision: RoutingDecision;
  contextAssembly?: ContextAssembly;
}

export interface OrchestrationResult {
  taskId: string;
  workflowId: string;
  response: LLMResponse;
  executionTimeMs: number;
  costUsd: number;
}

/**
 * Main Orchestration Engine that coordinates all components
 */
export class OrchestrationEngine extends EventEmitter {
  private router: TaskRouter;
  private stateManager: StateManager;
  private parallelExecutor: ParallelExecutor;
  private contextManager: ContextManager;
  private modelClient: ModelClient | MultiProviderClient;

  constructor(config: OrchestrationConfig) {
    super();
    this.router = config.router;
    this.stateManager = config.stateManager;
    this.parallelExecutor = config.parallelExecutor;
    this.contextManager = config.contextManager;
    this.modelClient = config.modelClient;
  }

  /**
   * Create and start a new workflow
   */
  async createWorkflow(definition: WorkflowDefinition): Promise<WorkflowState> {
    const workflow = await this.stateManager.createWorkflow(definition);
    this.emit('workflow:created', workflow);
    return workflow;
  }

  /**
   * Execute a single task through the full orchestration pipeline
   */
  async executeTask(
    routeRequest: RouteRequest,
    llmRequest: LLMRequest,
    sessionId: string
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();

    // 1. Route to appropriate model
    const routingDecision = await this.router.route(routeRequest);
    this.emit('task:routed', routingDecision);

    // 2. Optimize context if needed
    let optimizedRequest = llmRequest;
    if (llmRequest.messages.length > 0) {
      const budget = this.contextManager.calculateBudget(
        128000, // Default context window
        1000    // Reserve for system
      );
      
      // Process conversation context
      const assembly = this.contextManager.processConversation(
        llmRequest.messages,
        budget,
        llmRequest.messages[llmRequest.messages.length - 1]?.content
      );

      // Rebuild messages from assembled chunks
      if (assembly.chunks.length > 0) {
        optimizedRequest = {
          ...llmRequest,
          messages: this.rebuildMessages(assembly)
        };
      }
    }

    // 3. Execute with model client
    let response: LLMResponse;
    
    if (this.modelClient instanceof MultiProviderClient) {
      const result = await this.modelClient.completeWithFallback(
        optimizedRequest,
        routingDecision.provider as any,
        sessionId
      );
      response = result.response;
    } else {
      response = await this.modelClient.complete(
        optimizedRequest,
        routingDecision.provider as any,
        sessionId
      );
    }

    const executionTimeMs = Date.now() - startTime;

    // 4. Calculate actual cost
    const costTracker = this.modelClient instanceof MultiProviderClient
      ? this.modelClient.getClient(routingDecision.provider as any)?.getCostTracker()
      : this.modelClient.getCostTracker();
    
    const costUsd = costTracker?.getTotalCost() || 0;

    const result: OrchestrationResult = {
      taskId: routeRequest.task.role + '_' + Date.now(),
      workflowId: routeRequest.context.workflowId || '',
      response,
      executionTimeMs,
      costUsd
    };

    this.emit('task:completed', result);
    return result;
  }

  /**
   * Execute scout agents in parallel (fan-out pattern)
   */
  async executeScoutTasks<T, R>(
    baseTask: ExecutionTask<T>,
    variations: T[],
    llmRequestBuilder: (variation: T) => LLMRequest,
    options?: Partial<FanOutOptions>,
    sessionId?: string
  ): Promise<{ results: ExecutionResult<R>[]; aggregated: R }> {
    
    // Build handler that routes and executes each variation
    const handler = async (task: ExecutionTask<T>): Promise<R> => {
      const routeRequest: RouteRequest = {
        task: {
          role: AgentRole.SCOUT,
          estimatedInputTokens: 1000,
          estimatedOutputTokens: 500
        },
        context: {
          sessionId: sessionId || '',
          correlationId: task.id
        },
        strategy: RoutingStrategy.BALANCED
      };

      const llmRequest = llmRequestBuilder(task.data);
      const result = await this.executeTask(routeRequest, llmRequest, sessionId || '');
      return result.response.content as unknown as R;
    };

    return this.parallelExecutor.fanOut(baseTask, variations, handler, options, { sessionId });
  }

  /**
   * Rebuild messages from context assembly
   */
  private rebuildMessages(assembly: ContextAssembly): Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string }> {
    const messages: Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string }> = [];
    
    for (const chunk of assembly.chunks) {
      const role = chunk.type === 'user_message' ? 'user' :
                   chunk.type === 'system_message' ? 'system' :
                   chunk.type === 'assistant_message' ? 'assistant' :
                   'user';
      
      messages.push({ role, content: chunk.content });
    }

    return messages;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    workflows: ReturnType<StateManager['getStats']>;
    routing: ReturnType<TaskRouter['getStats']>;
    costs: number;
    metrics: unknown;
  } {
    const costs = this.modelClient instanceof MultiProviderClient
        ? this.modelClient.getTotalCosts()
        : 0;
    
    return {
      workflows: this.stateManager.getStats(),
      routing: this.router.getStats(),
      costs,
      metrics: {}
    };
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    this.parallelExecutor.dispose();
    await this.stateManager.dispose();
    this.removeAllListeners();
  }
}

// ============================================================================
// DEFAULT INSTANCE
// ============================================================================

import { getDefaultRouter } from './router';
import { getDefaultStateManager } from './stateManager';
import { getDefaultExecutor } from './parallelExecutor';
import { getDefaultContextManager } from './contextManager';

let defaultEngine: OrchestrationEngine | null = null;

export function getDefaultEngine(
  modelClient: ModelClient | MultiProviderClient
): OrchestrationEngine {
  if (!defaultEngine) {
    defaultEngine = new OrchestrationEngine({
      router: getDefaultRouter(),
      stateManager: getDefaultStateManager(),
      parallelExecutor: getDefaultExecutor(),
      contextManager: getDefaultContextManager(),
      modelClient
    });
  }
  return defaultEngine;
}

export function createEngine(
  config: OrchestrationConfig
): OrchestrationEngine {
  return new OrchestrationEngine(config);
}

export default {
  OrchestrationEngine,
  getDefaultEngine,
  createEngine
};
