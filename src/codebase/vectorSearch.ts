/**
 * Vector Search Module
 * 
 * Semantic code search using embeddings and vector similarity.
 * Includes in-memory vector store for MVP implementation.
 */

import * as fs from 'fs';
import { FileDiscovery, FileInfo } from './fileDiscovery';
import { ASTParser, SymbolInfo } from './astParser';

// ============================================================================
// Interfaces
// ============================================================================

export interface CodeEmbedding {
  id: string;
  filePath: string;
  content: string;
  contentType: 'file' | 'function' | 'class' | 'interface' | 'snippet';
  embedding: number[];
  metadata: EmbeddingMetadata;
  language: string;
  startLine: number;
  endLine: number;
}

export interface EmbeddingMetadata {
  fileSize: number;
  lastModified: Date;
  symbolName?: string;
  parentSymbol?: string;
  imports: string[];
  exports: string[];
  complexity?: number;
}

export interface SearchResult {
  embedding: CodeEmbedding;
  score: number;
  matchedTokens?: string[];
}

export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
  topK?: number;
  minScore?: number;
}

export interface SearchFilters {
  languages?: string[];
  filePatterns?: string[];
  contentTypes?: string[];
  excludeTests?: boolean;
  excludeNodeModules?: boolean;
  minFileSize?: number;
  maxFileSize?: number;
}

export interface VectorIndex {
  embeddings: CodeEmbedding[];
  dimensions: number;
  totalTokens: number;
  indexedAt: Date;
  version: string;
}

export interface SimilarityConfig {
  algorithm: 'cosine' | 'euclidean' | 'dot';
  normalize: boolean;
  weights?: {
    semantic: number;
    lexical: number;
    structural: number;
  };
}

export interface IndexOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  includeSymbols?: boolean;
  includeComments?: boolean;
  maxTokensPerChunk?: number;
  embeddingProvider?: 'local' | 'openai' | 'cohere' | 'huggingface';
  embeddingModel?: string;
  apiKey?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_CHUNK_OVERLAP = 128;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TOP_K = 10;
const DEFAULT_MIN_SCORE = 0.5;
const EMBEDDING_DIMENSIONS = 384; // For local/all-MiniLM-L6-v2

// Simple embedding for MVP - uses TF-IDF-like approach
// In production, use a proper embedding model

// ============================================================================
// Vector Store Class
// ============================================================================

export class VectorStore {
  private index: VectorIndex;
  private config: SimilarityConfig;
  private embeddingProvider: LocalEmbeddingProvider;

  constructor(config?: Partial<SimilarityConfig>) {
    this.config = {
      algorithm: 'cosine',
      normalize: true,
      weights: {
        semantic: 0.7,
        lexical: 0.2,
        structural: 0.1
      },
      ...config
    };

    this.index = {
      embeddings: [],
      dimensions: EMBEDDING_DIMENSIONS,
      totalTokens: 0,
      indexedAt: new Date(),
      version: '1.0.0'
    };

    this.embeddingProvider = new LocalEmbeddingProvider();
  }

  /**
   * Index the entire codebase
   */
  async indexCodebase(
    rootPath: string, 
    options: IndexOptions = {}
  ): Promise<VectorIndex> {
    const opts = {
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      includeSymbols: true,
      includeComments: false,
      maxTokensPerChunk: DEFAULT_MAX_TOKENS,
      embeddingProvider: 'local' as const,
      embeddingModel: 'all-MiniLM-L6-v2',
      ...options
    };

    // Discover files
    const fileDiscovery = new FileDiscovery({ rootPath });
    const discovered = await fileDiscovery.discoverFiles();

    // Parse and embed files
    const embeddings: CodeEmbedding[] = [];
    const astParser = new ASTParser();
    await astParser.initialize();

    for (const file of discovered.files) {
      try {
        const fileEmbeddings = await this.indexFile(file, astParser, opts);
        embeddings.push(...fileEmbeddings);
      } catch (error) {
        console.warn(`Failed to index ${file.path}:`, error);
      }
    }

    this.index = {
      embeddings,
      dimensions: EMBEDDING_DIMENSIONS,
      totalTokens: embeddings.reduce((sum, e) => sum + this.estimateTokens(e.content), 0),
      indexedAt: new Date(),
      version: '1.0.0'
    };

    return this.index;
  }

  /**
   * Perform semantic search
   */
  async semanticSearch(query: SearchQuery): Promise<SearchResult[]> {
    const topK = query.topK || DEFAULT_TOP_K;
    const minScore = query.minScore || DEFAULT_MIN_SCORE;

    // Generate query embedding
    const queryEmbedding = await this.embeddingProvider.embed(query.text);

    // Calculate similarities
    const scores: SearchResult[] = [];

    for (const embedding of this.index.embeddings) {
      // Apply filters
      if (query.filters && !this.matchesFilters(embedding, query.filters)) {
        continue;
      }

      const similarity = this.calculateSimilarity(queryEmbedding, embedding.embedding);
      
      if (similarity >= minScore) {
        scores.push({
          embedding,
          score: similarity,
          matchedTokens: this.extractMatchedTokens(query.text, embedding.content)
        });
      }
    }

    // Sort by score and return top K
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Find similar code to a given snippet
   */
  async findSimilar(
    codeSnippet: string, 
    options?: {
      topK?: number;
      minScore?: number;
      filters?: SearchFilters;
    }
  ): Promise<SearchResult[]> {
    return this.semanticSearch({
      text: codeSnippet,
      topK: options?.topK,
      minScore: options?.minScore,
      filters: options?.filters
    });
  }

  /**
   * Search by symbol name
   */
  async searchBySymbol(
    symbolName: string, 
    options?: {
      topK?: number;
      symbolType?: string;
    }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const embedding of this.index.embeddings) {
      if (embedding.metadata.symbolName === symbolName) {
        results.push({
          embedding,
          score: 1.0,
          matchedTokens: [symbolName]
        });
      } else if (embedding.content.includes(symbolName)) {
        const score = this.calculateLexicalScore(symbolName, embedding.content);
        results.push({
          embedding,
          score,
          matchedTokens: [symbolName]
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.topK || DEFAULT_TOP_K);
  }

  /**
   * Search by natural language description
   */
  async naturalLanguageSearch(
    description: string,
    options?: {
      topK?: number;
      minScore?: number;
    }
  ): Promise<SearchResult[]> {
    // Enhance the query with code-specific context
    const enhancedQuery = this.enhanceQuery(description);
    
    return this.semanticSearch({
      text: enhancedQuery,
      topK: options?.topK,
      minScore: options?.minScore
    });
  }

  /**
   * Get embeddings for a specific file
   */
  getFileEmbeddings(filePath: string): CodeEmbedding[] {
    return this.index.embeddings.filter(e => e.filePath === filePath);
  }

  /**
   * Get statistics about the index
   */
  getStats(): {
    totalEmbeddings: number;
    totalFiles: number;
    totalTokens: number;
    averageEmbeddingSize: number;
    languages: Record<string, number>;
    contentTypes: Record<string, number>;
  } {
    const languages: Record<string, number> = {};
    const contentTypes: Record<string, number> = {};
    const files = new Set<string>();

    for (const embedding of this.index.embeddings) {
      languages[embedding.language] = (languages[embedding.language] || 0) + 1;
      contentTypes[embedding.contentType] = (contentTypes[embedding.contentType] || 0) + 1;
      files.add(embedding.filePath);
    }

    return {
      totalEmbeddings: this.index.embeddings.length,
      totalFiles: files.size,
      totalTokens: this.index.totalTokens,
      averageEmbeddingSize: this.index.dimensions,
      languages,
      contentTypes
    };
  }

  /**
   * Save index to disk
   */
  async saveIndex(filePath: string): Promise<void> {
    const data = JSON.stringify(this.index, null, 2);
    await fs.promises.writeFile(filePath, data, 'utf-8');
  }

  /**
   * Load index from disk
   */
  async loadIndex(filePath: string): Promise<void> {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    this.index = JSON.parse(data);
  }

  /**
   * Clear the index
   */
  clearIndex(): void {
    this.index = {
      embeddings: [],
      dimensions: EMBEDDING_DIMENSIONS,
      totalTokens: 0,
      indexedAt: new Date(),
      version: '1.0.0'
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async indexFile(
    file: FileInfo,
    astParser: ASTParser,
    options: IndexOptions
  ): Promise<CodeEmbedding[]> {
    const embeddings: CodeEmbedding[] = [];
    const content = await fs.promises.readFile(file.path, 'utf-8');

    // Create file-level embedding
    const fileChunks = this.chunkContent(content, options.chunkSize || DEFAULT_CHUNK_SIZE, options.chunkOverlap || DEFAULT_CHUNK_OVERLAP);
    
    for (let i = 0; i < fileChunks.length; i++) {
      const chunk = fileChunks[i];
      const embedding = await this.embeddingProvider.embed(chunk);

      embeddings.push({
        id: `${file.path}#chunk${i}`,
        filePath: file.path,
        content: chunk,
        contentType: 'file',
        embedding,
        metadata: {
          fileSize: file.size,
          lastModified: file.lastModified,
          imports: [],
          exports: []
        },
        language: file.language,
        startLine: this.getLineNumber(content, i * (options.chunkSize || DEFAULT_CHUNK_SIZE)),
        endLine: this.getLineNumber(content, Math.min((i + 1) * (options.chunkSize || DEFAULT_CHUNK_SIZE), content.length))
      });
    }

    // Create symbol-level embeddings if requested
    if (options.includeSymbols) {
      try {
        const symbols = await astParser.extractSymbols(file.path);
        
        for (const symbol of symbols) {
          const symbolContent = this.extractSymbolContent(content, symbol);
          if (symbolContent && symbolContent.length > 50) {
            const embedding = await this.embeddingProvider.embed(symbolContent);

            embeddings.push({
              id: `${file.path}#${symbol.name}`,
              filePath: file.path,
              content: symbolContent,
              contentType: this.mapSymbolType(symbol.type),
              embedding,
              metadata: {
                fileSize: file.size,
                lastModified: file.lastModified,
                symbolName: symbol.name,
                parentSymbol: symbol.parent,
                imports: [],
                exports: [],
                complexity: this.estimateComplexity(symbolContent)
              },
              language: file.language,
              startLine: symbol.location.startLine,
              endLine: symbol.location.endLine
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to extract symbols from ${file.path}:`, error);
      }
    }

    return embeddings;
  }

  private chunkContent(
    content: string, 
    chunkSize: number, 
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (const line of lines) {
      const lineSize = line.length;

      if (currentSize + lineSize > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        
        // Keep overlap lines
        const overlapLines = currentChunk.slice(-Math.ceil(overlap / 50));
        currentChunk = [...overlapLines];
        currentSize = overlapLines.reduce((sum, l) => sum + l.length, 0);
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  private calculateSimilarity(a: number[], b: number[]): number {
    switch (this.config.algorithm) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'euclidean':
        return this.euclideanSimilarity(a, b);
      case 'dot':
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private euclideanSimilarity(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    const distance = Math.sqrt(sum);
    return 1 / (1 + distance);
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private matchesFilters(embedding: CodeEmbedding, filters: SearchFilters): boolean {
    if (filters.languages && !filters.languages.includes(embedding.language)) {
      return false;
    }

    if (filters.filePatterns) {
      const matches = filters.filePatterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(embedding.filePath);
      });
      if (!matches) return false;
    }

    if (filters.contentTypes && !filters.contentTypes.includes(embedding.contentType)) {
      return false;
    }

    if (filters.excludeTests && this.isTestFile(embedding.filePath)) {
      return false;
    }

    if (filters.excludeNodeModules && embedding.filePath.includes('node_modules')) {
      return false;
    }

    if (filters.minFileSize && embedding.metadata.fileSize < filters.minFileSize) {
      return false;
    }

    if (filters.maxFileSize && embedding.metadata.fileSize > filters.maxFileSize) {
      return false;
    }

    return true;
  }

  private extractMatchedTokens(query: string, content: string): string[] {
    const queryTokens = this.tokenize(query.toLowerCase());
    const contentTokens = this.tokenize(content.toLowerCase());
    const matched = queryTokens.filter(t => contentTokens.includes(t));
    return [...new Set(matched)];
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^a-zA-Z0-9_]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  private calculateLexicalScore(query: string, content: string): number {
    const queryTokens = this.tokenize(query.toLowerCase());
    const contentTokens = this.tokenize(content.toLowerCase());
    
    if (queryTokens.length === 0) return 0;

    const matches = queryTokens.filter(t => contentTokens.includes(t)).length;
    return matches / queryTokens.length;
  }

  private enhanceQuery(description: string): string {
    // Add code-specific context to natural language queries
    const codeTerms = [
      'function', 'class', 'method', 'interface', 'type',
      'import', 'export', 'const', 'let', 'var',
      'async', 'await', 'return', 'if', 'for', 'while'
    ];

    const lowerDesc = description.toLowerCase();
    const relevantTerms = codeTerms.filter(term => lowerDesc.includes(term));

    return `${description} ${relevantTerms.join(' ')}`;
  }

  private extractSymbolContent(content: string, symbol: SymbolInfo): string {
    const lines = content.split('\n');
    const startLine = Math.max(0, symbol.location.startLine - 1);
    const endLine = Math.min(lines.length, symbol.location.endLine);
    
    return lines.slice(startLine, endLine).join('\n');
  }

  private mapSymbolType(type: string): 'function' | 'class' | 'interface' | 'snippet' {
    switch (type) {
      case 'function':
      case 'method':
        return 'function';
      case 'class':
        return 'class';
      case 'interface':
      case 'type':
        return 'interface';
      default:
        return 'snippet';
    }
  }

  private estimateComplexity(content: string): number {
    // Simple complexity estimation
    const lines = content.split('\n').length;
    const branches = (content.match(/\b(if|else|for|while|switch|case|catch)\b/g) || []).length;
    const functions = (content.match(/\bfunction\b|\b=>\b/g) || []).length;
    
    return lines * 0.1 + branches * 0.5 + functions * 0.3;
  }

  private estimateTokens(content: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  private getLineNumber(content: string, offset: number): number {
    return content.substring(0, offset).split('\n').length;
  }

  private isTestFile(filePath: string): boolean {
    return /\.(test|spec)\.|__tests__|__mocks__/.test(filePath);
  }
}

// ============================================================================
// Local Embedding Provider
// ============================================================================

class LocalEmbeddingProvider {
  private vocabulary: Map<string, number> = new Map();
  private dimensions: number = EMBEDDING_DIMENSIONS;

  constructor() {
    this.initializeVocabulary();
  }

  async embed(text: string): Promise<number[]> {
    // Simple TF-IDF-like embedding for MVP
    // In production, use a proper embedding model like all-MiniLM-L6-v2
    
    const tokens = this.tokenize(text);
    const embedding = new Array(this.dimensions).fill(0);
    
    // Create a simple hash-based embedding
    for (const token of tokens) {
      const hash = this.hashString(token);
      for (let i = 0; i < this.dimensions; i++) {
        const bit = (hash >> (i % 32)) & 1;
        embedding[i] += bit ? 1 : -1;
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      return embedding.map(v => v / norm);
    }

    return embedding;
  }

  private initializeVocabulary(): void {
    // Common programming terms
    const terms = [
      'function', 'class', 'interface', 'type', 'const', 'let', 'var',
      'import', 'export', 'from', 'return', 'async', 'await', 'if',
      'else', 'for', 'while', 'switch', 'case', 'try', 'catch',
      'new', 'this', 'super', 'extends', 'implements', 'static',
      'public', 'private', 'protected', 'readonly', 'abstract'
    ];

    terms.forEach((term, i) => {
      this.vocabulary.set(term, i);
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createVectorStore(config?: Partial<SimilarityConfig>): VectorStore {
  return new VectorStore(config);
}

export async function indexCodebase(
  rootPath: string, 
  options?: IndexOptions
): Promise<VectorIndex> {
  const store = new VectorStore();
  return store.indexCodebase(rootPath, options);
}

export async function semanticSearch(
  query: string, 
  index: VectorIndex,
  options?: { topK?: number; minScore?: number }
): Promise<SearchResult[]> {
  const store = new VectorStore();
  // Load the index into the store
  (store as any).index = index;
  
  return store.semanticSearch({
    text: query,
    topK: options?.topK,
    minScore: options?.minScore
  });
}
