/**
 * OpenKode Spec-Driven Development Pipeline
 * =========================================
 * Phase 3: Tactical Planning
 * 
 * Creates detailed implementation specifications:
 * - File-level change specifications
 * - Interface definitions
 * - Implementation step sequencing
 * - Tactical specifications for execution
 */

import { Ticket, Task, Phase } from './decomposer';
import { CapturedIntent, Requirement } from './intentCapture';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Tactical Plan - Detailed implementation specification
 */
export interface TacticalPlan {
  /** Unique identifier */
  id: string;
  
  /** Plan title */
  title: string;
  
  /** Source ticket reference */
  sourceTicketId: string;
  
  /** Source intent reference */
  sourceIntentId: string;
  
  /** Plan version */
  version: string;
  
  /** Creation timestamp */
  createdAt: string;
  
  /** Files that need to be created/modified/deleted */
  filesToTouch: FileChange[];
  
  /** Interface definitions */
  interfaces: InterfaceDefinition[];
  
  /** Implementation steps */
  steps: ImplementationStep[];
  
  /** Dependencies to install */
  dependencies: DependencySpec[];
  
  /** Test specifications */
  testSpecs: TestSpec[];
  
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  
  /** Rollback plan */
  rollbackPlan: RollbackStep[];
  
  /** Verification commands */
  verificationCommands: string[];
  
  /** Estimated effort in hours */
  estimatedHours: number;
  
  /** Risk assessment */
  risks: Risk[];
}

/**
 * File change specification
 */
export interface FileChange {
  /** File path */
  path: string;
  
  /** Change type */
  action: 'create' | 'modify' | 'delete' | 'rename';
  
  /** Description of changes */
  description: string;
  
  /** File type */
  fileType: FileType;
  
  /** For renames: original path */
  originalPath?: string;
  
  /** Template or skeleton code */
  template?: string;
  
  /** Lines to add (for modifications) */
  linesToAdd?: CodeInsertion[];
  
  /** Lines to remove (for modifications) */
  linesToRemove?: CodeRemoval[];
  
  /** Imports to add */
  importsToAdd?: string[];
  
  /** Estimated complexity (1-5) */
  complexity: number;
}

/**
 * Code insertion specification
 */
export interface CodeInsertion {
  /** Where to insert (line number or anchor) */
  at: number | string;
  
  /** Code to insert */
  code: string;
  
  /** Insertion mode */
  mode: 'before' | 'after' | 'replace';
}

/**
 * Code removal specification
 */
export interface CodeRemoval {
  /** Start line */
  from: number;
  
  /** End line */
  to: number;
  
  /** Optional: what to replace with */
  replaceWith?: string;
}

/**
 * File types
 */
export type FileType = 
  | 'typescript' 
  | 'javascript' 
  | 'json' 
  | 'yaml' 
  | 'markdown' 
  | 'css' 
  | 'html' 
  | 'test' 
  | 'config' 
  | 'other';

/**
 * Interface definition
 */
export interface InterfaceDefinition {
  /** Interface name */
  name: string;
  
  /** Interface type */
  type: 'class' | 'interface' | 'type' | 'enum' | 'function';
  
  /** File path where defined */
  filePath: string;
  
  /** Properties/fields */
  properties: PropertyDefinition[];
  
  /** Methods */
  methods: MethodDefinition[];
  
  /** Generic type parameters */
  generics?: string[];
  
  /** Extends/implements */
  extends?: string[];
  
  /** JSDoc/documentation */
  documentation?: string;
  
  /** Export status */
  isExported: boolean;
}

/**
 * Property definition
 */
export interface PropertyDefinition {
  /** Property name */
  name: string;
  
  /** Type */
  type: string;
  
  /** Optional flag */
  optional: boolean;
  
  /** Default value */
  defaultValue?: string;
  
  /** Readonly flag */
  readonly?: boolean;
  
  /** Access modifier */
  access?: 'public' | 'private' | 'protected';
  
  /** Documentation */
  documentation?: string;
}

/**
 * Method definition
 */
export interface MethodDefinition {
  /** Method name */
  name: string;
  
  /** Parameters */
  parameters: ParameterDefinition[];
  
  /** Return type */
  returnType: string;
  
  /** Async flag */
  isAsync: boolean;
  
  /** Access modifier */
  access?: 'public' | 'private' | 'protected';
  
  /** Static flag */
  isStatic?: boolean;
  
  /** Abstract flag */
  isAbstract?: boolean;
  
  /** Documentation */
  documentation?: string;
}

/**
 * Parameter definition
 */
export interface ParameterDefinition {
  /** Parameter name */
  name: string;
  
  /** Type */
  type: string;
  
  /** Optional flag */
  optional: boolean;
  
  /** Default value */
  defaultValue?: string;
  
  /** Rest parameter flag */
  isRest?: boolean;
}

/**
 * Implementation step
 */
export interface ImplementationStep {
  /** Step number */
  stepNumber: number;
  
  /** Step title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Step type */
  type: StepType;
  
  /** Related files */
  relatedFiles: string[];
  
  /** Commands to execute */
  commands?: string[];
  
  /** Code to write */
  codeToWrite?: CodeBlock[];
  
  /** Verification after step */
  verification: string;
  
  /** Estimated duration in minutes */
  estimatedMinutes: number;
  
  /** Whether this step is blocking */
  isBlocking: boolean;
  
  /** Rollback for this step */
  rollback?: string;
}

/**
 * Step types
 */
export type StepType = 
  | 'setup' 
  | 'create_file' 
  | 'modify_file' 
  | 'delete_file' 
  | 'install_dependency' 
  | 'write_code' 
  | 'refactor' 
  | 'test' 
  | 'verify' 
  | 'document';

/**
 * Code block for implementation
 */
export interface CodeBlock {
  /** Target file */
  filePath: string;
  
  /** Code content */
  content: string;
  
  /** Where to insert */
  insertAt?: 'start' | 'end' | number | string;
  
  /** Whether to replace existing */
  replace?: boolean;
}

/**
 * Dependency specification
 */
export interface DependencySpec {
  /** Package name */
  name: string;
  
  /** Version constraint */
  version: string;
  
  /** Dev dependency flag */
  isDev: boolean;
  
  /** Why this is needed */
  reason: string;
  
  /** Alternative packages considered */
  alternatives?: string[];
}

/**
 * Test specification
 */
export interface TestSpec {
  /** Test file path */
  filePath: string;
  
  /** Test type */
  type: 'unit' | 'integration' | 'e2e' | 'contract';
  
  /** Test cases */
  testCases: TestCase[];
  
  /** Setup requirements */
  setup?: string;
  
  /** Mocks needed */
  mocks?: MockSpec[];
}

/**
 * Test case
 */
export interface TestCase {
  /** Test name */
  name: string;
  
  /** What is being tested */
  description: string;
  
  /** Input data */
  input: string;
  
  /** Expected output/behavior */
  expected: string;
  
  /** Test type */
  type: 'positive' | 'negative' | 'edge' | 'boundary';
}

/**
 * Mock specification
 */
export interface MockSpec {
  /** What to mock */
  target: string;
  
  /** Mock implementation */
  implementation: string;
}

/**
 * Rollback step
 */
export interface RollbackStep {
  /** Step number */
  stepNumber: number;
  
  /** What to rollback */
  description: string;
  
  /** How to rollback */
  action: string;
  
  /** Command to execute */
  command?: string;
}

/**
 * Risk assessment
 */
export interface Risk {
  /** Risk description */
  description: string;
  
  /** Impact level */
  impact: 'low' | 'medium' | 'high' | 'critical';
  
  /** Probability */
  probability: 'low' | 'medium' | 'high';
  
  /** Mitigation strategy */
  mitigation: string;
  
  /** Contingency plan */
  contingency?: string;
}

/**
 * Planning context
 */
export interface PlanningContext {
  /** Existing codebase information */
  codebase: CodebaseInfo;
  
  /** Available tools/libraries */
  availableTools: string[];
  
  /** Team conventions */
  conventions: TeamConventions;
  
  /** Previous similar implementations */
  precedents?: string[];
}

/**
 * Codebase information
 */
export interface CodebaseInfo {
  /** Root directory */
  rootPath: string;
  
  /** Programming language */
  language: string;
  
  /** Framework */
  framework?: string;
  
  /** Existing patterns */
  patterns: string[];
  
  /** Key directories */
  directories: string[];
  
  /** Existing interfaces */
  existingInterfaces?: string[];
}

/**
 * Team conventions
 */
export interface TeamConventions {
  /** Naming conventions */
  naming: {
    files: string;
    classes: string;
    functions: string;
    variables: string;
    constants: string;
  };
  
  /** Code style */
  codeStyle: {
    indentation: string;
    quotes: 'single' | 'double';
    semicolons: boolean;
    maxLineLength: number;
  };
  
  /** Testing conventions */
  testing: {
    framework: string;
    location: string;
    naming: string;
  };
  
  /** Documentation requirements */
  documentation: {
    required: boolean;
    style: string;
  };
}

// ============================================================================
// TACTICAL SPECIFICATION TEMPLATES
// ============================================================================

/**
 * Templates for common implementation patterns
 */
export const TacticalTemplates = {
  /**
   * TypeScript class template
   */
  typescriptClass: (name: string, properties: PropertyDefinition[]): string => {
    const props = properties.map(p => 
      `  ${p.access || 'public'} ${p.readonly ? 'readonly ' : ''}${p.name}${p.optional ? '?' : ''}: ${p.type};`
    ).join('\n');
    
    return `export class ${name} {
${props}

  constructor() {
    // Initialize
  }
}`;
  },

  /**
   * TypeScript interface template
   */
  typescriptInterface: (name: string, properties: PropertyDefinition[]): string => {
    const props = properties.map(p => 
      `  ${p.name}${p.optional ? '?' : ''}: ${p.type};`
    ).join('\n');
    
    return `export interface ${name} {
${props}
}`;
  },

  /**
   * Function template
   */
  function: (name: string, params: ParameterDefinition[], returnType: string, isAsync: boolean): string => {
    const paramList = params.map(p => 
      `${p.name}${p.optional ? '?' : ''}: ${p.type}`
    ).join(', ');
    
    return `export ${isAsync ? 'async ' : ''}function ${name}(${paramList}): ${returnType} {
  // TODO: Implement
  throw new Error('Not implemented');
}`;
  },

  /**
   * Test file template
   */
  testFile: (moduleName: string): string => {
    return `import * as ${moduleName} from './${moduleName}';

describe('${moduleName}', () => {
  it('should be defined', () => {
    expect(${moduleName}).toBeDefined();
  });
});`;
  }
};

// ============================================================================
// TACTICAL PLANNER CLASS
// ============================================================================

export class TacticalPlanner {
  private plans: Map<string, TacticalPlan> = new Map();
  private idCounter = 0;

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    this.idCounter++;
    return `tactical-${Date.now()}-${this.idCounter}`;
  }

  /**
   * Create a tactical plan from a ticket
   */
  createPlan(
    ticket: Ticket,
    intent: CapturedIntent,
    context: PlanningContext
  ): TacticalPlan {
    const id = this.generateId();

    // Analyze what needs to be implemented
    const analysis = this.analyzeTicket(ticket, intent, context);

    // Generate file changes
    const filesToTouch = this.generateFileChanges(analysis, context);

    // Generate interface definitions
    const interfaces = this.generateInterfaces(analysis, context);

    // Create implementation steps
    const steps = this.createImplementationSteps(filesToTouch, interfaces, context);

    // Generate test specifications
    const testSpecs = this.generateTestSpecs(ticket, analysis, context);

    // Identify dependencies
    const dependencies = this.identifyDependencies(analysis, context);

    // Assess risks
    const risks = this.assessRisks(analysis, context);

    // Create rollback plan
    const rollbackPlan = this.createRollbackPlan(filesToTouch);

    // Calculate estimated hours
    const estimatedHours = this.calculateEstimate(filesToTouch, steps);

    const plan: TacticalPlan = {
      id,
      title: `Tactical Plan: ${ticket.title}`,
      sourceTicketId: ticket.id,
      sourceIntentId: intent.id,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      filesToTouch,
      interfaces,
      steps,
      dependencies,
      testSpecs,
      acceptanceCriteria: ticket.acceptanceCriteria,
      rollbackPlan,
      verificationCommands: this.generateVerificationCommands(testSpecs),
      estimatedHours,
      risks
    };

    this.plans.set(id, plan);
    return plan;
  }

  /**
   * Analyze a ticket to understand implementation needs
   */
  private analyzeTicket(
    ticket: Ticket,
    intent: CapturedIntent,
    context: PlanningContext
  ): TicketAnalysis {
    // Extract key information from ticket and intent
    const requirements = intent.requirements.filter(r => 
      ticket.description.toLowerCase().includes(r.description.toLowerCase())
    );

    // Identify patterns from context
    const applicablePatterns = context.codebase.patterns.filter(p =>
      ticket.title.toLowerCase().includes(p.toLowerCase())
    );

    // Determine implementation approach
    const approach = this.determineApproach(ticket, context);

    return {
      ticket,
      requirements,
      applicablePatterns,
      approach,
      affectedModules: this.identifyAffectedModules(ticket, context),
      integrationPoints: this.identifyIntegrationPoints(ticket, context)
    };
  }

  /**
   * Determine implementation approach
   */
  private determineApproach(ticket: Ticket, context: PlanningContext): string {
    if (ticket.type === 'feature') {
      return context.codebase.patterns.includes('mvc') ? 'mvc' : 'functional';
    }
    if (ticket.type === 'refactor') {
      return 'incremental';
    }
    if (ticket.type === 'bug') {
      return 'fix-and-test';
    }
    return 'standard';
  }

  /**
   * Identify affected modules
   */
  private identifyAffectedModules(ticket: Ticket, context: PlanningContext): string[] {
    const modules: string[] = [];
    
    // Extract module names from ticket description
    const words = ticket.description.split(/\s+/);
    for (const word of words) {
      if (context.codebase.directories.some(d => word.toLowerCase().includes(d.toLowerCase()))) {
        modules.push(word);
      }
    }

    return modules;
  }

  /**
   * Identify integration points
   */
  private identifyIntegrationPoints(ticket: Ticket, context: PlanningContext): string[] {
    const points: string[] = [];
    
    // Look for API, database, external service mentions
    const desc = ticket.description.toLowerCase();
    if (desc.includes('api')) points.push('api');
    if (desc.includes('database') || desc.includes('db')) points.push('database');
    if (desc.includes('external') || desc.includes('service')) points.push('external-service');
    
    return points;
  }

  /**
   * Generate file change specifications
   */
  private generateFileChanges(
    analysis: TicketAnalysis,
    context: PlanningContext
  ): FileChange[] {
    const changes: FileChange[] = [];

    // Based on ticket type, determine file changes
    switch (analysis.ticket.type) {
      case 'feature':
        changes.push(...this.generateFeatureFileChanges(analysis, context));
        break;
      case 'bug':
        changes.push(...this.generateBugFixFileChanges(analysis, context));
        break;
      case 'refactor':
        changes.push(...this.generateRefactorFileChanges(analysis, context));
        break;
      case 'test':
        changes.push(...this.generateTestFileChanges(analysis, context));
        break;
      default:
        changes.push(...this.generateDefaultFileChanges(analysis, context));
    }

    return changes;
  }

  /**
   * Generate file changes for a feature
   */
  private generateFeatureFileChanges(
    analysis: TicketAnalysis,
    context: PlanningContext
  ): FileChange[] {
    const changes: FileChange[] = [];
    const baseName = this.toFileName(analysis.ticket.title);

    // Main implementation file
    changes.push({
      path: `${context.codebase.directories[0] || 'src'}/${baseName}.ts`,
      action: 'create',
      description: `Main implementation for ${analysis.ticket.title}`,
      fileType: 'typescript',
      template: TacticalTemplates.typescriptClass(
        this.toClassName(analysis.ticket.title),
        []
      ),
      complexity: 3
    });

    // Test file
    changes.push({
      path: `${context.conventions.testing.location}/${baseName}.test.ts`,
      action: 'create',
      description: `Unit tests for ${analysis.ticket.title}`,
      fileType: 'test',
      template: TacticalTemplates.testFile(baseName),
      complexity: 2
    });

    // Types file if needed
    if (analysis.approach === 'mvc') {
      changes.push({
        path: `${context.codebase.directories[0] || 'src'}/types/${baseName}.types.ts`,
        action: 'create',
        description: `Type definitions for ${analysis.ticket.title}`,
        fileType: 'typescript',
        template: TacticalTemplates.typescriptInterface(
          `${this.toClassName(analysis.ticket.title)}Props`,
          []
        ),
        complexity: 2
      });
    }

    return changes;
  }

  /**
   * Generate file changes for a bug fix
   */
  private generateBugFixFileChanges(
    analysis: TicketAnalysis,
    context: PlanningContext
  ): FileChange[] {
    const changes: FileChange[] = [];

    // Identify the file to modify
    const affectedFile = analysis.affectedModules[0] || 'src/index.ts';

    changes.push({
      path: affectedFile,
      action: 'modify',
      description: `Fix bug in ${analysis.ticket.title}`,
      fileType: 'typescript',
      complexity: 2
    });

    // Add regression test
    const baseName = this.toFileName(analysis.ticket.title);
    changes.push({
      path: `${context.conventions.testing.location}/${baseName}.regression.test.ts`,
      action: 'create',
      description: `Regression test for ${analysis.ticket.title}`,
      fileType: 'test',
      complexity: 2
    });

    return changes;
  }

  /**
   * Generate file changes for refactoring
   */
  private generateRefactorFileChanges(
    analysis: TicketAnalysis,
    context: PlanningContext
  ): FileChange[] {
    const changes: FileChange[] = [];

    for (const module of analysis.affectedModules) {
      changes.push({
        path: module,
        action: 'modify',
        description: `Refactor ${module}`,
        fileType: 'typescript',
        complexity: 3
      });
    }

    return changes;
  }

  /**
   * Generate file changes for tests
   */
  private generateTestFileChanges(
    analysis: TicketAnalysis,
    context: PlanningContext
  ): FileChange[] {
    const changes: FileChange[] = [];
    const baseName = this.toFileName(analysis.ticket.title);

    changes.push({
      path: `${context.conventions.testing.location}/${baseName}.test.ts`,
      action: 'create',
      description: `Tests for ${analysis.ticket.title}`,
      fileType: 'test',
      template: TacticalTemplates.testFile(baseName),
      complexity: 2
    });

    return changes;
  }

  /**
   * Generate default file changes
   */
  private generateDefaultFileChanges(
    analysis: TicketAnalysis,
    context: PlanningContext
  ): FileChange[] {
    return [{
      path: 'src/index.ts',
      action: 'modify',
      description: `Update for ${analysis.ticket.title}`,
      fileType: 'typescript',
      complexity: 2
    }];
  }

  /**
   * Generate interface definitions
   */
  private generateInterfaces(
    analysis: TicketAnalysis,
    context: PlanningContext
  ): InterfaceDefinition[] {
    const interfaces: InterfaceDefinition[] = [];

    // Generate interface based on requirements
    for (const req of analysis.requirements) {
      const interfaceName = this.toClassName(req.description);
      
      interfaces.push({
        name: interfaceName,
        type: 'interface',
        filePath: `src/types/${this.toFileName(req.description)}.types.ts`,
        properties: this.inferProperties(req),
        methods: this.inferMethods(req),
        isExported: true,
        documentation: req.description
      });
    }

    return interfaces;
  }

  /**
   * Infer properties from a requirement
   */
  private inferProperties(requirement: Requirement): PropertyDefinition[] {
    // Simple heuristic-based property inference
    const properties: PropertyDefinition[] = [];
    const desc = requirement.description.toLowerCase();

    if (desc.includes('id')) {
      properties.push({ name: 'id', type: 'string', optional: false });
    }
    if (desc.includes('name')) {
      properties.push({ name: 'name', type: 'string', optional: false });
    }
    if (desc.includes('status')) {
      properties.push({ name: 'status', type: 'string', optional: true });
    }
    if (desc.includes('date') || desc.includes('time')) {
      properties.push({ name: 'createdAt', type: 'Date', optional: true });
    }

    return properties;
  }

  /**
   * Infer methods from a requirement
   */
  private inferMethods(requirement: Requirement): MethodDefinition[] {
    const methods: MethodDefinition[] = [];
    const desc = requirement.description.toLowerCase();

    if (desc.includes('create') || desc.includes('add')) {
      methods.push({
        name: 'create',
        parameters: [{ name: 'data', type: 'any', optional: false }],
        returnType: 'Promise<any>',
        isAsync: true
      });
    }
    if (desc.includes('update') || desc.includes('modify')) {
      methods.push({
        name: 'update',
        parameters: [
          { name: 'id', type: 'string', optional: false },
          { name: 'data', type: 'any', optional: false }
        ],
        returnType: 'Promise<any>',
        isAsync: true
      });
    }
    if (desc.includes('delete') || desc.includes('remove')) {
      methods.push({
        name: 'delete',
        parameters: [{ name: 'id', type: 'string', optional: false }],
        returnType: 'Promise<void>',
        isAsync: true
      });
    }
    if (desc.includes('get') || desc.includes('fetch') || desc.includes('find')) {
      methods.push({
        name: 'find',
        parameters: [{ name: 'id', type: 'string', optional: false }],
        returnType: 'Promise<any>',
        isAsync: true
      });
    }

    return methods;
  }

  /**
   * Create implementation steps
   */
  private createImplementationSteps(
    filesToTouch: FileChange[],
    interfaces: InterfaceDefinition[],
    context: PlanningContext
  ): ImplementationStep[] {
    const steps: ImplementationStep[] = [];
    let stepNumber = 1;

    // Setup step
    steps.push({
      stepNumber: stepNumber++,
      title: 'Setup',
      description: 'Prepare development environment',
      type: 'setup',
      relatedFiles: [],
      verification: 'Environment ready',
      estimatedMinutes: 10,
      isBlocking: true
    });

    // Create directories if needed
    const directories = new Set(filesToTouch.map(f => f.path.split('/').slice(0, -1).join('/')));
    for (const dir of directories) {
      if (dir) {
        steps.push({
          stepNumber: stepNumber++,
          title: `Create directory: ${dir}`,
          description: `Ensure ${dir} directory exists`,
          type: 'setup',
          relatedFiles: [],
          commands: [`mkdir -p ${dir}`],
          verification: `Directory ${dir} exists`,
          estimatedMinutes: 2,
          isBlocking: false
        });
      }
    }

    // Create interface definitions
    for (const iface of interfaces) {
      steps.push({
        stepNumber: stepNumber++,
        title: `Define interface: ${iface.name}`,
        description: `Create interface definition for ${iface.name}`,
        type: 'write_code',
        relatedFiles: [iface.filePath],
        codeToWrite: [{
          filePath: iface.filePath,
          content: this.generateInterfaceCode(iface)
        }],
        verification: `Interface ${iface.name} defined`,
        estimatedMinutes: 10,
        isBlocking: true
      });
    }

    // Create/modify files
    for (const file of filesToTouch) {
      steps.push({
        stepNumber: stepNumber++,
        title: `${file.action} file: ${file.path}`,
        description: file.description,
        type: file.action === 'create' ? 'create_file' : 'modify_file',
        relatedFiles: [file.path],
        codeToWrite: file.template ? [{
          filePath: file.path,
          content: file.template
        }] : undefined,
        verification: `File ${file.path} ${file.action}d`,
        estimatedMinutes: file.complexity * 10,
        isBlocking: true
      });
    }

    // Test step
    steps.push({
      stepNumber: stepNumber++,
      title: 'Run tests',
      description: 'Execute test suite',
      type: 'test',
      relatedFiles: filesToTouch.filter(f => f.fileType === 'test').map(f => f.path),
      commands: ['npm test'],
      verification: 'All tests passing',
      estimatedMinutes: 5,
      isBlocking: true
    });

    // Verification step
    steps.push({
      stepNumber: stepNumber++,
      title: 'Final verification',
      description: 'Verify implementation meets requirements',
      type: 'verify',
      relatedFiles: filesToTouch.map(f => f.path),
      verification: 'Implementation verified',
      estimatedMinutes: 10,
      isBlocking: true
    });

    return steps;
  }

  /**
   * Generate interface code
   */
  private generateInterfaceCode(iface: InterfaceDefinition): string {
    const props = iface.properties.map(p => 
      `  ${p.name}${p.optional ? '?' : ''}: ${p.type};`
    ).join('\n');

    const methods = iface.methods.map(m => {
      const params = m.parameters.map(p => 
        `${p.name}${p.optional ? '?' : ''}: ${p.type}`
      ).join(', ');
      return `  ${m.name}(${params}): ${m.returnType};`;
    }).join('\n');

    return `export interface ${iface.name} {
${props}
${methods}
}`;
  }

  /**
   * Generate test specifications
   */
  private generateTestSpecs(
    ticket: Ticket,
    analysis: TicketAnalysis,
    context: PlanningContext
  ): TestSpec[] {
    const specs: TestSpec[] = [];
    const baseName = this.toFileName(ticket.title);

    // Unit tests
    specs.push({
      filePath: `${context.conventions.testing.location}/${baseName}.test.ts`,
      type: 'unit',
      testCases: [
        {
          name: 'should be defined',
          description: 'Module should be defined',
          input: 'N/A',
          expected: 'Module is defined',
          type: 'positive'
        },
        {
          name: 'should handle valid input',
          description: 'Normal operation with valid input',
          input: 'Valid data',
          expected: 'Success response',
          type: 'positive'
        },
        {
          name: 'should handle invalid input',
          description: 'Error handling for invalid input',
          input: 'Invalid data',
          expected: 'Error thrown',
          type: 'negative'
        }
      ]
    });

    return specs;
  }

  /**
   * Identify required dependencies
   */
  private identifyDependencies(
    analysis: TicketAnalysis,
    context: PlanningContext
  ): DependencySpec[] {
    const dependencies: DependencySpec[] = [];

    // Check for common dependency patterns
    const desc = analysis.ticket.description.toLowerCase();

    if (desc.includes('test') && !context.availableTools.includes('jest') && !context.availableTools.includes('vitest')) {
      dependencies.push({
        name: 'jest',
        version: '^29.0.0',
        isDev: true,
        reason: 'Testing framework'
      });
    }

    if (desc.includes('http') || desc.includes('api')) {
      dependencies.push({
        name: 'axios',
        version: '^1.6.0',
        isDev: false,
        reason: 'HTTP client',
        alternatives: ['fetch', 'node-fetch']
      });
    }

    if (desc.includes('validation') || desc.includes('schema')) {
      dependencies.push({
        name: 'zod',
        version: '^3.22.0',
        isDev: false,
        reason: 'Schema validation',
        alternatives: ['joi', 'yup', 'class-validator']
      });
    }

    return dependencies;
  }

  /**
   * Assess implementation risks
   */
  private assessRisks(analysis: TicketAnalysis, context: PlanningContext): Risk[] {
    const risks: Risk[] = [];

    // Complexity risk
    if (analysis.ticket.estimatedEffort > 8) {
      risks.push({
        description: 'High complexity may lead to underestimation',
        impact: 'medium',
        probability: 'medium',
        mitigation: 'Break down into smaller tickets'
      });
    }

    // Integration risk
    if (analysis.integrationPoints.length > 0) {
      risks.push({
        description: `Integration with ${analysis.integrationPoints.join(', ')} may have issues`,
        impact: 'high',
        probability: 'medium',
        mitigation: 'Test integrations early and often'
      });
    }

    // Breaking change risk
    if (analysis.ticket.type === 'refactor') {
      risks.push({
        description: 'Refactoring may introduce regressions',
        impact: 'high',
        probability: 'medium',
        mitigation: 'Comprehensive test coverage before refactoring',
        contingency: 'Rollback to previous version'
      });
    }

    return risks;
  }

  /**
   * Create rollback plan
   */
  private createRollbackPlan(filesToTouch: FileChange[]): RollbackStep[] {
    const steps: RollbackStep[] = [];
    let stepNumber = 1;

    for (const file of filesToTouch) {
      if (file.action === 'create') {
        steps.push({
          stepNumber: stepNumber++,
          description: `Remove created file: ${file.path}`,
          action: `Delete ${file.path}`,
          command: `rm ${file.path}`
        });
      } else if (file.action === 'modify') {
        steps.push({
          stepNumber: stepNumber++,
          description: `Restore original file: ${file.path}`,
          action: `Restore ${file.path} from git`,
          command: `git checkout -- ${file.path}`
        });
      }
    }

    return steps;
  }

  /**
   * Generate verification commands
   */
  private generateVerificationCommands(testSpecs: TestSpec[]): string[] {
    const commands: string[] = [];

    commands.push('npm run build');
    commands.push('npm test');
    commands.push('npm run lint');

    return commands;
  }

  /**
   * Calculate estimated hours
   */
  private calculateEstimate(filesToTouch: FileChange[], steps: ImplementationStep[]): number {
    const fileComplexity = filesToTouch.reduce((sum, f) => sum + f.complexity, 0);
    const stepMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    
    return Math.ceil((fileComplexity * 0.5) + (stepMinutes / 60));
  }

  /**
   * Convert title to file name
   */
  private toFileName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Convert title to class name
   */
  private toClassName(title: string): string {
    return title
      .split(/[^a-zA-Z0-9]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Get plan by ID
   */
  getPlan(id: string): TacticalPlan | undefined {
    return this.plans.get(id);
  }

  /**
   * List all plans
   */
  listPlans(): TacticalPlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Update plan
   */
  updatePlan(id: string, updates: Partial<TacticalPlan>): TacticalPlan | undefined {
    const plan = this.plans.get(id);
    if (plan) {
      Object.assign(plan, updates);
      plan.version = this.incrementVersion(plan.version);
      this.plans.set(id, plan);
    }
    return plan;
  }

  /**
   * Increment version number
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }
}

/**
 * Ticket analysis result
 */
interface TicketAnalysis {
  ticket: Ticket;
  requirements: Requirement[];
  applicablePatterns: string[];
  approach: string;
  affectedModules: string[];
  integrationPoints: string[];
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const tacticalPlanner = new TacticalPlanner();

// Default export
export default TacticalPlanner;
