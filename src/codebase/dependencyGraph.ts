/**
 * Dependency Graph Module
 * 
 * Module relationship mapping, import graph building, and change impact analysis
 * (blast radius calculation) for understanding code dependencies.
 */

import * as path from 'path';
import { FileDiscovery, FileInfo } from './fileDiscovery';
import { ASTParser, ImportInfo, ParseResult } from './astParser';

// ============================================================================
// Interfaces
// ============================================================================

export interface DependencyNode {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'module' | 'package' | 'external';
  language: string;
  size: number;
  imports: string[];
  exports: string[];
  dependents: string[];
  dependencies: string[];
  depth: number;
  metrics: NodeMetrics;
}

export interface NodeMetrics {
  incomingCount: number;
  outgoingCount: number;
  centrality: number;
  pageRank: number;
  complexity: number;
  stability: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'import' | 'export' | 'inheritance' | 'composition' | 'reference';
  weight: number;
  location?: {
    line: number;
    column: number;
  };
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  rootPath: string;
  metadata: {
    totalFiles: number;
    totalDependencies: number;
    maxDepth: number;
    languages: string[];
  };
}

export interface ImpactAnalysis {
  changedFiles: string[];
  directDependents: string[];
  transitiveDependents: string[];
  blastRadius: number;
  riskScore: number;
  affectedTests: string[];
  affectedEntryPoints: string[];
  impactTree: ImpactNode;
}

export interface ImpactNode {
  path: string;
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  depth: number;
  reason: string;
  children: ImpactNode[];
}

export interface GraphBuildOptions {
  rootPath: string;
  includeExternal?: boolean;
  includeNodeModules?: boolean;
  maxDepth?: number;
  filePatterns?: string[];
}

export interface CycleInfo {
  exists: boolean;
  cycles: string[][];
  filesInCycles: string[];
}

export interface ModuleMetrics {
  cohesion: number;
  coupling: number;
  instability: number;
  abstractness: number;
  distance: number;
}

// ============================================================================
// Dependency Graph Builder Class
// ============================================================================

export class DependencyGraphBuilder {
  private graph: DependencyGraph;
  private fileDiscovery: FileDiscovery;
  private astParser: ASTParser;
  private options: Required<GraphBuildOptions>;
  private parseCache: Map<string, ParseResult> = new Map();

  constructor(options: GraphBuildOptions) {
    this.options = {
      includeExternal: false,
      includeNodeModules: false,
      maxDepth: 20,
      filePatterns: ['*.{ts,tsx,js,jsx,py,go,rs}'],
      ...options
    };

    this.graph = {
      nodes: new Map(),
      edges: [],
      rootPath: options.rootPath,
      metadata: {
        totalFiles: 0,
        totalDependencies: 0,
        maxDepth: 0,
        languages: []
      }
    };

    this.fileDiscovery = new FileDiscovery({
      rootPath: options.rootPath,
      includePatterns: this.options.filePatterns
    });

    this.astParser = new ASTParser();
  }

  /**
   * Build the complete dependency graph
   */
  async buildGraph(): Promise<DependencyGraph> {
    // Initialize parser
    await this.astParser.initialize();

    // Discover all files
    const discovered = await this.fileDiscovery.discoverFiles(this.options.filePatterns);
    
    // Create nodes for each file
    for (const file of discovered.files) {
      this.createNode(file);
    }

    // Parse files and build edges
    await this.buildEdges();

    // Calculate metrics
    this.calculateMetrics();

    // Calculate depths
    this.calculateDepths();

    // Update metadata
    this.graph.metadata = {
      totalFiles: this.graph.nodes.size,
      totalDependencies: this.graph.edges.length,
      maxDepth: Math.max(...Array.from(this.graph.nodes.values()).map(n => n.depth)),
      languages: [...new Set(Array.from(this.graph.nodes.values()).map(n => n.language))]
    };

    return this.graph;
  }

  /**
   * Build the dependency graph (alias for buildGraph)
   */
  async build(rootPath?: string): Promise<DependencyGraph> {
    if (rootPath) {
      this.options.rootPath = rootPath;
      this.graph.rootPath = rootPath;
    }
    return this.buildGraph();
  }

  /**
   * Get direct dependencies of a file
   */
  getDependencies(filePath: string): DependencyNode[] {
    const node = this.graph.nodes.get(filePath);
    if (!node) return [];

    return node.dependencies
      .map(depId => this.graph.nodes.get(depId))
      .filter((n): n is DependencyNode => n !== undefined);
  }

  /**
   * Get files that depend on a given file
   */
  getDependents(filePath: string): DependencyNode[] {
    const node = this.graph.nodes.get(filePath);
    if (!node) return [];

    return node.dependents
      .map(depId => this.graph.nodes.get(depId))
      .filter((n): n is DependencyNode => n !== undefined);
  }

  /**
   * Analyze the impact of changing specific files
   */
  analyzeImpact(changedFiles: string[]): ImpactAnalysis {
    const directDependents = new Set<string>();
    const transitiveDependents = new Set<string>();
    const affectedTests: string[] = [];
    const affectedEntryPoints: string[] = [];

    // Build impact tree
    const impactTree: ImpactNode = {
      path: 'root',
      impactLevel: 'critical',
      depth: 0,
      reason: 'Change origin',
      children: []
    };

    for (const changedFile of changedFiles) {
      const node = this.graph.nodes.get(changedFile);
      if (!node) continue;

      const fileImpact: ImpactNode = {
        path: changedFile,
        impactLevel: 'critical',
        depth: 0,
        reason: 'Direct change',
        children: []
      };

      // Find all dependents recursively
      const visited = new Set<string>();
      const queue: { path: string; depth: number }[] = [{ path: changedFile, depth: 0 }];

      while (queue.length > 0) {
        const current = queue.shift()!;
        
        if (visited.has(current.path)) continue;
        visited.add(current.path);

        const currentNode = this.graph.nodes.get(current.path);
        if (!currentNode) continue;

        for (const dependent of currentNode.dependents) {
          if (dependent === changedFile) continue;

          if (current.depth === 0) {
            directDependents.add(dependent);
          } else {
            transitiveDependents.add(dependent);
          }

          const depNode = this.graph.nodes.get(dependent);
          if (depNode) {
            // Check if it's a test file
            if (this.isTestFile(dependent)) {
              affectedTests.push(dependent);
            }
            // Check if it's an entry point
            if (this.isEntryPoint(dependent)) {
              affectedEntryPoints.push(dependent);
            }

            // Add to impact tree
            const impactLevel = this.calculateImpactLevel(current.depth, depNode);
            fileImpact.children.push({
              path: dependent,
              impactLevel,
              depth: current.depth + 1,
              reason: `Depends on ${current.path}`,
              children: []
            });

            queue.push({ path: dependent, depth: current.depth + 1 });
          }
        }
      }

      impactTree.children.push(fileImpact);
    }

    // Calculate blast radius
    const totalFiles = this.graph.nodes.size;
    const affectedFiles = directDependents.size + transitiveDependents.size + changedFiles.length;
    const blastRadius = totalFiles > 0 ? affectedFiles / totalFiles : 0;

    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      changedFiles,
      Array.from(directDependents),
      Array.from(transitiveDependents),
      affectedTests,
      affectedEntryPoints
    );

    return {
      changedFiles,
      directDependents: Array.from(directDependents),
      transitiveDependents: Array.from(transitiveDependents),
      blastRadius,
      riskScore,
      affectedTests,
      affectedEntryPoints,
      impactTree
    };
  }

  /**
   * Detect circular dependencies
   */
  detectCycles(): CycleInfo {
    const cycles: string[][] = [];
    const filesInCycles = new Set<string>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[] = []): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = this.graph.nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          if (!visited.has(dep)) {
            dfs(dep, [...path]);
          } else if (recursionStack.has(dep)) {
            // Found a cycle
            const cycleStart = path.indexOf(dep);
            const cycle = path.slice(cycleStart);
            cycles.push(cycle);
            cycle.forEach(f => filesInCycles.add(f));
          }
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return {
      exists: cycles.length > 0,
      cycles,
      filesInCycles: Array.from(filesInCycles)
    };
  }

  /**
   * Find the shortest path between two files
   */
  findPath(from: string, to: string): string[] | null {
    if (!this.graph.nodes.has(from) || !this.graph.nodes.has(to)) {
      return null;
    }

    const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.node === to) {
        return current.path;
      }

      if (visited.has(current.node)) continue;
      visited.add(current.node);

      const node = this.graph.nodes.get(current.node);
      if (node) {
        for (const dep of node.dependencies) {
          if (!visited.has(dep)) {
            queue.push({
              node: dep,
              path: [...current.path, dep]
            });
          }
        }
      }
    }

    return null;
  }

  /**
   * Get files at a specific depth level
   */
  getFilesAtDepth(depth: number): DependencyNode[] {
    return Array.from(this.graph.nodes.values()).filter(n => n.depth === depth);
  }

  /**
   * Get the entry points of the application
   */
  getEntryPoints(): DependencyNode[] {
    return Array.from(this.graph.nodes.values()).filter(n => 
      n.depth === 0 || this.isEntryPoint(n.path)
    );
  }

  /**
   * Get the most critical files (high centrality)
   */
  getCriticalFiles(limit: number = 10): DependencyNode[] {
    return Array.from(this.graph.nodes.values())
      .sort((a, b) => b.metrics.centrality - a.metrics.centrality)
      .slice(0, limit);
  }

  /**
   * Calculate module metrics
   */
  calculateModuleMetrics(modulePath: string): ModuleMetrics {
    const moduleFiles = Array.from(this.graph.nodes.values())
      .filter(n => n.path.startsWith(modulePath));

    if (moduleFiles.length === 0) {
      return {
        cohesion: 0,
        coupling: 0,
        instability: 0,
        abstractness: 0,
        distance: 0
      };
    }

    // Calculate internal dependencies
    let internalDeps = 0;
    let externalDeps = 0;
    const modulePaths = new Set(moduleFiles.map(f => f.path));

    for (const file of moduleFiles) {
      for (const dep of file.dependencies) {
        if (modulePaths.has(dep)) {
          internalDeps++;
        } else {
          externalDeps++;
        }
      }
    }

    // Cohesion: ratio of internal dependencies
    const totalDeps = internalDeps + externalDeps;
    const cohesion = totalDeps > 0 ? internalDeps / totalDeps : 0;

    // Coupling: external dependencies per file
    const coupling = externalDeps / moduleFiles.length;

    // Instability: outgoing / (incoming + outgoing)
    const outgoing = externalDeps;
    const incoming = moduleFiles.reduce((sum, f) => sum + f.metrics.incomingCount, 0);
    const instability = (incoming + outgoing) > 0 ? outgoing / (incoming + outgoing) : 0;

    // Abstractness: abstract classes / total classes (simplified)
    const abstractness = 0.5; // Placeholder

    // Distance from main sequence
    const distance = Math.abs(abstractness + instability - 1);

    return {
      cohesion,
      coupling,
      instability,
      abstractness,
      distance
    };
  }

  /**
   * Export graph to various formats
   */
  exportGraph(format: 'json' | 'dot' | 'mermaid'): string {
    switch (format) {
      case 'json':
        return JSON.stringify({
          nodes: Array.from(this.graph.nodes.entries()),
          edges: this.graph.edges,
          metadata: this.graph.metadata
        }, null, 2);

      case 'dot':
        return this.toDotFormat();

      case 'mermaid':
        return this.toMermaidFormat();

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createNode(file: FileInfo): void {
    const node: DependencyNode = {
      id: file.path,
      path: file.path,
      name: file.name,
      type: 'file',
      language: file.language,
      size: file.size,
      imports: [],
      exports: [],
      dependents: [],
      dependencies: [],
      depth: -1,
      metrics: {
        incomingCount: 0,
        outgoingCount: 0,
        centrality: 0,
        pageRank: 0,
        complexity: 0,
        stability: 0
      }
    };

    this.graph.nodes.set(file.path, node);
  }

  private async buildEdges(): Promise<void> {
    const nodeEntries = Array.from(this.graph.nodes.entries());

    for (const [filePath, node] of nodeEntries) {
      try {
        const parseResult = await this.astParser.parseFile(filePath);
        this.parseCache.set(filePath, parseResult);

        // Process imports
        for (const imp of parseResult.imports) {
          const resolvedPath = this.resolveImport(filePath, imp.source);
          
          if (resolvedPath && this.graph.nodes.has(resolvedPath)) {
            node.dependencies.push(resolvedPath);
            node.imports.push(imp.source);

            // Add edge
            this.graph.edges.push({
              source: filePath,
              target: resolvedPath,
              type: 'import',
              weight: 1,
              location: imp.location ? {
                line: imp.location.startLine,
                column: imp.location.startColumn
              } : undefined
            });

            // Update target's dependents
            const targetNode = this.graph.nodes.get(resolvedPath);
            if (targetNode) {
              targetNode.dependents.push(filePath);
            }
          } else if (this.options.includeExternal) {
            // External dependency
            node.imports.push(imp.source);
          }
        }

        // Process exports
        for (const exp of parseResult.exports) {
          node.exports.push(exp.name);
        }
      } catch (error) {
        console.warn(`Failed to parse ${filePath}:`, error);
      }
    }
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      const resolved = path.resolve(fromDir, importPath);
      
      // Try common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      
      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (this.graph.nodes.has(fullPath)) {
          return fullPath;
        }
      }

      // Check if exact path exists
      if (this.graph.nodes.has(resolved)) {
        return resolved;
      }
    }

    // Handle package imports (simplified)
    if (!importPath.startsWith('.')) {
      // Could resolve to node_modules or other packages
      // For now, return null for external packages
      return null;
    }

    return null;
  }

  private calculateMetrics(): void {
    // Calculate PageRank-like centrality
    const dampingFactor = 0.85;
    const iterations = 20;
    const numNodes = this.graph.nodes.size;

    if (numNodes === 0) return;

    // Initialize PageRank
    for (const node of this.graph.nodes.values()) {
      node.metrics.pageRank = 1 / numNodes;
    }

    // Iterate PageRank calculation
    for (let i = 0; i < iterations; i++) {
      for (const node of this.graph.nodes.values()) {
        let rank = (1 - dampingFactor) / numNodes;

        for (const dependent of node.dependents) {
          const depNode = this.graph.nodes.get(dependent);
          if (depNode && depNode.dependencies.length > 0) {
            rank += dampingFactor * depNode.metrics.pageRank / depNode.dependencies.length;
          }
        }

        node.metrics.pageRank = rank;
      }
    }

    // Calculate other metrics
    for (const node of this.graph.nodes.values()) {
      node.metrics.incomingCount = node.dependents.length;
      node.metrics.outgoingCount = node.dependencies.length;
      
      // Centrality: combination of incoming and outgoing
      node.metrics.centrality = 
        Math.log(node.metrics.incomingCount + 1) * 0.6 +
        Math.log(node.metrics.outgoingCount + 1) * 0.4 +
        node.metrics.pageRank * 10;

      // Stability: files with more dependents are less stable
      node.metrics.stability = 1 / (1 + Math.log(node.metrics.incomingCount + 1));

      // Complexity: based on file size and dependencies
      node.metrics.complexity = 
        Math.log(node.size / 1024 + 1) * 0.3 +
        Math.log(node.dependencies.length + 1) * 0.7;
    }
  }

  private calculateDepths(): void {
    // Find entry points (files with no dependents or known entry patterns)
    const entryPoints = Array.from(this.graph.nodes.values())
      .filter(n => n.dependents.length === 0 || this.isEntryPoint(n.path));

    // BFS from entry points
    const visited = new Set<string>();
    const queue: { path: string; depth: number }[] = entryPoints.map(ep => ({
      path: ep.path,
      depth: 0
    }));

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.path)) continue;
      visited.add(current.path);

      const node = this.graph.nodes.get(current.path);
      if (node) {
        node.depth = current.depth;

        for (const dep of node.dependencies) {
          if (!visited.has(dep)) {
            queue.push({ path: dep, depth: current.depth + 1 });
          }
        }
      }
    }

    // Mark remaining nodes as depth -1 (orphaned)
    for (const node of this.graph.nodes.values()) {
      if (node.depth === -1) {
        node.depth = this.options.maxDepth;
      }
    }
  }

  private calculateImpactLevel(depth: number, node: DependencyNode): 'critical' | 'high' | 'medium' | 'low' {
    if (depth === 0) return 'critical';
    if (depth === 1) return 'high';
    if (node.metrics.incomingCount > 10) return 'high';
    if (depth <= 3) return 'medium';
    if (node.metrics.centrality > 0.5) return 'medium';
    return 'low';
  }

  private calculateRiskScore(
    changedFiles: string[],
    directDependents: string[],
    transitiveDependents: string[],
    affectedTests: string[],
    affectedEntryPoints: string[]
  ): number {
    let score = 0;

    // Base score from number of affected files
    score += changedFiles.length * 5;
    score += directDependents.length * 3;
    score += transitiveDependents.length * 1;

    // Bonus for affected tests
    score += affectedTests.length * 2;

    // High risk if entry points affected
    score += affectedEntryPoints.length * 10;

    // Check if critical files are affected
    const criticalFiles = this.getCriticalFiles(20);
    for (const critical of criticalFiles) {
      if (changedFiles.includes(critical.path) || 
          directDependents.includes(critical.path)) {
        score += 15;
      }
    }

    // Normalize to 0-100
    return Math.min(100, score);
  }

  private isTestFile(filePath: string): boolean {
    const testPatterns = [/\.(test|spec)\./, /__tests__/, /__mocks__/];
    return testPatterns.some(p => p.test(filePath));
  }

  private isEntryPoint(filePath: string): boolean {
    const entryPatterns = [/index\.(ts|tsx|js|jsx)$/, /main\./, /app\./, /server\./, /cli\./];
    return entryPatterns.some(p => p.test(filePath));
  }

  private toDotFormat(): string {
    const lines = ['digraph DependencyGraph {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=rounded];');

    // Add nodes
    for (const [id, node] of this.graph.nodes) {
      const label = path.basename(node.path);
      const color = node.depth === 0 ? 'lightgreen' : 
                    node.depth === 1 ? 'lightblue' : 
                    node.depth === 2 ? 'lightyellow' : 'white';
      lines.push(`  "${id}" [label="${label}", fillcolor="${color}"];`);
    }

    // Add edges
    for (const edge of this.graph.edges) {
      lines.push(`  "${edge.source}" -> "${edge.target}";`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  private toMermaidFormat(): string {
    const lines = ['graph TD;'];

    // Add nodes with labels
    for (const [id, node] of this.graph.nodes) {
      const shortId = id.replace(/[^a-zA-Z0-9]/g, '_');
      const label = path.basename(node.path);
      lines.push(`  ${shortId}["${label}"]`);
    }

    // Add edges
    for (const edge of this.graph.edges) {
      const sourceId = edge.source.replace(/[^a-zA-Z0-9]/g, '_');
      const targetId = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`  ${sourceId} --> ${targetId}`);
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDependencyGraphBuilder(options: GraphBuildOptions): DependencyGraphBuilder {
  return new DependencyGraphBuilder(options);
}

export async function buildDependencyGraph(rootPath: string): Promise<DependencyGraph> {
  const builder = new DependencyGraphBuilder({ rootPath });
  return builder.buildGraph();
}

export async function analyzeImpact(
  rootPath: string, 
  changedFiles: string[]
): Promise<ImpactAnalysis> {
  const builder = new DependencyGraphBuilder({ rootPath });
  await builder.buildGraph();
  return builder.analyzeImpact(changedFiles);
}
