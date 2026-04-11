/**
 * OpenKode Spec-Driven Development Pipeline
 * =========================================
 * Phase 5: Spec Storage & Retrieval
 * 
 * File-based spec storage in .openkode/ directory
 * Spec indexing and search
 * Export/import functionality
 */

import { CapturedIntent, PRD } from './intentCapture';
import { Epic, Phase, Ticket, Task } from './decomposer';
import { TacticalPlan } from './tacticalPlanner';
import { SpecVersion } from './specValidator';
import { TraceabilityEngine } from './traceability';
import { TraceLink, CoverageStatus } from '../types';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Base directory for spec storage */
  baseDir: string;
  
  /** Spec subdirectory */
  specDir: string;
  
  /** Index file name */
  indexFile: string;
  
  /** Format for spec files */
  format: 'json' | 'yaml';
  
  /** Enable compression */
  compress: boolean;
  
  /** Enable encryption */
  encrypt: boolean;
  
  /** Max versions to keep per spec */
  maxVersions: number;
}

/**
 * Spec index entry
 */
export interface SpecIndexEntry {
  /** Spec ID */
  id: string;
  
  /** Spec type */
  type: SpecType;
  
  /** Spec title/name */
  title: string;
  
  /** File path */
  path: string;
  
  /** Creation timestamp */
  createdAt: string;
  
  /** Last updated */
  updatedAt: string;
  
  /** Version */
  version: string;
  
  /** Tags */
  tags: string[];
  
  /** Related spec IDs */
  relatedSpecs: string[];
  
  /** Status */
  status: SpecStatus;
  
  /** Searchable content summary */
  summary: string;
}

/**
 * Spec types
 */
export type SpecType = 'intent' | 'prd' | 'epic' | 'phase' | 'ticket' | 'task' | 'tactical' | 'version';

/**
 * Spec status
 */
export type SpecStatus = 'draft' | 'active' | 'archived' | 'deprecated';

/**
 * Search query
 */
export interface SpecSearchQuery {
  /** Text to search */
  text?: string;
  
  /** Filter by type */
  type?: SpecType | SpecType[];
  
  /** Filter by status */
  status?: SpecStatus | SpecStatus[];
  
  /** Filter by tags */
  tags?: string[];
  
  /** Date range - from */
  fromDate?: string;
  
  /** Date range - to */
  toDate?: string;
  
  /** Filter by related spec */
  relatedTo?: string;
  
  /** Max results */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
}

/**
 * Search result
 */
export interface SpecSearchResult {
  /** Matching specs */
  specs: SpecIndexEntry[];
  
  /** Total matches */
  total: number;
  
  /** Query executed */
  query: SpecSearchQuery;
  
  /** Search duration in ms */
  duration: number;
}

/**
 * Export format
 */
export interface SpecExport {
  /** Export version */
  version: string;
  
  /** Export timestamp */
  exportedAt: string;
  
  /** Exported specs */
  specs: ExportedSpec[];
  
  /** Metadata */
  metadata: {
    count: number;
    types: Record<string, number>;
    dateRange: { from: string; to: string };
  };
}

/**
 * Exported spec
 */
export interface ExportedSpec {
  /** Spec type */
  type: SpecType;
  
  /** Spec content */
  content: unknown;
  
  /** Versions if included */
  versions?: SpecVersion[];
}

/**
 * Import result
 */
export interface SpecImportResult {
  /** Success flag */
  success: boolean;
  
  /** Number imported */
  imported: number;
  
  /** Number skipped (duplicates) */
  skipped: number;
  
  /** Number failed */
  failed: number;
  
  /** Errors */
  errors: SpecImportError[];
  
  /** Imported spec IDs */
  importedIds: string[];
}

/**
 * Import error
 */
export interface SpecImportError {
  /** Spec identifier */
  specId: string;
  
  /** Error message */
  error: string;
  
  /** Error code */
  code: string;
}

/**
 * Storage stats
 */
export interface StorageStats {
  /** Total specs */
  totalSpecs: number;
  
  /** Specs by type */
  byType: Record<SpecType, number>;
  
  /** Specs by status */
  byStatus: Record<SpecStatus, number>;
  
  /** Total storage size in bytes */
  totalSize: number;
  
  /** Average spec size */
  averageSize: number;
  
  /** Index size */
  indexSize: number;
  
  /** Last updated */
  lastUpdated: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DefaultStorageConfig: StorageConfig = {
  baseDir: '.openkode',
  specDir: 'specs',
  indexFile: 'index.json',
  format: 'json',
  compress: false,
  encrypt: false,
  maxVersions: 10
};

// ============================================================================
// SPEC STORE CLASS
// ============================================================================

export class SpecStore {
  private config: StorageConfig;
  private index: Map<string, SpecIndexEntry> = new Map();
  private memoryCache: Map<string, unknown> = new Map();
  private initialized = false;
  private traceEngine: TraceabilityEngine;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DefaultStorageConfig, ...config };
    this.traceEngine = new TraceabilityEngine(this.config.baseDir);
  }

  /**
   * Initialize the store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // In a real implementation, this would:
    // 1. Create directories if they don't exist
    // 2. Load existing index
    // 3. Validate storage integrity

    // For now, just mark as initialized
    this.initialized = true;
  }

  /**
   * Get full storage path
   */
  private getStoragePath(): string {
    return `${this.config.baseDir}/${this.config.specDir}`;
  }

  /**
   * Get file path for a spec
   */
  private getSpecFilePath(id: string, type: SpecType): string {
    const extension = this.config.format === 'yaml' ? 'yaml' : 'json';
    return `${this.getStoragePath()}/${type}/${id}.${extension}`;
  }

  /**
   * Get index file path
   */
  private getIndexPath(): string {
    return `${this.config.baseDir}/${this.config.indexFile}`;
  }

  /**
   * Save a spec to storage
   */
  async saveSpec<T>(
    spec: T,
    type: SpecType,
    options: {
      id?: string;
      title?: string;
      tags?: string[];
      relatedSpecs?: string[];
      status?: SpecStatus;
    } = {}
  ): Promise<SpecIndexEntry> {
    await this.initialize();

    // Extract or generate ID
    const id = options.id || this.extractId(spec) || this.generateId();
    
    // Extract title
    const title = options.title || this.extractTitle(spec) || 'Untitled';

    // Create index entry
    const now = new Date().toISOString();
    const existing = this.index.get(id);
    
    const entry: SpecIndexEntry = {
      id,
      type,
      title,
      path: this.getSpecFilePath(id, type),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      version: this.incrementVersion(existing?.version),
      tags: options.tags || existing?.tags || [],
      relatedSpecs: options.relatedSpecs || existing?.relatedSpecs || [],
      status: options.status || existing?.status || 'draft',
      summary: this.generateSummary(spec)
    };

    // Store in memory cache
    this.memoryCache.set(id, spec);
    this.index.set(id, entry);

    return entry;
  }

  /**
   * Extract ID from spec object
   */
  private extractId(spec: unknown): string | undefined {
    if (spec && typeof spec === 'object') {
      return (spec as Record<string, unknown>).id as string;
    }
    return undefined;
  }

  /**
   * Extract title from spec object
   */
  private extractTitle(spec: unknown): string | undefined {
    if (spec && typeof spec === 'object') {
      const obj = spec as Record<string, unknown>;
      return (obj.title || obj.name || obj.description) as string;
    }
    return undefined;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Increment version number
   */
  private incrementVersion(currentVersion?: string): string {
    if (!currentVersion) return '1.0.0';
    
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  /**
   * Generate summary for search indexing
   */
  private generateSummary(spec: unknown): string {
    if (!spec || typeof spec !== 'object') return '';
    
    const obj = spec as Record<string, unknown>;
    const parts: string[] = [];
    
    // Include key fields in summary
    if (obj.description) parts.push(String(obj.description));
    if (obj.requirements && Array.isArray(obj.requirements)) {
      const reqStrings = obj.requirements.map((r: unknown) => 
        typeof r === 'object' && r ? String((r as Record<string, unknown>).description || '') : ''
      ).filter((s: string) => s);
      parts.push(...reqStrings);
    }
    if (obj.title) parts.unshift(String(obj.title));
    
    return parts.join(' ').substring(0, 500);
  }

  /**
   * Get a spec by ID
   */
  async getSpec<T>(id: string): Promise<T | undefined> {
    await this.initialize();

    // Check memory cache first
    const cached = this.memoryCache.get(id);
    if (cached) {
      return cached as T;
    }

    // Get from index
    const entry = this.index.get(id);
    if (!entry) {
      return undefined;
    }

    // In a real implementation, this would read from file
    // For now, return undefined if not in cache
    return undefined;
  }

  /**
   * Get spec index entry
   */
  async getIndexEntry(id: string): Promise<SpecIndexEntry | undefined> {
    await this.initialize();
    return this.index.get(id);
  }

  /**
   * Update a spec
   */
  async updateSpec<T>(
    id: string,
    updates: Partial<T>,
    options: {
      tags?: string[];
      relatedSpecs?: string[];
      status?: SpecStatus;
    } = {}
  ): Promise<SpecIndexEntry | undefined> {
    await this.initialize();

    const existing = this.memoryCache.get(id);
    if (!existing) {
      return undefined;
    }

    // Merge updates
    const updated = { ...existing, ...updates };
    
    // Get existing entry
    const entry = this.index.get(id);
    if (!entry) {
      return undefined;
    }

    // Update entry
    const now = new Date().toISOString();
    const updatedEntry: SpecIndexEntry = {
      ...entry,
      updatedAt: now,
      version: this.incrementVersion(entry.version),
      tags: options.tags || entry.tags,
      relatedSpecs: options.relatedSpecs || entry.relatedSpecs,
      status: options.status || entry.status,
      summary: this.generateSummary(updated)
    };

    // Update storage
    this.memoryCache.set(id, updated);
    this.index.set(id, updatedEntry);

    return updatedEntry;
  }

  /**
   * Delete a spec
   */
  async deleteSpec(id: string): Promise<boolean> {
    await this.initialize();

    const existed = this.index.has(id);
    
    this.index.delete(id);
    this.memoryCache.delete(id);

    return existed;
  }

  /**
   * Search specs
   */
  async search(query: SpecSearchQuery): Promise<SpecSearchResult> {
    await this.initialize();

    const startTime = Date.now();
    
    let results = Array.from(this.index.values());

    // Filter by text
    if (query.text) {
      const searchText = query.text.toLowerCase();
      results = results.filter(entry =>
        entry.title.toLowerCase().includes(searchText) ||
        entry.summary.toLowerCase().includes(searchText) ||
        entry.tags.some(tag => tag.toLowerCase().includes(searchText))
      );
    }

    // Filter by type
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      results = results.filter(entry => types.includes(entry.type));
    }

    // Filter by status
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      results = results.filter(entry => statuses.includes(entry.status));
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(entry =>
        query.tags!.some(tag => entry.tags.includes(tag))
      );
    }

    // Filter by date range
    if (query.fromDate) {
      results = results.filter(entry => entry.createdAt >= query.fromDate!);
    }
    if (query.toDate) {
      results = results.filter(entry => entry.createdAt <= query.toDate!);
    }

    // Filter by related spec
    if (query.relatedTo) {
      results = results.filter(entry => entry.relatedSpecs.includes(query.relatedTo!));
    }

    const total = results.length;

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    results = results.slice(offset, offset + limit);

    const duration = Date.now() - startTime;

    return {
      specs: results,
      total,
      query,
      duration
    };
  }

  /**
   * List all specs
   */
  async listSpecs(
    options: {
      type?: SpecType;
      status?: SpecStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<SpecIndexEntry[]> {
    await this.initialize();

    let results = Array.from(this.index.values());

    if (options.type) {
      results = results.filter(e => e.type === options.type);
    }

    if (options.status) {
      results = results.filter(e => e.status === options.status);
    }

    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Export specs
   */
  async exportSpecs(
    options: {
      ids?: string[];
      types?: SpecType[];
      includeVersions?: boolean;
      fromDate?: string;
      toDate?: string;
    } = {}
  ): Promise<SpecExport> {
    await this.initialize();

    let entries = Array.from(this.index.values());

    // Filter by IDs
    if (options.ids) {
      entries = entries.filter(e => options.ids!.includes(e.id));
    }

    // Filter by types
    if (options.types) {
      entries = entries.filter(e => options.types!.includes(e.type));
    }

    // Filter by date range
    if (options.fromDate) {
      entries = entries.filter(e => e.createdAt >= options.fromDate!);
    }
    if (options.toDate) {
      entries = entries.filter(e => e.createdAt <= options.toDate!);
    }

    // Build export
    const specs: ExportedSpec[] = [];
    for (const entry of entries) {
      const content = this.memoryCache.get(entry.id);
      if (content) {
        specs.push({
          type: entry.type,
          content
        });
      }
    }

    // Calculate type counts
    const types: Record<string, number> = {};
    for (const spec of specs) {
      types[spec.type] = (types[spec.type] || 0) + 1;
    }

    // Calculate date range
    const dates = entries.map(e => e.createdAt).sort();

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      specs,
      metadata: {
        count: specs.length,
        types,
        dateRange: {
          from: dates[0] || new Date().toISOString(),
          to: dates[dates.length - 1] || new Date().toISOString()
        }
      }
    };
  }

  /**
   * Import specs
   */
  async importSpecs(exportData: SpecExport, options: {
    skipExisting?: boolean;
    overwrite?: boolean;
  } = {}): Promise<SpecImportResult> {
    await this.initialize();

    const result: SpecImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      importedIds: []
    };

    for (const spec of exportData.specs) {
      try {
        const id = this.extractId(spec.content) || this.generateId();
        
        // Check if exists
        if (this.index.has(id)) {
          if (options.skipExisting) {
            result.skipped++;
            continue;
          }
          if (!options.overwrite) {
            result.errors.push({
              specId: id,
              error: 'Spec already exists',
              code: 'IMPORT-001'
            });
            result.failed++;
            continue;
          }
        }

        // Save spec
        await this.saveSpec(spec.content, spec.type, { id });
        result.imported++;
        result.importedIds.push(id);

      } catch (error) {
        result.failed++;
        result.errors.push({
          specId: 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'IMPORT-002'
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    await this.initialize();

    const entries = Array.from(this.index.values());
    
    // Calculate by type
    const byType: Record<string, number> = {};
    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }

    // Calculate by status
    const byStatus: Record<string, number> = {};
    for (const entry of entries) {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    }

    // Calculate sizes (approximate from memory)
    let totalSize = 0;
    for (const [id, spec] of this.memoryCache.entries()) {
      totalSize += JSON.stringify(spec).length * 2; // Approximate UTF-16 size
    }

    const indexSize = JSON.stringify(Array.from(this.index.values())).length * 2;

    return {
      totalSpecs: entries.length,
      byType: byType as Record<SpecType, number>,
      byStatus: byStatus as Record<SpecStatus, number>,
      totalSize,
      averageSize: entries.length > 0 ? totalSize / entries.length : 0,
      indexSize,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Archive old specs
   */
  async archiveOldSpecs(olderThanDays: number): Promise<number> {
    await this.initialize();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const cutoffStr = cutoff.toISOString();

    let archived = 0;
    
    for (const [id, entry] of this.index.entries()) {
      if (entry.status === 'draft' && entry.updatedAt < cutoffStr) {
        this.index.set(id, { ...entry, status: 'archived' });
        archived++;
      }
    }

    return archived;
  }

  /**
   * Get related specs
   */
  async getRelatedSpecs(id: string): Promise<SpecIndexEntry[]> {
    await this.initialize();

    const entry = this.index.get(id);
    if (!entry) {
      return [];
    }

    return entry.relatedSpecs
      .map(relatedId => this.index.get(relatedId))
      .filter((e): e is SpecIndexEntry => e !== undefined);
  }

  /**
   * Link specs together
   */
  async linkSpecs(id1: string, id2: string): Promise<boolean> {
    await this.initialize();

    const entry1 = this.index.get(id1);
    const entry2 = this.index.get(id2);

    if (!entry1 || !entry2) {
      return false;
    }

    // Add bidirectional link
    if (!entry1.relatedSpecs.includes(id2)) {
      entry1.relatedSpecs.push(id2);
    }
    if (!entry2.relatedSpecs.includes(id1)) {
      entry2.relatedSpecs.push(id1);
    }

    this.index.set(id1, entry1);
    this.index.set(id2, entry2);

    return true;
  }

  // ── Traceability ──────────────────────────────────────────────────────────

  /** Upsert a trace link for a task/requirement. */
  async saveTraceLink(link: TraceLink): Promise<void> {
    await this.traceEngine.saveTraceLink(link);
  }

  /** Return all trace links, optionally filtered by specId. */
  async getTraceLinks(specId?: string): Promise<TraceLink[]> {
    return this.traceEngine.getTraceLinks(specId);
  }

  /** Return a coverage map { requirementId → CoverageStatus } for the given IDs. */
  async getCoverageMap(requirementIds: string[]): Promise<Record<string, CoverageStatus>> {
    return this.traceEngine.computeCoverageMap(requirementIds);
  }

  /**
   * Clear all specs (use with caution)
   */
  async clear(): Promise<void> {
    await this.initialize();
    
    this.index.clear();
    this.memoryCache.clear();
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const specStore = new SpecStore();

// Default export
export default SpecStore;
