/**
 * Context Assembler Module
 * 
 * Assembles relevant code context for LLM prompts with token budget management
 * and context formatting for different agent types.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileDiscovery, FileInfo } from './fileDiscovery';
import { ASTParser, SymbolInfo } from './astParser';
import { DependencyGraph, DependencyNode, DependencyGraphBuilder } from './dependencyGraph';
import { VectorStore, SearchResult as VectorSearchResult } from './vectorSearch';
import { SymbolIndex, SymbolEntry } from './symbolIndex';

// ============================================================================
// Interfaces
// ============================================================================

export interface ContextAssemblyOptions {
  maxTokens?: number;
  tokenBudget?: TokenBudget;
  contextTypes?: ContextType[];
  includeDependencies?: boolean;
  includeDependents?: boolean;
  includeTests?: boolean;
  includeDocumentation?: boolean;
  priorityFiles?: string[];
  excludePatterns?: string[];
  format?: 'raw' | 'markdown' | 'xml' | 'json';
  agentType?: AgentType;
}

export interface TokenBudget {
  code: number;
  documentation: number;
  imports: number;
  context: number;
  reserved: number;
}

export type ContextType = 
  | 'source' 
  | 'imports' 
  | 'exports' 
  | 'dependencies' 
  | 'dependents'
  | 'tests'
  | 'documentation'
  | 'symbols'
  | 'related';

export type AgentType = 
  | 'planner' 
  | 'researcher' 
  | 'coder' 
  | 'reviewer' 
  | 'debugger'
  | 'architect'
  | 'general';

export interface AssembledContext {
  content: string;
  files: ContextFile[];
  metadata: ContextMetadata;
  tokenCount: number;
  sections: ContextSection[];
}

export interface ContextFile {
  path: string;
  content: string;
  relevance: number;
  tokenCount: number;
  includedLines: number[];
  reason: string;
}

export interface ContextMetadata {
  totalFiles: number;
  totalTokens: number;
  languages: string[];
  fileTypes: Record<string, number>;
  assembledAt: Date;
  query?: string;
}

export interface ContextSection {
  name: string;
  content: string;
  tokenCount: number;
  priority: number;
}

export interface PrioritizedFile {
  file: FileInfo;
  score: number;
  reasons: string[];
  suggestedLines?: number[];
}

export interface RelevanceContext {
  query?: string;
  targetFiles?: string[];
  taskType?: string;
  relatedSymbols?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_TOKENS = 8000;
const CHARS_PER_TOKEN = 4; // Rough estimate

const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  code: 5000,
  documentation: 1000,
  imports: 500,
  context: 1000,
  reserved: 500
};

const AGENT_CONTEXT_CONFIGS: Record<AgentType, ContextType[]> = {
  planner: ['source', 'imports', 'exports', 'symbols', 'dependencies'],
  researcher: ['documentation', 'source', 'symbols', 'related'],
  coder: ['source', 'imports', 'tests', 'dependencies', 'dependents'],
  reviewer: ['source', 'tests', 'documentation', 'dependents'],
  debugger: ['source', 'tests', 'dependencies', 'dependents'],
  architect: ['source', 'imports', 'exports', 'symbols', 'dependencies', 'documentation'],
  general: ['source', 'imports', 'documentation']
};

// ============================================================================
// Context Assembler Class
// ============================================================================

export class ContextAssembler {
  private fileDiscovery: FileDiscovery;
  private astParser: ASTParser;
  private vectorStore: VectorStore;
  private symbolIndex: SymbolIndex;
  private dependencyGraph?: DependencyGraph;
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.fileDiscovery = new FileDiscovery({ rootPath });
    this.astParser = new ASTParser();
    this.vectorStore = new VectorStore();
    this.symbolIndex = new SymbolIndex(rootPath);
  }

  /**
   * Initialize the assembler with indexing
   */
  async initialize(): Promise<void> {
    await this.astParser.initialize();
    await this.vectorStore.indexCodebase(this.rootPath);
    await this.symbolIndex.indexSymbols();
    
    const graphBuilder = new DependencyGraphBuilder({ rootPath: this.rootPath });
    this.dependencyGraph = await graphBuilder.buildGraph();
  }

  /**
   * Assemble context for a given query or task
   */
  async assembleContext(
    query: string,
    options: ContextAssemblyOptions = {}
  ): Promise<AssembledContext> {
    const opts = this.normalizeOptions(options);
    const relevanceContext: RelevanceContext = {
      query,
      taskType: opts.agentType
    };

    // Discover and prioritize files
    const prioritizedFiles = await this.prioritizeFiles(relevanceContext);

    // Filter and select files based on token budget
    const selectedFiles = await this.selectFilesForContext(
      prioritizedFiles,
      opts.tokenBudget.code
    );

    // Build context sections
    const sections = await this.buildContextSections(
      selectedFiles,
      opts,
      query
    );

    // Assemble final content
    const { content, totalTokens } = this.assembleFinalContent(sections, opts);

    return {
      content,
      files: selectedFiles,
      metadata: {
        totalFiles: selectedFiles.length,
        totalTokens,
        languages: [...new Set(selectedFiles.map(f => path.extname(f.path)))],
        fileTypes: this.countFileTypes(selectedFiles),
        assembledAt: new Date(),
        query
      },
      tokenCount: totalTokens,
      sections
    };
  }

  /**
   * Prioritize files based on relevance to the context
   */
  async prioritizeFiles(context: RelevanceContext): Promise<PrioritizedFile[]> {
    const discovered = await this.fileDiscovery.discoverFiles();
    const prioritized: PrioritizedFile[] = [];

    // Get semantic search results
    let semanticResults: VectorSearchResult[] = [];
    if (context.query) {
      semanticResults = await this.vectorStore.semanticSearch({
        text: context.query,
        topK: 50
      });
    }

    // Get dependency information
    const dependencyMap = new Map<string, string[]>();
    if (this.dependencyGraph) {
      for (const [path, node] of this.dependencyGraph.nodes) {
        dependencyMap.set(path, node.dependencies);
      }
    }

    // Score each file
    for (const file of discovered.files) {
      const score = this.calculateRelevanceScore(file, context, semanticResults);
      const reasons = this.getRelevanceReasons(file, context, semanticResults);

      prioritized.push({
        file,
        score,
        reasons,
        suggestedLines: this.suggestRelevantLines(file, context)
      });
    }

    // Sort by score
    return prioritized.sort((a, b) => b.score - a.score);
  }

  /**
   * Select files to include in context based on token budget
   */
  async selectFilesForContext(
    prioritizedFiles: PrioritizedFile[],
    tokenBudget: number
  ): Promise<ContextFile[]> {
    const selected: ContextFile[] = [];
    let usedTokens = 0;

    for (const prioritized of prioritizedFiles) {
      const file = prioritized.file;
      
      try {
        const content = await fs.promises.readFile(file.path, 'utf-8');
        const tokenCount = this.estimateTokens(content);

        // Check if we can fit this file
        if (usedTokens + tokenCount <= tokenBudget) {
          selected.push({
            path: file.path,
            content,
            relevance: prioritized.score,
            tokenCount,
            includedLines: prioritized.suggestedLines || 
              Array.from({ length: content.split('\n').length }, (_, i) => i + 1),
            reason: prioritized.reasons.join(', ')
          });
          usedTokens += tokenCount;
        } else {
          // Try to include partial content
          const partialContent = this.extractPartialContent(
            content,
            prioritized.suggestedLines,
            tokenBudget - usedTokens
          );

          if (partialContent) {
            const partialTokens = this.estimateTokens(partialContent);
            selected.push({
              path: file.path,
              content: partialContent,
              relevance: prioritized.score,
              tokenCount: partialTokens,
              includedLines: prioritized.suggestedLines || [],
              reason: `${prioritized.reasons.join(', ')} (partial)`
            });
            usedTokens += partialTokens;
          }
        }

        if (usedTokens >= tokenBudget) {
          break;
        }
      } catch (error) {
        console.warn(`Failed to read ${file.path}:`, error);
      }
    }

    return selected;
  }

  /**
   * Format context for a specific agent type
   */
  formatForAgent(
    context: AssembledContext, 
    agentType: AgentType
  ): string {
    const config = AGENT_CONTEXT_CONFIGS[agentType];
    
    switch (agentType) {
      case 'planner':
        return this.formatForPlanner(context, config);
      case 'researcher':
        return this.formatForResearcher(context, config);
      case 'coder':
        return this.formatForCoder(context, config);
      case 'reviewer':
        return this.formatForReviewer(context, config);
      case 'debugger':
        return this.formatForDebugger(context, config);
      case 'architect':
        return this.formatForArchitect(context, config);
      default:
        return context.content;
    }
  }

  /**
   * Get quick context for a specific file
   */
  async getFileContext(filePath: string): Promise<string> {
    const fileContext = await this.fileDiscovery.getFileContext(filePath);
    if (!fileContext) {
      return '';
    }

    const symbols = await this.astParser.extractSymbols(filePath);
    const outline = this.generateFileOutline(symbols);

    return `
## File: ${path.basename(filePath)}

### Location
${filePath}

### Outline
${outline}

### Imports
${fileContext.imports.map(i => `- ${i}`).join('\n')}

### Exports
${fileContext.exports.map(e => `- ${e}`).join('\n')}

### Content Preview
\`\`\`${fileContext.file.language}
${fileContext.content.substring(0, 1000)}...
\`\`\`
`.trim();
  }

  /**
   * Get context for related files
   */
  async getRelatedContext(
    filePath: string, 
    depth: number = 1
  ): Promise<AssembledContext> {
    const relatedFiles: ContextFile[] = [];
    const visited = new Set<string>();
    const queue: { path: string; currentDepth: number }[] = [
      { path: filePath, currentDepth: 0 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.path) || current.currentDepth > depth) {
        continue;
      }
      visited.add(current.path);

      const fileContext = await this.fileDiscovery.getFileContext(current.path);
      if (fileContext) {
        relatedFiles.push({
          path: current.path,
          content: fileContext.content,
          relevance: 1 - current.currentDepth * 0.2,
          tokenCount: this.estimateTokens(fileContext.content),
          includedLines: [],
          reason: `Related file (depth ${current.currentDepth})`
        });

        // Add dependencies to queue
        for (const dep of fileContext.dependencies) {
          queue.push({ path: dep, currentDepth: current.currentDepth + 1 });
        }

        // Add dependents to queue
        for (const dep of fileContext.dependents) {
          queue.push({ path: dep, currentDepth: current.currentDepth + 1 });
        }
      }
    }

    const content = this.assembleRelatedContent(relatedFiles);

    return {
      content,
      files: relatedFiles,
      metadata: {
        totalFiles: relatedFiles.length,
        totalTokens: relatedFiles.reduce((sum, f) => sum + f.tokenCount, 0),
        languages: [...new Set(relatedFiles.map(f => path.extname(f.path)))],
        fileTypes: this.countFileTypes(relatedFiles),
        assembledAt: new Date()
      },
      tokenCount: relatedFiles.reduce((sum, f) => sum + f.tokenCount, 0),
      sections: []
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private normalizeOptions(options: ContextAssemblyOptions): Required<ContextAssemblyOptions> {
    const agentType = options.agentType || 'general';
    const contextTypes = options.contextTypes || AGENT_CONTEXT_CONFIGS[agentType];

    return {
      maxTokens: options.maxTokens || DEFAULT_MAX_TOKENS,
      tokenBudget: options.tokenBudget || DEFAULT_TOKEN_BUDGET,
      contextTypes,
      includeDependencies: options.includeDependencies ?? true,
      includeDependents: options.includeDependents ?? false,
      includeTests: options.includeTests ?? false,
      includeDocumentation: options.includeDocumentation ?? true,
      priorityFiles: options.priorityFiles || [],
      excludePatterns: options.excludePatterns || [],
      format: options.format || 'markdown',
      agentType
    };
  }

  private calculateRelevanceScore(
    file: FileInfo,
    context: RelevanceContext,
    semanticResults: VectorSearchResult[]
  ): number {
    let score = file.relevanceScore;

    // Boost for semantic similarity
    const semanticMatch = semanticResults.find(r => 
      r.embedding.filePath === file.path
    );
    if (semanticMatch) {
      score += semanticMatch.score * 2;
    }

    // Boost for target files
    if (context.targetFiles?.includes(file.path)) {
      score *= 3;
    }

    // Boost for files containing related symbols
    if (context.relatedSymbols) {
      for (const symbol of context.relatedSymbols) {
        if (file.name.includes(symbol)) {
          score += 0.5;
        }
      }
    }

    // Boost for recent files
    const daysSinceModified = (Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    score *= Math.max(0.7, 1 - daysSinceModified / 90);

    return score;
  }

  private getRelevanceReasons(
    file: FileInfo,
    context: RelevanceContext,
    semanticResults: VectorSearchResult[]
  ): string[] {
    const reasons: string[] = [];

    if (context.targetFiles?.includes(file.path)) {
      reasons.push('target file');
    }

    const semanticMatch = semanticResults.find(r => 
      r.embedding.filePath === file.path
    );
    if (semanticMatch) {
      reasons.push('semantic match');
    }

    if (file.isEntry) {
      reasons.push('entry point');
    }

    if (file.referenceCount > 10) {
      reasons.push('highly referenced');
    }

    return reasons;
  }

  private suggestRelevantLines(file: FileInfo, context: RelevanceContext): number[] | undefined {
    // This would use more sophisticated analysis to suggest relevant lines
    // For now, return undefined to include the entire file
    return undefined;
  }

  private async buildContextSections(
    files: ContextFile[],
    options: Required<ContextAssemblyOptions>,
    query: string
  ): Promise<ContextSection[]> {
    const sections: ContextSection[] = [];

    // Overview section
    sections.push({
      name: 'overview',
      content: this.buildOverviewSection(files, query),
      tokenCount: 0,
      priority: 1
    });

    // Code section
    if (options.contextTypes.includes('source')) {
      sections.push({
        name: 'code',
        content: this.buildCodeSection(files, options.format),
        tokenCount: 0,
        priority: 2
      });
    }

    // Imports section
    if (options.contextTypes.includes('imports') && options.includeDependencies) {
      const importsContent = await this.buildImportsSection(files);
      if (importsContent) {
        sections.push({
          name: 'imports',
          content: importsContent,
          tokenCount: 0,
          priority: 3
        });
      }
    }

    // Symbols section
    if (options.contextTypes.includes('symbols')) {
      const symbolsContent = await this.buildSymbolsSection(files);
      if (symbolsContent) {
        sections.push({
          name: 'symbols',
          content: symbolsContent,
          tokenCount: 0,
          priority: 4
        });
      }
    }

    // Documentation section
    if (options.contextTypes.includes('documentation') && options.includeDocumentation) {
      const docContent = await this.buildDocumentationSection(files);
      if (docContent) {
        sections.push({
          name: 'documentation',
          content: docContent,
          tokenCount: 0,
          priority: 5
        });
      }
    }

    // Calculate token counts
    for (const section of sections) {
      section.tokenCount = this.estimateTokens(section.content);
    }

    return sections.sort((a, b) => a.priority - b.priority);
  }

  private buildOverviewSection(files: ContextFile[], query: string): string {
    return `
# Code Context

## Query
${query}

## Files Included (${files.length})
${files.map(f => `- ${path.basename(f.path)} (${f.tokenCount} tokens) - ${f.reason}`).join('\n')}

## Summary
Total tokens: ${files.reduce((sum, f) => sum + f.tokenCount, 0)}
Languages: ${[...new Set(files.map(f => path.extname(f.path)))].join(', ')}
`.trim();
  }

  private buildCodeSection(files: ContextFile[], format: string): string {
    const parts: string[] = ['\n## Source Code\n'];

    for (const file of files) {
      const lang = path.extname(file.path).slice(1);
      
      if (format === 'markdown') {
        parts.push(`\n### ${path.basename(file.path)}\n`);
        parts.push(`\`\`\`${lang}`);
        parts.push(file.content);
        parts.push('```\n');
      } else if (format === 'xml') {
        parts.push(`<file path="${file.path}">`);
        parts.push(file.content);
        parts.push('</file>');
      } else {
        parts.push(`\n--- FILE: ${file.path} ---\n`);
        parts.push(file.content);
      }
    }

    return parts.join('\n');
  }

  private async buildImportsSection(files: ContextFile[]): Promise<string> {
    const allImports = new Set<string>();

    for (const file of files) {
      const fileContext = await this.fileDiscovery.getFileContext(file.path);
      if (fileContext) {
        fileContext.imports.forEach(imp => allImports.add(imp));
      }
    }

    if (allImports.size === 0) return '';

    return `
## Dependencies

${Array.from(allImports).map(i => `- ${i}`).join('\n')}
`.trim();
  }

  private async buildSymbolsSection(files: ContextFile[]): Promise<string> {
    const symbols: string[] = [];

    for (const file of files) {
      const fileSymbols = await this.astParser.extractSymbols(file.path);
      for (const symbol of fileSymbols.slice(0, 10)) {
        symbols.push(`${symbol.type}: ${symbol.name} (${path.basename(file.path)})`);
      }
    }

    if (symbols.length === 0) return '';

    return `
## Key Symbols

${symbols.map(s => `- ${s}`).join('\n')}
`.trim();
  }

  private async buildDocumentationSection(files: ContextFile[]): Promise<string> {
    // Extract comments and documentation
    const docs: string[] = [];

    for (const file of files) {
      const content = await fs.promises.readFile(file.path, 'utf-8');
      const comments = this.extractComments(content, path.extname(file.path));
      if (comments.length > 0) {
        docs.push(`### ${path.basename(file.path)}\n${comments.join('\n')}`);
      }
    }

    if (docs.length === 0) return '';

    return `
## Documentation

${docs.join('\n\n')}
`.trim();
  }

  private assembleFinalContent(
    sections: ContextSection[], 
    options: Required<ContextAssemblyOptions>
  ): { content: string; totalTokens: number } {
    const parts: string[] = [];
    let totalTokens = 0;

    for (const section of sections) {
      if (totalTokens + section.tokenCount <= options.maxTokens) {
        parts.push(section.content);
        totalTokens += section.tokenCount;
      }
    }

    return {
      content: parts.join('\n\n'),
      totalTokens
    };
  }

  private assembleRelatedContent(files: ContextFile[]): string {
    const parts: string[] = ['# Related Files Context\n'];

    for (const file of files) {
      parts.push(`\n## ${path.basename(file.path)}`);
      parts.push(`*Relevance: ${(file.relevance * 100).toFixed(0)}%*`);
      parts.push(`\`\`\`${path.extname(file.path).slice(1)}`);
      parts.push(file.content.substring(0, 500));
      parts.push('```\n');
    }

    return parts.join('\n');
  }

  private formatForPlanner(context: AssembledContext, config: ContextType[]): string {
    return `${context.content}

---

## Planning Context

Based on the above code, please:
1. Identify the key components and their relationships
2. Understand the current architecture
3. Plan the implementation approach
4. Consider dependencies and potential impacts
`;
  }

  private formatForResearcher(context: AssembledContext, config: ContextType[]): string {
    return `${context.content}

---

## Research Context

Please analyze the above code to:
1. Understand the existing patterns and conventions
2. Identify similar implementations
3. Find relevant documentation
4. Suggest best practices based on the codebase
`;
  }

  private formatForCoder(context: AssembledContext, config: ContextType[]): string {
    return `${context.content}

---

## Implementation Context

When implementing:
1. Follow the existing code style and patterns
2. Consider the shown dependencies
3. Add appropriate tests
4. Update relevant documentation
`;
  }

  private formatForReviewer(context: AssembledContext, config: ContextType[]): string {
    return `${context.content}

---

## Review Context

Please review for:
1. Code quality and best practices
2. Potential bugs or issues
3. Test coverage
4. Documentation completeness
5. Performance considerations
`;
  }

  private formatForDebugger(context: AssembledContext, config: ContextType[]): string {
    return `${context.content}

---

## Debug Context

Please help debug by:
1. Identifying potential error sources
2. Tracing the execution flow
3. Checking test cases
4. Suggesting fixes
`;
  }

  private formatForArchitect(context: AssembledContext, config: ContextType[]): string {
    return `${context.content}

---

## Architecture Context

Please analyze:
1. Overall system design
2. Component interactions
3. Scalability considerations
4. Technical debt
5. Improvement opportunities
`;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  private extractPartialContent(
    content: string,
    suggestedLines: number[] | undefined,
    maxTokens: number
  ): string | null {
    const maxChars = maxTokens * CHARS_PER_TOKEN;

    if (suggestedLines && suggestedLines.length > 0) {
      const lines = content.split('\n');
      const selectedLines = suggestedLines
        .filter(l => l > 0 && l <= lines.length)
        .map(l => lines[l - 1]);
      
      const partial = selectedLines.join('\n');
      if (partial.length <= maxChars) {
        return partial;
      }
    }

    // Fall back to first N characters
    if (content.length <= maxChars) {
      return content;
    }

    return content.substring(0, maxChars);
  }

  private generateFileOutline(symbols: SymbolInfo[]): string {
    const lines: string[] = [];

    for (const symbol of symbols) {
      const indent = symbol.parent ? '  ' : '';
      lines.push(`${indent}- ${symbol.type}: ${symbol.name}`);
    }

    return lines.join('\n');
  }

  private extractComments(content: string, ext: string): string[] {
    const comments: string[] = [];

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      // JSDoc comments
      const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
      let match;
      while ((match = jsdocRegex.exec(content)) !== null) {
        comments.push(match[0]);
      }

      // Single-line comments
      const lineRegex = /\/\/.*$/gm;
      while ((match = lineRegex.exec(content)) !== null) {
        if (match[0].length > 10) { // Only substantial comments
          comments.push(match[0]);
        }
      }
    } else if (ext === '.py') {
      // Python docstrings
      const docstringRegex = /"""[\s\S]*?"""/g;
      let match;
      while ((match = docstringRegex.exec(content)) !== null) {
        comments.push(match[0]);
      }
    }

    return comments.slice(0, 10); // Limit number of comments
  }

  private countFileTypes(files: ContextFile[]): Record<string, number> {
    const types: Record<string, number> = {};
    for (const file of files) {
      const ext = path.extname(file.path);
      types[ext] = (types[ext] || 0) + 1;
    }
    return types;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createContextAssembler(rootPath: string): ContextAssembler {
  return new ContextAssembler(rootPath);
}

export async function assembleContext(
  rootPath: string,
  query: string,
  options?: ContextAssemblyOptions
): Promise<AssembledContext> {
  const assembler = new ContextAssembler(rootPath);
  await assembler.initialize();
  return assembler.assembleContext(query, options);
}

export async function getFileContext(filePath: string): Promise<string> {
  const assembler = new ContextAssembler(path.dirname(filePath));
  return assembler.getFileContext(filePath);
}
