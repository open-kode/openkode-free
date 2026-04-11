/**
 * OpenKode Codebase Intelligence Layer
 * 
 * A comprehensive suite for understanding code structure at scale,
 * providing intelligent file discovery, AST parsing, dependency analysis,
 * semantic search, symbol indexing, and context assembly for LLM prompts.
 */

// ============================================================================
// File Discovery Module
// ============================================================================

export {
  FileDiscovery,
  createFileDiscovery,
  discoverFiles,
} from './fileDiscovery';

export type {
  FileInfo,
  DiscoveryOptions,
  SearchResult as FileSearchResult,
  FileContext,
} from './fileDiscovery';

// ============================================================================
// AST Parser Module
// ============================================================================

export {
  ASTParser,
  createASTParser,
  parseFile,
  extractSymbols,
} from './astParser';

export type {
  SymbolInfo,
  SymbolType,
  SymbolKind,
  SourceLocation,
  ParseResult,
  ImportInfo,
  ImportSpecifier,
  ExportInfo,
  ParseError,
  ReferenceInfo,
  ParserOptions,
} from './astParser';

// ============================================================================
// Dependency Graph Module
// ============================================================================

export {
  DependencyGraphBuilder,
  createDependencyGraphBuilder,
  buildDependencyGraph,
  analyzeImpact,
} from './dependencyGraph';

export type {
  DependencyNode,
  NodeMetrics,
  DependencyEdge,
  DependencyGraph,
  ImpactAnalysis,
  ImpactNode,
  GraphBuildOptions,
  CycleInfo,
  ModuleMetrics,
} from './dependencyGraph';

// ============================================================================
// Vector Search Module
// ============================================================================

export {
  VectorStore,
  createVectorStore,
  indexCodebase,
  semanticSearch,
} from './vectorSearch';

export type {
  CodeEmbedding,
  EmbeddingMetadata,
  SearchResult as VectorSearchResult,
  SearchQuery,
  SearchFilters,
  VectorIndex,
  SimilarityConfig,
  IndexOptions,
} from './vectorSearch';

// ============================================================================
// Symbol Index Module
// ============================================================================

export {
  SymbolIndex,
  createSymbolIndex,
  indexSymbols,
  findSymbol,
} from './symbolIndex';

export type {
  SymbolTable,
  SymbolEntry,
  CrossReference,
  ReferenceEntry,
  FileSymbols,
  SymbolTableMetadata,
  SymbolLookupOptions,
  ReferenceLookupOptions,
  SymbolSearchResult,
  RenameRequest,
  RenameResult,
  FileChange,
  TextEdit,
} from './symbolIndex';

// ============================================================================
// Context Assembler Module
// ============================================================================

export {
  ContextAssembler,
  createContextAssembler,
  assembleContext,
  getFileContext,
} from './contextAssembler';

export type {
  ContextAssemblyOptions,
  TokenBudget,
  ContextType,
  AgentType,
  AssembledContext,
  ContextFile,
  ContextMetadata,
  ContextSection,
  PrioritizedFile,
  RelevanceContext,
} from './contextAssembler';

// ============================================================================
// Main Interfaces Summary
// ============================================================================

/**
 * Core interfaces for the Codebase Intelligence Layer:
 * 
 * ## FileInfo
 * Represents a discovered file with metadata and relevance scoring.
 * - path: Absolute file path
 * - relativePath: Path relative to project root
 * - name: File name
 * - extension: File extension
 * - size: File size in bytes
 * - lastModified: Last modification date
 * - language: Detected programming language
 * - relevanceScore: Calculated relevance score
 * - importCount: Number of imports
 * - exportCount: Number of exports
 * - referenceCount: Number of references to this file
 * - isTest: Whether file is a test file
 * - isConfig: Whether file is a config file
 * - isEntry: Whether file is an entry point
 * 
 * ## SymbolInfo
 * Represents a code symbol (function, class, interface, etc.)
 * - name: Symbol name
 * - type: Symbol type (function, class, interface, etc.)
 * - kind: Symbol kind (definition, declaration, reference)
 * - location: Source code location
 * - filePath: Containing file path
 * - parent: Parent symbol (for nested symbols)
 * - children: Child symbols
 * - modifiers: Modifiers (export, async, static, etc.)
 * - documentation: Associated documentation
 * - signature: Symbol signature
 * - isExported: Whether symbol is exported
 * - isAsync: Whether function is async
 * - isStatic: Whether member is static
 * - isAbstract: Whether class/method is abstract
 * - visibility: Access visibility
 * 
 * ## DependencyNode
 * Represents a node in the dependency graph
 * - id: Unique identifier
 * - path: File path
 * - name: Node name
 * - type: Node type (file, module, package, external)
 * - language: Programming language
 * - size: File size
 * - imports: Imported modules
 * - exports: Exported symbols
 * - dependents: Files that depend on this
 * - dependencies: Files this depends on
 * - depth: Depth in dependency tree
 * - metrics: Node metrics (centrality, pageRank, etc.)
 * 
 * ## SearchResult (Vector)
 * Represents a semantic search result
 * - embedding: The matched code embedding
 * - score: Similarity score
 * - matchedTokens: Tokens that matched the query
 */

// ============================================================================
// Unified Codebase Intelligence Interface
// ============================================================================

import { FileDiscovery } from './fileDiscovery';
import { ASTParser } from './astParser';
import { DependencyGraphBuilder } from './dependencyGraph';
import { VectorStore } from './vectorSearch';
import { SymbolIndex } from './symbolIndex';
import { ContextAssembler } from './contextAssembler';

export interface CodebaseIntelligence {
  fileDiscovery: FileDiscovery;
  astParser: ASTParser;
  dependencyGraph: DependencyGraphBuilder;
  vectorStore: VectorStore;
  symbolIndex: SymbolIndex;
  contextAssembler: ContextAssembler;
  rootPath: string;
}

export interface CodebaseIntelligenceConfig {
  rootPath: string;
  includeNodeModules?: boolean;
  includeTests?: boolean;
  maxFileSize?: number;
  languages?: string[];
  embeddingProvider?: 'local' | 'openai' | 'cohere';
}

/**
 * Create a fully initialized Codebase Intelligence instance
 */
export async function createCodebaseIntelligence(
  config: CodebaseIntelligenceConfig
): Promise<CodebaseIntelligence> {
  const { rootPath } = config;

  // Initialize all components
  const fileDiscovery = new FileDiscovery({ 
    rootPath,
    excludePatterns: config.includeNodeModules ? [] : ['node_modules'],
  });

  const astParser = new ASTParser({
    maxFileSize: config.maxFileSize || 1024 * 1024,
  });
  await astParser.initialize();

  const dependencyGraph = new DependencyGraphBuilder({ 
    rootPath,
    includeNodeModules: config.includeNodeModules || false,
  });

  const vectorStore = new VectorStore();
  await vectorStore.indexCodebase(rootPath);

  const symbolIndex = new SymbolIndex(rootPath);
  await symbolIndex.indexSymbols();

  const contextAssembler = new ContextAssembler(rootPath);
  await contextAssembler.initialize();

  return {
    fileDiscovery,
    astParser,
    dependencyGraph,
    vectorStore,
    symbolIndex,
    contextAssembler,
    rootPath,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick analysis of a codebase
 */
export async function analyzeCodebase(rootPath: string): Promise<{
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  languages: string[];
  entryPoints: string[];
  criticalFiles: string[];
}> {
  const intelligence = await createCodebaseIntelligence({ rootPath });

  // Get file statistics
  const fileStats = await intelligence.fileDiscovery.getStatistics();

  // Get symbol statistics
  const symbolStats = intelligence.symbolIndex.getStatistics();

  // Build dependency graph
  const graph = await intelligence.dependencyGraph.buildGraph();

  // Get critical files
  const criticalFiles = intelligence.dependencyGraph
    .getCriticalFiles(10)
    .map(n => n.path);

  // Get entry points
  const entryPoints = intelligence.dependencyGraph
    .getEntryPoints()
    .map(n => n.path);

  return {
    fileCount: fileStats.totalFiles,
    symbolCount: symbolStats.totalSymbols,
    dependencyCount: graph.edges.length,
    languages: Object.keys(fileStats.byLanguage),
    entryPoints,
    criticalFiles,
  };
}

/**
 * Search across all intelligence sources
 */
export async function unifiedSearch(
  rootPath: string,
  query: string,
  options?: {
    semantic?: boolean;
    symbol?: boolean;
    file?: boolean;
    topK?: number;
  }
): Promise<{
  semanticResults: any[];
  symbolResults: any[];
  fileResults: any[];
}> {
  const intelligence = await createCodebaseIntelligence({ rootPath });
  const results = {
    semanticResults: [] as any[],
    symbolResults: [] as any[],
    fileResults: [] as any[],
  };

  if (options?.semantic !== false) {
    results.semanticResults = await intelligence.vectorStore.semanticSearch({
      text: query,
      topK: options?.topK || 10,
    });
  }

  if (options?.symbol !== false) {
    results.symbolResults = intelligence.symbolIndex.searchSymbols(query, {
      limit: options?.topK || 10,
    });
  }

  if (options?.file !== false) {
    const discovered = await intelligence.fileDiscovery.discoverFiles();
    results.fileResults = discovered.files
      .filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.relativePath.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, options?.topK || 10);
  }

  return results;
}

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
