/**
 * Intent Detector - Distinguish conversation from code generation
 * 
 * Prevents generating files for greetings, questions, and casual chat
 */

export type UserIntent =
  | 'greeting'      // "Hi", "Hello", "Hey"
  | 'question'      // "What can you do?", "How does this work?"
  | 'help'          // "Help me", "I need assistance"
  | 'plan_request'  // "Build a notepad app", "I want to create a todo app" → generate execution plan
  | 'code_request'  // "Add auth to this file", "Fix this bug" → direct code change
  | 'explanation'   // "Explain this code", "What does this do?"
  | 'modification'  // "Fix this bug", "Refactor this"
  | 'chat'          // General conversation
  | 'unclear';      // Ambiguous intent

export interface IntentResult {
  intent: UserIntent;
  confidence: number;
  shouldGenerateCode: boolean;
  shouldGeneratePlan: boolean;
  suggestedResponse?: string;
}

export class IntentDetector {
  // Greeting patterns
  private greetingPatterns = [
    /^hi+\b/i,
    /^hello+\b/i,
    /^hey+\b/i,
    /^greetings/i,
    /^good\s+(morning|afternoon|evening)/i,
    /^howdy/i,
    /^what'?s\s+up/i,
    /^yo\b/i
  ];

  // Question patterns
  private questionPatterns = [
    /^(what|how|why|when|where|who|can|could|would|will|is|are|do|does)\b/i,
    /\?$/  // Ends with question mark
  ];

  // Help patterns
  private helpPatterns = [
    /^help\b/i,
    /^i\s+need\s+help/i,
    /^assist(ance| me)/i,
    /^support/i,
    /^stuck/i,
    /^confused/i
  ];

  // Plan request patterns — high-level "I want to build something" → generate execution plan
  private planRequestPatterns = [
    /^(build|create|make|develop|design)\s+.*(app|application|system|platform|tool|website|site|service|api|bot|cli|dashboard|extension|plugin)\b/i,
    /\b(what|how).*(takes?|do\s+I\s+need|steps?|plan|approach)\b.*\b(build|create|make|develop)\b/i,
    /\b(help\s+me|i\s+want\s+to|i\s+need\s+to|i\s+am\s+going\s+to)\s+(build|create|make|develop)\b/i,
    /^(plan|roadmap|spec|architecture)\s+(for|to)\b/i,
    /^(create|build|make)\s+a\s+(full|complete|entire|whole)\b/i,
    /^(build|develop)\s+(me\s+)?(a|an|the)\b/i
  ];

  // Code request patterns — specific, targeted code changes
  private codeRequestPatterns = [
    /^(add|implement|write)\s+(a\s+)?(function|method|class|component|hook|endpoint|route|test)\b/i,
    /^fix\s+(this|the|a|an|bug|error|issue)\b/i,
    /^(update|modify|refactor|rename|delete|remove)\s+/i,
    /^(generate|scaffold)\s+(a\s+)?(file|component|page|model|schema|migration)\b/i
  ];

  // Explanation patterns - should NOT generate, should explain
  private explanationPatterns = [
    /^(explain|describe|tell\s+me\s+about|what\s+is|what\s+are|how\s+does)\b/i,
    /\b(meaning|purpose|function\s+of)\b/i
  ];

  detectIntent(input: string): IntentResult {
    const trimmed = input.trim();

    // Greetings
    if (this.matchesAny(trimmed, this.greetingPatterns)) {
      return { intent: 'greeting', confidence: 0.95, shouldGenerateCode: false, shouldGeneratePlan: false, suggestedResponse: this.getGreetingResponse() };
    }

    // Help
    if (this.matchesAny(trimmed, this.helpPatterns)) {
      return { intent: 'help', confidence: 0.9, shouldGenerateCode: false, shouldGeneratePlan: false, suggestedResponse: this.getHelpResponse() };
    }

    // Plan request — high-level "build me an app" → generate execution plan
    if (this.matchesAny(trimmed, this.planRequestPatterns)) {
      return { intent: 'plan_request', confidence: 0.88, shouldGenerateCode: false, shouldGeneratePlan: true };
    }

    // Specific code change — "add X function", "fix this bug"
    if (this.matchesAny(trimmed, this.codeRequestPatterns)) {
      return { intent: 'code_request', confidence: 0.85, shouldGenerateCode: true, shouldGeneratePlan: false };
    }

    // Explanation
    if (this.matchesAny(trimmed, this.explanationPatterns)) {
      return { intent: 'explanation', confidence: 0.8, shouldGenerateCode: false, shouldGeneratePlan: false };
    }

    // Questions → LLM chat
    if (this.matchesAny(trimmed, this.questionPatterns)) {
      return { intent: 'question', confidence: 0.8, shouldGenerateCode: false, shouldGeneratePlan: false };
    }

    // Very short → conversational
    if (trimmed.split(/\s+/).length <= 2) {
      return { intent: 'chat', confidence: 0.6, shouldGenerateCode: false, shouldGeneratePlan: false, suggestedResponse: "I'm here to help you build software. What would you like to create?" };
    }

    // Default → let LLM handle it as conversation
    return { intent: 'unclear', confidence: 0.5, shouldGenerateCode: false, shouldGeneratePlan: false };
  }

  private matchesAny(input: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(input));
  }

  private getGreetingResponse(): string {
    const responses = [
      "Hello! I'm OpenKode, your AI development orchestrator. I can help you build software in 4 modes:\n\n🎯 **Precision** - Step-by-step with analysis\n🏗️ **Blueprint** - Architecture-first planning\n🔭 **Visionary** - Strategic design and specs\n🚀 **Rocket** - Fast auto-execution\n\nWhat would you like to build?",
      "Hi there! Ready to code? I can help you create applications, add features, or analyze existing code. Just tell me what you want to build!",
      "Hey! I'm here to help you develop software. What project are we working on today?"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private getHelpResponse(): string {
    return `I can help you in several ways:\n\n**Generate Code:**\n- "Create a React todo app"\n- "Add user authentication"\n- "Build a REST API"\n\n**Analyze Code:**\n- "Explain this file"\n- "Find bugs in src/utils"\n- "Refactor this component"\n\n**Terminal Commands:**\n- Run npm install/build/test\n- Execute git commands\n- Manage WSL/PowerShell\n\n**External Agents:**\n- Route to Cursor, Copilot, Codex\n\nWhat do you need help with?`;
  }

  private getQuestionResponse(question: string): string {
    const lower = question.toLowerCase();
    
    if (lower.includes('can you do') || lower.includes('what can you')) {
      return this.getHelpResponse();
    }
    
    if (lower.includes('mode') || lower.includes('precision') || lower.includes('blueprint')) {
      return `I have 4 modes:\n\n🎯 **Precision** - Careful step-by-step implementation with analysis\n🏗️ **Blueprint** - Multi-phase architecture and planning\n🔭 **Visionary** - High-level design and specifications\n🚀 **Rocket** - Fast single-shot generation\n\nSwitch modes by clicking the mode cards above. What would you like to build?`;
    }

    if (lower.includes('how') && (lower.includes('work') || lower.includes('use'))) {
      return `Just tell me what you want to build! For example:\n- "Create a Next.js blog"\n- "Add a login page"\n- "Fix the API error"\n\nI'll analyze your request, create a plan, and generate the code. You can also:\n- Change modes for different approaches\n- Ask me to explain code\n- Run terminal commands\n- Hand off to external agents like Cursor\n\nWhat are we building?`;
    }

    return `Good question! I'm an AI development orchestrator. I can:\n\n1. **Generate code** - Apps, features, APIs\n2. **Analyze projects** - Understand structure, find issues\n3. **Run commands** - npm, git, tests\n4. **Integrate agents** - Cursor, Copilot, Codex\n\nWhat would you like to do? Just describe what you want to build!`;
  }
}

export const intentDetector = new IntentDetector();
