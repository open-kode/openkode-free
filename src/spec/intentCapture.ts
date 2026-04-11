/**
 * OpenKode Spec-Driven Development Pipeline
 * =========================================
 * Phase 1: Intent Capture
 * 
 * Captures user intent, generates PRD, extracts constraints,
 * and structures requirements into a formal specification.
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Raw user input for intent capture
 */
export interface IntentInput {
  /** User's natural language description of what they want */
  description: string;
  
  /** Optional constraints (time, tech, budget, etc.) */
  constraints?: Constraint[];
  
  /** Optional acceptance criteria */
  acceptanceCriteria?: AcceptanceCriterion[];
  
  /** Optional context (existing codebase, prior decisions) */
  context?: IntentContext;
  
  /** Optional priority level */
  priority?: PriorityLevel;
  
  /** Optional tags for categorization */
  tags?: string[];
}

/**
 * Constraint definition
 */
export interface Constraint {
  /** Type of constraint */
  type: 'time' | 'technology' | 'budget' | 'performance' | 'security' | 'compliance' | 'other';
  
  /** Human-readable description */
  description: string;
  
  /** Constraint value/expression */
  value?: string | number | boolean;
  
  /** Whether this constraint is hard (must be met) or soft (preferred) */
  severity: 'hard' | 'soft';
  
  /** Optional validation function identifier */
  validator?: string;
}

/**
 * Acceptance criterion for validation
 */
export interface AcceptanceCriterion {
  /** Unique identifier */
  id: string;
  
  /** Human-readable description of what must be true */
  description: string;
  
  /** How to verify this criterion */
  verificationMethod: 'manual' | 'automated' | 'review';
  
  /** Optional test case or verification script */
  testCase?: string;
  
  /** Whether this is required or optional */
  required: boolean;
}

/**
 * Context for intent capture
 */
export interface IntentContext {
  /** Existing codebase information */
  codebase?: CodebaseContext;
  
  /** Prior decisions that affect this intent */
  priorDecisions?: PriorDecision[];
  
  /** Related specs or epics */
  relatedSpecs?: string[];
  
  /** Stakeholders involved */
  stakeholders?: string[];
}

/**
 * Codebase context information
 */
export interface CodebaseContext {
  /** Root directory of the codebase */
  rootPath: string;
  
  /** Primary language/framework */
  primaryLanguage?: string;
  
  /** Existing architecture patterns */
  architecture?: string[];
  
  /** Key dependencies */
  dependencies?: string[];
}

/**
 * Prior architectural or design decision
 */
export interface PriorDecision {
  /** Decision identifier */
  id: string;
  
  /** What was decided */
  decision: string;
  
  /** Why it was decided */
  rationale: string;
  
  /** When it was decided */
  date?: string;
  
  /** Impact on current intent */
  impact?: string;
}

/**
 * Priority levels for intents
 */
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

/**
 * Captured and structured intent
 */
export interface CapturedIntent {
  /** Unique identifier */
  id: string;
  
  /** Description from original input */
  description: string;
  
  /** Original input */
  originalInput: IntentInput;
  
  /** Structured requirements extracted from input */
  requirements: Requirement[];
  
  /** Extracted constraints */
  constraints: Constraint[];
  
  /** Acceptance criteria */
  acceptanceCriteria: AcceptanceCriterion[];
  
  /** Assumptions made during capture */
  assumptions: string[];
  
  /** Open questions that need clarification */
  openQuestions: string[];
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Timestamp of capture */
  capturedAt: string;
  
  /** Version of the captured intent */
  version: string;
}

/**
 * Structured requirement
 */
export interface Requirement {
  /** Unique identifier */
  id: string;
  
  /** Requirement type */
  type: 'functional' | 'non-functional' | 'technical' | 'business';
  
  /** Human-readable description */
  description: string;
  
  /** Priority within requirements */
  priority: PriorityLevel;
  
  /** Parent requirement if hierarchical */
  parentId?: string;
  
  /** Child requirements */
  children?: string[];
}

/**
 * Product Requirements Document
 */
export interface PRD {
  /** Document identifier */
  id: string;
  
  /** Document title */
  title: string;
  
  /** Document version */
  version: string;
  
  /** When the PRD was created */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
  
  /** Document status */
  status: 'draft' | 'review' | 'approved' | 'deprecated';
  
  /** Overview/executive summary */
  overview: string;
  
  /** Goals and objectives */
  goals: Goal[];
  
  /** Detailed requirements */
  requirements: Requirement[];
  
  /** Constraints */
  constraints: Constraint[];
  
  /** Acceptance criteria */
  acceptanceCriteria: AcceptanceCriterion[];
  
  /** Out of scope items */
  outOfScope: string[];
  
  /** Assumptions */
  assumptions: string[];
  
  /** Open questions */
  openQuestions: string[];
  
  /** Related documents */
  relatedDocuments?: string[];
}

/**
 * Goal definition
 */
export interface Goal {
  /** Goal identifier */
  id: string;
  
  /** Goal description */
  description: string;
  
  /** Success metrics */
  successMetrics?: string[];
  
  /** Target date */
  targetDate?: string;
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * PRD section templates
 */
export const PRDTemplates = {
  overview: `# Overview

## Problem Statement
{problemStatement}

## Solution Overview
{solutionOverview}

## Target Users
{targetUsers}
`,

  goals: `# Goals

## Primary Goals
{primaryGoals}

## Success Metrics
{successMetrics}
`,

  requirements: `# Requirements

## Functional Requirements
{functionalRequirements}

## Non-Functional Requirements
{nonFunctionalRequirements}
`,

  constraints: `# Constraints

## Technical Constraints
{technicalConstraints}

## Business Constraints
{businessConstraints}
`,

  acceptanceCriteria: `# Acceptance Criteria

{acceptanceCriteriaList}
`
};

/**
 * Intent capture templates
 */
export const IntentTemplates = {
  feature: {
    name: 'Feature Development',
    description: 'Template for capturing new feature requirements',
    prompts: [
      'What problem does this feature solve?',
      'Who are the target users?',
      'What are the key capabilities needed?',
      'What are the constraints or limitations?',
      'How will we know this is successful?'
    ]
  },
  
  bugfix: {
    name: 'Bug Fix',
    description: 'Template for capturing bug fix requirements',
    prompts: [
      'What is the current behavior?',
      'What is the expected behavior?',
      'What are the steps to reproduce?',
      'What is the impact of this bug?',
      'Are there any workarounds?'
    ]
  },
  
  refactor: {
    name: 'Code Refactoring',
    description: 'Template for capturing refactoring requirements',
    prompts: [
      'What code needs to be refactored?',
      'Why does it need refactoring?',
      'What are the risks?',
      'What should remain unchanged?',
      'How will we verify the refactoring?'
    ]
  },
  
  integration: {
    name: 'System Integration',
    description: 'Template for capturing integration requirements',
    prompts: [
      'What systems need to be integrated?',
      'What data needs to flow between them?',
      'What are the interface requirements?',
      'What are the failure scenarios?',
      'How will we test the integration?'
    ]
  }
};

// ============================================================================
// INTENT CAPTURE CLASS
// ============================================================================

export class IntentCaptureSystem {
  private capturedIntents: Map<string, CapturedIntent> = new Map();
  private prds: Map<string, PRD> = new Map();
  private idCounter = 0;

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    this.idCounter++;
    return `${prefix}-${Date.now()}-${this.idCounter}`;
  }

  /**
   * Capture intent from user input
   */
  captureIntent(input: IntentInput): CapturedIntent {
    const id = this.generateId('intent');
    
    // Extract requirements from description
    const requirements = this.extractRequirements(input.description);
    
    // Extract constraints from input or infer from description
    const constraints = this.extractConstraints(input);
    
    // Generate or validate acceptance criteria
    const acceptanceCriteria = this.processAcceptanceCriteria(input);
    
    // Identify assumptions and open questions
    const { assumptions, openQuestions } = this.analyzeIntent(input);
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(input, requirements, openQuestions);

    const capturedIntent: CapturedIntent = {
      id,
      description: input.description,
      originalInput: input,
      requirements,
      constraints,
      acceptanceCriteria,
      assumptions,
      openQuestions,
      confidence,
      capturedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    this.capturedIntents.set(id, capturedIntent);
    return capturedIntent;
  }

  /**
   * Extract requirements from natural language description
   */
  private extractRequirements(description: string): Requirement[] {
    const requirements: Requirement[] = [];
    
    // Simple pattern-based extraction (in production, use NLP)
    const patterns = [
      { regex: /must\s+(.+?)(?:\.|,|;|$)/gi, type: 'functional' as const, priority: 'high' as const },
      { regex: /should\s+(.+?)(?:\.|,|;|$)/gi, type: 'functional' as const, priority: 'medium' as const },
      { regex: /needs?\s+to\s+(.+?)(?:\.|,|;|$)/gi, type: 'functional' as const, priority: 'high' as const },
      { regex: /requires?\s+(.+?)(?:\.|,|;|$)/gi, type: 'technical' as const, priority: 'high' as const },
      { regex: /support\s+(.+?)(?:\.|,|;|$)/gi, type: 'non-functional' as const, priority: 'medium' as const }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(description)) !== null) {
        requirements.push({
          id: this.generateId('req'),
          type: pattern.type,
          description: match[1].trim(),
          priority: pattern.priority
        });
      }
    }

    // If no requirements extracted, create a generic one
    if (requirements.length === 0) {
      requirements.push({
        id: this.generateId('req'),
        type: 'functional',
        description: description.trim(),
        priority: 'medium'
      });
    }

    return requirements;
  }

  /**
   * Extract constraints from input
   */
  private extractConstraints(input: IntentInput): Constraint[] {
    const constraints: Constraint[] = [...(input.constraints || [])];
    
    // Infer constraints from description
    const description = input.description.toLowerCase();
    
    // Time constraints
    if (description.includes('asap') || description.includes('urgent') || description.includes('quick')) {
      constraints.push({
        type: 'time',
        description: 'Time-sensitive delivery required',
        severity: 'soft'
      });
    }
    
    // Technology constraints
    const techPatterns = [
      { pattern: /using\s+(\w+)/i, type: 'technology' },
      { pattern: /in\s+(typescript|javascript|python|java|go|rust)/i, type: 'technology' },
      { pattern: /with\s+(react|vue|angular|svelte)/i, type: 'technology' }
    ];
    
    for (const { pattern } of techPatterns) {
      const match = description.match(pattern);
      if (match) {
        constraints.push({
          type: 'technology',
          description: `Must use ${match[1]}`,
          value: match[1],
          severity: 'hard'
        });
      }
    }

    return constraints;
  }

  /**
   * Process acceptance criteria from input
   */
  private processAcceptanceCriteria(input: IntentInput): AcceptanceCriterion[] {
    if (input.acceptanceCriteria && input.acceptanceCriteria.length > 0) {
      return input.acceptanceCriteria;
    }

    // Generate default acceptance criteria based on requirements
    const criteria: AcceptanceCriterion[] = [];
    
    // Extract potential criteria from description
    const description = input.description;
    const criteriaPatterns = [
      /(?:given|when|then)\s+(.+?)(?:\.|,|;|$)/gi,
      /(?:acceptance|criteria):?\s*(.+?)(?:\.|,|;|$)/gi
    ];

    for (const pattern of criteriaPatterns) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        criteria.push({
          id: this.generateId('ac'),
          description: match[1].trim(),
          verificationMethod: 'automated',
          required: true
        });
      }
    }

    return criteria;
  }

  /**
   * Analyze intent for assumptions and open questions
   */
  private analyzeIntent(input: IntentInput): { assumptions: string[]; openQuestions: string[] } {
    const assumptions: string[] = [];
    const openQuestions: string[] = [];
    
    const description = input.description.toLowerCase();

    // Common assumption patterns
    if (!description.includes('platform') && !description.includes('browser')) {
      assumptions.push('Target platform is web/browser-based');
    }
    
    if (!description.includes('user') && !description.includes('customer')) {
      assumptions.push('Feature is for end users');
    }

    // Detect potential open questions
    if (!description.includes('error') && !description.includes('fail')) {
      openQuestions.push('What should happen on error/failure?');
    }
    
    if (!description.includes('performance') && !description.includes('speed')) {
      openQuestions.push('Are there performance requirements?');
    }
    
    if (!description.includes('test') && !description.includes('verify')) {
      openQuestions.push('How should this be tested?');
    }

    return { assumptions, openQuestions };
  }

  /**
   * Calculate confidence score for captured intent
   */
  private calculateConfidence(
    input: IntentInput,
    requirements: Requirement[],
    openQuestions: string[]
  ): number {
    let score = 0.5; // Base score

    // More requirements = higher confidence (up to a point)
    score += Math.min(requirements.length * 0.05, 0.2);

    // Explicit constraints increase confidence
    if (input.constraints && input.constraints.length > 0) {
      score += 0.1;
    }

    // Explicit acceptance criteria increase confidence
    if (input.acceptanceCriteria && input.acceptanceCriteria.length > 0) {
      score += 0.1;
    }

    // Open questions reduce confidence
    score -= Math.min(openQuestions.length * 0.05, 0.2);

    // Context increases confidence
    if (input.context) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate PRD from captured intent
   */
  generatePRD(intent: CapturedIntent, title?: string): PRD {
    const id = this.generateId('prd');
    const now = new Date().toISOString();

    const prd: PRD = {
      id,
      title: title || `PRD for ${intent.id}`,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      overview: this.generateOverview(intent),
      goals: this.generateGoals(intent),
      requirements: intent.requirements,
      constraints: intent.constraints,
      acceptanceCriteria: intent.acceptanceCriteria,
      outOfScope: [],
      assumptions: intent.assumptions,
      openQuestions: intent.openQuestions
    };

    this.prds.set(id, prd);
    return prd;
  }

  /**
   * Generate PRD overview section
   */
  private generateOverview(intent: CapturedIntent): string {
    return `## Problem Statement
${intent.originalInput.description}

## Solution Overview
This document outlines the requirements and specifications for implementing the described functionality.

## Target Users
${intent.originalInput.context?.stakeholders?.join(', ') || 'End users'}
`;
  }

  /**
   * Generate goals from intent
   */
  private generateGoals(intent: CapturedIntent): Goal[] {
    return intent.requirements
      .filter(r => r.priority === 'high' || r.priority === 'critical')
      .map(r => ({
        id: this.generateId('goal'),
        description: r.description,
        successMetrics: ['Implementation complete', 'Tests passing']
      }));
  }

  /**
   * Apply a template to structure intent
   */
  applyTemplate(templateName: keyof typeof IntentTemplates, input: IntentInput): IntentInput {
    const template = IntentTemplates[templateName];
    if (!template) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    // Enhance input with template context
    return {
      ...input,
      tags: [...(input.tags || []), templateName],
      context: {
        ...input.context,
        priorDecisions: [
          ...(input.context?.priorDecisions || []),
          {
            id: this.generateId('decision'),
            decision: `Using ${template.name} template`,
            rationale: template.description,
            date: new Date().toISOString()
          }
        ]
      }
    };
  }

  /**
   * Validate constraints against known rules
   */
  validateConstraints(constraints: Constraint[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const constraint of constraints) {
      // Check for conflicting constraints
      const conflicts = constraints.filter(c => 
        c !== constraint && 
        c.type === constraint.type &&
        c.severity === 'hard'
      );

      if (conflicts.length > 0) {
        errors.push(`Potential conflict in ${constraint.type} constraints`);
      }

      // Validate constraint format
      if (!constraint.description || constraint.description.length < 5) {
        errors.push(`Constraint description too short: ${constraint.description}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get captured intent by ID
   */
  getIntent(id: string): CapturedIntent | undefined {
    return this.capturedIntents.get(id);
  }

  /**
   * Get PRD by ID
   */
  getPRD(id: string): PRD | undefined {
    return this.prds.get(id);
  }

  /**
   * List all captured intents
   */
  listIntents(): CapturedIntent[] {
    return Array.from(this.capturedIntents.values());
  }

  /**
   * List all PRDs
   */
  listPRDs(): PRD[] {
    return Array.from(this.prds.values());
  }

  /**
   * Update PRD status
   */
  updatePRDStatus(id: string, status: PRD['status']): PRD | undefined {
    const prd = this.prds.get(id);
    if (prd) {
      prd.status = status;
      prd.updatedAt = new Date().toISOString();
      this.prds.set(id, prd);
    }
    return prd;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const intentCapture = new IntentCaptureSystem();

// Default export
export default IntentCaptureSystem;
