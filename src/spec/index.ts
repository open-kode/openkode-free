/**
 * OpenKode Spec-Driven Development Pipeline
 * =========================================
 * 
 * Main exports for the SDD spec module.
 * Implements the workflow: Intent → Decompose → Plan → Handoff → Verify
 */

// ============================================================================
// INTENT CAPTURE EXPORTS
// ============================================================================

export {
  IntentCaptureSystem,
  intentCapture,
  IntentInput,
  Constraint,
  AcceptanceCriterion,
  IntentContext,
  CodebaseContext,
  PriorDecision,
  PriorityLevel,
  CapturedIntent,
  Requirement,
  PRD,
  Goal,
  PRDTemplates,
  IntentTemplates
} from './intentCapture';

// ============================================================================
// DECOMPOSER EXPORTS
// ============================================================================

export {
  Decomposer,
  decomposer,
  Epic,
  Phase,
  Ticket,
  Task,
  WorkItemStatus,
  Complexity,
  PhaseType,
  TicketType,
  TaskType,
  DecompositionStrategy,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  DecompositionResult,
  DecompositionStats
} from './decomposer';

// ============================================================================
// TACTICAL PLANNER EXPORTS
// ============================================================================

export {
  TacticalPlanner,
  tacticalPlanner,
  TacticalPlan,
  FileChange,
  CodeInsertion,
  CodeRemoval,
  FileType,
  InterfaceDefinition,
  PropertyDefinition,
  MethodDefinition,
  ParameterDefinition,
  ImplementationStep,
  StepType,
  CodeBlock,
  DependencySpec,
  TestSpec,
  TestCase,
  MockSpec,
  RollbackStep,
  Risk,
  PlanningContext,
  CodebaseInfo,
  TeamConventions,
  TacticalTemplates
} from './tacticalPlanner';

// ============================================================================
// SPEC VALIDATOR EXPORTS
// ============================================================================

export {
  SpecValidator,
  specValidator,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationInfo,
  SpecVersion,
  SpecType,
  SpecDiff,
  DiffEntry,
  DiffModification,
  BreakingChange,
  ValidationRule,
  SpecSchema,
  SchemaProperty,
  IntentInputSchema,
  PRDSchema,
  EpicSchema,
  TacticalPlanSchema
} from './specValidator';

// ============================================================================
// SPEC STORE EXPORTS
// ============================================================================

export {
  SpecStore,
  specStore,
  StorageConfig,
  SpecIndexEntry,
  SpecStatus,
  SpecSearchQuery,
  SpecSearchResult,
  SpecExport,
  ExportedSpec,
  SpecImportResult,
  SpecImportError,
  StorageStats,
  DefaultStorageConfig
} from './specStore';

// ============================================================================
// TRACEABILITY EXPORTS
// ============================================================================

export { TraceabilityEngine } from './traceability';

// ============================================================================
// WORKFLOW ORCHESTRATOR
// ============================================================================

import { IntentCaptureSystem, CapturedIntent, IntentInput } from './intentCapture';
import { Decomposer, Epic, DecompositionResult } from './decomposer';
import { TacticalPlanner, TacticalPlan, PlanningContext } from './tacticalPlanner';
import { SpecValidator, ValidationResult, SpecVersion } from './specValidator';
import { SpecStore, SpecIndexEntry } from './specStore';

/**
 * SDD Pipeline configuration
 */
export interface SDDPipelineConfig {
  /** Enable validation at each stage */
  validateAtEachStage: boolean;
  
  /** Auto-save specs to store */
  autoSave: boolean;
  
  /** Max decomposition depth */
  maxDecompositionDepth: number;
  
  /** Planning context */
  planningContext: PlanningContext;
}

/**
 * Pipeline stage result
 */
export interface PipelineStageResult<T> {
  /** Success flag */
  success: boolean;
  
  /** Stage output */
  output?: T;
  
  /** Validation result */
  validation?: ValidationResult;
  
  /** Errors */
  errors: string[];
  
  /** Warnings */
  warnings: string[];
  
  /** Stage duration in ms */
  duration: number;
}

/**
 * Complete pipeline result
 */
export interface PipelineResult {
  /** Overall success */
  success: boolean;
  
  /** Captured intent */
  intent?: CapturedIntent;
  
  /** Generated PRD */
  prd?: import('./intentCapture').PRD;
  
  /** Decomposed epic */
  epic?: Epic;
  
  /** Tactical plans */
  plans?: TacticalPlan[];
  
  /** Stage results */
  stages: {
    capture?: PipelineStageResult<CapturedIntent>;
    decompose?: PipelineStageResult<DecompositionResult>;
    plan?: PipelineStageResult<TacticalPlan[]>;
  };
  
  /** Total duration */
  totalDuration: number;
  
  /** Stored spec IDs */
  storedSpecIds: string[];
}

/**
 * SDD Pipeline Orchestrator
 * 
 * Orchestrates the complete Spec-Driven Development workflow:
 * 1. Intent Capture - Parse user input into structured requirements
 * 2. Decomposition - Break down into Epic → Phase → Ticket → Task
 * 3. Tactical Planning - Create detailed implementation plans
 * 4. Validation - Validate specs against schemas
 * 5. Storage - Persist specs for tracking
 */
export class SDDPipeline {
  private intentCapture: IntentCaptureSystem;
  private decomposer: Decomposer;
  private tacticalPlanner: TacticalPlanner;
  private validator: SpecValidator;
  private store: SpecStore;
  private config: SDDPipelineConfig;

  constructor(
    intentCapture: IntentCaptureSystem,
    decomposer: Decomposer,
    tacticalPlanner: TacticalPlanner,
    validator: SpecValidator,
    store: SpecStore,
    config: Partial<SDDPipelineConfig> = {}
  ) {
    this.intentCapture = intentCapture;
    this.decomposer = decomposer;
    this.tacticalPlanner = tacticalPlanner;
    this.validator = validator;
    this.store = store;
    this.config = {
      validateAtEachStage: true,
      autoSave: true,
      maxDecompositionDepth: 4,
      planningContext: {
        codebase: {
          rootPath: process.cwd(),
          language: 'typescript',
          patterns: ['mvc', 'functional'],
          directories: ['src', 'lib', 'test']
        },
        availableTools: ['jest', 'eslint', 'prettier'],
        conventions: {
          naming: {
            files: 'kebab-case',
            classes: 'PascalCase',
            functions: 'camelCase',
            variables: 'camelCase',
            constants: 'UPPER_SNAKE_CASE'
          },
          codeStyle: {
            indentation: '2 spaces',
            quotes: 'single',
            semicolons: true,
            maxLineLength: 100
          },
          testing: {
            framework: 'jest',
            location: 'test',
            naming: '*.test.ts'
          },
          documentation: {
            required: true,
            style: 'JSDoc'
          }
        }
      },
      ...config
    };
  }

  /**
   * Execute the complete SDD pipeline
   */
  async execute(input: IntentInput): Promise<PipelineResult> {
    const startTime = Date.now();
    const storedSpecIds: string[] = [];
    const result: PipelineResult = {
      success: false,
      stages: {},
      totalDuration: 0,
      storedSpecIds
    };

    // Stage 1: Intent Capture
    const captureResult = await this.runCaptureStage(input);
    result.stages.capture = captureResult;
    
    if (!captureResult.success) {
      result.success = false;
      result.totalDuration = Date.now() - startTime;
      return result;
    }

    result.intent = captureResult.output;

    // Generate PRD
    if (captureResult.output) {
      const prd = this.intentCapture.generatePRD(captureResult.output);
      result.prd = prd;

      // Save to store
      if (this.config.autoSave) {
        const entry = await this.store.saveSpec(prd, 'prd', {
          id: prd.id,
          title: prd.title,
          tags: ['auto-generated']
        });
        storedSpecIds.push(entry.id);
      }
    }

    // Stage 2: Decomposition
    if (captureResult.output) {
      const decomposeResult = await this.runDecomposeStage(captureResult.output, result.prd);
      result.stages.decompose = decomposeResult;

      if (decomposeResult.success && decomposeResult.output) {
        result.epic = decomposeResult.output.epic;

        // Save to store
        if (this.config.autoSave && result.epic) {
          const entry = await this.store.saveSpec(result.epic, 'epic', {
            id: result.epic.id,
            title: result.epic.title,
            relatedSpecs: result.prd ? [result.prd.id] : []
          });
          storedSpecIds.push(entry.id);
        }
      }
    }

    // Stage 3: Tactical Planning
    if (result.epic && result.intent) {
      const planResult = await this.runPlanStage(result.epic, result.intent);
      result.stages.plan = planResult;

      if (planResult.success && planResult.output) {
        result.plans = planResult.output;

        // Save to store
        if (this.config.autoSave && result.plans) {
          for (const plan of result.plans) {
            const entry = await this.store.saveSpec(plan, 'tactical', {
              id: plan.id,
              title: plan.title,
              relatedSpecs: result.epic ? [result.epic.id] : []
            });
            storedSpecIds.push(entry.id);
          }
        }
      }
    }

    // Calculate overall success
    result.success = 
      result.stages.capture?.success === true &&
      result.stages.decompose?.success === true &&
      result.stages.plan?.success === true;

    result.totalDuration = Date.now() - startTime;
    return result;
  }

  /**
   * Run intent capture stage
   */
  private async runCaptureStage(input: IntentInput): Promise<PipelineStageResult<CapturedIntent>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Capture intent
      const intent = this.intentCapture.captureIntent(input);

      // Validate if enabled
      let validation: ValidationResult | undefined;
      if (this.config.validateAtEachStage) {
        validation = this.validator.validate(intent, 'intent');
        
        if (!validation.valid) {
          errors.push(...validation.errors.map(e => e.message));
        }
        warnings.push(...validation.warnings.map(w => w.message));
      }

      return {
        success: errors.length === 0,
        output: intent,
        validation,
        errors,
        warnings,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Run decomposition stage
   */
  private async runDecomposeStage(
    intent: CapturedIntent,
    prd?: import('./intentCapture').PRD
  ): Promise<PipelineStageResult<DecompositionResult>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Decompose into epic
      const result = this.decomposer.decomposeEpic(intent, prd);

      // Add decomposition warnings
      warnings.push(...result.warnings);

      // Validate if enabled
      let validation: ValidationResult | undefined;
      if (this.config.validateAtEachStage) {
        validation = this.validator.validate(result.epic, 'epic');
        
        if (!validation.valid) {
          errors.push(...validation.errors.map(e => e.message));
        }
        warnings.push(...validation.warnings.map(w => w.message));
      }

      return {
        success: errors.length === 0,
        output: result,
        validation,
        errors,
        warnings,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Run tactical planning stage
   */
  private async runPlanStage(
    epic: Epic,
    intent: CapturedIntent
  ): Promise<PipelineStageResult<TacticalPlan[]>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const plans: TacticalPlan[] = [];

      // Create tactical plans for tickets
      for (const phase of epic.phases) {
        for (const ticket of phase.tickets) {
          const plan = this.tacticalPlanner.createPlan(
            ticket,
            intent,
            this.config.planningContext
          );
          plans.push(plan);
        }
      }

      // Validate if enabled
      let validation: ValidationResult | undefined;
      if (this.config.validateAtEachStage && plans.length > 0) {
        validation = this.validator.validate(plans[0], 'tactical');
        
        if (!validation.valid) {
          errors.push(...validation.errors.map(e => e.message));
        }
        warnings.push(...validation.warnings.map(w => w.message));
      }

      return {
        success: errors.length === 0,
        output: plans,
        validation,
        errors,
        warnings,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get pipeline status
   */
  getStatus(): {
    components: {
      intentCapture: boolean;
      decomposer: boolean;
      tacticalPlanner: boolean;
      validator: boolean;
      store: boolean;
    };
    config: SDDPipelineConfig;
  } {
    return {
      components: {
        intentCapture: !!this.intentCapture,
        decomposer: !!this.decomposer,
        tacticalPlanner: !!this.tacticalPlanner,
        validator: !!this.validator,
        store: !!this.store
      },
      config: this.config
    };
  }
}

// ============================================================================
// DEFAULT PIPELINE INSTANCE
// ============================================================================

import { intentCapture } from './intentCapture';
import { decomposer } from './decomposer';
import { tacticalPlanner } from './tacticalPlanner';
import { specValidator } from './specValidator';
import { specStore } from './specStore';

/**
 * Default SDD Pipeline instance
 */
export const sddPipeline = new SDDPipeline(
  intentCapture,
  decomposer,
  tacticalPlanner,
  specValidator,
  specStore
);

// Default export
export default SDDPipeline;
