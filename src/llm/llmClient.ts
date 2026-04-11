/**
 * LLM Client - Actually calls LLM APIs
 * 
 * Supports: OpenAI, Anthropic, Gemini, Kimi
 * No dummy implementations. Real API calls only.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { LLMProvider as LLMProviderFromTypes } from '../types';

// Re-export the type for convenience
export type LLMProvider = LLMProviderFromTypes;

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string; // For custom endpoints like Kimi
}

export interface LLMResponse {
  raw: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  model: string;
  latency: number;
}

export interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
  responseFormat: 'json' | 'markdown';
}

// ─── Execution Plan types ─────────────────────────────────────────────────────

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  type: 'create' | 'modify' | 'test' | 'config' | 'research' | 'design';
  files?: string[];
  status: 'pending';
}

export interface PlanPhase {
  id: string;
  title: string;
  estimatedHours?: number;
  tasks: PlanTask[];
}

export interface PlanEpic {
  id: string;
  title: string;
  description: string;
  phases: PlanPhase[];
}

export interface PlanApproach {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

export interface ExecutionPlan {
  title: string;
  summary: string;
  mode: string;
  clarifications?: string[];   // Precision: questions before starting
  approaches?: PlanApproach[]; // Visionary: multiple strategic options
  epics: PlanEpic[];
}

// ─── Plan generation system prompts (one per mode) ────────────────────────────

const PLAN_SYSTEM_PROMPTS: Record<string, string> = {
  precision: `You are OpenKode in Precision Mode — a meticulous senior engineer.
Generate a detailed, atomic execution plan. Output ONLY valid JSON with this exact structure:
{
  "title": "short project title",
  "summary": "2-3 sentence description of what will be built",
  "mode": "precision",
  "clarifications": ["question 1 if ambiguous", "question 2"],
  "epics": [
    {
      "id": "E1",
      "title": "epic title",
      "description": "what this epic delivers",
      "phases": [
        {
          "id": "E1-P1",
          "title": "phase title",
          "estimatedHours": 2,
          "tasks": [
            {
              "id": "E1-P1-T1",
              "title": "task title",
              "description": "exactly what to do",
              "type": "create",
              "files": ["src/index.ts"],
              "status": "pending"
            }
          ]
        }
      ]
    }
  ]
}
Rules:
- Tasks must be ATOMIC — each should take 15-30 minutes max
- Include exact filenames (e.g. "src/components/Editor.tsx")
- Order tasks by dependency — nothing should depend on a later task
- Minimum 3 epics, 2 phases per epic, 3+ tasks per phase
- task type: "create" (new file), "modify" (edit file), "test", "config", "research", "design"
- clarifications: only include if there are genuine ambiguities; empty array [] if clear`,

  blueprint: `You are OpenKode in Blueprint Mode — a software architect.
Generate an architecture-first execution plan. Output ONLY valid JSON:
{
  "title": "short project title",
  "summary": "2-3 sentence description",
  "mode": "blueprint",
  "epics": [
    {
      "id": "E1",
      "title": "System Architecture",
      "description": "Define the system design before any code",
      "phases": [...]
    },
    {
      "id": "E2",
      "title": "Core Interfaces",
      "description": "Define types, APIs, and contracts",
      "phases": [...]
    }
  ]
}
Rules:
- First epic MUST be "System Architecture" (components, data flow, tech stack decisions)
- Second epic MUST be "Core Interfaces" (TypeScript types, API schemas, DB models)
- Subsequent epics implement module by module
- Tasks are at the module/component level, not function level
- Include design tasks (ASCII diagrams, ADRs) before implementation tasks`,

  visionary: `You are OpenKode in Visionary Mode — a product-minded engineer.
Generate a strategic options analysis followed by a milestone-based plan. Output ONLY valid JSON:
{
  "title": "short project title",
  "summary": "2-3 sentence description",
  "mode": "visionary",
  "approaches": [
    {
      "id": "A1",
      "title": "approach name",
      "description": "what this approach entails",
      "pros": ["pro 1", "pro 2"],
      "cons": ["con 1"],
      "recommended": true
    },
    {
      "id": "A2",
      "title": "alternative approach",
      "description": "...",
      "pros": [...],
      "cons": [...],
      "recommended": false
    }
  ],
  "epics": [...]
}
Rules:
- Always provide 2-3 approaches with honest pros/cons; mark exactly one as recommended
- Epics should be milestone-based ("MVP", "Growth", "Scale") not technical layers
- Think about long-term: include a "Future Considerations" epic
- Challenge assumptions — if the request seems narrow, propose a broader vision
- Tasks represent strategic deliverables, not individual files`,

  rocket: `You are OpenKode in Rocket Mode — maximum speed, minimum friction.
Generate the smallest viable execution plan. Output ONLY valid JSON:
{
  "title": "short project title",
  "summary": "one sentence — what will be working when done",
  "mode": "rocket",
  "epics": [
    {
      "id": "E1",
      "title": "MVP",
      "description": "The working core, nothing more",
      "phases": [
        {
          "id": "E1-P1",
          "title": "Build",
          "estimatedHours": 1,
          "tasks": [...]
        }
      ]
    }
  ]
}
Rules:
- MAXIMUM 1 epic, 3 phases, 8 tasks total
- Every task MUST map to a specific file to create or modify
- No research tasks, no design tasks, no "consider X" — only concrete actions
- Default to the simplest tech stack (plain HTML/JS over React, etc.) unless specified
- If it can be done in one file, do it in one file`
};

// ─────────────────────────────────────────────────────────────────────────────

export class LLMClient {
  private config: LLMConfig;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private gemini?: GoogleGenerativeAI;

  constructor(config: LLMConfig) {
    this.config = config;
    
    switch (config.provider) {
      case 'openai':
        this.openai = new OpenAI({ apiKey: config.apiKey });
        break;
      case 'anthropic':
        this.anthropic = new Anthropic({ apiKey: config.apiKey });
        break;
      case 'gemini':
        this.gemini = new GoogleGenerativeAI(config.apiKey);
        break;
      case 'kimi':
        this.openai = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl || 'https://api.moonshot.cn/v1'
        });
        break;
      case 'deepseek':
        this.openai = new OpenAI({
          apiKey: config.apiKey,
          baseURL: 'https://api.deepseek.com/v1'
        });
        break;
      case 'openrouter':
        this.openai = new OpenAI({
          apiKey: config.apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: { 'HTTP-Referer': 'https://openkode.dev', 'X-Title': 'OpenKode' }
        });
        break;
      case 'azure':
        // Azure requires baseUrl in config: https://<resource>.openai.azure.com/openai/deployments/<deployment>
        this.openai = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl || ''
        });
        break;
      case 'custom':
        this.openai = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl || ''
        });
        break;
    }
  }

  /**
   * Generate code from a prompt
   * Real API call. No mocks. No dummies.
   */
  async generate(prompt: CompiledPrompt): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      let response: LLMResponse;
      
      switch (this.config.provider) {
        case 'openai':
          response = await this.callOpenAI(prompt);
          break;
        case 'anthropic':
          response = await this.callAnthropic(prompt);
          break;
        case 'gemini':
          response = await this.callGemini(prompt);
          break;
        case 'kimi':
          response = await this.callKimi(prompt);
          break;
        default:
          throw new Error(`Unknown provider: ${this.config.provider}`);
      }
      
      response.latency = Date.now() - startTime;
      return response;
      
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Stream a chat response, calling onChunk for each token.
   * messages: [{role, content}] conversation history
   * systemPrompt: optional system prompt
   */
  async streamChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    onChunk: (token: string) => void,
    systemPrompt?: string
  ): Promise<string> {
    const sys = systemPrompt || 'You are OpenKode, an expert AI coding assistant embedded in VS Code. Be concise and helpful.';
    let full = '';

    switch (this.config.provider) {
      case 'openai':
      case 'kimi':
      case 'deepseek':
      case 'openrouter':
      case 'azure':
      case 'custom': {
        if (!this.openai) throw new Error('OpenAI client not initialized');
        const defaultModels: Record<string, string> = {
          openai: 'gpt-4o-mini', kimi: 'moonshot-v1-8k',
          deepseek: 'deepseek-chat', openrouter: 'openai/gpt-4o-mini',
          azure: 'gpt-4o', custom: 'gpt-4o'
        };
        const model = this.config.model || defaultModels[this.config.provider] || 'gpt-4o-mini';
        const stream = await this.openai.chat.completions.create({
          model,
          stream: true,
          messages: [
            { role: 'system', content: sys },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 4000
        });
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) { full += token; onChunk(token); }
        }
        break;
      }
      case 'anthropic': {
        if (!this.anthropic) throw new Error('Anthropic client not initialized');
        const model = this.config.model || 'claude-3-5-sonnet-20241022';
        const stream = await this.anthropic.messages.create({
          model,
          max_tokens: 4000,
          stream: true,
          system: sys,
          messages: messages.map(m => ({ role: m.role, content: m.content }))
        });
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text; onChunk(event.delta.text);
          }
        }
        break;
      }
      case 'gemini': {
        if (!this.gemini) throw new Error('Gemini client not initialized');
        const gemModel = this.gemini.getGenerativeModel({ model: this.config.model || 'gemini-1.5-flash' });
        const combined = [sys, ...messages.map(m => `${m.role}: ${m.content}`)].join('\n\n');
        const result = await gemModel.generateContentStream(combined);
        for await (const chunk of result.stream) {
          const token = chunk.text();
          if (token) { full += token; onChunk(token); }
        }
        break;
      }
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
    return full;
  }

  /**
   * Generate a structured execution plan (Epic → Phase → Task) shaped by mode.
   * Returns parsed JSON. Throws if LLM response is not valid JSON.
   */
  async generatePlan(userRequest: string, mode: string, workspaceContext?: string): Promise<ExecutionPlan> {
    let systemPrompt = PLAN_SYSTEM_PROMPTS[mode] || PLAN_SYSTEM_PROMPTS['precision'];
    if (workspaceContext) {
      systemPrompt += `\n\nThe user's current project context is below. Use real file paths and existing names when specifying task files. Do not invent files that don't exist unless they clearly need to be created.\n\n${workspaceContext}`;
    }
    const userPrompt = `Generate an execution plan for the following request:\n\n"${userRequest}"\n\nRespond ONLY with valid JSON matching the schema in your system prompt. No markdown, no prose, just JSON.`;

    const response = await this.generate({
      systemPrompt,
      userPrompt,
      responseFormat: 'json'
    });

    return this.parseJSON<ExecutionPlan>(response.raw);
  }

  /**
   * Summarize old messages into a compact context string.
   * Called when conversation history grows too long.
   */
  async compactMessages(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const systemPrompt = `You are a conversation summarizer for an AI coding assistant called OpenKode.
Produce a COMPACT, FACTUAL summary of the conversation history provided.
Rules:
- Extract: the user's goals, key decisions made, files mentioned, technologies chosen, errors encountered, solutions applied
- Preserve: any specific filenames, function names, variable names, error messages, and code snippets that were discussed
- Omit: pleasantries, repetitions, tangential discussion
- Format: plain prose paragraphs (NO markdown headers, NO bullet points)
- Length: 150-300 words maximum
- Begin with: "CONTEXT SUMMARY: "
Output ONLY the summary. No preamble, no explanation.`;

    const formatted = messages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n');

    const response = await this.generate({
      systemPrompt,
      userPrompt: `Summarize this conversation:\n\n${formatted}`,
      responseFormat: 'markdown'
    });

    return response.raw.trim();
  }

  /**
   * Generate a detailed, step-by-step implementation guide for an ExecutionPlan.
   * fileContents: map of relativePath → current file content (empty string = new file).
   * Returns a markdown string with exact implementation instructions per task.
   */
  async generateDetailedPlan(
    plan: ExecutionPlan,
    fileContents: Record<string, string>,
    preCheckStatus?: Record<string, 'exists' | 'missing'>
  ): Promise<string> {
    const systemPrompt = `You are an expert software engineer generating a detailed implementation guide.
You will receive a high-level execution plan, the current content of relevant files, and a pre-check status showing which files already exist.
Your output is a DETAILED IMPLEMENTATION GUIDE that a developer or AI coding tool can follow literally.

IMPORTANT — Check for already-done work:
- Before writing instructions for a task, compare the task description against the current file content provided.
- If a task's required code/change is ALREADY PRESENT in the current file content, prefix the task section with "✅ ALREADY DONE — skipping" and do NOT repeat the implementation. Briefly note what was found.
- Only provide full instructions for tasks that are NOT yet implemented or are only partially done.
- A file pre-check status of "exists" means the file is present but you must still verify the specific task requirement is met.
- A file pre-check status of "missing" means the file does not exist yet and the task is definitely not done.

For each task that IS needed, provide:
1. The exact file path to create or modify
2. For NEW files: the complete file content, fully written out
3. For EXISTING files: clear FIND/REPLACE blocks showing the exact change — use "FIND:" and "REPLACE:" markers
4. Any imports or dependencies to add
5. The correct order to implement tasks (accounting for dependencies)

Format rules:
- Use ## headers for each Epic, ### for each Phase, #### for each Task
- Always include the file path in a code comment at the top of each code block
- For complete new files, use triple-backtick blocks with the language identifier
- Be COMPLETE — do not say "implement as appropriate" — write the actual code
- At the end, add a ## Dependencies section listing any new packages to install`;

    const filesSection = Object.entries(fileContents)
      .map(([filePath, content]) =>
        content
          ? `### ${filePath}\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``
          : `### ${filePath}\n(NEW FILE — does not exist yet)`
      )
      .join('\n\n');

    const preCheckSection = preCheckStatus && Object.keys(preCheckStatus).length > 0
      ? Object.entries(preCheckStatus)
          .map(([f, s]) => `- ${f}: **${s}**`)
          .join('\n')
      : '(no pre-check data)';

    const planJson = JSON.stringify(plan, null, 2);
    const userPrompt = `Generate a detailed implementation guide for this execution plan.

## Execution Plan
\`\`\`json
${planJson}
\`\`\`

## File Pre-Check Status (exists = file is present on disk; missing = file does not exist yet)
${preCheckSection}

## Current File Contents
${filesSection || '(No existing files referenced — all tasks create new files)'}

Output the complete implementation guide in markdown. For already-done tasks write "✅ ALREADY DONE — skipping". Write actual code for everything else.`;

    const response = await this.generate({
      systemPrompt,
      userPrompt,
      responseFormat: 'markdown'
    });

    return response.raw.trim();
  }

  /**
   * Verify that an AI tool has implemented the tasks in an execution plan.
   * fileContents: current state of all files mentioned in plan tasks.
   * Returns a structured result per task.
   */
  async verifyExecution(
    tasks: PlanTask[],
    fileContents: Record<string, string>,
    planTitle: string
  ): Promise<Array<{ taskId: string; completed: boolean; notes: string }>> {
    const systemPrompt = `You are a code reviewer verifying that implementation tasks have been completed.
For each task, examine the current file contents and determine if the task has been implemented.

Rules:
- Only mark a task "completed: true" if the implementation is clearly present in the files
- If a file doesn't exist yet (empty content), the task is NOT completed
- Be strict: "completed" means the feature/code is actually there, not just partially started
- "notes" should be 1-2 sentences: confirm what was found, or explain what is missing

Output ONLY valid JSON — no markdown, no prose, just the JSON array:
[
  { "taskId": "E1-P1-T1", "completed": true, "notes": "UserService class created with login() and register() methods." },
  { "taskId": "E1-P1-T2", "completed": false, "notes": "src/db/schema.ts exists but User table migration is missing." }
]`;

    const tasksSection = tasks
      .map(t =>
        `Task ${t.id}: ${t.title}\n  Description: ${t.description}\n  Expected files: ${(t.files || []).join(', ') || 'none specified'}`
      )
      .join('\n\n');

    const filesSection = Object.entries(fileContents)
      .map(([filePath, content]) =>
        content
          ? `### ${filePath}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``
          : `### ${filePath}\n(FILE DOES NOT EXIST)`
      )
      .join('\n\n');

    const userPrompt = `Verify implementation for plan: "${planTitle}"

## Tasks to Verify
${tasksSection}

## Current File Contents
${filesSection}

Respond with ONLY the JSON array.`;

    const response = await this.generate({
      systemPrompt,
      userPrompt,
      responseFormat: 'json'
    });

    return this.parseJSON<Array<{ taskId: string; completed: boolean; notes: string }>>(response.raw);
  }

  /**
   * Check whether the user's request involves tech stack decisions (new project,
   * adding DB/cache/queue/auth/etc.) and return clarifying questions if so.
   */
  async generateStackClarifications(
    userRequest: string,
    existingStack?: string
  ): Promise<{ needed: boolean; questions: Array<{ id: string; label: string; options: string[] }> }> {
    const systemPrompt = `You are a tech stack advisor for a software project.
Analyze the user's request and decide if it involves technology choices that should be clarified upfront.

Trigger questions when the request involves:
- Starting a new project or app
- Adding a database, data layer, or ORM
- Adding caching (Redis, Memcached, etc.)
- Adding a message queue or event bus
- Adding authentication or authorization
- Adding file/blob storage
- Adding search functionality
- Adding email, SMS, or notification services
- Adding a payment gateway
- Choosing a framework or language for a new service

Rules:
- Ask ONLY about components clearly needed by the request (2–5 questions max)
- Each question has 3–6 short option names (1–3 words each)
- Always include a "Custom" option as the last choice
- If the user has already specified a technology, do NOT ask about it
- If no infrastructure choices are needed (e.g. a pure UI tweak or refactor), return needed: false

Output ONLY valid JSON — no markdown, no prose:
{
  "needed": true,
  "questions": [
    { "id": "database", "label": "Database", "options": ["PostgreSQL", "MySQL", "MongoDB", "SQLite", "Custom"] }
  ]
}

If no choices needed:
{ "needed": false, "questions": [] }`;

    const userPrompt = `User request: "${userRequest}"${existingStack ? `\n\nExisting stack already decided: ${existingStack}` : ''}

Does this require technology choices? Output ONLY JSON.`;

    const response = await this.generate({ systemPrompt, userPrompt, responseFormat: 'json' });
    try {
      return this.parseJSON<{ needed: boolean; questions: Array<{ id: string; label: string; options: string[] }> }>(response.raw);
    } catch {
      return { needed: false, questions: [] };
    }
  }

  /**
   * Generate and parse as JSON
   * Throws if response is not valid JSON
   */
  async generateJSON<T>(prompt: CompiledPrompt): Promise<T> {
    const response = await this.generate(prompt);
    return this.parseJSON<T>(response.raw);
  }

  private async callOpenAI(prompt: CompiledPrompt): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const model = this.config.model || 'gpt-4o-mini';
    
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    return {
      raw: response.choices[0].message.content || '',
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0
      },
      model: response.model,
      latency: 0 // Set by caller
    };
  }

  private async callAnthropic(prompt: CompiledPrompt): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const model = this.config.model || 'claude-3-5-sonnet-20241022';
    
    const response = await this.anthropic.messages.create({
      model,
      max_tokens: 4000,
      system: prompt.systemPrompt,
      messages: [{ role: 'user', content: prompt.userPrompt }]
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';

    return {
      raw: text,
      usage: {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0
      },
      model: response.model,
      latency: 0
    };
  }

  private async callGemini(prompt: CompiledPrompt): Promise<LLMResponse> {
    if (!this.gemini) {
      throw new Error('Gemini client not initialized');
    }

    const model = this.gemini.getGenerativeModel({ 
      model: this.config.model || 'gemini-1.5-flash'
    });
    
    const result = await model.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [
          { text: `${prompt.systemPrompt}\n\n${prompt.userPrompt}` }
        ]
      }]
    });

    const response = result.response;
    const usage = response.usageMetadata;

    return {
      raw: response.text(),
      usage: usage ? {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0
      } : undefined,
      model: this.config.model || 'gemini-1.5-flash',
      latency: 0
    };
  }

  private async callKimi(prompt: CompiledPrompt): Promise<LLMResponse> {
    // Kimi uses OpenAI-compatible API
    if (!this.openai) {
      throw new Error('Kimi client not initialized');
    }

    // Kimi model names - try moonshot-v1-8k as default
    const model = this.config.model || 'moonshot-v1-8k';
    
    console.log(`[LLMClient] Calling Kimi API`);
    console.log(`[LLMClient] Model: ${model}`);
    console.log(`[LLMClient] Base URL: ${this.config.baseUrl || 'https://api.moonshot.cn/v1'}`);
    
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      console.log(`[LLMClient] Kimi API response received successfully`);

      return {
        raw: response.choices[0].message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0
        },
        model: response.model,
        latency: 0
      };
    } catch (error) {
      console.error(`[LLMClient] Kimi API error:`, error);
      throw error;
    }
  }

  private parseJSON<T>(raw: string): T {
    // Try to extract JSON from markdown code blocks first
    const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) || 
                      raw.match(/```\n?([\s\S]*?)\n?```/);
    
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    
    try {
      return JSON.parse(jsonStr) as T;
    } catch (e) {
      throw new Error(
        `Failed to parse LLM response as JSON: ${e}\n` +
        `Response preview: ${raw.substring(0, 200)}...`
      );
    }
  }

  private wrapError(error: unknown): Error {
    // Log the raw error for debugging
    console.error(`[LLMClient] Raw error for ${this.config.provider}:`, error);
    
    if (error instanceof Error) {
      // Log the full error details
      console.error(`[LLMClient] Full error for ${this.config.provider}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
        // @ts-ignore - accessing potential API error properties
        status: (error as any).status,
        // @ts-ignore
        code: (error as any).code,
        // @ts-ignore
        type: (error as any).type
      });
      
      // Add context to common errors
      if (error.message.includes('401') || (error as any).status === 401) {
        return new Error(`Invalid API key for ${this.config.provider}. Original error: ${error.message}`);
      }
      if (error.message.includes('429') || (error as any).status === 429) {
        return new Error(`Rate limit exceeded for ${this.config.provider}. Please wait a moment.`);
      }
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return new Error(`Request timeout. The API is slow or your connection is unstable.`);
      }
      return new Error(`${this.config.provider} API error: ${error.message}`);
    }
    return new Error(String(error));
  }
}
