/**
 * OpenKode Multi-Agent Orchestration Engine - Model Client
 * 
 * Unified LLM client:
 * - Abstract interface for all LLM providers
 * - Retry logic with exponential backoff
 * - Streaming support for long responses
 * - Cost tracking per request
 */

import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { LLMProvider } from '../types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type { LLMProvider };

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
  stream?: boolean;
}

export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  role: string;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  usage: TokenUsage;
  tool_calls?: ToolCall[];
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens?: number;
}

export interface StreamChunk {
  id: string;
  content: string;
  finish_reason?: string;
  usage?: TokenUsage;
}

export interface RequestCost {
  inputCost: number;
  outputCost: number;
  cachedInputCost?: number;
  totalCost: number;
  currency: string;
}

export interface RequestMetrics {
  requestId: string;
  provider: LLMProvider;
  model: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  latencyMs?: number;
  ttftMs?: number; // Time to first token
  retryCount: number;
  success: boolean;
  error?: Error;
  cost: RequestCost;
  usage: TokenUsage;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

export interface ModelClientConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  retryConfig?: Partial<RetryConfig>;
  timeoutMs?: number;
  enableCostTracking: boolean;
  enableMetrics: boolean;
}

export interface ProviderConfig {
  name: LLMProvider;
  baseUrl: string;
  defaultHeaders: Record<string, string>;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  costPer1kInput: number;
  costPer1kOutput: number;
  costPer1kCachedInput?: number;
}

// ============================================================================
// COST TRACKER
// ============================================================================

export class CostTracker extends EventEmitter {
  private costs: Map<string, RequestCost> = new Map();
  private sessionCosts: Map<string, RequestCost[]> = new Map();
  private totalCost: number = 0;

  /**
   * Record a request cost
   */
  recordCost(requestId: string, cost: RequestCost, sessionId?: string): void {
    this.costs.set(requestId, cost);
    this.totalCost += cost.totalCost;

    if (sessionId) {
      const session = this.sessionCosts.get(sessionId) || [];
      session.push(cost);
      this.sessionCosts.set(sessionId, session);
    }

    this.emit('cost:recorded', { requestId, cost, sessionId });
  }

  /**
   * Calculate cost from token usage
   */
  calculateCost(
    usage: TokenUsage,
    provider: LLMProvider,
    model: string
  ): RequestCost {
    const rates = this.getRates(provider, model);
    
    const inputCost = (usage.prompt_tokens / 1000) * rates.input;
    const outputCost = (usage.completion_tokens / 1000) * rates.output;
    const cachedCost = usage.cached_tokens && rates.cachedInput
      ? (usage.cached_tokens / 1000) * rates.cachedInput
      : 0;

    return {
      inputCost,
      outputCost,
      cachedInputCost: cachedCost,
      totalCost: inputCost + outputCost + cachedCost,
      currency: 'USD'
    };
  }

  /**
   * Get cost rates for provider/model
   */
  private getRates(provider: LLMProvider, model: string): {
    input: number;
    output: number;
    cachedInput?: number;
  } {
    const rates: Record<string, { input: number; output: number; cachedInput?: number }> = {
      // OpenAI
      'gpt-4o': { input: 0.0025, output: 0.01, cachedInput: 0.00125 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006, cachedInput: 0.000075 },
      'o1-preview': { input: 0.015, output: 0.06 },
      'o1-mini': { input: 0.003, output: 0.012 },
      
      // Anthropic
      'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
      
      // xAI
      'grok-2': { input: 0.005, output: 0.015 },
      'grok-2-mini': { input: 0.002, output: 0.006 },
      
      // Default
      'default': { input: 0.01, output: 0.03 }
    };

    return rates[model] || rates['default'];
  }

  /**
   * Get total cost
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Get cost for a specific request
   */
  getRequestCost(requestId: string): RequestCost | undefined {
    return this.costs.get(requestId);
  }

  /**
   * Get costs for a session
   */
  getSessionCosts(sessionId: string): RequestCost[] {
    return this.sessionCosts.get(sessionId) || [];
  }

  /**
   * Get session total cost
   */
  getSessionTotal(sessionId: string): number {
    const costs = this.sessionCosts.get(sessionId) || [];
    return costs.reduce((sum, c) => sum + c.totalCost, 0);
  }

  /**
   * Get cost breakdown by provider
   */
  getProviderBreakdown(): Record<string, number> {
    // This would require storing provider with each cost
    return {};
  }

  /**
   * Reset all costs
   */
  reset(): void {
    this.costs.clear();
    this.sessionCosts.clear();
    this.totalCost = 0;
  }

  /**
   * Export cost report
   */
  exportReport(): {
    totalCost: number;
    requestCount: number;
    averageCost: number;
    sessionCount: number;
  } {
    const requestCount = this.costs.size;
    return {
      totalCost: this.totalCost,
      requestCount,
      averageCost: requestCount > 0 ? this.totalCost / requestCount : 0,
      sessionCount: this.sessionCosts.size
    };
  }
}

// ============================================================================
// METRICS COLLECTOR
// ============================================================================

export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, RequestMetrics> = new Map();
  private sessionMetrics: Map<string, string[]> = new Map();

  startRequest(requestId: string, provider: LLMProvider, model: string): RequestMetrics {
    const metrics: RequestMetrics = {
      requestId,
      provider,
      model,
      startTime: new Date(),
      retryCount: 0,
      success: false,
      cost: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };

    this.metrics.set(requestId, metrics);
    return metrics;
  }

  recordRetry(requestId: string): void {
    const metrics = this.metrics.get(requestId);
    if (metrics) {
      metrics.retryCount++;
    }
  }

  recordFirstToken(requestId: string): void {
    const metrics = this.metrics.get(requestId);
    if (metrics && !metrics.ttftMs) {
      metrics.ttftMs = Date.now() - metrics.startTime.getTime();
    }
  }

  completeRequest(
    requestId: string,
    success: boolean,
    usage: TokenUsage,
    cost: RequestCost,
    error?: Error
  ): RequestMetrics {
    const metrics = this.metrics.get(requestId);
    if (!metrics) {
      throw new Error(`Metrics not found for request: ${requestId}`);
    }

    metrics.endTime = new Date();
    metrics.durationMs = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.latencyMs = metrics.durationMs;
    metrics.success = success;
    metrics.usage = usage;
    metrics.cost = cost;
    if (error) metrics.error = error;

    this.emit('metrics:completed', metrics);
    return metrics;
  }

  associateWithSession(requestId: string, sessionId: string): void {
    const session = this.sessionMetrics.get(sessionId) || [];
    session.push(requestId);
    this.sessionMetrics.set(sessionId, session);
  }

  getMetrics(requestId: string): RequestMetrics | undefined {
    return this.metrics.get(requestId);
  }

  getSessionMetrics(sessionId: string): RequestMetrics[] {
    const requestIds = this.sessionMetrics.get(sessionId) || [];
    return requestIds
      .map(id => this.metrics.get(id))
      .filter((m): m is RequestMetrics => m !== undefined);
  }

  getAllMetrics(): RequestMetrics[] {
    return Array.from(this.metrics.values());
  }

  getStats(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatencyMs: number;
    averageTtftMs: number;
    totalRetries: number;
  } {
    const all = this.getAllMetrics();
    const successful = all.filter(m => m.success);
    const failed = all.filter(m => !m.success);

    const avgLatency = successful.length > 0
      ? successful.reduce((sum, m) => sum + (m.latencyMs || 0), 0) / successful.length
      : 0;

    const avgTtft = successful.filter(m => m.ttftMs).length > 0
      ? successful.filter(m => m.ttftMs)
          .reduce((sum, m) => sum + (m.ttftMs || 0), 0) / successful.filter(m => m.ttftMs).length
      : 0;

    return {
      totalRequests: all.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageLatencyMs: Math.round(avgLatency),
      averageTtftMs: Math.round(avgTtft),
      totalRetries: all.reduce((sum, m) => sum + m.retryCount, 0)
    };
  }
}

// ============================================================================
// BASE PROVIDER CLIENT
// ============================================================================

abstract class BaseProviderClient extends EventEmitter {
  protected config: ProviderConfig;
  protected costTracker: CostTracker;
  protected metricsCollector: MetricsCollector;

  constructor(
    config: ProviderConfig,
    costTracker: CostTracker,
    metricsCollector: MetricsCollector
  ) {
    super();
    this.config = config;
    this.costTracker = costTracker;
    this.metricsCollector = metricsCollector;
  }

  abstract complete(request: LLMRequest, sessionId?: string): Promise<LLMResponse>;
  abstract stream(request: LLMRequest, sessionId?: string): AsyncIterable<StreamChunk>;

  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async makeRequest(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected recordMetrics(
    requestId: string,
    usage: TokenUsage,
    sessionId?: string
  ): void {
    const cost = this.costTracker.calculateCost(usage, this.config.name, '');
    this.costTracker.recordCost(requestId, cost, sessionId);
    this.metricsCollector.completeRequest(requestId, true, usage, cost);
  }
}

// ============================================================================
// OPENAI CLIENT
// ============================================================================

class OpenAIClient extends BaseProviderClient {
  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.openai.com/v1',
    costTracker: CostTracker,
    metricsCollector: MetricsCollector
  ) {
    super(
      {
        name: 'openai',
        baseUrl,
        defaultHeaders: {
          'Authorization': `Bearer ${apiKey}`
        },
        supportsStreaming: true,
        supportsTools: true,
        supportsJsonMode: true,
        costPer1kInput: 0.0025,
        costPer1kOutput: 0.01
      },
      costTracker,
      metricsCollector
    );
  }

  async complete(request: LLMRequest, sessionId?: string): Promise<LLMResponse> {
    const requestId = this.generateRequestId();
    this.metricsCollector.startRequest(requestId, 'openai', request.model);

    const body = this.buildRequestBody(request, false);
    
    const response = await this.makeRequest(
      `${this.config.baseUrl}/chat/completions`,
      body,
      this.config.defaultHeaders,
      60000
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const usage: TokenUsage = {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
      cached_tokens: data.usage?.prompt_tokens_details?.cached_tokens
    };

    this.recordMetrics(requestId, usage, sessionId);

    return {
      id: data.id,
      model: data.model,
      content: data.choices[0]?.message?.content || '',
      role: data.choices[0]?.message?.role || 'assistant',
      finish_reason: data.choices[0]?.finish_reason,
      usage,
      tool_calls: data.choices[0]?.message?.tool_calls
    };
  }

  async *stream(request: LLMRequest, sessionId?: string): AsyncIterable<StreamChunk> {
    const requestId = this.generateRequestId();
    this.metricsCollector.startRequest(requestId, 'openai', request.model);

    const body = this.buildRequestBody(request, true);
    
    const response = await this.makeRequest(
      `${this.config.baseUrl}/chat/completions`,
      body,
      this.config.defaultHeaders,
      120000
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let firstToken = true;
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;

              if (firstToken) {
                this.metricsCollector.recordFirstToken(requestId);
                firstToken = false;
              }

              yield {
                id: parsed.id,
                content: delta?.content || '',
                finish_reason: parsed.choices[0]?.finish_reason
              };
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private buildRequestBody(request: LLMRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream
    };

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens;
    if (request.top_p !== undefined) body.top_p = request.top_p;
    if (request.frequency_penalty !== undefined) body.frequency_penalty = request.frequency_penalty;
    if (request.presence_penalty !== undefined) body.presence_penalty = request.presence_penalty;
    if (request.stop !== undefined) body.stop = request.stop;
    if (request.tools !== undefined) body.tools = request.tools;
    if (request.tool_choice !== undefined) body.tool_choice = request.tool_choice;
    if (request.response_format !== undefined) body.response_format = request.response_format;

    return body;
  }
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

class AnthropicClient extends BaseProviderClient {
  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.anthropic.com/v1',
    costTracker: CostTracker,
    metricsCollector: MetricsCollector
  ) {
    super(
      {
        name: 'anthropic',
        baseUrl,
        defaultHeaders: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        supportsStreaming: true,
        supportsTools: true,
        supportsJsonMode: false,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015
      },
      costTracker,
      metricsCollector
    );
  }

  async complete(request: LLMRequest, sessionId?: string): Promise<LLMResponse> {
    const requestId = this.generateRequestId();
    this.metricsCollector.startRequest(requestId, 'anthropic', request.model);

    const body = this.buildRequestBody(request, false);
    
    const response = await this.makeRequest(
      `${this.config.baseUrl}/messages`,
      body,
      this.config.defaultHeaders,
      60000
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const usage: TokenUsage = {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    };

    this.recordMetrics(requestId, usage, sessionId);

    return {
      id: data.id,
      model: data.model,
      content: data.content?.[0]?.text || '',
      role: data.role || 'assistant',
      finish_reason: data.stop_reason,
      usage
    };
  }

  async *stream(request: LLMRequest, sessionId?: string): AsyncIterable<StreamChunk> {
    const requestId = this.generateRequestId();
    this.metricsCollector.startRequest(requestId, 'anthropic', request.model);

    const body = this.buildRequestBody(request, true);
    
    const response = await this.makeRequest(
      `${this.config.baseUrl}/messages`,
      body,
      this.config.defaultHeaders,
      120000
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let firstToken = true;
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                if (firstToken) {
                  this.metricsCollector.recordFirstToken(requestId);
                  firstToken = false;
                }

                yield {
                  id: requestId,
                  content: parsed.delta?.text || ''
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private buildRequestBody(request: LLMRequest, stream: boolean): Record<string, unknown> {
    // Convert messages to Anthropic format
    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: request.model,
      messages: conversationMessages.map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: request.max_tokens || 4096,
      stream
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.top_p !== undefined) body.top_p = request.top_p;
    if (request.tools !== undefined) {
      body.tools = request.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }));
    }

    return body;
  }
}

// ============================================================================
// MODEL CLIENT
// ============================================================================

export class ModelClient extends EventEmitter {
  private clients: Map<LLMProvider, BaseProviderClient> = new Map();
  private costTracker: CostTracker;
  private metricsCollector: MetricsCollector;
  private retryConfig: RetryConfig;

  constructor(config: ModelClientConfig) {
    super();
    
    this.costTracker = new CostTracker();
    this.metricsCollector = new MetricsCollector();
    
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableStatuses: [429, 500, 502, 503, 504],
      ...config.retryConfig
    };

    // Initialize provider client
    this.initializeProvider(config);
  }

  private initializeProvider(config: ModelClientConfig): void {
    switch (config.provider) {
      case 'openai':
        this.clients.set(
          'openai',
          new OpenAIClient(
            config.apiKey,
            config.baseUrl,
            this.costTracker,
            this.metricsCollector
          )
        );
        break;
      
      case 'anthropic':
        this.clients.set(
          'anthropic',
          new AnthropicClient(
            config.apiKey,
            config.baseUrl,
            this.costTracker,
            this.metricsCollector
          )
        );
        break;
      
      // Add more providers as needed
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Complete a request with retry logic
   */
  async complete(
    request: LLMRequest,
    provider: LLMProvider = 'openai',
    sessionId?: string
  ): Promise<LLMResponse> {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`Provider not initialized: ${provider}`);
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await client.complete(request, sessionId);
        this.emit('request:success', { provider, model: request.model, attempt });
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const shouldRetry = this.shouldRetry(error, attempt);
        if (!shouldRetry) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        this.emit('request:retry', { provider, model: request.model, attempt, delay });
        
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Stream a request with retry logic
   */
  async *stream(
    request: LLMRequest,
    provider: LLMProvider = 'openai',
    sessionId?: string
  ): AsyncIterable<StreamChunk> {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`Provider not initialized: ${provider}`);
    }

    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        for await (const chunk of client.stream(request, sessionId)) {
          yield chunk;
        }
        return;
      } catch (error) {
        const lastError = error instanceof Error ? error : new Error(String(error));
        
        const shouldRetry = this.shouldRetry(error, attempt);
        if (!shouldRetry || attempt === this.retryConfig.maxRetries) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        this.emit('request:retry', { provider, model: request.model, attempt, delay });
        
        await this.sleep(delay);
        attempt++;
      }
    }
  }

  /**
   * Check if error is retryable
   */
  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.retryConfig.maxRetries) return false;

    // Check for HTTP status in error message
    if (error instanceof Error) {
      const statusMatch = error.message.match(/(\d{3})/);
      if (statusMatch) {
        const status = parseInt(statusMatch[1]);
        return this.retryConfig.retryableStatuses.includes(status);
      }

      // Retry on network errors
      if (error.message.includes('network') || 
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelayMs * 
                  Math.pow(this.retryConfig.backoffMultiplier, attempt);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cost tracker
   */
  getCostTracker(): CostTracker {
    return this.costTracker;
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Get combined stats
   */
  getStats(): {
    costs: ReturnType<CostTracker['exportReport']>;
    metrics: ReturnType<MetricsCollector['getStats']>;
  } {
    return {
      costs: this.costTracker.exportReport(),
      metrics: this.metricsCollector.getStats()
    };
  }

  /**
   * Reset all tracking
   */
  resetTracking(): void {
    this.costTracker.reset();
    // Metrics can't be easily reset, would need new collector
  }
}

// ============================================================================
// MULTI-PROVIDER CLIENT
// ============================================================================

export class MultiProviderClient extends EventEmitter {
  private clients: Map<LLMProvider, ModelClient> = new Map();
  private fallbackOrder: LLMProvider[];

  constructor(
    configs: Array<{ provider: LLMProvider; config: Omit<ModelClientConfig, 'provider'> }>,
    fallbackOrder?: LLMProvider[]
  ) {
    super();
    
    for (const { provider, config } of configs) {
      this.clients.set(provider, new ModelClient({
        provider,
        ...config
      } as ModelClientConfig));
    }

    this.fallbackOrder = fallbackOrder || Array.from(this.clients.keys());
  }

  /**
   * Complete with fallback providers
   */
  async completeWithFallback(
    request: LLMRequest,
    preferredProvider?: LLMProvider,
    sessionId?: string
  ): Promise<{ response: LLMResponse; provider: LLMProvider }> {
    const providers = this.buildProviderOrder(preferredProvider);
    let lastError: Error | undefined;

    for (const provider of providers) {
      const client = this.clients.get(provider);
      if (!client) continue;

      try {
        const response = await client.complete(request, provider, sessionId);
        return { response, provider };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.emit('provider:failed', { provider, error: lastError });
      }
    }

    throw lastError || new Error('All providers failed');
  }

  /**
   * Build provider order with preference
   */
  private buildProviderOrder(preferred?: LLMProvider): LLMProvider[] {
    const order = [...this.fallbackOrder];
    
    if (preferred && order.includes(preferred)) {
      order.splice(order.indexOf(preferred), 1);
      order.unshift(preferred);
    }

    return order;
  }

  /**
   * Get client for provider
   */
  getClient(provider: LLMProvider): ModelClient | undefined {
    return this.clients.get(provider);
  }

  /**
   * Get all cost trackers
   */
  getAllCostTrackers(): Map<LLMProvider, CostTracker> {
    const trackers = new Map<LLMProvider, CostTracker>();
    for (const [provider, client] of this.clients) {
      trackers.set(provider, client.getCostTracker());
    }
    return trackers;
  }

  /**
   * Get total costs across all providers
   */
  getTotalCosts(): number {
    let total = 0;
    for (const client of this.clients.values()) {
      total += client.getCostTracker().getTotalCost();
    }
    return total;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createModelClient(config: ModelClientConfig): ModelClient {
  return new ModelClient(config);
}

export function createMultiProviderClient(
  configs: Array<{ provider: LLMProvider; config: Omit<ModelClientConfig, 'provider'> }>,
  fallbackOrder?: LLMProvider[]
): MultiProviderClient {
  return new MultiProviderClient(configs, fallbackOrder);
}

export default {
  ModelClient,
  MultiProviderClient,
  CostTracker,
  MetricsCollector,
  createModelClient,
  createMultiProviderClient
};
