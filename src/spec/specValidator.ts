/**
 * OpenKode Spec-Driven Development Pipeline
 * =========================================
 * Phase 4: Spec Validation & Versioning
 * 
 * Validates specifications against schemas, manages version control,
 * provides diffing between versions, and enforces completeness rules.
 */

import { CapturedIntent, PRD, IntentInput } from './intentCapture';
import { Epic, Phase, Ticket, Task } from './decomposer';
import { TacticalPlan, FileChange, InterfaceDefinition } from './tacticalPlanner';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Validation errors */
  errors: ValidationError[];
  
  /** Validation warnings */
  warnings: ValidationWarning[];
  
  /** Validation info messages */
  info: ValidationInfo[];
  
  /** Overall score (0-100) */
  score: number;
  
  /** Timestamp */
  timestamp: string;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Path to the invalid field */
  path: string;
  
  /** Severity */
  severity: 'error';
  
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  
  /** Warning message */
  message: string;
  
  /** Path to the field */
  path: string;
  
  /** Severity */
  severity: 'warning';
  
  /** Suggested improvement */
  suggestion?: string;
}

/**
 * Validation info
 */
export interface ValidationInfo {
  /** Info code */
  code: string;
  
  /** Info message */
  message: string;
  
  /** Path to the field */
  path: string;
}

/**
 * Spec version
 */
export interface SpecVersion {
  /** Version identifier (semver) */
  version: string;
  
  /** Spec ID */
  specId: string;
  
  /** Spec type */
  specType: SpecType;
  
  /** When this version was created */
  createdAt: string;
  
  /** Who created this version */
  author?: string;
  
  /** Change description */
  changeDescription: string;
  
  /** Previous version */
  previousVersion?: string;
  
  /** Spec content (serialized) */
  content: string;
  
  /** Validation result for this version */
  validationResult?: ValidationResult;
  
  /** Tags */
  tags: string[];
}

/**
 * Spec types
 */
export type SpecType = 'intent' | 'prd' | 'epic' | 'phase' | 'ticket' | 'task' | 'tactical';

/**
 * Spec diff result
 */
export interface SpecDiff {
  /** From version */
  fromVersion: string;
  
  /** To version */
  toVersion: string;
  
  /** Spec ID */
  specId: string;
  
  /** Type of changes */
  changeType: 'major' | 'minor' | 'patch' | 'none';
  
  /** Added fields */
  added: DiffEntry[];
  
  /** Removed fields */
  removed: DiffEntry[];
  
  /** Modified fields */
  modified: DiffModification[];
  
  /** Unchanged fields */
  unchanged: string[];
  
  /** Breaking changes */
  breakingChanges: BreakingChange[];
  
  /** Timestamp */
  timestamp: string;
}

/**
 * Diff entry for added/removed fields
 */
export interface DiffEntry {
  /** Field path */
  path: string;
  
  /** Field value */
  value: unknown;
  
  /** Field type */
  type: string;
}

/**
 * Diff modification
 */
export interface DiffModification {
  /** Field path */
  path: string;
  
  /** Old value */
  oldValue: unknown;
  
  /** New value */
  newValue: unknown;
  
  /** Type of old value */
  oldType: string;
  
  /** Type of new value */
  newType: string;
}

/**
 * Breaking change
 */
export interface BreakingChange {
  /** Change description */
  description: string;
  
  /** Field path */
  path: string;
  
  /** Migration guide */
  migration?: string;
}

/**
 * Validation rule
 */
export interface ValidationRule<T> {
  /** Rule name */
  name: string;
  
  /** Rule description */
  description: string;
  
  /** Validate function */
  validate: (spec: T) => { valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] };
}

/**
 * JSON Schema for spec validation
 */
export interface SpecSchema {
  /** Schema ID */
  $id: string;
  
  /** Schema type */
  $schema: string;
  
  /** Schema title */
  title: string;
  
  /** Schema description */
  description?: string;
  
  /** Type definition */
  type: 'object';
  
  /** Required fields */
  required: string[];
  
  /** Property definitions */
  properties: Record<string, SchemaProperty>;
  
  /** Additional properties allowed */
  additionalProperties?: boolean;
}

/**
 * Schema property definition
 */
export interface SchemaProperty {
  /** Property type */
  type: string | string[];
  
  /** Property description */
  description?: string;
  
  /** Default value */
  default?: unknown;
  
  /** Enum values */
  enum?: unknown[];
  
  /** Pattern for strings */
  pattern?: string;
  
  /** Minimum for numbers */
  minimum?: number;
  
  /** Maximum for numbers */
  maximum?: number;
  
  /** Min length for strings/arrays */
  minLength?: number;
  
  /** Max length for strings/arrays */
  maxLength?: number;
  
  /** Nested object properties */
  properties?: Record<string, SchemaProperty>;
  
  /** Array items schema */
  items?: SchemaProperty;
  
  /** Required nested fields */
  required?: string[];
  
  /** Format for strings (email, uri, date-time, etc.) */
  format?: string;
  
  /** Minimum items for arrays */
  minItems?: number;
}

// ============================================================================
// JSON SCHEMAS FOR SPEC TYPES
// ============================================================================

/**
 * Intent input schema
 */
export const IntentInputSchema: SpecSchema = {
  $id: 'intent-input',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Intent Input',
  description: 'Schema for intent input validation',
  type: 'object',
  required: ['description'],
  properties: {
    description: {
      type: 'string',
      description: 'User description of intent',
      minLength: 10,
      maxLength: 5000
    },
    constraints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['time', 'technology', 'budget', 'performance', 'security', 'compliance', 'other'] },
          description: { type: 'string', minLength: 5 },
          value: { type: ['string', 'number', 'boolean'] },
          severity: { type: 'string', enum: ['hard', 'soft'] }
        },
        required: ['type', 'description', 'severity']
      }
    },
    acceptanceCriteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          description: { type: 'string', minLength: 5 },
          verificationMethod: { type: 'string', enum: ['manual', 'automated', 'review'] },
          required: { type: 'boolean' }
        },
        required: ['id', 'description', 'verificationMethod', 'required']
      }
    },
    priority: {
      type: 'string',
      enum: ['critical', 'high', 'medium', 'low', 'minimal']
    },
    tags: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

/**
 * PRD schema
 */
export const PRDSchema: SpecSchema = {
  $id: 'prd',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Product Requirements Document',
  description: 'Schema for PRD validation',
  type: 'object',
  required: ['id', 'title', 'version', 'createdAt', 'updatedAt', 'status', 'overview', 'goals', 'requirements', 'constraints', 'acceptanceCriteria'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string', minLength: 5 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: ['draft', 'review', 'approved', 'deprecated'] },
    overview: { type: 'string', minLength: 20 },
    goals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          description: { type: 'string', minLength: 5 }
        },
        required: ['id', 'description']
      },
      minItems: 1
    },
    requirements: {
      type: 'array',
      minItems: 1
    },
    constraints: { type: 'array' },
    acceptanceCriteria: {
      type: 'array',
      minItems: 1
    },
    outOfScope: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } }
  }
};

/**
 * Epic schema
 */
export const EpicSchema: SpecSchema = {
  $id: 'epic',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Epic',
  description: 'Schema for epic validation',
  type: 'object',
  required: ['id', 'title', 'description', 'sourceIntentId', 'phases', 'requirements', 'priority', 'complexity', 'status', 'createdAt'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string', minLength: 5 },
    description: { type: 'string', minLength: 10 },
    sourceIntentId: { type: 'string' },
    sourcePRDId: { type: 'string' },
    phases: { type: 'array' },
    requirements: { type: 'array', minItems: 1 },
    priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'minimal'] },
    complexity: { type: 'string', enum: ['xs', 's', 'm', 'l', 'xl', 'xxl'] },
    status: { type: 'string', enum: ['backlog', 'ready', 'in_progress', 'review', 'blocked', 'completed', 'cancelled'] },
    createdAt: { type: 'string', format: 'date-time' },
    targetDate: { type: 'string', format: 'date-time' },
    owner: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } }
  }
};

/**
 * Tactical plan schema
 */
export const TacticalPlanSchema: SpecSchema = {
  $id: 'tactical-plan',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Tactical Plan',
  description: 'Schema for tactical plan validation',
  type: 'object',
  required: ['id', 'title', 'sourceTicketId', 'sourceIntentId', 'version', 'createdAt', 'filesToTouch', 'interfaces', 'steps', 'dependencies', 'testSpecs', 'acceptanceCriteria', 'rollbackPlan', 'verificationCommands', 'estimatedHours', 'risks'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string', minLength: 5 },
    sourceTicketId: { type: 'string' },
    sourceIntentId: { type: 'string' },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    createdAt: { type: 'string', format: 'date-time' },
    filesToTouch: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['create', 'modify', 'delete', 'rename'] },
          description: { type: 'string', minLength: 5 },
          fileType: { type: 'string' },
          complexity: { type: 'number', minimum: 1, maximum: 5 }
        },
        required: ['path', 'action', 'description', 'fileType', 'complexity']
      }
    },
    interfaces: { type: 'array' },
    steps: {
      type: 'array',
      minItems: 1
    },
    dependencies: { type: 'array' },
    testSpecs: { type: 'array' },
    acceptanceCriteria: {
      type: 'array',
      minItems: 1
    },
    rollbackPlan: { type: 'array' },
    verificationCommands: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1
    },
    estimatedHours: { type: 'number', minimum: 0.5 },
    risks: { type: 'array' }
  }
};

// ============================================================================
// VALIDATOR CLASS
// ============================================================================

export class SpecValidator {
  private schemas: Map<string, SpecSchema> = new Map();
  private versions: Map<string, SpecVersion[]> = new Map();
  private rules: Map<string, Array<{ name: string; description: string; validate: (spec: unknown) => { valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] } }>> = new Map();

  constructor() {
    // Register default schemas
    this.registerSchema(IntentInputSchema);
    this.registerSchema(PRDSchema);
    this.registerSchema(EpicSchema);
    this.registerSchema(TacticalPlanSchema);

    // Register default validation rules
    this.registerDefaultRules();
  }

  /**
   * Register a schema
   */
  registerSchema(schema: SpecSchema): void {
    this.schemas.set(schema.$id, schema);
  }

  /**
   * Register default validation rules
   */
  private registerDefaultRules(): void {
    // Intent validation rules
    this.rules.set('intent', [
      {
        name: 'description-length',
        description: 'Description must be at least 10 characters',
        validate: (spec: unknown) => {
          const intent = spec as CapturedIntent;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          if (intent.originalInput.description.length < 10) {
            errors.push({
              code: 'INTENT-001',
              message: 'Description is too short (minimum 10 characters)',
              path: 'originalInput.description',
              severity: 'error',
              suggestion: 'Provide more detailed description'
            });
          } else if (intent.originalInput.description.length < 50) {
            warnings.push({
              code: 'INTENT-W001',
              message: 'Description is brief - consider adding more detail',
              path: 'originalInput.description',
              severity: 'warning'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      },
      {
        name: 'requirements-exist',
        description: 'Intent must have at least one requirement',
        validate: (spec: unknown) => {
          const intent = spec as CapturedIntent;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          if (intent.requirements.length === 0) {
            errors.push({
              code: 'INTENT-002',
              message: 'No requirements extracted from intent',
              path: 'requirements',
              severity: 'error',
              suggestion: 'Add explicit requirements or refine description'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      },
      {
        name: 'confidence-check',
        description: 'Confidence should be reasonable',
        validate: (spec: unknown) => {
          const intent = spec as CapturedIntent;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          if (intent.confidence < 0.3) {
            warnings.push({
              code: 'INTENT-W002',
              message: `Low confidence (${(intent.confidence * 100).toFixed(0)}%) - consider clarification`,
              path: 'confidence',
              severity: 'warning',
              suggestion: 'Review open questions and provide more context'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      }
    ]);

    // PRD validation rules
    this.rules.set('prd', [
      {
        name: 'goals-exist',
        description: 'PRD must have at least one goal',
        validate: (spec: unknown) => {
          const prd = spec as PRD;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          if (prd.goals.length === 0) {
            errors.push({
              code: 'PRD-001',
              message: 'PRD must have at least one goal',
              path: 'goals',
              severity: 'error',
              suggestion: 'Add clear goals for what this PRD achieves'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      },
      {
        name: 'acceptance-criteria',
        description: 'PRD should have verifiable acceptance criteria',
        validate: (spec: unknown) => {
          const prd = spec as PRD;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          const automatedCount = prd.acceptanceCriteria.filter(ac => ac.verificationMethod === 'automated').length;
          if (automatedCount === 0 && prd.acceptanceCriteria.length > 0) {
            warnings.push({
              code: 'PRD-W001',
              message: 'No automated acceptance criteria - consider adding tests',
              path: 'acceptanceCriteria',
              severity: 'warning'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      }
    ]);

    // Epic validation rules
    this.rules.set('epic', [
      {
        name: 'phases-exist',
        description: 'Epic must have at least one phase',
        validate: (spec: unknown) => {
          const epic = spec as Epic;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          if (epic.phases.length === 0) {
            errors.push({
              code: 'EPIC-001',
              message: 'Epic must have at least one phase',
              path: 'phases',
              severity: 'error',
              suggestion: 'Decompose epic into implementation phases'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      },
      {
        name: 'complexity-reasonable',
        description: 'Epic complexity should match scope',
        validate: (spec: unknown) => {
          const epic = spec as Epic;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          if (epic.complexity === 'xxl' && epic.phases.length < 5) {
            warnings.push({
              code: 'EPIC-W001',
              message: 'XXL complexity but few phases - may be underestimated',
              path: 'complexity',
              severity: 'warning'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      }
    ]);

    // Tactical plan validation rules
    this.rules.set('tactical', [
      {
        name: 'files-specified',
        description: 'Tactical plan must specify files to touch',
        validate: (spec: unknown) => {
          const plan = spec as TacticalPlan;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          if (plan.filesToTouch.length === 0) {
            errors.push({
              code: 'TACTICAL-001',
              message: 'No files specified for modification',
              path: 'filesToTouch',
              severity: 'error',
              suggestion: 'Specify all files that will be created or modified'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      },
      {
        name: 'steps-ordered',
        description: 'Implementation steps should be properly ordered',
        validate: (spec: unknown) => {
          const plan = spec as TacticalPlan;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          const stepNumbers = plan.steps.map(s => s.stepNumber);
          const hasDuplicates = stepNumbers.length !== new Set(stepNumbers).size;
          
          if (hasDuplicates) {
            errors.push({
              code: 'TACTICAL-002',
              message: 'Duplicate step numbers found',
              path: 'steps',
              severity: 'error'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      },
      {
        name: 'rollback-plan',
        description: 'Should have rollback plan for risky changes',
        validate: (spec: unknown) => {
          const plan = spec as TacticalPlan;
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];
          
          const hasRiskyChanges = plan.filesToTouch.some(f => f.action === 'delete' || f.action === 'rename');
          
          if (hasRiskyChanges && plan.rollbackPlan.length === 0) {
            warnings.push({
              code: 'TACTICAL-W001',
              message: 'Risky file operations without rollback plan',
              path: 'rollbackPlan',
              severity: 'warning',
              suggestion: 'Add rollback steps for delete/rename operations'
            });
          }
          
          return { valid: errors.length === 0, errors, warnings };
        }
      }
    ]);
  }

  /**
   * Validate a spec against its schema and rules
   */
  validate<T>(spec: T, specType: SpecType, schemaId?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    // Schema validation
    const schema = schemaId ? this.schemas.get(schemaId) : this.getSchemaForType(specType);
    if (schema) {
      const schemaResult = this.validateAgainstSchema(spec, schema);
      errors.push(...schemaResult.errors);
      warnings.push(...schemaResult.warnings);
    }

    // Rule validation
    const rules = this.rules.get(specType) || [];
    for (const rule of rules) {
      const result = rule.validate(spec);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    // Calculate score
    const score = this.calculateScore(errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      score,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get schema for spec type
   */
  private getSchemaForType(specType: SpecType): SpecSchema | undefined {
    const mapping: Record<SpecType, string> = {
      intent: 'intent-input',
      prd: 'prd',
      epic: 'epic',
      phase: 'epic',
      ticket: 'epic',
      task: 'epic',
      tactical: 'tactical-plan'
    };
    return this.schemas.get(mapping[specType]);
  }

  /**
   * Validate against JSON schema (simplified implementation)
   */
  private validateAgainstSchema<T>(spec: T, schema: SpecSchema): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in (spec as Record<string, unknown>))) {
          errors.push({
            code: 'SCHEMA-001',
            message: `Required field '${field}' is missing`,
            path: field,
            severity: 'error'
          });
        }
      }
    }

    // Check property types
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const value = (spec as Record<string, unknown>)[key];
        
        if (value !== undefined) {
          // Type check
          if (propSchema.type) {
            const types = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            
            if (!types.includes(actualType)) {
              errors.push({
                code: 'SCHEMA-002',
                message: `Field '${key}' has invalid type. Expected: ${types.join(' | ')}, got: ${actualType}`,
                path: key,
                severity: 'error'
              });
            }
          }

          // Min length check
          if (propSchema.minLength !== undefined) {
            if (typeof value === 'string' && value.length < propSchema.minLength) {
              errors.push({
                code: 'SCHEMA-003',
                message: `Field '${key}' is too short. Minimum: ${propSchema.minLength}, got: ${value.length}`,
                path: key,
                severity: 'error'
              });
            }
            if (Array.isArray(value) && value.length < propSchema.minLength) {
              errors.push({
                code: 'SCHEMA-004',
                message: `Array '${key}' has too few items. Minimum: ${propSchema.minLength}, got: ${value.length}`,
                path: key,
                severity: 'error'
              });
            }
          }

          // Pattern check
          if (propSchema.pattern && typeof value === 'string') {
            const regex = new RegExp(propSchema.pattern);
            if (!regex.test(value)) {
              errors.push({
                code: 'SCHEMA-005',
                message: `Field '${key}' does not match required pattern`,
                path: key,
                severity: 'error'
              });
            }
          }

          // Enum check
          if (propSchema.enum && !propSchema.enum.includes(value)) {
            errors.push({
              code: 'SCHEMA-006',
              message: `Field '${key}' has invalid value. Must be one of: ${propSchema.enum.join(', ')}`,
              path: key,
              severity: 'error'
            });
          }
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Calculate validation score
   */
  private calculateScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    const errorWeight = 20;
    const warningWeight = 5;
    
    const deduction = (errors.length * errorWeight) + (warnings.length * warningWeight);
    return Math.max(0, 100 - deduction);
  }

  /**
   * Create a new version of a spec
   */
  createVersion<T>(
    specId: string,
    specType: SpecType,
    content: T,
    changeDescription: string,
    author?: string,
    tags: string[] = []
  ): SpecVersion {
    const existingVersions = this.versions.get(specId) || [];
    const previousVersion = existingVersions[existingVersions.length - 1];
    
    // Generate version number
    let version = '1.0.0';
    if (previousVersion) {
      version = this.incrementVersion(previousVersion.version, changeDescription);
    }

    const specVersion: SpecVersion = {
      version,
      specId,
      specType,
      createdAt: new Date().toISOString(),
      author,
      changeDescription,
      previousVersion: previousVersion?.version,
      content: JSON.stringify(content),
      tags
    };

    // Validate and store result
    specVersion.validationResult = this.validate(content, specType);

    // Store version
    existingVersions.push(specVersion);
    this.versions.set(specId, existingVersions);

    return specVersion;
  }

  /**
   * Increment version number based on change type
   */
  private incrementVersion(currentVersion: string, changeDescription: string): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    // Determine change type from description
    const desc = changeDescription.toLowerCase();
    const isBreaking = desc.includes('breaking') || desc.includes('remove') || desc.includes('delete');
    const isFeature = desc.includes('add') || desc.includes('new') || desc.includes('feature');
    
    if (isBreaking) {
      return `${major + 1}.0.0`;
    } else if (isFeature) {
      return `${major}.${minor + 1}.0`;
    } else {
      return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * Get diff between two versions
   */
  diff(specId: string, fromVersion: string, toVersion: string): SpecDiff | undefined {
    const versions = this.versions.get(specId);
    if (!versions) return undefined;

    const from = versions.find(v => v.version === fromVersion);
    const to = versions.find(v => v.version === toVersion);
    
    if (!from || !to) return undefined;

    const fromObj = JSON.parse(from.content);
    const toObj = JSON.parse(to.content);

    return this.computeDiff(fromVersion, toVersion, specId, fromObj, toObj);
  }

  /**
   * Compute diff between two objects
   */
  private computeDiff(
    fromVersion: string,
    toVersion: string,
    specId: string,
    fromObj: unknown,
    toObj: unknown
  ): SpecDiff {
    const added: DiffEntry[] = [];
    const removed: DiffEntry[] = [];
    const modified: DiffModification[] = [];
    const unchanged: string[] = [];
    const breakingChanges: BreakingChange[] = [];

    this.compareObjects('', fromObj, toObj, added, removed, modified, unchanged, breakingChanges);

    // Determine change type
    let changeType: SpecDiff['changeType'] = 'none';
    if (breakingChanges.length > 0) {
      changeType = 'major';
    } else if (added.length > 0 || removed.length > 0) {
      changeType = 'minor';
    } else if (modified.length > 0) {
      changeType = 'patch';
    }

    return {
      fromVersion,
      toVersion,
      specId,
      changeType,
      added,
      removed,
      modified,
      unchanged,
      breakingChanges,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Recursively compare objects
   */
  private compareObjects(
    path: string,
    from: unknown,
    to: unknown,
    added: DiffEntry[],
    removed: DiffEntry[],
    modified: DiffModification[],
    unchanged: string[],
    breakingChanges: BreakingChange[]
  ): void {
    // Handle null/undefined
    if (from === null && to === null) {
      unchanged.push(path);
      return;
    }
    if (from === null || from === undefined) {
      added.push({ path, value: to, type: typeof to });
      return;
    }
    if (to === null || to === undefined) {
      removed.push({ path, value: from, type: typeof from });
      // Removal is potentially breaking
      if (path.includes('required') || path.includes('public')) {
        breakingChanges.push({
          description: `Removed: ${path}`,
          path,
          migration: `Remove usage of ${path}`
        });
      }
      return;
    }

    // Handle different types
    if (typeof from !== typeof to) {
      modified.push({
        path,
        oldValue: from,
        newValue: to,
        oldType: typeof from,
        newType: typeof to
      });
      return;
    }

    // Handle primitives
    if (typeof from !== 'object') {
      if (from === to) {
        unchanged.push(path);
      } else {
        modified.push({
          path,
          oldValue: from,
          newValue: to,
          oldType: typeof from,
          newType: typeof to
        });
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(from) && Array.isArray(to)) {
      const maxLength = Math.max(from.length, to.length);
      for (let i = 0; i < maxLength; i++) {
        const itemPath = path ? `${path}[${i}]` : `[${i}]`;
        if (i < from.length && i < to.length) {
          this.compareObjects(itemPath, from[i], to[i], added, removed, modified, unchanged, breakingChanges);
        } else if (i < from.length) {
          removed.push({ path: itemPath, value: from[i], type: 'array-item' });
        } else {
          added.push({ path: itemPath, value: to[i], type: 'array-item' });
        }
      }
      return;
    }

    // Handle objects
    const fromKeys = Object.keys(from as Record<string, unknown>);
    const toKeys = Object.keys(to as Record<string, unknown>);
    const allKeys = new Set([...fromKeys, ...toKeys]);

    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      this.compareObjects(
        keyPath,
        (from as Record<string, unknown>)[key],
        (to as Record<string, unknown>)[key],
        added,
        removed,
        modified,
        unchanged,
        breakingChanges
      );
    }
  }

  /**
   * Get all versions for a spec
   */
  getVersions(specId: string): SpecVersion[] {
    return this.versions.get(specId) || [];
  }

  /**
   * Get specific version
   */
  getVersion(specId: string, version: string): SpecVersion | undefined {
    const versions = this.versions.get(specId);
    return versions?.find(v => v.version === version);
  }

  /**
   * List all specs with versions
   */
  listSpecs(): { specId: string; specType: SpecType; versions: string[] }[] {
    return Array.from(this.versions.entries()).map(([specId, versions]) => ({
      specId,
      specType: versions[0]?.specType || 'intent',
      versions: versions.map(v => v.version)
    }));
  }

  /**
   * Register a custom validation rule
   */
  registerRule<T>(specType: SpecType, rule: ValidationRule<T>): void {
    const existing = this.rules.get(specType) || [];
    existing.push(rule as ValidationRule<unknown>);
    this.rules.set(specType, existing);
  }

  /**
   * Check if spec meets completeness criteria
   */
  checkCompleteness<T>(spec: T, specType: SpecType): { complete: boolean; missing: string[] } {
    const missing: string[] = [];
    
    const completenessRules: Record<SpecType, string[]> = {
      intent: ['id', 'originalInput', 'requirements', 'confidence'],
      prd: ['id', 'title', 'version', 'goals', 'requirements', 'acceptanceCriteria'],
      epic: ['id', 'title', 'phases', 'requirements', 'complexity'],
      phase: ['id', 'name', 'tickets', 'type', 'order'],
      ticket: ['id', 'title', 'tasks', 'type', 'acceptanceCriteria'],
      task: ['id', 'description', 'type', 'estimatedHours'],
      tactical: ['id', 'filesToTouch', 'steps', 'acceptanceCriteria', 'estimatedHours']
    };

    const required = completenessRules[specType] || [];
    
    for (const field of required) {
      const value = (spec as Record<string, unknown>)[field];
      if (value === undefined || value === null || 
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'string' && value.trim() === '')) {
        missing.push(field);
      }
    }

    return { complete: missing.length === 0, missing };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const specValidator = new SpecValidator();

// Default export
export default SpecValidator;
