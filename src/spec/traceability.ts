/**
 * TraceabilityEngine
 *
 * Links plan tasks (requirement IDs) to implementation evidence.
 * Persists TraceLinks in {workspaceRoot}/.openkode/tracelinks.json.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TraceLink, CoverageStatus } from '../types';

export class TraceabilityEngine {
  private readonly storePath: string;
  private cache: TraceLink[] | null = null;

  constructor(workspaceRoot: string) {
    this.storePath = path.join(workspaceRoot, '.openkode', 'tracelinks.json');
  }

  /** Upsert a trace link (matched by id). */
  async saveTraceLink(link: TraceLink): Promise<void> {
    const links = await this.load();
    const idx = links.findIndex(l => l.id === link.id);
    if (idx >= 0) {
      links[idx] = link;
    } else {
      links.push(link);
    }
    this.cache = links;
    await this.flush(links);
  }

  /** Get all links, optionally filtered by specId. */
  async getTraceLinks(specId?: string): Promise<TraceLink[]> {
    const links = await this.load();
    return specId ? links.filter(l => l.specId === specId) : links;
  }

  /** Get coverage status for a single requirementId (task id). */
  async getTaskCoverage(requirementId: string): Promise<CoverageStatus | null> {
    const links = await this.load();
    const link = links.find(l => l.requirementId === requirementId);
    return link?.status ?? null;
  }

  /**
   * Return a map of { requirementId → CoverageStatus } for the supplied IDs.
   * IDs with no trace link are omitted from the map.
   */
  async computeCoverageMap(requirementIds: string[]): Promise<Record<string, CoverageStatus>> {
    const links = await this.load();
    const map: Record<string, CoverageStatus> = {};
    for (const id of requirementIds) {
      const link = links.find(l => l.requirementId === id);
      if (link) { map[id] = link.status; }
    }
    return map;
  }

  /**
   * Simple heuristic: test files present → covered, implementation files only → partial, none → missing.
   * Use this when you have file lists but no LLM verification.
   */
  inferCoverage(changedFiles: string[], testFiles: string[]): CoverageStatus {
    if (testFiles.length > 0) { return 'covered'; }
    if (changedFiles.length > 0) { return 'partial'; }
    return 'missing';
  }

  /** Build a TraceLink from task metadata and save it. */
  async recordTaskEvidence(
    taskId: string,
    specId: string,
    taskTitle: string,
    changedFiles: string[],
    testFiles: string[],
    evidence?: string
  ): Promise<TraceLink> {
    const status = this.inferCoverage(changedFiles, testFiles);
    const link: TraceLink = {
      id: `tl-${taskId}`,
      specId,
      requirementId: taskId,
      requirementText: taskTitle,
      changedFiles,
      testFiles,
      status,
      verifiedAt: Date.now(),
      evidence,
    };
    await this.saveTraceLink(link);
    return link;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async load(): Promise<TraceLink[]> {
    if (this.cache) { return this.cache; }
    try {
      const raw = await fs.readFile(this.storePath, 'utf-8');
      this.cache = JSON.parse(raw) as TraceLink[];
      return this.cache;
    } catch {
      return [];
    }
  }

  private async flush(links: TraceLink[]): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    await fs.writeFile(this.storePath, JSON.stringify(links, null, 2), 'utf-8');
  }
}
