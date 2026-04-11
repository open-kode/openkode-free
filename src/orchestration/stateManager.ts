/**
 * OpenKode Multi-Agent Orchestration Engine - State Manager
 * 
 * Persistent state machine for multi-phase workflows:
 * - Workflow lifecycle management
 * - Phase transitions with validation
 * - State persistence to workspace storage
 * - Archive and recovery capabilities
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived'
}

export enum PhaseStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface WorkflowPhase {
  id: string;
  name: string;
  description?: string;
  status: PhaseStatus;
  order: number;
  agentRole?: string;
  modelId?: string;
  dependencies: string[]; // Phase IDs that must complete before this one
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface WorkflowState {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  phases: Map<string, WorkflowPhase>;
  phaseOrder: string[]; // Ordered list of phase IDs
  currentPhaseId?: string;
  context: Record<string, unknown>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    createdBy?: string;
    tags?: string[];
    priority?: number;
  };
  results: Record<string, unknown>;
  errors: Array<{
    phaseId?: string;
    message: string;
    stack?: string;
    timestamp: Date;
  }>;
}

export interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  phases: Array<{
    id: string;
    name: string;
    description?: string;
    agentRole?: string;
    dependencies?: string[];
    maxRetries?: number;
    input?: Record<string, unknown>;
  }>;
  context?: Record<string, unknown>;
  metadata?: {
    createdBy?: string;
    tags?: string[];
    priority?: number;
  };
}

export interface StateManagerConfig {
  storagePath: string;
  autoSave?: boolean;
  saveIntervalMs?: number;
  maxArchivedWorkflows?: number;
  encryptionKey?: string;
}

export interface WorkflowQuery {
  status?: WorkflowStatus;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface WorkflowSnapshot {
  id: string;
  name: string;
  status: WorkflowStatus;
  currentPhase?: string;
  progress: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  duration?: number; // milliseconds
}

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

function serializeWorkflow(state: WorkflowState): object {
  return {
    ...state,
    phases: Array.from(state.phases.entries()),
    metadata: {
      ...state.metadata,
      createdAt: state.metadata.createdAt.toISOString(),
      updatedAt: state.metadata.updatedAt.toISOString(),
      startedAt: state.metadata.startedAt?.toISOString(),
      completedAt: state.metadata.completedAt?.toISOString()
    }
  };
}

function deserializeWorkflow(data: any): WorkflowState {
  const phases = new Map<string, WorkflowPhase>();
  
  if (Array.isArray(data.phases)) {
    for (const [id, phase] of data.phases) {
      phases.set(id, {
        ...phase,
        startedAt: phase.startedAt ? new Date(phase.startedAt) : undefined,
        completedAt: phase.completedAt ? new Date(phase.completedAt) : undefined
      });
    }
  }

  return {
    ...data,
    phases,
    metadata: {
      ...data.metadata,
      createdAt: new Date(data.metadata.createdAt),
      updatedAt: new Date(data.metadata.updatedAt),
      startedAt: data.metadata.startedAt ? new Date(data.metadata.startedAt) : undefined,
      completedAt: data.metadata.completedAt ? new Date(data.metadata.completedAt) : undefined
    },
    errors: (data.errors || []).map((e: any) => ({
      ...e,
      timestamp: new Date(e.timestamp)
    }))
  };
}

// ============================================================================
// STATE MANAGER
// ============================================================================

export class StateManager extends EventEmitter {
  private workflows: Map<string, WorkflowState> = new Map();
  private config: StateManagerConfig;
  private saveTimer?: NodeJS.Timeout;
  private isDirty: boolean = false;

  constructor(config: StateManagerConfig) {
    super();
    this.config = {
      autoSave: true,
      saveIntervalMs: 30000,
      maxArchivedWorkflows: 100,
      ...config
    };

    if (this.config.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Create a new workflow from a definition
   */
  async createWorkflow(definition: WorkflowDefinition): Promise<WorkflowState> {
    const id = definition.id || this.generateId();
    const now = new Date();

    // Build phases with proper ordering
    const phases = new Map<string, WorkflowPhase>();
    const phaseOrder: string[] = [];

    // Topological sort for phase ordering
    const sortedPhases = this.topologicalSort(definition.phases);

    sortedPhases.forEach((phaseDef, index) => {
      const phase: WorkflowPhase = {
        id: phaseDef.id,
        name: phaseDef.name,
        description: phaseDef.description,
        status: PhaseStatus.PENDING,
        order: index,
        agentRole: phaseDef.agentRole,
        dependencies: phaseDef.dependencies || [],
        input: phaseDef.input,
        retryCount: 0,
        maxRetries: phaseDef.maxRetries || 3
      };
      phases.set(phase.id, phase);
      phaseOrder.push(phase.id);
    });

    const workflow: WorkflowState = {
      id,
      name: definition.name,
      description: definition.description,
      status: WorkflowStatus.PENDING,
      phases,
      phaseOrder,
      context: definition.context || {},
      metadata: {
        createdAt: now,
        updatedAt: now,
        ...definition.metadata
      },
      results: {},
      errors: []
    };

    this.workflows.set(id, workflow);
    this.isDirty = true;

    this.emit('workflow:created', workflow);
    
    if (this.config.autoSave) {
      await this.saveWorkflow(id);
    }

    return workflow;
  }

  /**
   * Start a workflow
   */
  async startWorkflow(workflowId: string): Promise<WorkflowState> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== WorkflowStatus.PENDING) {
      throw new Error(`Cannot start workflow with status: ${workflow.status}`);
    }

    workflow.status = WorkflowStatus.RUNNING;
    workflow.metadata.startedAt = new Date();
    workflow.metadata.updatedAt = new Date();

    // Set first phase as current
    if (workflow.phaseOrder.length > 0) {
      workflow.currentPhaseId = workflow.phaseOrder[0];
    }

    this.isDirty = true;
    this.emit('workflow:started', workflow);
    await this.saveWorkflow(workflowId);

    return workflow;
  }

  /**
   * Update a phase's status and data
   */
  async updatePhase(
    workflowId: string,
    phaseId: string,
    updates: Partial<WorkflowPhase>
  ): Promise<WorkflowPhase> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const phase = workflow.phases.get(phaseId);
    if (!phase) {
      throw new Error(`Phase not found: ${phaseId}`);
    }

    // Validate state transitions
    if (updates.status) {
      this.validatePhaseTransition(phase, updates.status);
    }

    // Update phase
    Object.assign(phase, updates);
    phase.completedAt = new Date();
    
    if (updates.status === PhaseStatus.IN_PROGRESS && !phase.startedAt) {
      phase.startedAt = new Date();
    }

    workflow.metadata.updatedAt = new Date();
    this.isDirty = true;

    this.emit('phase:updated', workflowId, phase);

    // Check if we should advance to next phase
    if (updates.status === PhaseStatus.COMPLETED || updates.status === PhaseStatus.SKIPPED) {
      await this.advanceWorkflow(workflowId);
    }

    await this.saveWorkflow(workflowId);
    return phase;
  }

  /**
   * Advance workflow to next phase
   */
  private async advanceWorkflow(workflowId: string): Promise<void> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) return;

    const currentIndex = workflow.currentPhaseId 
      ? workflow.phaseOrder.indexOf(workflow.currentPhaseId)
      : -1;

    // Find next eligible phase
    for (let i = currentIndex + 1; i < workflow.phaseOrder.length; i++) {
      const nextPhaseId = workflow.phaseOrder[i];
      const nextPhase = workflow.phases.get(nextPhaseId);
      
      if (!nextPhase) continue;

      // Check dependencies
      const depsSatisfied = nextPhase.dependencies.every(depId => {
        const depPhase = workflow.phases.get(depId);
        return depPhase?.status === PhaseStatus.COMPLETED || depPhase?.status === PhaseStatus.SKIPPED;
      });

      if (depsSatisfied && nextPhase.status === PhaseStatus.PENDING) {
        workflow.currentPhaseId = nextPhaseId;
        nextPhase.status = PhaseStatus.IN_PROGRESS;
        nextPhase.startedAt = new Date();
        this.emit('phase:started', workflowId, nextPhase);
        return;
      }
    }

    // No more phases - workflow complete
    await this.completeWorkflow(workflowId);
  }

  /**
   * Complete a workflow
   */
  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) return;

    workflow.status = WorkflowStatus.COMPLETED;
    workflow.currentPhaseId = undefined;
    workflow.metadata.completedAt = new Date();
    workflow.metadata.updatedAt = new Date();

    this.isDirty = true;
    this.emit('workflow:completed', workflow);
    await this.saveWorkflow(workflowId);
  }

  /**
   * Fail a workflow or phase
   */
  async failPhase(
    workflowId: string,
    phaseId: string,
    error: Error | string
  ): Promise<void> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const phase = workflow.phases.get(phaseId);
    if (!phase) {
      throw new Error(`Phase not found: ${phaseId}`);
    }

    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    phase.status = PhaseStatus.FAILED;
    phase.error = errorMessage;
    phase.retryCount++;

    workflow.errors.push({
      phaseId,
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date()
    });

    // Check if we can retry
    if (phase.retryCount < phase.maxRetries) {
      this.emit('phase:retry', workflowId, phase, error);
      phase.status = PhaseStatus.PENDING;
      phase.startedAt = undefined;
    } else {
      workflow.status = WorkflowStatus.FAILED;
      this.emit('workflow:failed', workflow);
    }

    workflow.metadata.updatedAt = new Date();
    this.isDirty = true;
    await this.saveWorkflow(workflowId);
  }

  /**
   * Get workflow state
   */
  getWorkflow(workflowId: string): WorkflowState | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get current phase of a workflow
   */
  getCurrentPhase(workflowId: string): WorkflowPhase | undefined {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow || !workflow.currentPhaseId) return undefined;
    return workflow.phases.get(workflow.currentPhaseId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): WorkflowState[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Query workflows
   */
  queryWorkflows(query: WorkflowQuery): WorkflowState[] {
    let results = this.getAllWorkflows();

    if (query.status) {
      results = results.filter(w => w.status === query.status);
    }

    if (query.tags) {
      results = results.filter(w => 
        query.tags!.some(tag => w.metadata.tags?.includes(tag))
      );
    }

    if (query.createdAfter) {
      results = results.filter(w => w.metadata.createdAt >= query.createdAfter!);
    }

    if (query.createdBefore) {
      results = results.filter(w => w.metadata.createdAt <= query.createdBefore!);
    }

    if (query.createdBy) {
      results = results.filter(w => w.metadata.createdBy === query.createdBy);
    }

    // Sort by creation date (newest first)
    results.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime());

    const offset = query.offset || 0;
    const limit = query.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get workflow snapshot (lightweight summary)
   */
  getSnapshot(workflowId: string): WorkflowSnapshot | undefined {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) return undefined;

    const completedPhases = Array.from(workflow.phases.values())
      .filter(p => p.status === PhaseStatus.COMPLETED || p.status === PhaseStatus.SKIPPED).length;
    
    const progress = workflow.phases.size > 0 
      ? Math.round((completedPhases / workflow.phases.size) * 100)
      : 0;

    const currentPhase = workflow.currentPhaseId 
      ? workflow.phases.get(workflow.currentPhaseId)?.name
      : undefined;

    const duration = workflow.metadata.completedAt && workflow.metadata.startedAt
      ? workflow.metadata.completedAt.getTime() - workflow.metadata.startedAt.getTime()
      : workflow.metadata.startedAt
        ? Date.now() - workflow.metadata.startedAt.getTime()
        : undefined;

    return {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      currentPhase,
      progress,
      createdAt: workflow.metadata.createdAt,
      updatedAt: workflow.metadata.updatedAt,
      duration
    };
  }

  /**
   * Pause a workflow
   */
  async pauseWorkflow(workflowId: string): Promise<WorkflowState> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== WorkflowStatus.RUNNING) {
      throw new Error(`Cannot pause workflow with status: ${workflow.status}`);
    }

    workflow.status = WorkflowStatus.PAUSED;
    workflow.metadata.updatedAt = new Date();
    this.isDirty = true;

    this.emit('workflow:paused', workflow);
    await this.saveWorkflow(workflowId);

    return workflow;
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(workflowId: string): Promise<WorkflowState> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== WorkflowStatus.PAUSED) {
      throw new Error(`Cannot resume workflow with status: ${workflow.status}`);
    }

    workflow.status = WorkflowStatus.RUNNING;
    workflow.metadata.updatedAt = new Date();
    this.isDirty = true;

    this.emit('workflow:resumed', workflow);
    await this.saveWorkflow(workflowId);

    return workflow;
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string, reason?: string): Promise<WorkflowState> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status === WorkflowStatus.COMPLETED || 
        workflow.status === WorkflowStatus.FAILED ||
        workflow.status === WorkflowStatus.ARCHIVED) {
      throw new Error(`Cannot cancel workflow with status: ${workflow.status}`);
    }

    workflow.status = WorkflowStatus.CANCELLED;
    workflow.metadata.updatedAt = new Date();
    
    if (reason) {
      workflow.errors.push({
        message: `Cancelled: ${reason}`,
        timestamp: new Date()
      });
    }

    this.isDirty = true;
    this.emit('workflow:cancelled', workflow);
    await this.saveWorkflow(workflowId);

    return workflow;
  }

  /**
   * Archive a completed workflow
   */
  async archiveWorkflow(workflowId: string): Promise<void> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== WorkflowStatus.COMPLETED && 
        workflow.status !== WorkflowStatus.FAILED &&
        workflow.status !== WorkflowStatus.CANCELLED) {
      throw new Error(`Cannot archive workflow with status: ${workflow.status}`);
    }

    workflow.status = WorkflowStatus.ARCHIVED;
    workflow.metadata.updatedAt = new Date();
    this.isDirty = true;

    this.emit('workflow:archived', workflow);
    await this.saveWorkflow(workflowId);

    // Move to archive directory
    const archiveDir = path.join(this.config.storagePath, 'archive');
    await fs.mkdir(archiveDir, { recursive: true });
    
    const archivePath = path.join(archiveDir, `${workflowId}.json`);
    const activePath = path.join(this.config.storagePath, `${workflowId}.json`);
    
    await fs.writeFile(archivePath, JSON.stringify(serializeWorkflow(workflow), null, 2));
    await fs.unlink(activePath).catch(() => {});

    this.workflows.delete(workflowId);
    await this.cleanupArchives();
  }

  /**
   * Delete a workflow permanently
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    this.workflows.delete(workflowId);
    this.isDirty = true;

    const filePath = path.join(this.config.storagePath, `${workflowId}.json`);
    await fs.unlink(filePath).catch(() => {});

    this.emit('workflow:deleted', workflowId);
  }

  /**
   * Save a workflow to storage
   */
  async saveWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    await fs.mkdir(this.config.storagePath, { recursive: true });
    
    const filePath = path.join(this.config.storagePath, `${workflowId}.json`);
    const data = JSON.stringify(serializeWorkflow(workflow), null, 2);
    
    await fs.writeFile(filePath, data, 'utf-8');
  }

  /**
   * Load all workflows from storage
   */
  async loadWorkflows(): Promise<void> {
    try {
      await fs.mkdir(this.config.storagePath, { recursive: true });
      const files = await fs.readdir(this.config.storagePath);
      
      for (const file of files) {
        if (!file.endsWith('.json') || file.startsWith('.')) continue;
        
        const filePath = path.join(this.config.storagePath, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) continue;

        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(data);
          const workflow = deserializeWorkflow(parsed);
          
          if (workflow.status !== WorkflowStatus.ARCHIVED) {
            this.workflows.set(workflow.id, workflow);
          }
        } catch (err) {
          this.emit('error', new Error(`Failed to load workflow from ${file}: ${err}`));
        }
      }

      this.emit('workflows:loaded', this.workflows.size);
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Save all workflows
   */
  async saveAll(): Promise<void> {
    await fs.mkdir(this.config.storagePath, { recursive: true });
    
    for (const [id, workflow] of this.workflows) {
      await this.saveWorkflow(id);
    }
    
    this.isDirty = false;
    this.emit('workflows:saved', this.workflows.size);
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.saveTimer = setInterval(async () => {
      if (this.isDirty) {
        await this.saveAll();
      }
    }, this.config.saveIntervalMs);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }
  }

  /**
   * Clean up old archives
   */
  private async cleanupArchives(): Promise<void> {
    const archiveDir = path.join(this.config.storagePath, 'archive');
    
    try {
      const files = await fs.readdir(archiveDir);
      const maxArchives = this.config.maxArchivedWorkflows || 100;
      
      if (files.length <= maxArchives) return;

      // Sort by modification time (oldest first)
      const fileStats = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => ({
            name: f,
            stat: await fs.stat(path.join(archiveDir, f))
          }))
      );

      fileStats.sort((a, b) => a.stat.mtime.getTime() - b.stat.mtime.getTime());

      // Delete oldest files
      const toDelete = fileStats.slice(0, fileStats.length - maxArchives);
      for (const file of toDelete) {
        await fs.unlink(path.join(archiveDir, file.name));
      }
    } catch (err) {
      // Archive directory might not exist
    }
  }

  /**
   * Topological sort for phase ordering
   */
  private topologicalSort(phases: WorkflowDefinition['phases']): WorkflowDefinition['phases'] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: WorkflowDefinition['phases'] = [];
    const phaseMap = new Map(phases.map(p => [p.id, p]));

    const visit = (phase: typeof phases[0]) => {
      if (temp.has(phase.id)) {
        throw new Error(`Circular dependency detected at phase: ${phase.id}`);
      }
      if (visited.has(phase.id)) return;

      temp.add(phase.id);
      
      for (const depId of phase.dependencies || []) {
        const dep = phaseMap.get(depId);
        if (dep) visit(dep);
      }

      temp.delete(phase.id);
      visited.add(phase.id);
      result.push(phase);
    };

    for (const phase of phases) {
      if (!visited.has(phase.id)) {
        visit(phase);
      }
    }

    return result;
  }

  /**
   * Validate phase status transition
   */
  private validatePhaseTransition(phase: WorkflowPhase, newStatus: PhaseStatus): void {
    const validTransitions: Record<PhaseStatus, PhaseStatus[]> = {
      [PhaseStatus.PENDING]: [PhaseStatus.IN_PROGRESS, PhaseStatus.SKIPPED],
      [PhaseStatus.IN_PROGRESS]: [PhaseStatus.COMPLETED, PhaseStatus.FAILED],
      [PhaseStatus.COMPLETED]: [],
      [PhaseStatus.FAILED]: [PhaseStatus.IN_PROGRESS], // For retries
      [PhaseStatus.SKIPPED]: []
    };

    if (!validTransitions[phase.status].includes(newStatus)) {
      throw new Error(
        `Invalid phase transition from ${phase.status} to ${newStatus}`
      );
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<WorkflowStatus, number>;
    dirty: boolean;
  } {
    const byStatus = {} as Record<WorkflowStatus, number>;
    
    for (const status of Object.values(WorkflowStatus)) {
      byStatus[status] = 0;
    }

    for (const workflow of this.workflows.values()) {
      byStatus[workflow.status]++;
    }

    return {
      total: this.workflows.size,
      byStatus,
      dirty: this.isDirty
    };
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.stopAutoSave();
    if (this.isDirty) {
      await this.saveAll();
    }
    this.removeAllListeners();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let defaultStateManager: StateManager | null = null;

export function getDefaultStateManager(config?: Partial<StateManagerConfig>): StateManager {
  if (!defaultStateManager) {
    defaultStateManager = new StateManager({
      storagePath: process.env.WORKFLOW_STORAGE_PATH || './workflows',
      ...config
    });
  }
  return defaultStateManager;
}

export function createStateManager(config: StateManagerConfig): StateManager {
  return new StateManager(config);
}

export default {
  StateManager,
  WorkflowStatus,
  PhaseStatus,
  getDefaultStateManager,
  createStateManager
};
