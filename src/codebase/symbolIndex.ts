/**
 * Symbol Index Module
 * 
 * Symbol indexing and cross-reference tracking for efficient symbol lookup
 * by name or location across the entire codebase.
 */

import * as path from 'path';
import { ASTParser, SymbolInfo, SourceLocation, ReferenceInfo } from './astParser';
import { FileDiscovery, FileInfo } from './fileDiscovery';

// ============================================================================
// Interfaces
// ============================================================================

export interface SymbolTable {
  symbols: Map<string, SymbolEntry[]>;
  locations: Map<string, SymbolEntry>;
  references: Map<string, ReferenceEntry[]>;
  files: Map<string, FileSymbols>;
  metadata: SymbolTableMetadata;
}

export interface SymbolEntry {
  id: string;
  name: string;
  type: string;
  kind: string;
  location: SourceLocation;
  filePath: string;
  parent?: string;
  children: string[];
  modifiers: string[];
  documentation?: string;
  signature?: string;
  isExported: boolean;
  visibility: 'public' | 'private' | 'protected' | 'internal';
  crossReferences: CrossReference[];
}

export interface CrossReference {
  type: 'definition' | 'declaration' | 'reference' | 'implementation' | 'inheritance';
  targetSymbol: string;
  targetFile: string;
  targetLocation: SourceLocation;
  relationship: string;
}

export interface ReferenceEntry {
  symbolId: string;
  location: SourceLocation;
  filePath: string;
  context: string;
  referenceType: 'read' | 'write' | 'call' | 'import' | 'inheritance';
}

export interface FileSymbols {
  filePath: string;
  symbols: SymbolEntry[];
  imports: string[];
  exports: string[];
  lastIndexed: Date;
}

export interface SymbolTableMetadata {
  totalSymbols: number;
  totalFiles: number;
  totalReferences: number;
  languages: string[];
  indexedAt: Date;
  version: string;
}

export interface SymbolLookupOptions {
  includePrivate?: boolean;
  includeTests?: boolean;
  filePattern?: string;
  symbolType?: string;
}

export interface ReferenceLookupOptions {
  includeTransitive?: boolean;
  maxDepth?: number;
  includeExternal?: boolean;
}

export interface SymbolSearchResult {
  symbol: SymbolEntry;
  score: number;
  matches: string[];
}

export interface RenameRequest {
  symbolId: string;
  newName: string;
  filePath: string;
  location: SourceLocation;
}

export interface RenameResult {
  success: boolean;
  changes: FileChange[];
  errors: string[];
}

export interface FileChange {
  filePath: string;
  edits: TextEdit[];
}

export interface TextEdit {
  range: SourceLocation;
  newText: string;
}

// ============================================================================
// Symbol Index Class
// ============================================================================

export class SymbolIndex {
  private table: SymbolTable;
  private astParser: ASTParser;
  private fileDiscovery: FileDiscovery;
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.astParser = new ASTParser();
    this.fileDiscovery = new FileDiscovery({ rootPath });
    
    this.table = {
      symbols: new Map(),
      locations: new Map(),
      references: new Map(),
      files: new Map(),
      metadata: {
        totalSymbols: 0,
        totalFiles: 0,
        totalReferences: 0,
        languages: [],
        indexedAt: new Date(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Index all symbols in the codebase
   */
  async indexSymbols(): Promise<SymbolTable> {
    await this.astParser.initialize();

    // Discover files
    const discovered = await this.fileDiscovery.discoverFiles();
    
    // Index each file
    for (const file of discovered.files) {
      await this.indexFile(file);
    }

    // Build cross-references
    this.buildCrossReferences();

    // Update metadata
    this.updateMetadata();

    return this.table;
  }

  /**
   * Build the symbol index (alias for indexSymbols)
   */
  async build(rootPath?: string): Promise<SymbolTable> {
    if (rootPath) {
      this.rootPath = rootPath;
    }
    return this.indexSymbols();
  }

  /**
   * Find a symbol by its name
   */
  findSymbol(
    name: string, 
    options: SymbolLookupOptions = {}
  ): SymbolEntry[] {
    const results: SymbolEntry[] = [];
    const normalizedName = name.toLowerCase();

    // Exact match
    const exactMatches = this.table.symbols.get(normalizedName);
    if (exactMatches) {
      results.push(...this.filterSymbols(exactMatches, options));
    }

    // Fuzzy match
    for (const [symbolName, entries] of this.table.symbols) {
      if (symbolName.includes(normalizedName) || normalizedName.includes(symbolName)) {
        if (symbolName !== normalizedName) {
          results.push(...this.filterSymbols(entries, options));
        }
      }
    }

    return this.deduplicateSymbols(results);
  }

  /**
   * Find symbol by its location in a file
   */
  findSymbolAtLocation(
    filePath: string, 
    line: number, 
    column: number
  ): SymbolEntry | null {
    const locationKey = `${filePath}:${line}:${column}`;
    
    // Direct lookup
    const directMatch = this.table.locations.get(locationKey);
    if (directMatch) {
      return directMatch;
    }

    // Search within file symbols
    const fileSymbols = this.table.files.get(filePath);
    if (!fileSymbols) return null;

    // Find symbol that contains this location
    for (const symbol of fileSymbols.symbols) {
      if (this.locationContains(symbol.location, line, column)) {
        return symbol;
      }
    }

    return null;
  }

  /**
   * Get all references to a symbol
   */
  getReferences(
    symbolId: string, 
    options: ReferenceLookupOptions = {}
  ): ReferenceEntry[] {
    const directRefs = this.table.references.get(symbolId) || [];
    
    if (!options.includeTransitive) {
      return directRefs;
    }

    // Include transitive references
    const allRefs: ReferenceEntry[] = [...directRefs];
    const visited = new Set<string>([symbolId]);
    const queue: string[] = [symbolId];
    let depth = 0;

    while (queue.length > 0 && depth < (options.maxDepth || 5)) {
      const current = queue.shift()!;
      const refs = this.table.references.get(current) || [];

      for (const ref of refs) {
        if (!visited.has(ref.symbolId)) {
          visited.add(ref.symbolId);
          allRefs.push(ref);
          queue.push(ref.symbolId);
        }
      }

      depth++;
    }

    return allRefs;
  }

  /**
   * Get all symbols defined in a file
   */
  getFileSymbols(filePath: string): FileSymbols | null {
    return this.table.files.get(filePath) || null;
  }

  /**
   * Search for symbols with fuzzy matching
   */
  searchSymbols(
    query: string, 
    options: {
      limit?: number;
      includePrivate?: boolean;
      symbolTypes?: string[];
    } = {}
  ): SymbolSearchResult[] {
    const results: SymbolSearchResult[] = [];
    const normalizedQuery = query.toLowerCase();
    const queryParts = normalizedQuery.split(/[.\s]/);

    for (const [name, entries] of this.table.symbols) {
      for (const entry of entries) {
        // Filter by type if specified
        if (options.symbolTypes && !options.symbolTypes.includes(entry.type)) {
          continue;
        }

        // Filter private symbols
        if (!options.includePrivate && entry.visibility === 'private') {
          continue;
        }

        // Calculate match score
        const score = this.calculateMatchScore(normalizedQuery, queryParts, name, entry);
        
        if (score > 0) {
          results.push({
            symbol: entry,
            score,
            matches: this.getMatchedParts(normalizedQuery, name)
          });
        }
      }
    }

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 20);
  }

  /**
   * Get symbols that implement or extend a given symbol
   */
  getImplementations(symbolId: string): SymbolEntry[] {
    const symbol = this.findSymbolById(symbolId);
    if (!symbol) return [];

    const implementations: SymbolEntry[] = [];

    for (const ref of symbol.crossReferences) {
      if (ref.type === 'implementation' || ref.relationship === 'extends' || ref.relationship === 'implements') {
        const impl = this.findSymbolById(ref.targetSymbol);
        if (impl) {
          implementations.push(impl);
        }
      }
    }

    return implementations;
  }

  /**
   * Get the hierarchy of a symbol (parent classes, interfaces)
   */
  getHierarchy(symbolId: string): {
    parents: SymbolEntry[];
    children: SymbolEntry[];
    siblings: SymbolEntry[];
  } {
    const symbol = this.findSymbolById(symbolId);
    if (!symbol) {
      return { parents: [], children: [], siblings: [] };
    }

    const parents: SymbolEntry[] = [];
    const children: SymbolEntry[] = [];
    const siblings: SymbolEntry[] = [];

    // Find parents (inheritance)
    for (const ref of symbol.crossReferences) {
      if (ref.relationship === 'extends' || ref.relationship === 'implements') {
        const parent = this.findSymbolById(ref.targetSymbol);
        if (parent) {
          parents.push(parent);
        }
      }
    }

    // Find children (symbols that extend/implement this)
    for (const [_, entries] of this.table.symbols) {
      for (const entry of entries) {
        for (const ref of entry.crossReferences) {
          if (ref.targetSymbol === symbolId && 
              (ref.relationship === 'extends' || ref.relationship === 'implements')) {
            children.push(entry);
          }
        }
      }
    }

    // Find siblings (same parent)
    if (symbol.parent) {
      const parentEntry = this.findSymbolById(symbol.parent);
      if (parentEntry) {
        for (const childId of parentEntry.children) {
          if (childId !== symbolId) {
            const sibling = this.findSymbolById(childId);
            if (sibling) {
              siblings.push(sibling);
            }
          }
        }
      }
    }

    return { parents, children, siblings };
  }

  /**
   * Get all exported symbols
   */
  getExportedSymbols(): SymbolEntry[] {
    const exported: SymbolEntry[] = [];

    for (const entries of this.table.symbols.values()) {
      for (const entry of entries) {
        if (entry.isExported) {
          exported.push(entry);
        }
      }
    }

    return exported;
  }

  /**
   * Get symbols by type
   */
  getSymbolsByType(type: string): SymbolEntry[] {
    const results: SymbolEntry[] = [];

    for (const entries of this.table.symbols.values()) {
      for (const entry of entries) {
        if (entry.type === type) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * Get unused symbols (symbols with no references)
   */
  getUnusedSymbols(): SymbolEntry[] {
    const unused: SymbolEntry[] = [];

    for (const entries of this.table.symbols.values()) {
      for (const entry of entries) {
        const refs = this.table.references.get(entry.id) || [];
        if (refs.length === 0 && entry.isExported) {
          unused.push(entry);
        }
      }
    }

    return unused;
  }

  /**
   * Calculate rename locations for a symbol
   */
  calculateRename(request: RenameRequest): RenameResult {
    const symbol = this.findSymbolById(request.symbolId);
    if (!symbol) {
      return {
        success: false,
        changes: [],
        errors: ['Symbol not found']
      };
    }

    const changes: FileChange[] = [];
    const errors: string[] = [];
    const affectedFiles = new Set<string>();

    // Add the definition file
    affectedFiles.add(symbol.filePath);

    // Add files with references
    const refs = this.getReferences(symbol.id, { includeTransitive: true });
    for (const ref of refs) {
      affectedFiles.add(ref.filePath);
    }

    // Generate changes for each file
    for (const filePath of affectedFiles) {
      const fileSymbols = this.table.files.get(filePath);
      if (!fileSymbols) continue;

      const edits: TextEdit[] = [];

      // Find symbols in this file that need renaming
      for (const fileSymbol of fileSymbols.symbols) {
        if (fileSymbol.name === symbol.name || 
            fileSymbol.id === symbol.id ||
            this.isRelatedSymbol(fileSymbol, symbol)) {
          edits.push({
            range: fileSymbol.location,
            newText: request.newName
          });
        }
      }

      if (edits.length > 0) {
        changes.push({
          filePath,
          edits
        });
      }
    }

    return {
      success: errors.length === 0,
      changes,
      errors
    };
  }

  /**
   * Get symbol statistics
   */
  getStatistics(): {
    totalSymbols: number;
    byType: Record<string, number>;
    byVisibility: Record<string, number>;
    byLanguage: Record<string, number>;
    mostReferenced: SymbolEntry[];
    unusedCount: number;
  } {
    const byType: Record<string, number> = {};
    const byVisibility: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    const referenceCounts: Map<string, number> = new Map();

    for (const entries of this.table.symbols.values()) {
      for (const entry of entries) {
        byType[entry.type] = (byType[entry.type] || 0) + 1;
        byVisibility[entry.visibility] = (byVisibility[entry.visibility] || 0) + 1;
        
        const ext = path.extname(entry.filePath);
        byLanguage[ext] = (byLanguage[ext] || 0) + 1;

        const refCount = (this.table.references.get(entry.id) || []).length;
        referenceCounts.set(entry.id, refCount);
      }
    }

    // Get most referenced symbols
    const sortedRefs = Array.from(referenceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const mostReferenced = sortedRefs
      .map(([id]) => this.findSymbolById(id))
      .filter((s): s is SymbolEntry => s !== undefined);

    return {
      totalSymbols: this.table.metadata.totalSymbols,
      byType,
      byVisibility,
      byLanguage,
      mostReferenced,
      unusedCount: this.getUnusedSymbols().length
    };
  }

  /**
   * Export the symbol table
   */
  export(): SymbolTable {
    return this.table;
  }

  /**
   * Import a symbol table
   */
  import(table: SymbolTable): void {
    this.table = table;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.table.symbols.clear();
    this.table.locations.clear();
    this.table.references.clear();
    this.table.files.clear();
    this.table.metadata = {
      totalSymbols: 0,
      totalFiles: 0,
      totalReferences: 0,
      languages: [],
      indexedAt: new Date(),
      version: '1.0.0'
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async indexFile(file: FileInfo): Promise<void> {
    try {
      const parseResult = await this.astParser.parseFile(file.path);
      const symbols: SymbolEntry[] = [];

      for (const symbol of parseResult.symbols) {
        const entry = this.createSymbolEntry(symbol, file.path);
        symbols.push(entry);

        // Add to symbol table
        const normalizedName = entry.name.toLowerCase();
        if (!this.table.symbols.has(normalizedName)) {
          this.table.symbols.set(normalizedName, []);
        }
        this.table.symbols.get(normalizedName)!.push(entry);

        // Add to location map
        const locationKey = `${file.path}:${entry.location.startLine}:${entry.location.startColumn}`;
        this.table.locations.set(locationKey, entry);
      }

      // Store file symbols
      this.table.files.set(file.path, {
        filePath: file.path,
        symbols,
        imports: parseResult.imports.map(i => i.source),
        exports: parseResult.exports.map(e => e.name),
        lastIndexed: new Date()
      });
    } catch (error) {
      console.warn(`Failed to index symbols in ${file.path}:`, error);
    }
  }

  private createSymbolEntry(symbol: SymbolInfo, filePath: string): SymbolEntry {
    const id = `${filePath}#${symbol.name}@${symbol.location.startLine}`;

    return {
      id,
      name: symbol.name,
      type: symbol.type,
      kind: symbol.kind,
      location: symbol.location,
      filePath,
      parent: symbol.parent,
      children: symbol.children,
      modifiers: symbol.modifiers,
      documentation: symbol.documentation,
      signature: symbol.signature,
      isExported: symbol.isExported,
      visibility: symbol.visibility,
      crossReferences: []
    };
  }

  private buildCrossReferences(): void {
    // Build inheritance relationships
    for (const entries of this.table.symbols.values()) {
      for (const entry of entries) {
        if (entry.type === 'class' || entry.type === 'interface') {
          this.findInheritanceRelationships(entry);
        }
      }
    }

    // Build reference map
    for (const entries of this.table.symbols.values()) {
      for (const entry of entries) {
        this.findReferences(entry);
      }
    }
  }

  private findInheritanceRelationships(entry: SymbolEntry): void {
    if (!entry.signature) { return; }

    // Extract parent names from `extends Foo` and `implements Bar, Baz`
    const extendsMatch = entry.signature.match(/\bextends\s+([\w,\s<>]+?)(?:\s+implements|\s*\{|$)/);
    const implementsMatch = entry.signature.match(/\bimplements\s+([\w,\s<>]+?)(?:\s*\{|$)/);

    const parentNames: Array<{ name: string; rel: 'extends' | 'implements' }> = [];
    if (extendsMatch) {
      extendsMatch[1].split(',').forEach(n => {
        const name = n.trim().replace(/<.*>/, '').trim();
        if (name) { parentNames.push({ name, rel: 'extends' }); }
      });
    }
    if (implementsMatch) {
      implementsMatch[1].split(',').forEach(n => {
        const name = n.trim().replace(/<.*>/, '').trim();
        if (name) { parentNames.push({ name, rel: 'implements' }); }
      });
    }

    for (const { name, rel } of parentNames) {
      const targets = this.table.symbols.get(name) ?? this.table.symbols.get(name.toLowerCase());
      if (!targets || targets.length === 0) { continue; }
      const target = targets[0];
      entry.crossReferences.push({
        type: 'inheritance',
        targetSymbol: target.id,
        targetFile: target.filePath,
        targetLocation: target.location,
        relationship: rel,
      });
    }
  }

  private findReferences(entry: SymbolEntry): void {
    const refs: ReferenceEntry[] = [];

    // Search all files for references to this symbol
    for (const [filePath, fileSymbols] of this.table.files) {
      for (const symbol of fileSymbols.symbols) {
        // Check if this symbol references the entry
        if (this.symbolReferences(symbol, entry)) {
          refs.push({
            symbolId: entry.id,
            location: symbol.location,
            filePath,
            context: '',
            referenceType: 'read'
          });
        }
      }
    }

    if (refs.length > 0) {
      this.table.references.set(entry.id, refs);
    }
  }

  private symbolReferences(symbol: SymbolEntry, target: SymbolEntry): boolean {
    // Check if symbol's cross-references include target
    return symbol.crossReferences.some(ref => ref.targetSymbol === target.id);
  }

  private filterSymbols(
    symbols: SymbolEntry[], 
    options: SymbolLookupOptions
  ): SymbolEntry[] {
    return symbols.filter(s => {
      if (!options.includePrivate && s.visibility === 'private') {
        return false;
      }

      if (options.symbolType && s.type !== options.symbolType) {
        return false;
      }

      if (options.filePattern) {
        const regex = new RegExp(options.filePattern);
        if (!regex.test(s.filePath)) {
          return false;
        }
      }

      return true;
    });
  }

  private deduplicateSymbols(symbols: SymbolEntry[]): SymbolEntry[] {
    const seen = new Set<string>();
    return symbols.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }

  private findSymbolById(id: string): SymbolEntry | null {
    for (const entries of this.table.symbols.values()) {
      for (const entry of entries) {
        if (entry.id === id) {
          return entry;
        }
      }
    }
    return null;
  }

  private locationContains(
    location: SourceLocation, 
    line: number, 
    column: number
  ): boolean {
    if (line < location.startLine || line > location.endLine) {
      return false;
    }
    if (line === location.startLine && column < location.startColumn) {
      return false;
    }
    if (line === location.endLine && column > location.endColumn) {
      return false;
    }
    return true;
  }

  private calculateMatchScore(
    query: string,
    queryParts: string[],
    symbolName: string,
    entry: SymbolEntry
  ): number {
    const normalizedSymbol = symbolName.toLowerCase();
    let score = 0;

    // Exact match
    if (normalizedSymbol === query) {
      score += 100;
    }

    // Starts with query
    if (normalizedSymbol.startsWith(query)) {
      score += 50;
    }

    // Contains query
    if (normalizedSymbol.includes(query)) {
      score += 30;
    }

    // Query parts match
    for (const part of queryParts) {
      if (normalizedSymbol.includes(part)) {
        score += 10;
      }
    }

    // Boost for exported symbols
    if (entry.isExported) {
      score += 5;
    }

    // Boost for public symbols
    if (entry.visibility === 'public') {
      score += 3;
    }

    return score;
  }

  private getMatchedParts(query: string, symbolName: string): string[] {
    const matches: string[] = [];
    const normalizedQuery = query.toLowerCase();
    const normalizedSymbol = symbolName.toLowerCase();

    if (normalizedSymbol.includes(normalizedQuery)) {
      matches.push(query);
    }

    return matches;
  }

  private isRelatedSymbol(a: SymbolEntry, b: SymbolEntry): boolean {
    // Check if symbols are related (same name, same parent, etc.)
    if (a.name === b.name) return true;
    if (a.parent === b.id || b.parent === a.id) return true;
    
    // Check cross-references
    return a.crossReferences.some(ref => ref.targetSymbol === b.id) ||
           b.crossReferences.some(ref => ref.targetSymbol === a.id);
  }

  private updateMetadata(): void {
    let totalSymbols = 0;
    let totalReferences = 0;
    const languages = new Set<string>();

    for (const entries of this.table.symbols.values()) {
      totalSymbols += entries.length;
    }

    for (const refs of this.table.references.values()) {
      totalReferences += refs.length;
    }

    for (const fileSymbols of this.table.files.values()) {
      const ext = path.extname(fileSymbols.filePath);
      languages.add(ext);
    }

    this.table.metadata = {
      totalSymbols,
      totalFiles: this.table.files.size,
      totalReferences,
      languages: Array.from(languages),
      indexedAt: new Date(),
      version: '1.0.0'
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createSymbolIndex(rootPath: string): SymbolIndex {
  return new SymbolIndex(rootPath);
}

export async function indexSymbols(rootPath: string): Promise<SymbolTable> {
  const index = new SymbolIndex(rootPath);
  return index.indexSymbols();
}

export function findSymbol(
  table: SymbolTable, 
  name: string, 
  options?: SymbolLookupOptions
): SymbolEntry[] {
  const results: SymbolEntry[] = [];
  const normalizedName = name.toLowerCase();

  const exactMatches = table.symbols.get(normalizedName);
  if (exactMatches) {
    results.push(...exactMatches);
  }

  return results;
}
