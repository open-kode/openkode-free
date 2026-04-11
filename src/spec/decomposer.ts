/**
 * OpenKode Spec-Driven Development Pipeline
 * =========================================
 * Phase 2: Decomposition
 * 
 * Decomposes captured intent into hierarchical work items:
 * Epic → Phase → Ticket → Task
 * Handles dependency analysis and complexity-based strategies.
 */

import { CapturedIntent, PRD, Requirement, PriorityLevel } from './intentCapture';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Epic - Top-level work item representing a significant deliverable
 */
export interface Epic {
  /** Unique identifier */
  id: string;
  
  /** Epic title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Source intent/PRD reference */
  sourceIntentId: string;
  sourcePRDId?: string;
  
  /** Child phases */
  phases: Phase[];
  
  /** Epic-level requirements */
  requirements: Requirement[];
  
  /** Priority */
  priority: PriorityLevel;
  
  /** Estimated complexity (story points or t-shirt size) */
  complexity: Complexity;
  
  /** Status */
  status: WorkItemStatus;
  
  /** Creation timestamp */
  createdAt: string;
  
  /** Target completion */
  targetDate?: string;
  
  /** Assigned owner */
  owner?: string;
  
  /** Tags/labels */
  tags: string[];
}

/**
 * Phase - Major stage within an epic
 */
export interface Phase {
  /** Unique identifier */
  id: string;
  
  /** Phase name */
  name: string;
  
  /** Phase description */
  description: string;
  
  /** Parent epic ID */
  epicId: string;
  
  /** Child tickets */
  tickets: Ticket[];
  
  /** Phase type */
  type: PhaseType;
  
  /** Phase order (for sequencing) */
  order: number;
  
  /** Dependencies on other phases */
  dependencies: string[];
  
  /** Estimated duration in days */
  estimatedDuration: number;
  
  /** Status */
  status: WorkItemStatus;
  
  /** Start condition - when can this phase begin */
  startCondition?: string;
  
  /** Exit criteria - what defines phase completion */
  exitCriteria: string[];
  
  /** Deliverables produced in this phase */
  deliverables: string[];
}

/**
 * Ticket - Implementable work item within a phase
 */
export interface Ticket {
  /** Unique identifier */
  id: string;
  
  /** Ticket title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Parent phase ID */
  phaseId: string;
  
  /** Parent epic ID */
  epicId: string;
  
  /** Child tasks */
  tasks: Task[];
  
  /** Ticket type */
  type: TicketType;
  
  /** Priority */
  priority: PriorityLevel;
  
  /** Estimated effort (story points or hours) */
  estimatedEffort: number;
  
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  
  /** Dependencies on other tickets */
  dependencies: string[];
  
  /** Status */
  status: WorkItemStatus;
  
  /** Assigned to */
  assignee?: string;
  
  /** Labels */
  labels: string[];
  
  /** Related files/modules */
  relatedFiles?: string[];
}

/**
 * Task - Atomic unit of work within a ticket
 */
export interface Task {
  /** Unique identifier */
  id: string;
  
  /** Task description */
  description: string;
  
  /** Parent ticket ID */
  ticketId: string;
  
  /** Task type */
  type: TaskType;
  
  /** Estimated duration in hours */
  estimatedHours: number;
  
  /** Status */
  status: WorkItemStatus;
  
  /** Whether this is a blocking task */
  isBlocking: boolean;
  
  /** Verification method */
  verification: string;
  
  /** Command or action to execute */
  action?: string;
}

/**
 * Work item status
 */
export type WorkItemStatus = 
  | 'backlog' 
  | 'ready' 
  | 'in_progress' 
  | 'review' 
  | 'blocked' 
  | 'completed' 
  | 'cancelled';

/**
 * Complexity levels
 */
export type Complexity = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';

/**
 * Phase types
 */
export type PhaseType = 
  | 'discovery' 
  | 'design' 
  | 'implementation' 
  | 'testing' 
  | 'deployment' 
  | 'documentation' 
  | 'review';

/**
 * Ticket types
 */
export type TicketType = 
  | 'feature' 
  | 'bug' 
  | 'refactor' 
  | 'test' 
  | 'docs' 
  | 'spike' 
  | 'chore'
  | 'review';

/**
 * Task types
 */
export type TaskType = 
  | 'code' 
  | 'test' 
  | 'review' 
  | 'docs' 
  | 'research' 
  | 'setup' 
  | 'validation';

/**
 * Decomposition strategy
 */
export interface DecompositionStrategy {
  /** Strategy name */
  name: string;
  
  /** When to apply this strategy */
  applicability: (intent: CapturedIntent) => boolean;
  
  /** Apply strategy to decompose */
  decompose: (intent: CapturedIntent, epic: Epic) => Phase[];
}

/**
 * Dependency graph for work items
 */
export interface DependencyGraph {
  /** Nodes in the graph */
  nodes: DependencyNode[];
  
  /** Edges representing dependencies */
  edges: DependencyEdge[];
}

/**
 * Dependency node
 */
export interface DependencyNode {
  /** Node ID (references work item) */
  id: string;
  
  /** Node type */
  type: 'epic' | 'phase' | 'ticket' | 'task';
  
  /** Display label */
  label: string;
  
  /** Estimated duration */
  duration: number;
}

/**
 * Dependency edge
 */
export interface DependencyEdge {
  /** Source node ID */
  from: string;
  
  /** Target node ID */
  to: string;
  
  /** Dependency type */
  type: 'blocks' | 'depends_on' | 'relates_to';
}

/**
 * Decomposition result
 */
export interface DecompositionResult {
  /** Generated epic */
  epic: Epic;
  
  /** Dependency graph */
  dependencyGraph: DependencyGraph;
  
  /** Summary statistics */
  stats: DecompositionStats;
  
  /** Warnings or issues */
  warnings: string[];
}

/**
 * Decomposition statistics
 */
export interface DecompositionStats {
  /** Total phases */
  phaseCount: number;
  
  /** Total tickets */
  ticketCount: number;
  
  /** Total tasks */
  taskCount: number;
  
  /** Total estimated effort */
  totalEffort: number;
  
  /** Critical path length (in days) */
  criticalPathLength: number;
  
  /** Dependency count */
  dependencyCount: number;
}

// ============================================================================
// DECOMPOSITION STRATEGIES
// ============================================================================

/**
 * Standard decomposition strategy - works for most features
 */
const standardStrategy: DecompositionStrategy = {
  name: 'standard',
  applicability: () => true, // Default fallback
  decompose: (intent: CapturedIntent, epic: Epic): Phase[] => {
    return [
      {
        id: generateId('phase'),
        name: 'Discovery & Analysis',
        description: 'Understand requirements and analyze approach',
        epicId: epic.id,
        tickets: [],
        type: 'discovery',
        order: 1,
        dependencies: [],
        estimatedDuration: 1,
        status: 'backlog',
        exitCriteria: ['Requirements clarified', 'Approach defined'],
        deliverables: ['Analysis document']
      },
      {
        id: generateId('phase'),
        name: 'Design',
        description: 'Design solution architecture and interfaces',
        epicId: epic.id,
        tickets: [],
        type: 'design',
        order: 2,
        dependencies: [],
        estimatedDuration: 1,
        status: 'backlog',
        exitCriteria: ['Design approved', 'Interfaces defined'],
        deliverables: ['Design document', 'Interface specifications']
      },
      {
        id: generateId('phase'),
        name: 'Implementation',
        description: 'Implement the solution',
        epicId: epic.id,
        tickets: [],
        type: 'implementation',
        order: 3,
        dependencies: [],
        estimatedDuration: 3,
        status: 'backlog',
        exitCriteria: ['Code complete', 'Unit tests passing'],
        deliverables: ['Implementation', 'Unit tests']
      },
      {
        id: generateId('phase'),
        name: 'Testing & Validation',
        description: 'Test and validate the implementation',
        epicId: epic.id,
        tickets: [],
        type: 'testing',
        order: 4,
        dependencies: [],
        estimatedDuration: 1,
        status: 'backlog',
        exitCriteria: ['All tests passing', 'Acceptance criteria met'],
        deliverables: ['Test results', 'Validation report']
      },
      {
        id: generateId('phase'),
        name: 'Documentation',
        description: 'Document the solution',
        epicId: epic.id,
        tickets: [],
        type: 'documentation',
        order: 5,
        dependencies: [],
        estimatedDuration: 0.5,
        status: 'backlog',
        exitCriteria: ['Documentation complete', 'Examples provided'],
        deliverables: ['Documentation', 'Examples']
      }
    ];
  }
};

/**
 * Simple strategy for small changes
 */
const simpleStrategy: DecompositionStrategy = {
  name: 'simple',
  applicability: (intent: CapturedIntent) => {
    return intent.requirements.length <= 3 && intent.confidence > 0.7;
  },
  decompose: (intent: CapturedIntent, epic: Epic): Phase[] => {
    return [
      {
        id: generateId('phase'),
        name: 'Implementation',
        description: 'Implement the change',
        epicId: epic.id,
        tickets: [],
        type: 'implementation',
        order: 1,
        dependencies: [],
        estimatedDuration: 1,
        status: 'backlog',
        exitCriteria: ['Implementation complete', 'Tests passing'],
        deliverables: ['Code changes']
      },
      {
        id: generateId('phase'),
        name: 'Validation',
        description: 'Validate the implementation',
        epicId: epic.id,
        tickets: [],
        type: 'testing',
        order: 2,
        dependencies: [],
        estimatedDuration: 0.5,
        status: 'backlog',
        exitCriteria: ['Validation complete'],
        deliverables: ['Validation results']
      }
    ];
  }
};

/**
 * Complex strategy for large features
 */
const complexStrategy: DecompositionStrategy = {
  name: 'complex',
  applicability: (intent: CapturedIntent) => {
    return intent.requirements.length > 10 || intent.constraints.length > 5;
  },
  decompose: (intent: CapturedIntent, epic: Epic): Phase[] => {
    return [
      {
        id: generateId('phase'),
        name: 'Research & Discovery',
        description: 'Deep research and requirements analysis',
        epicId: epic.id,
        tickets: [],
        type: 'discovery',
        order: 1,
        dependencies: [],
        estimatedDuration: 3,
        status: 'backlog',
        exitCriteria: ['Research complete', 'Requirements documented'],
        deliverables: ['Research findings', 'Requirements document']
      },
      {
        id: generateId('phase'),
        name: 'Architecture Design',
        description: 'Design system architecture',
        epicId: epic.id,
        tickets: [],
        type: 'design',
        order: 2,
        dependencies: [],
        estimatedDuration: 3,
        status: 'backlog',
        exitCriteria: ['Architecture approved', 'ADR documents'],
        deliverables: ['Architecture diagrams', 'ADRs']
      },
      {
        id: generateId('phase'),
        name: 'Prototype',
        description: 'Build proof of concept',
        epicId: epic.id,
        tickets: [],
        type: 'implementation',
        order: 3,
        dependencies: [],
        estimatedDuration: 5,
        status: 'backlog',
        exitCriteria: ['Prototype working', 'Risks validated'],
        deliverables: ['Prototype', 'Risk assessment']
      },
      {
        id: generateId('phase'),
        name: 'Detailed Design',
        description: 'Detailed component design',
        epicId: epic.id,
        tickets: [],
        type: 'design',
        order: 4,
        dependencies: [],
        estimatedDuration: 2,
        status: 'backlog',
        exitCriteria: ['Designs reviewed', 'Interfaces finalized'],
        deliverables: ['Detailed designs', 'Interface specs']
      },
      {
        id: generateId('phase'),
        name: 'Core Implementation',
        description: 'Implement core functionality',
        epicId: epic.id,
        tickets: [],
        type: 'implementation',
        order: 5,
        dependencies: [],
        estimatedDuration: 10,
        status: 'backlog',
        exitCriteria: ['Core features working', 'Unit tests passing'],
        deliverables: ['Core implementation']
      },
      {
        id: generateId('phase'),
        name: 'Integration',
        description: 'Integrate components',
        epicId: epic.id,
        tickets: [],
        type: 'implementation',
        order: 6,
        dependencies: [],
        estimatedDuration: 5,
        status: 'backlog',
        exitCriteria: ['Integration complete', 'Integration tests passing'],
        deliverables: ['Integrated system']
      },
      {
        id: generateId('phase'),
        name: 'System Testing',
        description: 'Comprehensive system testing',
        epicId: epic.id,
        tickets: [],
        type: 'testing',
        order: 7,
        dependencies: [],
        estimatedDuration: 5,
        status: 'backlog',
        exitCriteria: ['All tests passing', 'Performance validated'],
        deliverables: ['Test reports', 'Performance benchmarks']
      },
      {
        id: generateId('phase'),
        name: 'Deployment Preparation',
        description: 'Prepare for deployment',
        epicId: epic.id,
        tickets: [],
        type: 'deployment',
        order: 8,
        dependencies: [],
        estimatedDuration: 2,
        status: 'backlog',
        exitCriteria: ['Deployment scripts ready', 'Rollback plan'],
        deliverables: ['Deployment package']
      },
      {
        id: generateId('phase'),
        name: 'Documentation',
        description: 'Complete documentation',
        epicId: epic.id,
        tickets: [],
        type: 'documentation',
        order: 9,
        dependencies: [],
        estimatedDuration: 3,
        status: 'backlog',
        exitCriteria: ['Documentation complete', 'Training materials'],
        deliverables: ['User docs', 'API docs', 'Training']
      }
    ];
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function determineComplexity(intent: CapturedIntent): Complexity {
  const reqCount = intent.requirements.length;
  const constraintCount = intent.constraints.length;
  
  if (reqCount <= 2 && constraintCount <= 2) return 'xs';
  if (reqCount <= 5 && constraintCount <= 3) return 's';
  if (reqCount <= 10 && constraintCount <= 5) return 'm';
  if (reqCount <= 20 && constraintCount <= 10) return 'l';
  if (reqCount <= 50 && constraintCount <= 20) return 'xl';
  return 'xxl';
}

function complexityToEffort(complexity: Complexity): number {
  const mapping: Record<Complexity, number> = {
    xs: 1,
    s: 3,
    m: 8,
    l: 21,
    xl: 55,
    xxl: 100
  };
  return mapping[complexity];
}

// ============================================================================
// DECOMPOSER CLASS
// ============================================================================

export class Decomposer {
  private strategies: DecompositionStrategy[] = [simpleStrategy, complexStrategy, standardStrategy];
  private epics: Map<string, Epic> = new Map();
  private phases: Map<string, Phase> = new Map();
  private tickets: Map<string, Ticket> = new Map();
  private tasks: Map<string, Task> = new Map();

  /**
   * Register a custom decomposition strategy
   */
  registerStrategy(strategy: DecompositionStrategy): void {
    this.strategies.unshift(strategy);
  }

  /**
   * Select appropriate strategy for the intent
   */
  private selectStrategy(intent: CapturedIntent): DecompositionStrategy {
    for (const strategy of this.strategies) {
      if (strategy.applicability(intent)) {
        return strategy;
      }
    }
    return standardStrategy;
  }

  /**
   * Decompose a captured intent into an epic with phases
   */
  decomposeEpic(intent: CapturedIntent, prd?: PRD): DecompositionResult {
    // Create epic
    const epic: Epic = {
      id: generateId('epic'),
      title: this.generateEpicTitle(intent),
      description: intent.originalInput.description,
      sourceIntentId: intent.id,
      sourcePRDId: prd?.id,
      phases: [],
      requirements: intent.requirements,
      priority: intent.originalInput.priority || 'medium',
      complexity: determineComplexity(intent),
      status: 'backlog',
      createdAt: new Date().toISOString(),
      tags: intent.originalInput.tags || []
    };

    // Select and apply decomposition strategy
    const strategy = this.selectStrategy(intent);
    const phases = strategy.decompose(intent, epic);
    
    // Generate tickets for each phase
    for (const phase of phases) {
      phase.tickets = this.generateTickets(phase, intent);
    }

    // Set up phase dependencies
    this.establishPhaseDependencies(phases);

    epic.phases = phases;
    this.epics.set(epic.id, epic);

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(epic);

    // Calculate statistics
    const stats = this.calculateStats(epic);

    // Generate warnings
    const warnings = this.generateWarnings(epic, intent);

    return {
      epic,
      dependencyGraph,
      stats,
      warnings
    };
  }

  /**
   * Generate epic title from intent
   */
  private generateEpicTitle(intent: CapturedIntent): string {
    // Extract first sentence or first 50 chars
    const desc = intent.originalInput.description;
    const firstSentence = desc.split(/[.!?]/)[0];
    return firstSentence.length > 50 
      ? firstSentence.substring(0, 50) + '...'
      : firstSentence;
  }

  /**
   * Generate tickets for a phase
   */
  generateTickets(phase: Phase, intent: CapturedIntent): Ticket[] {
    const tickets: Ticket[] = [];

    switch (phase.type) {
      case 'discovery':
        tickets.push(
          this.createTicket(phase, 'Analyze requirements', 'docs', intent),
          this.createTicket(phase, 'Document findings', 'docs', intent)
        );
        break;

      case 'design':
        tickets.push(
          this.createTicket(phase, 'Create design document', 'docs', intent),
          this.createTicket(phase, 'Define interfaces', 'feature', intent),
          this.createTicket(phase, 'Review design', 'review', intent)
        );
        break;

      case 'implementation':
        // Create tickets based on requirements
        for (const req of intent.requirements.slice(0, 5)) {
          tickets.push(this.createTicketFromRequirement(phase, req));
        }
        // Add supporting tickets
        tickets.push(
          this.createTicket(phase, 'Write unit tests', 'test', intent),
          this.createTicket(phase, 'Code review', 'chore', intent)
        );
        break;

      case 'testing':
        tickets.push(
          this.createTicket(phase, 'Execute test plan', 'test', intent),
          this.createTicket(phase, 'Fix identified issues', 'bug', intent),
          this.createTicket(phase, 'Validate acceptance criteria', 'test', intent)
        );
        break;

      case 'documentation':
        tickets.push(
          this.createTicket(phase, 'Write user documentation', 'docs', intent),
          this.createTicket(phase, 'Write API documentation', 'docs', intent),
          this.createTicket(phase, 'Create examples', 'docs', intent)
        );
        break;

      case 'deployment':
        tickets.push(
          this.createTicket(phase, 'Prepare deployment scripts', 'chore', intent),
          this.createTicket(phase, 'Create rollback plan', 'docs', intent),
          this.createTicket(phase, 'Execute deployment', 'chore', intent)
        );
        break;

      case 'review':
        tickets.push(
          this.createTicket(phase, 'Conduct review', 'review', intent),
          this.createTicket(phase, 'Address feedback', 'chore', intent)
        );
        break;
    }

    // Generate tasks for each ticket
    for (const ticket of tickets) {
      ticket.tasks = this.generateTasks(ticket);
      this.tickets.set(ticket.id, ticket);
    }

    return tickets;
  }

  /**
   * Create a ticket
   */
  private createTicket(
    phase: Phase,
    title: string,
    type: TicketType,
    intent: CapturedIntent
  ): Ticket {
    const ticket: Ticket = {
      id: generateId('ticket'),
      title,
      description: `${title} for ${phase.name}`,
      phaseId: phase.id,
      epicId: phase.epicId,
      tasks: [],
      type,
      priority: intent.originalInput.priority || 'medium',
      estimatedEffort: type === 'feature' ? 5 : 2,
      acceptanceCriteria: [`${title} is complete`],
      dependencies: [],
      status: 'backlog',
      labels: [type, phase.type]
    };
    return ticket;
  }

  /**
   * Create a ticket from a requirement
   */
  private createTicketFromRequirement(phase: Phase, requirement: Requirement): Ticket {
    const ticket: Ticket = {
      id: generateId('ticket'),
      title: `Implement: ${requirement.description.substring(0, 50)}`,
      description: requirement.description,
      phaseId: phase.id,
      epicId: phase.epicId,
      tasks: [],
      type: 'feature',
      priority: requirement.priority,
      estimatedEffort: requirement.priority === 'high' ? 8 : 5,
      acceptanceCriteria: [requirement.description],
      dependencies: [],
      status: 'backlog',
      labels: ['feature', requirement.type]
    };
    return ticket;
  }

  /**
   * Generate tasks for a ticket
   */
  generateTasks(ticket: Ticket): Task[] {
    const tasks: Task[] = [];

    switch (ticket.type) {
      case 'feature':
        tasks.push(
          { id: generateId('task'), description: 'Analyze implementation approach', ticketId: ticket.id, type: 'research', estimatedHours: 1, status: 'backlog', isBlocking: true, verification: 'Approach documented' },
          { id: generateId('task'), description: 'Implement core functionality', ticketId: ticket.id, type: 'code', estimatedHours: 4, status: 'backlog', isBlocking: true, verification: 'Code compiles' },
          { id: generateId('task'), description: 'Add error handling', ticketId: ticket.id, type: 'code', estimatedHours: 1, status: 'backlog', isBlocking: false, verification: 'Edge cases handled' },
          { id: generateId('task'), description: 'Write unit tests', ticketId: ticket.id, type: 'test', estimatedHours: 2, status: 'backlog', isBlocking: false, verification: 'Tests passing' }
        );
        break;

      case 'bug':
        tasks.push(
          { id: generateId('task'), description: 'Reproduce the issue', ticketId: ticket.id, type: 'research', estimatedHours: 1, status: 'backlog', isBlocking: true, verification: 'Issue reproduced' },
          { id: generateId('task'), description: 'Identify root cause', ticketId: ticket.id, type: 'research', estimatedHours: 1, status: 'backlog', isBlocking: true, verification: 'Root cause identified' },
          { id: generateId('task'), description: 'Implement fix', ticketId: ticket.id, type: 'code', estimatedHours: 2, status: 'backlog', isBlocking: true, verification: 'Fix implemented' },
          { id: generateId('task'), description: 'Verify fix', ticketId: ticket.id, type: 'validation', estimatedHours: 1, status: 'backlog', isBlocking: false, verification: 'Fix verified' }
        );
        break;

      case 'test':
        tasks.push(
          { id: generateId('task'), description: 'Define test cases', ticketId: ticket.id, type: 'research', estimatedHours: 1, status: 'backlog', isBlocking: true, verification: 'Test cases defined' },
          { id: generateId('task'), description: 'Implement tests', ticketId: ticket.id, type: 'test', estimatedHours: 3, status: 'backlog', isBlocking: true, verification: 'Tests implemented' },
          { id: generateId('task'), description: 'Execute tests', ticketId: ticket.id, type: 'test', estimatedHours: 1, status: 'backlog', isBlocking: false, verification: 'Test results recorded' }
        );
        break;

      case 'docs':
        tasks.push(
          { id: generateId('task'), description: 'Outline documentation structure', ticketId: ticket.id, type: 'research', estimatedHours: 0.5, status: 'backlog', isBlocking: true, verification: 'Outline complete' },
          { id: generateId('task'), description: 'Write documentation content', ticketId: ticket.id, type: 'docs', estimatedHours: 2, status: 'backlog', isBlocking: true, verification: 'Content written' },
          { id: generateId('task'), description: 'Review and edit', ticketId: ticket.id, type: 'review', estimatedHours: 0.5, status: 'backlog', isBlocking: false, verification: 'Documentation reviewed' }
        );
        break;

      default:
        tasks.push(
          { id: generateId('task'), description: 'Complete task', ticketId: ticket.id, type: 'code', estimatedHours: 2, status: 'backlog', isBlocking: true, verification: 'Task complete' }
        );
    }

    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }

    return tasks;
  }

  /**
   * Create phases for an epic (public API)
   */
  createPhases(epic: Epic, intent: CapturedIntent): Phase[] {
    const strategy = this.selectStrategy(intent);
    return strategy.decompose(intent, epic);
  }

  /**
   * Establish dependencies between phases
   */
  private establishPhaseDependencies(phases: Phase[]): void {
    // Sort by order
    phases.sort((a, b) => a.order - b.order);

    // Each phase depends on the previous one (except first)
    for (let i = 1; i < phases.length; i++) {
      phases[i].dependencies.push(phases[i - 1].id);
    }
  }

  /**
   * Analyze dependencies between tickets
   */
  analyzeTicketDependencies(tickets: Ticket[]): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    // Simple heuristic: tickets in same phase with similar labels may be related
    for (let i = 0; i < tickets.length; i++) {
      for (let j = i + 1; j < tickets.length; j++) {
        const t1 = tickets[i];
        const t2 = tickets[j];

        // Same phase and type suggests potential dependency
        if (t1.phaseId === t2.phaseId && t1.type === t2.type) {
          // Implementation before testing
          if (t1.type === 'feature' && t2.type === 'test') {
            edges.push({ from: t1.id, to: t2.id, type: 'blocks' });
          }
        }
      }
    }

    return edges;
  }

  /**
   * Build dependency graph for an epic
   */
  private buildDependencyGraph(epic: Epic): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    // Add epic node
    nodes.push({
      id: epic.id,
      type: 'epic',
      label: epic.title,
      duration: complexityToEffort(epic.complexity)
    });

    // Add phase nodes and edges
    for (const phase of epic.phases) {
      nodes.push({
        id: phase.id,
        type: 'phase',
        label: phase.name,
        duration: phase.estimatedDuration
      });

      edges.push({ from: epic.id, to: phase.id, type: 'contains' as any });

      for (const depId of phase.dependencies) {
        edges.push({ from: depId, to: phase.id, type: 'depends_on' });
      }

      // Add ticket nodes
      for (const ticket of phase.tickets) {
        nodes.push({
          id: ticket.id,
          type: 'ticket',
          label: ticket.title,
          duration: ticket.estimatedEffort
        });

        edges.push({ from: phase.id, to: ticket.id, type: 'contains' as any });

        for (const depId of ticket.dependencies) {
          edges.push({ from: depId, to: ticket.id, type: 'depends_on' });
        }

        // Add task nodes
        for (const task of ticket.tasks) {
          nodes.push({
            id: task.id,
            type: 'task',
            label: task.description.substring(0, 30),
            duration: task.estimatedHours
          });

          edges.push({ from: ticket.id, to: task.id, type: 'contains' as any });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Calculate decomposition statistics
   */
  private calculateStats(epic: Epic): DecompositionStats {
    let ticketCount = 0;
    let taskCount = 0;
    let totalEffort = 0;

    for (const phase of epic.phases) {
      ticketCount += phase.tickets.length;
      for (const ticket of phase.tickets) {
        taskCount += ticket.tasks.length;
        totalEffort += ticket.estimatedEffort;
      }
    }

    // Calculate critical path (simplified)
    const criticalPathLength = epic.phases.reduce((sum, p) => sum + p.estimatedDuration, 0);

    return {
      phaseCount: epic.phases.length,
      ticketCount,
      taskCount,
      totalEffort,
      criticalPathLength,
      dependencyCount: epic.phases.reduce((sum, p) => sum + p.dependencies.length, 0)
    };
  }

  /**
   * Generate warnings for potential issues
   */
  private generateWarnings(epic: Epic, intent: CapturedIntent): string[] {
    const warnings: string[] = [];

    if (intent.confidence < 0.5) {
      warnings.push('Low confidence in captured intent - consider clarification');
    }

    if (intent.openQuestions.length > 0) {
      warnings.push(`${intent.openQuestions.length} open questions need resolution`);
    }

    if (epic.phases.length > 7) {
      warnings.push('Large number of phases - consider breaking into multiple epics');
    }

    const stats = this.calculateStats(epic);
    if (stats.totalEffort > 100) {
      warnings.push('High total effort - consider scope reduction');
    }

    return warnings;
  }

  /**
   * Get epic by ID
   */
  getEpic(id: string): Epic | undefined {
    return this.epics.get(id);
  }

  /**
   * Get phase by ID
   */
  getPhase(id: string): Phase | undefined {
    return this.phases.get(id);
  }

  /**
   * Get ticket by ID
   */
  getTicket(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }

  /**
   * Get task by ID
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * List all epics
   */
  listEpics(): Epic[] {
    return Array.from(this.epics.values());
  }

  /**
   * Update work item status
   */
  updateStatus(
    type: 'epic' | 'phase' | 'ticket' | 'task',
    id: string,
    status: WorkItemStatus
  ): boolean {
    switch (type) {
      case 'epic': {
        const epic = this.epics.get(id);
        if (epic) {
          epic.status = status;
          return true;
        }
        break;
      }
      case 'ticket': {
        const ticket = this.tickets.get(id);
        if (ticket) {
          ticket.status = status;
          return true;
        }
        break;
      }
      case 'task': {
        const task = this.tasks.get(id);
        if (task) {
          task.status = status;
          return true;
        }
        break;
      }
    }
    return false;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const decomposer = new Decomposer();

// Default export
export default Decomposer;
