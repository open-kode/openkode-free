/**
 * CheckpointManager — snapshot files + git state at workflow phase boundaries.
 * RollbackEngine — restore a prior checkpoint.
 *
 * Checkpoints are stored in {workspaceRoot}/.openkode/checkpoints/{id}.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { EventEmitter } from 'events';
import { Checkpoint } from '../types';

const CHECKPOINT_DIR = '.openkode/checkpoints';
const MAX_FILE_SIZE = 512 * 1024; // 512 KB — skip larger files

export class CheckpointManager extends EventEmitter {
  private readonly workspaceRoot: string;
  private readonly checkpointDir: string;

  constructor(workspaceRoot: string) {
    super();
    this.workspaceRoot = workspaceRoot;
    this.checkpointDir = path.join(workspaceRoot, CHECKPOINT_DIR);
  }

  /**
   * Create a checkpoint capturing the current state of the given files.
   * If no files are specified, scans for all tracked git files.
   */
  async createCheckpoint(
    workflowId: string,
    label: string,
    phaseIndex: number,
    files?: string[]
  ): Promise<Checkpoint> {
    await fs.mkdir(this.checkpointDir, { recursive: true });

    const filesToSnap = files ?? this.getTrackedFiles();
    const fileSnapshots: Record<string, string> = {};

    for (const rel of filesToSnap) {
      const abs = path.join(this.workspaceRoot, rel);
      try {
        const stat = await fs.stat(abs);
        if (stat.size <= MAX_FILE_SIZE) {
          fileSnapshots[rel] = await fs.readFile(abs, 'utf-8');
        }
      } catch { /* file doesn't exist — skip */ }
    }

    const checkpoint: Checkpoint = {
      id: `ckpt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workflowId,
      label,
      createdAt: Date.now(),
      gitHead: this.getGitHead(),
      fileSnapshots,
      phaseIndex,
    };

    const filePath = path.join(this.checkpointDir, `${checkpoint.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');

    this.emit('checkpointCreated', checkpoint);
    return checkpoint;
  }

  /** List all checkpoints for a workflow, newest first. */
  async listCheckpoints(workflowId?: string): Promise<Checkpoint[]> {
    try {
      const entries = await fs.readdir(this.checkpointDir);
      const checkpoints: Checkpoint[] = [];

      for (const entry of entries.filter(e => e.endsWith('.json'))) {
        try {
          const raw = await fs.readFile(path.join(this.checkpointDir, entry), 'utf-8');
          const ckpt = JSON.parse(raw) as Checkpoint;
          if (!workflowId || ckpt.workflowId === workflowId) {
            checkpoints.push(ckpt);
          }
        } catch { /* corrupt file — skip */ }
      }

      return checkpoints.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }

  /** Load a single checkpoint by ID. */
  async getCheckpoint(id: string): Promise<Checkpoint | null> {
    try {
      const raw = await fs.readFile(path.join(this.checkpointDir, `${id}.json`), 'utf-8');
      return JSON.parse(raw) as Checkpoint;
    } catch {
      return null;
    }
  }

  /**
   * Preview what will be discarded if we roll back to this checkpoint.
   * Returns a map of relative path → { before: string (checkpoint), after: string (current) }
   */
  async previewRollback(
    checkpointId: string
  ): Promise<Array<{ file: string; checkpoint: string; current: string }>> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    if (!checkpoint) { throw new Error(`Checkpoint ${checkpointId} not found`); }

    const diffs: Array<{ file: string; checkpoint: string; current: string }> = [];

    for (const [rel, snapshotContent] of Object.entries(checkpoint.fileSnapshots)) {
      const abs = path.join(this.workspaceRoot, rel);
      let currentContent = '';
      try { currentContent = await fs.readFile(abs, 'utf-8'); } catch { /* file deleted */ }
      if (currentContent !== snapshotContent) {
        diffs.push({ file: rel, checkpoint: snapshotContent, current: currentContent });
      }
    }

    return diffs;
  }

  private getTrackedFiles(): string[] {
    try {
      const output = execSync('git ls-files', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        timeout: 5000,
      });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private getGitHead(): string | undefined {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
    } catch {
      return undefined;
    }
  }
}

export class RollbackEngine {
  private readonly workspaceRoot: string;
  private readonly checkpointManager: CheckpointManager;

  constructor(workspaceRoot: string, checkpointManager: CheckpointManager) {
    this.workspaceRoot = workspaceRoot;
    this.checkpointManager = checkpointManager;
  }

  /**
   * Restore all snapshotted files from a checkpoint.
   * Creates an auto-checkpoint of the current state before rolling back.
   */
  async rollbackTo(checkpointId: string, workflowId: string, phaseIndex: number): Promise<void> {
    const checkpoint = await this.checkpointManager.getCheckpoint(checkpointId);
    if (!checkpoint) { throw new Error(`Checkpoint ${checkpointId} not found`); }

    // Auto-save current state before rollback
    const files = Object.keys(checkpoint.fileSnapshots);
    await this.checkpointManager.createCheckpoint(
      workflowId,
      `pre-rollback (before restoring ${checkpoint.label})`,
      phaseIndex,
      files
    );

    // Restore files
    for (const [rel, content] of Object.entries(checkpoint.fileSnapshots)) {
      const abs = path.join(this.workspaceRoot, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, 'utf-8');
    }
  }
}
