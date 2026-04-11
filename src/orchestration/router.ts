/**
 * OpenKode Multi-Agent Orchestration Engine - Task Router
 * 
 * Routes tasks to appropriate LLM models based on:
 * - Model capabilities and specializations
 * - Cost constraints
 * - Latency requirements
 * - Task complexity
 */

import { EventEmitter } from 'events';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  XAI = 'xai',
  CUSTOM = 'custom'
}

export enum AgentRole {
  PLANNER = 'planner',       // Strategic planning, architecture
  VERIFIER = 'verifier',     // Code review, validation, testing
  SCOUT = 'scout',           // Exploration, research, discovery
  RESEARCHER = 'researcher', // Deep analysis, documentation
  SUMMARIZER = 'summarizer', // Condensation, synthesis
  CODER = 'coder',           // Code generation, implementation
  DEBUGGER = 'debugger'      // Error analysis, fixing
}

export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3
}

export enum RoutingStrategy {
  COST_OPTIMIZED = 'cost_optimized',
  LATENCY_OPTIMIZED = 'latency_optimized',
  QUALITY_OPTIMIZED = 'quality_optimized',
  BALANCED = 'balanced'
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  contextWindow: number;
  specialties: AgentRole[];
}

export interface ModelCostProfile {
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  cachedInputCostPer1kTokens?: number;
}

export interface ModelPerformanceProfile {
  averageLatencyMs: number;
  p95LatencyMs: number;
  availabilityScore: number; // 0-1
  successRate: number;       // 0-1
}

export interface RegisteredModel {
  id: string;
  name: string;
  provider: ModelProvider;
  endpoint?: string;
  apiKeyEnvVar: string;
  capabilities: ModelCapabilities;
  cost: ModelCostProfile;
  performance: ModelPerformanceProfile;
  enabled: boolean;
  rateLimitRpm: number;
  rateLimitTpm: number;
  metadata?: Record<string, unknown>;
}

export interface TaskRequirements {
  role: AgentRole;
  minContextWindow?: number;
  requiresStreaming?: boolean;
  requiresVision?: boolean;
  requiresTools?: boolean;
  requiresJsonMode?: boolean;
  maxLatencyMs?: number;
  maxCostUsd?: number;
  priority?: TaskPriority;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

export interface RoutingDecision {
  modelId: string;
  modelName: string;
  provider: ModelProvider;
  confidence: number;      // 0-1
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  reason: string;
  fallbackModelIds: string[];
}

export interface RoutingContext {
  sessionId: string;
  workflowId?: string;
  correlationId?: string;
  userPreferences?: {
    preferredProvider?: ModelProvider;
    costBudget?: number;
    latencyTarget?: number;
  };
  previousModelId?: string;
  conversationHistory?: string[];
}

export interface RouteRequest {
  task: TaskRequirements;
  context: RoutingContext;
  strategy?: RoutingStrategy;
}

// ============================================================================
// MODEL REGISTRY
// ============================================================================

export class ModelRegistry extends EventEmitter {
  private models: Map<string, RegisteredModel> = new Map();
  private roleToModels: Map<AgentRole, string[]> = new Map();
  private usageStats: Map<string, { requests: number; tokens: number; errors: number }> = new Map();

  constructor() {
    super();
    this.initializeDefaultModels();
  }

  /**
   * Register a new model in the registry
   */
  registerModel(model: RegisteredModel): void {
    this.models.set(model.id, model);
    this.usageStats.set(model.id, { requests: 0, tokens: 0, errors: 0 });
    
    // Index by roles
    model.capabilities.specialties.forEach(role => {
      const existing = this.roleToModels.get(role) || [];
      if (!existing.includes(model.id)) {
        existing.push(model.id);
        this.roleToModels.set(role, existing);
      }
    });

    this.emit('model:registered', model);
  }

  /**
   * Unregister a model
   */
  unregisterModel(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    this.models.delete(modelId);
    this.usageStats.delete(modelId);

    // Remove from role index
    model.capabilities.specialties.forEach(role => {
      const existing = this.roleToModels.get(role) || [];
      const filtered = existing.filter(id => id !== modelId);
      this.roleToModels.set(role, filtered);
    });

    this.emit('model:unregistered', modelId);
    return true;
  }

  /**
   * Get a model by ID
   */
  getModel(modelId: string): RegisteredModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all models for a specific role
   */
  getModelsForRole(role: AgentRole): RegisteredModel[] {
    const modelIds = this.roleToModels.get(role) || [];
    return modelIds
      .map(id => this.models.get(id))
      .filter((m): m is RegisteredModel => m !== undefined && m.enabled);
  }

  /**
   * Get all registered models
   */
  getAllModels(): RegisteredModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Update model availability
   */
  setModelEnabled(modelId: string, enabled: boolean): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;
    model.enabled = enabled;
    this.emit('model:updated', model);
    return true;
  }

  /**
   * Update model performance metrics
   */
  updatePerformance(modelId: string, performance: Partial<ModelPerformanceProfile>): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;
    model.performance = { ...model.performance, ...performance };
    this.emit('model:performanceUpdated', modelId, performance);
    return true;
  }

  /**
   * Record usage statistics
   */
  recordUsage(modelId: string, tokens: number, error: boolean = false): void {
    const stats = this.usageStats.get(modelId);
    if (stats) {
      stats.requests++;
      stats.tokens += tokens;
      if (error) stats.errors++;
    }
  }

  /**
   * Get usage statistics for a model
   */
  getUsageStats(modelId: string) {
    return this.usageStats.get(modelId);
  }

  /**
   * Initialize default models for common providers
   */
  private initializeDefaultModels(): void {
    // OpenAI Models
    this.registerModel({
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: ModelProvider.OPENAI,
      apiKeyEnvVar: 'OPENAI_API_KEY',
      capabilities: {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsVision: true,
        supportsTools: true,
        supportsJsonMode: true,
        contextWindow: 128000,
        specialties: [AgentRole.PLANNER, AgentRole.VERIFIER, AgentRole.CODER, AgentRole.DEBUGGER]
      },
      cost: {
        inputCostPer1kTokens: 0.0025,
        outputCostPer1kTokens: 0.01,
        cachedInputCostPer1kTokens: 0.00125
      },
      performance: {
        averageLatencyMs: 800,
        p95LatencyMs: 2000,
        availabilityScore: 0.99,
        successRate: 0.98
      },
      enabled: true,
      rateLimitRpm: 500,
      rateLimitTpm: 30000
    });

    this.registerModel({
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: ModelProvider.OPENAI,
      apiKeyEnvVar: 'OPENAI_API_KEY',
      capabilities: {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsVision: true,
        supportsTools: true,
        supportsJsonMode: true,
        contextWindow: 128000,
        specialties: [AgentRole.SUMMARIZER, AgentRole.SCOUT, AgentRole.CODER]
      },
      cost: {
        inputCostPer1kTokens: 0.00015,
        outputCostPer1kTokens: 0.0006,
        cachedInputCostPer1kTokens: 0.000075
      },
      performance: {
        averageLatencyMs: 300,
        p95LatencyMs: 800,
        availabilityScore: 0.99,
        successRate: 0.98
      },
      enabled: true,
      rateLimitRpm: 1000,
      rateLimitTpm: 100000
    });

    this.registerModel({
      id: 'o1-preview',
      name: 'o1 Preview',
      provider: ModelProvider.OPENAI,
      apiKeyEnvVar: 'OPENAI_API_KEY',
      capabilities: {
        maxTokens: 32768,
        supportsStreaming: false,
        supportsVision: false,
        supportsTools: false,
        supportsJsonMode: false,
        contextWindow: 128000,
        specialties: [AgentRole.RESEARCHER, AgentRole.PLANNER, AgentRole.VERIFIER]
      },
      cost: {
        inputCostPer1kTokens: 0.015,
        outputCostPer1kTokens: 0.06
      },
      performance: {
        averageLatencyMs: 5000,
        p95LatencyMs: 15000,
        availabilityScore: 0.95,
        successRate: 0.95
      },
      enabled: true,
      rateLimitRpm: 100,
      rateLimitTpm: 5000
    });

    // Anthropic Models
    this.registerModel({
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: ModelProvider.ANTHROPIC,
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      capabilities: {
        maxTokens: 8192,
        supportsStreaming: true,
        supportsVision: true,
        supportsTools: true,
        supportsJsonMode: true,
        contextWindow: 200000,
        specialties: [AgentRole.PLANNER, AgentRole.VERIFIER, AgentRole.RESEARCHER, AgentRole.CODER]
      },
      cost: {
        inputCostPer1kTokens: 0.003,
        outputCostPer1kTokens: 0.015
      },
      performance: {
        averageLatencyMs: 600,
        p95LatencyMs: 1800,
        availabilityScore: 0.98,
        successRate: 0.97
      },
      enabled: true,
      rateLimitRpm: 400,
      rateLimitTpm: 40000
    });

    this.registerModel({
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      provider: ModelProvider.ANTHROPIC,
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      capabilities: {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsVision: true,
        supportsTools: true,
        supportsJsonMode: true,
        contextWindow: 200000,
        specialties: [AgentRole.SUMMARIZER, AgentRole.SCOUT]
      },
      cost: {
        inputCostPer1kTokens: 0.00025,
        outputCostPer1kTokens: 0.00125
      },
      performance: {
        averageLatencyMs: 250,
        p95LatencyMs: 600,
        availabilityScore: 0.99,
        successRate: 0.98
      },
      enabled: true,
      rateLimitRpm: 1000,
      rateLimitTpm: 100000
    });

    // xAI Models
    this.registerModel({
      id: 'grok-2',
      name: 'Grok 2',
      provider: ModelProvider.XAI,
      apiKeyEnvVar: 'XAI_API_KEY',
      capabilities: {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsVision: false,
        supportsTools: true,
        supportsJsonMode: true,
        contextWindow: 128000,
        specialties: [AgentRole.SCOUT, AgentRole.CODER, AgentRole.SUMMARIZER]
      },
      cost: {
        inputCostPer1kTokens: 0.005,
        outputCostPer1kTokens: 0.015
      },
      performance: {
        averageLatencyMs: 500,
        p95LatencyMs: 1500,
        availabilityScore: 0.95,
        successRate: 0.96
      },
      enabled: true,
      rateLimitRpm: 300,
      rateLimitTpm: 20000
    });
  }
}

// ============================================================================
// TASK ROUTER
// ============================================================================

export class TaskRouter extends EventEmitter {
  private registry: ModelRegistry;
  private routingHistory: Map<string, RoutingDecision[]> = new Map();

  constructor(registry: ModelRegistry) {
    super();
    this.registry = registry;
  }

  /**
   * Route a task to the most appropriate model
   */
  async route(request: RouteRequest): Promise<RoutingDecision> {
    const { task, context, strategy = RoutingStrategy.BALANCED } = request;
    
    this.emit('routing:started', request);

    // Get candidate models for the role
    const candidates = this.registry.getModelsForRole(task.role);
    
    if (candidates.length === 0) {
      throw new Error(`No models available for role: ${task.role}`);
    }

    // Filter by hard requirements
    const eligible = candidates.filter(model => this.meetsRequirements(model, task));

    if (eligible.length === 0) {
      throw new Error(`No models meet requirements for task: ${JSON.stringify(task)}`);
    }

    // Score and rank models based on strategy
    const scored = eligible.map(model => this.scoreModel(model, task, strategy));
    scored.sort((a, b) => b.score - a.score);

    const topChoice = scored[0];
    const fallbacks = scored.slice(1, 4).map(s => s.model.id);

    const decision: RoutingDecision = {
      modelId: topChoice.model.id,
      modelName: topChoice.model.name,
      provider: topChoice.model.provider,
      confidence: topChoice.score,
      estimatedCostUsd: topChoice.estimatedCost,
      estimatedLatencyMs: topChoice.estimatedLatency,
      reason: topChoice.reason,
      fallbackModelIds: fallbacks
    };

    // Store in history
    const history = this.routingHistory.get(context.sessionId) || [];
    history.push(decision);
    this.routingHistory.set(context.sessionId, history);

    this.emit('routing:completed', decision);
    return decision;
  }

  /**
   * Check if a model meets hard requirements
   */
  private meetsRequirements(model: RegisteredModel, task: TaskRequirements): boolean {
    const caps = model.capabilities;
    
    if (task.minContextWindow && caps.contextWindow < task.minContextWindow) return false;
    if (task.requiresStreaming && !caps.supportsStreaming) return false;
    if (task.requiresVision && !caps.supportsVision) return false;
    if (task.requiresTools && !caps.supportsTools) return false;
    if (task.requiresJsonMode && !caps.supportsJsonMode) return false;
    if (task.maxLatencyMs && model.performance.p95LatencyMs > task.maxLatencyMs) return false;

    // Check cost constraint
    if (task.maxCostUsd && task.estimatedInputTokens && task.estimatedOutputTokens) {
      const estimatedCost = this.estimateCost(model, task.estimatedInputTokens, task.estimatedOutputTokens);
      if (estimatedCost > task.maxCostUsd) return false;
    }

    return true;
  }

  /**
   * Score a model based on routing strategy
   */
  private scoreModel(
    model: RegisteredModel, 
    task: TaskRequirements, 
    strategy: RoutingStrategy
  ): { model: RegisteredModel; score: number; estimatedCost: number; estimatedLatency: number; reason: string } {
    const inputTokens = task.estimatedInputTokens || 1000;
    const outputTokens = task.estimatedOutputTokens || 500;
    
    const estimatedCost = this.estimateCost(model, inputTokens, outputTokens);
    const estimatedLatency = model.performance.averageLatencyMs;

    let score = 0;
    let reason = '';

    switch (strategy) {
      case RoutingStrategy.COST_OPTIMIZED:
        score = this.calculateCostScore(model, estimatedCost);
        reason = `Cost-optimized: $${estimatedCost.toFixed(4)}`;
        break;
      
      case RoutingStrategy.LATENCY_OPTIMIZED:
        score = this.calculateLatencyScore(model);
        reason = `Latency-optimized: ${estimatedLatency}ms`;
        break;
      
      case RoutingStrategy.QUALITY_OPTIMIZED:
        score = this.calculateQualityScore(model, task);
        reason = `Quality-optimized: ${model.name} with ${model.capabilities.contextWindow} context`;
        break;
      
      case RoutingStrategy.BALANCED:
      default:
        score = this.calculateBalancedScore(model, estimatedCost, task);
        reason = `Balanced: cost=$${estimatedCost.toFixed(4)}, latency=${estimatedLatency}ms`;
        break;
    }

    // Boost score for role match
    if (model.capabilities.specialties.includes(task.role)) {
      score += 0.1;
    }

    // Penalize by error rate
    score *= model.performance.successRate;

    return { model, score, estimatedCost, estimatedLatency, reason };
  }

  /**
   * Calculate cost-based score (lower cost = higher score)
   */
  private calculateCostScore(model: RegisteredModel, estimatedCost: number): number {
    const allModels = this.registry.getAllModels();
    const maxCost = Math.max(...allModels.map(m => 
      this.estimateCost(m, 1000, 500)
    ));
    return 1 - (estimatedCost / maxCost);
  }

  /**
   * Calculate latency-based score (lower latency = higher score)
   */
  private calculateLatencyScore(model: RegisteredModel): number {
    const allModels = this.registry.getAllModels();
    const maxLatency = Math.max(...allModels.map(m => m.performance.averageLatencyMs));
    return 1 - (model.performance.averageLatencyMs / maxLatency);
  }

  /**
   * Calculate quality-based score
   */
  private calculateQualityScore(model: RegisteredModel, task: TaskRequirements): number {
    let score = 0;
    
    // Larger context window is better
    score += Math.min(model.capabilities.contextWindow / 200000, 1) * 0.3;
    
    // Higher max tokens is better
    score += Math.min(model.capabilities.maxTokens / 8192, 1) * 0.2;
    
    // Success rate
    score += model.performance.successRate * 0.3;
    
    // Availability
    score += model.performance.availabilityScore * 0.2;

    return score;
  }

  /**
   * Calculate balanced score
   */
  private calculateBalancedScore(model: RegisteredModel, estimatedCost: number, task: TaskRequirements): number {
    const costScore = this.calculateCostScore(model, estimatedCost);
    const latencyScore = this.calculateLatencyScore(model);
    const qualityScore = this.calculateQualityScore(model, task);

    // Weight by task priority
    const priority = task.priority ?? TaskPriority.MEDIUM;
    const priorityWeights = {
      [TaskPriority.CRITICAL]: { quality: 0.5, latency: 0.3, cost: 0.2 },
      [TaskPriority.HIGH]: { quality: 0.4, latency: 0.4, cost: 0.2 },
      [TaskPriority.MEDIUM]: { quality: 0.3, latency: 0.3, cost: 0.4 },
      [TaskPriority.LOW]: { quality: 0.2, latency: 0.2, cost: 0.6 }
    };
    
    const weights = priorityWeights[priority];
    return qualityScore * weights.quality + latencyScore * weights.latency + costScore * weights.cost;
  }

  /**
   * Estimate cost for a request
   */
  private estimateCost(model: RegisteredModel, inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * model.cost.inputCostPer1kTokens;
    const outputCost = (outputTokens / 1000) * model.cost.outputCostPer1kTokens;
    return inputCost + outputCost;
  }

  /**
   * Get routing history for a session
   */
  getRoutingHistory(sessionId: string): RoutingDecision[] {
    return this.routingHistory.get(sessionId) || [];
  }

  /**
   * Clear routing history
   */
  clearHistory(sessionId?: string): void {
    if (sessionId) {
      this.routingHistory.delete(sessionId);
    } else {
      this.routingHistory.clear();
    }
  }

  /**
   * Get router statistics
   */
  getStats(): { totalSessions: number; totalDecisions: number } {
    let totalDecisions = 0;
    this.routingHistory.forEach(decisions => {
      totalDecisions += decisions.length;
    });
    return {
      totalSessions: this.routingHistory.size,
      totalDecisions
    };
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

let defaultRegistry: ModelRegistry | null = null;
let defaultRouter: TaskRouter | null = null;

export function getDefaultRegistry(): ModelRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ModelRegistry();
  }
  return defaultRegistry;
}

export function getDefaultRouter(): TaskRouter {
  if (!defaultRouter) {
    defaultRouter = new TaskRouter(getDefaultRegistry());
  }
  return defaultRouter;
}

export function createRouter(registry?: ModelRegistry): TaskRouter {
  return new TaskRouter(registry || getDefaultRegistry());
}

export default {
  ModelRegistry,
  TaskRouter,
  ModelProvider,
  AgentRole,
  TaskPriority,
  RoutingStrategy,
  getDefaultRegistry,
  getDefaultRouter,
  createRouter
};
