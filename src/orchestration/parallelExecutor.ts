/**
 * OpenKode Multi-Agent Orchestration Engine - Parallel Executor
 * 
 * Parallel execution framework:
 * - Fan-out pattern for scout agents
 * - Session coherence maintenance
 * - Result aggregation with timeout handling
 * - Race conditions and early termination
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ExecutionTask<T = unknown, R = unknown> {
  id: string;
  name: string;
  data: T;
  priority?: number;
  timeoutMs?: number;
  retries?: number;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult<R = unknown> {
  taskId: string;
  status: 'success' | 'failure' | 'timeout' | 'cancelled';
  result?: R;
  error?: Error;
  durationMs: number;
  attempts: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionContext {
  sessionId: string;
  parentTaskId?: string;
  correlationId?: string;
  sharedContext?: Record<string, unknown>;
  cancellationToken?: CancellationToken;
}

export interface ParallelExecutionOptions {
  maxConcurrency: number;
  taskTimeoutMs: number;
  globalTimeoutMs?: number;
  continueOnError: boolean;
  abortOnFirstError: boolean;
  abortOnFirstSuccess: boolean;
  retryAttempts: number;
  retryDelayMs: number;
  enableProgressTracking: boolean;
}

export interface FanOutOptions extends ParallelExecutionOptions {
  aggregationStrategy: AggregationStrategy;
  minResults?: number;
  maxResults?: number;
}

export enum AggregationStrategy {
  COLLECT_ALL = 'collect_all',
  FIRST_SUCCESS = 'first_success',
  MAJORITY_VOTE = 'majority_vote',
  WEIGHTED_VOTE = 'weighted_vote',
  RANKED_MERGE = 'ranked_merge',
  CUSTOM = 'custom'
}

export interface ExecutionProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  inProgress: number;
  percentage: number;
  estimatedTimeRemainingMs?: number;
}

export interface TaskHandler<T = unknown, R = unknown> {
  (task: ExecutionTask<T>, context: ExecutionContext): Promise<R>;
}

export interface AggregationFunction<R = unknown> {
  (results: ExecutionResult<R>[], context: ExecutionContext): R;
}

export interface CancellationToken {
  isCancelled: boolean;
  reason?: string;
  cancel: (reason?: string) => void;
  onCancel: (callback: (reason?: string) => void) => void;
}

// ============================================================================
// CANCELLATION TOKEN
// ============================================================================

export function createCancellationToken(): CancellationToken {
  const callbacks: Array<(reason?: string) => void> = [];
  
  const token: CancellationToken = {
    isCancelled: false,
    cancel: (reason?: string) => {
      if (!token.isCancelled) {
        token.isCancelled = true;
        token.reason = reason;
        callbacks.forEach(cb => cb(reason));
      }
    },
    onCancel: (callback) => {
      if (token.isCancelled) {
        callback(token.reason);
      } else {
        callbacks.push(callback);
      }
    }
  };

  return token;
}

// ============================================================================
// PARALLEL EXECUTOR
// ============================================================================

export class ParallelExecutor extends EventEmitter {
  private defaultOptions: ParallelExecutionOptions;
  private activeExecutions: Map<string, AbortController> = new Map();
  private sessionContexts: Map<string, ExecutionContext> = new Map();

  constructor(options?: Partial<ParallelExecutionOptions>) {
    super();
    this.defaultOptions = {
      maxConcurrency: 5,
      taskTimeoutMs: 30000,
      continueOnError: true,
      abortOnFirstError: false,
      abortOnFirstSuccess: false,
      retryAttempts: 2,
      retryDelayMs: 1000,
      enableProgressTracking: true,
      ...options
    };
  }

  /**
   * Execute multiple tasks in parallel with concurrency control
   */
  async executeParallel<T, R>(
    tasks: ExecutionTask<T>[],
    handler: TaskHandler<T, R>,
    options?: Partial<ParallelExecutionOptions>,
    context?: Partial<ExecutionContext>
  ): Promise<ExecutionResult<R>[]> {
    const opts = { ...this.defaultOptions, ...options };
    const sessionId = context?.sessionId || randomUUID();
    const execContext = this.createExecutionContext(sessionId, context);
    const executionId = randomUUID();

    this.emit('execution:started', { executionId, sessionId, taskCount: tasks.length });

    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    const startTime = Date.now();
    const results: ExecutionResult<R>[] = [];
    const inProgress = new Set<string>();
    const pending = new Set(tasks.map(t => t.id));
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Track progress
    const progress: ExecutionProgress = {
      total: tasks.length,
      completed: 0,
      failed: 0,
      pending: tasks.length,
      inProgress: 0,
      percentage: 0
    };

    // Global timeout
    let globalTimeoutId: NodeJS.Timeout | undefined;
    if (opts.globalTimeoutMs) {
      globalTimeoutId = setTimeout(() => {
        abortController.abort('Global timeout exceeded');
      }, opts.globalTimeoutMs);
    }

    try {
      const semaphore = new Semaphore(opts.maxConcurrency);

      while (pending.size > 0 || inProgress.size > 0) {
        // Check for cancellation
        if (execContext.cancellationToken?.isCancelled) {
          throw new Error(`Execution cancelled: ${execContext.cancellationToken.reason}`);
        }

        if (abortController.signal.aborted) {
          throw new Error('Execution aborted');
        }

        // Launch new tasks up to concurrency limit
        while (inProgress.size < opts.maxConcurrency && pending.size > 0) {
          const eligibleTask = this.findEligibleTask(pending, taskMap, results);
          if (!eligibleTask) break;

          pending.delete(eligibleTask.id);
          inProgress.add(eligibleTask.id);

          semaphore.acquire().then(() => {
            this.executeTaskWithRetry(eligibleTask, handler, execContext, opts, abortController)
              .then(result => {
                results.push(result);
                if (result.status === 'failure' || result.status === 'timeout') {
                  progress.failed++;
                }
              })
              .catch(error => {
                results.push({
                  taskId: eligibleTask.id,
                  status: 'failure',
                  error: error instanceof Error ? error : new Error(String(error)),
                  durationMs: 0,
                  attempts: 0
                });
                progress.failed++;
              })
              .finally(() => {
                inProgress.delete(eligibleTask.id);
                progress.completed++;
                progress.inProgress = inProgress.size;
                progress.pending = pending.size;
                progress.percentage = Math.round((progress.completed / progress.total) * 100);
                
                if (opts.enableProgressTracking) {
                  this.emit('execution:progress', { executionId, progress });
                }

                semaphore.release();
              });
          });
        }

        // Check early termination conditions
        if (opts.abortOnFirstError && progress.failed > 0) {
          abortController.abort('First error encountered');
          break;
        }

        if (opts.abortOnFirstSuccess && results.some(r => r.status === 'success')) {
          abortController.abort('First success achieved');
          break;
        }

        // Wait a bit before checking again
        if (pending.size > 0 || inProgress.size > 0) {
          await this.delay(10);
        }
      }

      // Wait for all in-progress tasks
      while (inProgress.size > 0) {
        await this.delay(50);
      }

      this.emit('execution:completed', { executionId, results });
      return results;

    } catch (error) {
      this.emit('execution:error', { executionId, error });
      throw error;
    } finally {
      if (globalTimeoutId) clearTimeout(globalTimeoutId);
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Fan-out pattern: Execute scout agents in parallel and aggregate results
   */
  async fanOut<T, R>(
    baseTask: ExecutionTask<T>,
    variations: T[],
    handler: TaskHandler<T, R>,
    options?: Partial<FanOutOptions>,
    context?: Partial<ExecutionContext>,
    aggregator?: AggregationFunction<R>
  ): Promise<{ results: ExecutionResult<R>[]; aggregated: R }> {
    const opts: FanOutOptions = {
      ...this.defaultOptions,
      aggregationStrategy: AggregationStrategy.COLLECT_ALL,
      ...options
    };

    const sessionId = context?.sessionId || randomUUID();
    const execContext = this.createExecutionContext(sessionId, context);

    // Create individual tasks for each variation
    const tasks: ExecutionTask<T>[] = variations.map((variation, index) => ({
      id: `${baseTask.id}_variant_${index}`,
      name: `${baseTask.name} [variant ${index + 1}]`,
      data: variation,
      priority: baseTask.priority,
      timeoutMs: baseTask.timeoutMs,
      metadata: {
        ...baseTask.metadata,
        variantIndex: index,
        parentTaskId: baseTask.id
      }
    }));

    this.emit('fanout:started', { 
      sessionId, 
      baseTaskId: baseTask.id, 
      variantCount: variations.length 
    });

    const results = await this.executeParallel(tasks, handler, opts, execContext);

    // Apply aggregation strategy
    let aggregated: R;
    
    if (aggregator) {
      aggregated = aggregator(results, execContext);
    } else {
      aggregated = this.applyAggregationStrategy(results, opts.aggregationStrategy, execContext);
    }

    this.emit('fanout:completed', { sessionId, results, aggregated });

    return { results, aggregated };
  }

  /**
   * Race pattern: Execute tasks and return first successful result
   */
  async race<T, R>(
    tasks: ExecutionTask<T>[],
    handler: TaskHandler<T, R>,
    options?: Partial<ParallelExecutionOptions>,
    context?: Partial<ExecutionContext>
  ): Promise<ExecutionResult<R>> {
    const opts = { 
      ...this.defaultOptions, 
      ...options,
      abortOnFirstSuccess: true 
    };

    const results = await this.executeParallel(tasks, handler, opts, context);
    
    const success = results.find(r => r.status === 'success');
    if (success) {
      return success;
    }

    // Return first failure if no successes
    return results[0] || {
      taskId: 'none',
      status: 'failure',
      error: new Error('All tasks failed'),
      durationMs: 0,
      attempts: 0
    };
  }

  /**
   * Pipeline pattern: Execute tasks sequentially with data flow
   */
  async pipeline<T, R>(
    tasks: ExecutionTask<T>[],
    handlers: TaskHandler<T, R>[],
    options?: Partial<ParallelExecutionOptions>,
    context?: Partial<ExecutionContext>
  ): Promise<ExecutionResult<R>[]> {
    const sessionId = context?.sessionId || crypto.randomUUID();
    const execContext = this.createExecutionContext(sessionId, context);
    const results: ExecutionResult<R>[] = [];

    this.emit('pipeline:started', { sessionId, stageCount: tasks.length });

    let previousResult: R | undefined;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const handler = handlers[i] || handlers[handlers.length - 1];

      // Inject previous result into task data if applicable
      if (previousResult !== undefined) {
        task.data = { ...task.data as any, _previousResult: previousResult };
      }

      const result = await this.executeTaskWithRetry(
        task, 
        handler, 
        execContext, 
        { ...this.defaultOptions, ...options },
        new AbortController()
      );

      results.push(result);

      if (result.status !== 'success') {
        this.emit('pipeline:failed', { sessionId, stage: i, result });
        throw new Error(`Pipeline failed at stage ${i}: ${result.error?.message}`);
      }

      previousResult = result.result;
      this.emit('pipeline:stageCompleted', { sessionId, stage: i, result });
    }

    this.emit('pipeline:completed', { sessionId, results });
    return results;
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTaskWithRetry<T, R>(
    task: ExecutionTask<T>,
    handler: TaskHandler<T, R>,
    context: ExecutionContext,
    options: ParallelExecutionOptions,
    abortController: AbortController
  ): Promise<ExecutionResult<R>> {
    const maxAttempts = (task.retries ?? options.retryAttempts) + 1;
    const timeoutMs = task.timeoutMs ?? options.taskTimeoutMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = Date.now();

      try {
        // Check cancellation before starting
        if (context.cancellationToken?.isCancelled) {
          return {
            taskId: task.id,
            status: 'cancelled',
            durationMs: Date.now() - startTime,
            attempts: attempt
          };
        }

        const result = await this.executeWithTimeout(
          () => handler(task, context),
          timeoutMs,
          abortController
        );

        return {
          taskId: task.id,
          status: 'success',
          result,
          durationMs: Date.now() - startTime,
          attempts: attempt,
          metadata: task.metadata
        };

      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        
        if (isLastAttempt || abortController.signal.aborted) {
          return {
            taskId: task.id,
            status: abortController.signal.aborted ? 'cancelled' : 'failure',
            error: error instanceof Error ? error : new Error(String(error)),
            durationMs: Date.now() - startTime,
            attempts: attempt,
            metadata: task.metadata
          };
        }

        // Wait before retry
        await this.delay(options.retryDelayMs * attempt);
      }
    }

    // Should never reach here
    return {
      taskId: task.id,
      status: 'failure',
      error: new Error('Max retries exceeded'),
      durationMs: 0,
      attempts: maxAttempts
    };
  }

  /**
   * Execute with timeout
   */
  private executeWithTimeout<R>(
    fn: () => Promise<R>,
    timeoutMs: number,
    abortController: AbortController
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Listen for abort
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error('Task aborted'));
      };

      abortController.signal.addEventListener('abort', abortHandler, { once: true });

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          abortController.signal.removeEventListener('abort', abortHandler);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          abortController.signal.removeEventListener('abort', abortHandler);
          reject(error);
        });
    });
  }

  /**
   * Find next eligible task (respecting dependencies)
   */
  private findEligibleTask<T>(
    pending: Set<string>,
    taskMap: Map<string, ExecutionTask<T>>,
    completedResults: ExecutionResult<unknown>[]
  ): ExecutionTask<T> | undefined {
    const completedIds = new Set(completedResults.map(r => r.taskId));

    for (const taskId of pending) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      const depsSatisfied = (task.dependencies || []).every(depId => {
        const result = completedResults.find(r => r.taskId === depId);
        return result && result.status === 'success';
      });

      if (depsSatisfied) {
        return task;
      }
    }

    return undefined;
  }

  /**
   * Apply aggregation strategy to results
   */
  private applyAggregationStrategy<R>(
    results: ExecutionResult<R>[],
    strategy: AggregationStrategy,
    context: ExecutionContext
  ): R {
    const successes = results.filter(r => r.status === 'success' && r.result !== undefined);

    switch (strategy) {
      case AggregationStrategy.FIRST_SUCCESS:
        if (successes.length === 0) {
          throw new Error('No successful results to aggregate');
        }
        return successes[0].result!;

      case AggregationStrategy.COLLECT_ALL:
        return successes.map(r => r.result) as unknown as R;

      case AggregationStrategy.MAJORITY_VOTE:
        return this.majorityVote(successes);

      case AggregationStrategy.RANKED_MERGE:
        return this.rankedMerge(successes);

      case AggregationStrategy.WEIGHTED_VOTE:
        return this.weightedVote(successes);

      default:
        return successes.map(r => r.result) as unknown as R;
    }
  }

  /**
   * Majority vote aggregation (for categorical results)
   */
  private majorityVote<R>(results: ExecutionResult<R>[]): R {
    if (results.length === 0) {
      throw new Error('No successful results for majority vote');
    }

    const counts = new Map<string, number>();
    
    for (const r of results) {
      const key = JSON.stringify(r.result);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    let maxCount = 0;
    let winner: string = '';

    for (const [key, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        winner = key;
      }
    }

    return JSON.parse(winner);
  }

  /**
   * Weighted vote based on confidence/duration
   */
  private weightedVote<R>(results: ExecutionResult<R>[]): R {
    if (results.length === 0) {
      throw new Error('No successful results for weighted vote');
    }

    // Weight by inverse duration (faster = more weight)
    const weights = results.map(r => ({
      result: r.result,
      weight: 1 / (r.durationMs + 1)
    }));

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    
    // For simplicity, return highest weighted result
    weights.sort((a, b) => b.weight - a.weight);
    return weights[0].result as R;
  }

  /**
   * Ranked merge (for list results)
   */
  private rankedMerge<R>(results: ExecutionResult<R>[]): R {
    if (results.length === 0) {
      throw new Error('No successful results for ranked merge');
    }

    // Flatten and deduplicate results assuming arrays
    const allItems: unknown[] = [];
    
    for (const r of results) {
      if (Array.isArray(r.result)) {
        allItems.push(...r.result);
      } else {
        allItems.push(r.result);
      }
    }

    // Remove duplicates (using JSON for simple comparison)
    const seen = new Set<string>();
    const unique = allItems.filter(item => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique as unknown as R;
  }

  /**
   * Create execution context
   */
  private createExecutionContext(
    sessionId: string,
    partial?: Partial<ExecutionContext>
  ): ExecutionContext {
    const existing = this.sessionContexts.get(sessionId);
    
    const context: ExecutionContext = {
      sessionId,
      correlationId: partial?.correlationId || randomUUID(),
      sharedContext: {
        ...existing?.sharedContext,
        ...partial?.sharedContext
      },
      cancellationToken: partial?.cancellationToken || createCancellationToken(),
      ...partial
    };

    this.sessionContexts.set(sessionId, context);
    return context;
  }

  /**
   * Get session context
   */
  getSessionContext(sessionId: string): ExecutionContext | undefined {
    return this.sessionContexts.get(sessionId);
  }

  /**
   * Update session context
   */
  updateSessionContext(
    sessionId: string, 
    updates: Partial<ExecutionContext>
  ): ExecutionContext {
    const existing = this.sessionContexts.get(sessionId);
    const updated = { ...existing, ...updates, sessionId };
    this.sessionContexts.set(sessionId, updated);
    return updated;
  }

  /**
   * Cancel an active execution
   */
  cancelExecution(executionId: string, reason?: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort(reason);
      this.activeExecutions.delete(executionId);
      this.emit('execution:cancelled', { executionId, reason });
      return true;
    }
    return false;
  }

  /**
   * Cancel all executions for a session
   */
  cancelSession(sessionId: string, reason?: string): number {
    let cancelled = 0;
    
    const context = this.sessionContexts.get(sessionId);
    if (context?.cancellationToken) {
      context.cancellationToken.cancel(reason);
      cancelled++;
    }

    return cancelled;
  }

  /**
   * Get active execution count
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessionContexts.size;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Cancel all active executions
    for (const [id, controller] of this.activeExecutions) {
      controller.abort('Executor disposed');
      this.emit('execution:cancelled', { executionId: id, reason: 'Executor disposed' });
    }
    
    this.activeExecutions.clear();
    this.sessionContexts.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// SEMAPHORE
// ============================================================================

class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.permits++;
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let defaultExecutor: ParallelExecutor | null = null;

export function getDefaultExecutor(options?: Partial<ParallelExecutionOptions>): ParallelExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new ParallelExecutor(options);
  }
  return defaultExecutor;
}

export function createExecutor(options?: Partial<ParallelExecutionOptions>): ParallelExecutor {
  return new ParallelExecutor(options);
}

export default {
  ParallelExecutor,
  AggregationStrategy,
  createCancellationToken,
  getDefaultExecutor,
  createExecutor
};
