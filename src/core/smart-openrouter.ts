if (process.env.OPENKODE_EDITION !== 'pro') {
  // Smart OpenRouter is Pro-only. No-op exports for Free edition.
  module.exports = {};
  return;
}

/**
 * SmartOpenRouter — OpenKode Pro intelligent model-routing via OpenRouter.ai.
 *
 * Automatically selects the cheapest capable model for each task type
 * (planning, verification, fast iteration) based on:
 *  1. Token budget remaining for the month
 *  2. Task complexity score (heuristic from spec length + code context size)
 *  3. User-defined cost ceiling (openkode.pro.monthlyCostCap)
 *
 * ⚠️  PRO ONLY — guarded by `OPENKODE_EDITION === 'pro'` in llm-router.ts.
 *
 * OpenRouter API docs: https://openrouter.ai/docs
 */
/**
 * SmartOpenRouter — OpenKode Pro intelligent model-routing via OpenRouter.ai.
 *
 * Automatically selects the cheapest capable model for each task type
 * (planning, verification, fast iteration) based on:
 *  1. Token budget remaining for the month
 *  2. Task complexity score (heuristic from spec length + code context size)
 *  3. User-defined cost ceiling (openkode.pro.monthlyCostCap)
 *
 * ⚠️  PRO ONLY — guarded by `OPENKODE_EDITION === 'pro'` in llm-router.ts.
 *
 * OpenRouter API docs: https://openrouter.ai/docs
 */

import axios from 'axios';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskType = 'planning' | 'verification' | 'fast-iteration' | 'general';

export type ModelCandidate = {
  id: string;
  /** Cost per 1 000 input tokens in USD. */
  inputCostPer1k: number;
  /** Cost per 1 000 output tokens in USD. */
  outputCostPer1k: number;
  contextWindow: number;
  /** Rough quality score 0–10 (higher = better for complex tasks). */
  qualityScore: number;
};

/** Curated model roster for smart routing. Updated manually per quarter. */
const MODEL_ROSTER: Record<TaskType, ModelCandidate[]> = {
  planning: [
    { id: 'anthropic/claude-3-7-sonnet', inputCostPer1k: 0.003, outputCostPer1k: 0.015, contextWindow: 200_000, qualityScore: 9.5 },
    { id: 'openai/gpt-4o',               inputCostPer1k: 0.005, outputCostPer1k: 0.015, contextWindow: 128_000, qualityScore: 9.0 },
    { id: 'google/gemini-2.5-pro',        inputCostPer1k: 0.0035,outputCostPer1k: 0.0105,contextWindow: 1_000_000,qualityScore: 9.0 },
  ],
  verification: [
    { id: 'anthropic/claude-3-7-sonnet', inputCostPer1k: 0.003, outputCostPer1k: 0.015, contextWindow: 200_000, qualityScore: 9.5 },
    { id: 'openai/gpt-4o-mini',          inputCostPer1k: 0.00015,outputCostPer1k: 0.0006,contextWindow: 128_000, qualityScore: 7.0 },
  ],
  'fast-iteration': [
    { id: 'openai/gpt-4o-mini',          inputCostPer1k: 0.00015,outputCostPer1k: 0.0006,contextWindow: 128_000, qualityScore: 7.0 },
    { id: 'google/gemini-flash-1.5',     inputCostPer1k: 0.000075,outputCostPer1k: 0.0003,contextWindow: 1_000_000,qualityScore: 6.5 },
  ],
  general: [
    { id: 'anthropic/claude-3-haiku',    inputCostPer1k: 0.00025,outputCostPer1k: 0.00125,contextWindow: 200_000, qualityScore: 7.5 },
    { id: 'openai/gpt-4o-mini',          inputCostPer1k: 0.00015,outputCostPer1k: 0.0006,contextWindow: 128_000, qualityScore: 7.0 },
  ],
};

// ─── Smart selection ──────────────────────────────────────────────────────────

/**
 * Select the best model for a given task type and estimated token budget.
 *
 * Strategy:
 *  1. Filter candidates whose context window fits `estimatedTokens`.
 *  2. If remaining monthly budget is tight (< $1), pick the cheapest candidate.
 *  3. Otherwise, pick the highest quality-score model.
 *
 * @param taskType        The type of task (planning, verification, etc.)
 * @param estimatedTokens Rough estimate of total tokens needed.
 * @param remainingBudget Monthly cost remaining in USD.
 */
export function selectModel(
  taskType: TaskType,
  estimatedTokens: number,
  remainingBudget: number,
): ModelCandidate {
  const candidates = MODEL_ROSTER[taskType].filter(
    (m) => m.contextWindow >= estimatedTokens,
  );

  if (candidates.length === 0) {
    // Fall back to the first candidate regardless of context window
    return MODEL_ROSTER[taskType][0];
  }

  if (remainingBudget < 1) {
    // Budget is tight — pick cheapest
    return candidates.reduce((best, m) =>
      m.inputCostPer1k < best.inputCostPer1k ? m : best,
    );
  }

  // Budget available — pick highest quality
  return candidates.reduce((best, m) =>
    m.qualityScore > best.qualityScore ? m : best,
  );
}

// ─── OpenRouter client ────────────────────────────────────────────────────────

export type OpenRouterRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
};

export type OpenRouterResponse = {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

/**
 * Send a chat request via OpenRouter.
 *
 * @param req     The request payload (model already selected by selectModel()).
 * @param apiKey  OpenRouter API key (stored in VS Code SecretStorage for Pro users).
 */
export async function callOpenRouter(
  req: OpenRouterRequest,
  apiKey: string,
): Promise<OpenRouterResponse> {
  const response = await axios.post<{
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage?: OpenRouterResponse['usage'];
  }>(
    `${OPENROUTER_BASE}/chat/completions`,
    req,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://openkode.dev',
        'X-Title': 'OpenKode Pro',
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    },
  );

  const content = response.data.choices?.[0]?.message?.content ?? '';
  return { content, model: response.data.model, usage: response.data.usage };
}
