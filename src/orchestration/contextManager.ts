/**
 * OpenKode Multi-Agent Orchestration Engine - Context Manager
 * 
 * Context window optimization:
 * - Smart chunking strategies
 * - Token counting and limit management
 * - Context compression for large codebases
 * - Relevance-based context prioritization
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ContextChunk {
  id: string;
  content: string;
  tokens: number;
  priority: number; // 0-1, higher = more important
  source?: string;
  type: ChunkType;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

export enum ChunkType {
  CODE = 'code',
  COMMENT = 'comment',
  DOCUMENTATION = 'documentation',
  IMPORT = 'import',
  SIGNATURE = 'signature',
  ERROR = 'error',
  USER_MESSAGE = 'user_message',
  SYSTEM_MESSAGE = 'system_message',
  ASSISTANT_MESSAGE = 'assistant_message',
  FILE_HEADER = 'file_header',
  SUMMARY = 'summary'
}

export interface ChunkingOptions {
  maxChunkSize: number;        // tokens
  overlapTokens: number;       // tokens to overlap between chunks
  preserveBoundaries: boolean; // preserve function/class boundaries
  respectImports: boolean;     // keep imports together
  language?: string;           // for language-aware chunking
}

export interface ContextBudget {
  maxTokens: number;
  reservedTokens: number;      // for system message, etc.
  availableTokens: number;
}

export interface ContextAssembly {
  chunks: ContextChunk[];
  totalTokens: number;
  coverage: number;            // percentage of original content included
  compressionRatio: number;    // original tokens / final tokens
}

export interface RelevanceScore {
  chunkId: string;
  score: number;
  reason: string;
}

export interface CompressionResult {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  method: CompressionMethod;
}

export enum CompressionMethod {
  SUMMARIZATION = 'summarization',
  TRUNCATION = 'truncation',
  REMOVAL = 'removal',
  CODE_FOLDING = 'code_folding',
  COMMENT_REMOVAL = 'comment_removal',
  WHITESPACE_NORMALIZATION = 'whitespace_normalization'
}

export interface TokenizerConfig {
  model: string;
  encoding?: string;
  approximate?: boolean;
}

export interface ContextManagerConfig {
  defaultModel: string;
  defaultMaxTokens: number;
  chunkingOptions?: Partial<ChunkingOptions>;
  enableCompression: boolean;
  enableRelevanceScoring: boolean;
  cacheEmbeddings: boolean;
}

// ============================================================================
// TOKEN COUNTER
// ============================================================================

export class TokenCounter {
  private config: TokenizerConfig;
  private cache: Map<string, number> = new Map();

  // Approximate tokens per character ratios for different models
  private static readonly TOKEN_RATIOS: Record<string, number> = {
    'gpt-4': 0.25,
    'gpt-4o': 0.25,
    'gpt-3.5-turbo': 0.25,
    'claude': 0.3,
    'claude-3': 0.3,
    'default': 0.25
  };

  constructor(config: TokenizerConfig) {
    this.config = {
      approximate: true,
      ...config
    };
  }

  /**
   * Count tokens in text
   */
  countTokens(text: string): number {
    if (!text) return 0;

    const cacheKey = this.hashText(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let count: number;

    if (this.config.approximate) {
      count = this.approximateCount(text);
    } else {
      // In a real implementation, this would use tiktoken or similar
      count = this.approximateCount(text);
    }

    this.cache.set(cacheKey, count);
    return count;
  }

  /**
   * Approximate token count based on character ratio
   */
  private approximateCount(text: string): number {
    const ratio = TokenCounter.TOKEN_RATIOS[this.config.model] || 
                  TokenCounter.TOKEN_RATIOS['default'];
    
    // More accurate approximation considering whitespace and punctuation
    let adjustedLength = text.length;
    
    // Count code-specific patterns
    const codePatterns = [
      /\b(function|class|const|let|var|if|else|for|while|return)\b/g,
      /[{}[\];(),]/g,
      /\s+/g
    ];

    for (const pattern of codePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        // Code tokens are often shorter
        adjustedLength -= matches.length * 0.3;
      }
    }

    return Math.ceil(adjustedLength * ratio);
  }

  /**
   * Count tokens for multiple texts
   */
  countBatch(texts: string[]): number[] {
    return texts.map(t => this.countTokens(t));
  }

  /**
   * Get token budget breakdown
   */
  getBudgetBreakdown(budget: ContextBudget): {
    reserved: number;
    available: number;
    utilization: number;
  } {
    return {
      reserved: budget.reservedTokens,
      available: budget.availableTokens,
      utilization: budget.reservedTokens / budget.maxTokens
    };
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Simple hash for caching
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

// ============================================================================
// SMART CHUNKER
// ============================================================================

export class SmartChunker extends EventEmitter {
  private options: ChunkingOptions;
  private tokenCounter: TokenCounter;

  constructor(tokenCounter: TokenCounter, options?: Partial<ChunkingOptions>) {
    super();
    this.tokenCounter = tokenCounter;
    this.options = {
      maxChunkSize: 2000,
      overlapTokens: 100,
      preserveBoundaries: true,
      respectImports: true,
      ...options
    };
  }

  /**
   * Chunk code content intelligently
   */
  chunkCode(content: string, source: string, language?: string): ContextChunk[] {
    const chunks: ContextChunk[] = [];
    const lines = content.split('\n');
    
    // Detect language if not provided
    const lang = language || this.detectLanguage(source, content);
    
    // Parse into semantic units
    const units = this.parseSemanticUnits(lines, lang);
    
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const unit of units) {
      const unitTokens = this.tokenCounter.countTokens(unit.content);

      // If single unit exceeds max size, split it further
      if (unitTokens > this.options.maxChunkSize) {
        // Flush current chunk first
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(
            currentChunk.join('\n'),
            source,
            unit.type,
            chunkIndex++
          ));
          currentChunk = [];
          currentTokens = 0;
        }

        // Split large unit
        const subChunks = this.splitLargeUnit(unit.content, unit.type);
        for (const sub of subChunks) {
          chunks.push(this.createChunk(sub, source, unit.type, chunkIndex++));
        }
        continue;
      }

      // Check if adding this unit would exceed limit
      if (currentTokens + unitTokens > this.options.maxChunkSize && currentChunk.length > 0) {
        chunks.push(this.createChunk(
          currentChunk.join('\n'),
          source,
          ChunkType.CODE,
          chunkIndex++
        ));
        
        // Keep overlap
        const overlapLines = this.getOverlapLines(currentChunk);
        currentChunk = [...overlapLines];
        currentTokens = this.tokenCounter.countTokens(overlapLines.join('\n'));
      }

      currentChunk.push(unit.content);
      currentTokens += unitTokens;
    }

    // Flush remaining content
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(
        currentChunk.join('\n'),
        source,
        ChunkType.CODE,
        chunkIndex++
      ));
    }

    this.emit('chunking:completed', { source, chunkCount: chunks.length });
    return chunks;
  }

  /**
   * Chunk conversation history
   */
  chunkConversation(messages: Array<{ role: string; content: string }>): ContextChunk[] {
    const chunks: ContextChunk[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const type = msg.role === 'user' ? ChunkType.USER_MESSAGE :
                   msg.role === 'system' ? ChunkType.SYSTEM_MESSAGE :
                   ChunkType.ASSISTANT_MESSAGE;

      const content = msg.content;
      const tokens = this.tokenCounter.countTokens(content);

      // Split large messages
      if (tokens > this.options.maxChunkSize) {
        const subChunks = this.splitLargeUnit(content, type);
        subChunks.forEach((sub, idx) => {
          chunks.push({
            id: `msg_${i}_chunk_${idx}`,
            content: sub,
            tokens: this.tokenCounter.countTokens(sub),
            priority: this.calculateMessagePriority(i, messages.length),
            type,
            metadata: { messageIndex: i, chunkIndex: idx }
          });
        });
      } else {
        chunks.push({
          id: `msg_${i}`,
          content,
          tokens,
          priority: this.calculateMessagePriority(i, messages.length),
          type,
          metadata: { messageIndex: i }
        });
      }
    }

    return chunks;
  }

  /**
   * Parse content into semantic units
   */
  private parseSemanticUnits(lines: string[], language: string): Array<{ content: string; type: ChunkType }> {
    const units: Array<{ content: string; type: ChunkType }> = [];
    let currentUnit: string[] = [];
    let inImportBlock = false;
    const inComment = false;

    const importPatterns = [
      /^\s*import\s+/,
      /^\s*from\s+\S+\s+import/,
      /^\s*require\s*\(/,
      /^\s*#include/
    ];

    const commentPatterns = {
      start: /^\s*\/\*\*/,
      end: /\*\//,
      line: /^\s*\/(\/|\*)/,
      docstring: /^\s*("""|''')/
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for import block
      const isImport = importPatterns.some(p => p.test(trimmed));
      
      if (isImport && this.options.respectImports) {
        if (!inImportBlock && currentUnit.length > 0) {
          units.push({ content: currentUnit.join('\n'), type: ChunkType.CODE });
          currentUnit = [];
        }
        inImportBlock = true;
        currentUnit.push(line);
        continue;
      }

      if (inImportBlock && !isImport && trimmed !== '') {
        units.push({ content: currentUnit.join('\n'), type: ChunkType.IMPORT });
        currentUnit = [line];
        inImportBlock = false;
        continue;
      }

      // Check for function/class boundaries
      if (this.options.preserveBoundaries && this.isBoundaryLine(trimmed, language)) {
        if (currentUnit.length > 0) {
          units.push({ content: currentUnit.join('\n'), type: ChunkType.CODE });
        }
        currentUnit = [line];
        continue;
      }

      currentUnit.push(line);
    }

    // Flush last unit
    if (currentUnit.length > 0) {
      units.push({ 
        content: currentUnit.join('\n'), 
        type: inImportBlock ? ChunkType.IMPORT : ChunkType.CODE 
      });
    }

    return units;
  }

  /**
   * Check if line is a boundary (function/class definition)
   */
  private isBoundaryLine(line: string, language: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      typescript: [/^\s*(export\s+)?(async\s+)?function\s+\w+/, /^\s*(export\s+)?class\s+\w+/],
      javascript: [/^\s*(export\s+)?(async\s+)?function\s+\w+/, /^\s*(export\s+)?class\s+\w+/],
      python: [/^\s*(async\s+)?def\s+\w+/, /^\s*class\s+\w+/],
      java: [/^\s*(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/, /^\s*(public\s+)?class\s+\w+/],
      go: [/^\s*func\s+/, /^\s*type\s+\w+\s+struct/],
      rust: [/^\s*(pub\s+)?fn\s+\w+/, /^\s*(pub\s+)?struct\s+\w+/]
    };

    const langPatterns = patterns[language] || patterns.typescript;
    return langPatterns.some(p => p.test(line));
  }

  /**
   * Split a large unit into smaller chunks
   */
  private splitLargeUnit(content: string, type: ChunkType): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = this.tokenCounter.countTokens(line);

      if (currentTokens + lineTokens > this.options.maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentTokens = 0;
      }

      currentChunk.push(line);
      currentTokens += lineTokens;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * Get overlap lines for continuity
   */
  private getOverlapLines(lines: string[]): string[] {
    const overlap: string[] = [];
    let tokenCount = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
      const lineTokens = this.tokenCounter.countTokens(lines[i]);
      if (tokenCount + lineTokens > this.options.overlapTokens) break;
      overlap.unshift(lines[i]);
      tokenCount += lineTokens;
    }

    return overlap;
  }

  /**
   * Create a context chunk
   */
  private createChunk(
    content: string, 
    source: string, 
    type: ChunkType,
    index: number
  ): ContextChunk {
    return {
      id: `${source}_chunk_${index}`,
      content,
      tokens: this.tokenCounter.countTokens(content),
      priority: 0.5,
      source,
      type,
      metadata: { chunkIndex: index }
    };
  }

  /**
   * Detect programming language from file extension or content
   */
  private detectLanguage(source: string, content: string): string {
    const ext = source.split('.').pop()?.toLowerCase();
    
    const extMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'rb': 'ruby',
      'php': 'php'
    };

    if (ext && extMap[ext]) {
      return extMap[ext];
    }

    // Content-based detection
    if (content.includes('def ') && content.includes(':')) return 'python';
    if (content.includes('func ')) return 'go';
    if (content.includes('fn ')) return 'rust';
    if (content.includes('interface ') && content.includes('{')) return 'typescript';

    return 'typescript';
  }

  /**
   * Calculate priority based on message position
   */
  private calculateMessagePriority(index: number, total: number): number {
    // More recent messages get higher priority
    return 0.3 + (0.7 * (index / Math.max(total - 1, 1)));
  }
}

// ============================================================================
// CONTEXT COMPRESSOR
// ============================================================================

export class ContextCompressor extends EventEmitter {
  private tokenCounter: TokenCounter;

  constructor(tokenCounter: TokenCounter) {
    super();
    this.tokenCounter = tokenCounter;
  }

  /**
   * Compress content to fit within token budget
   */
  compress(content: string, targetTokens: number, method?: CompressionMethod): CompressionResult {
    const originalTokens = this.tokenCounter.countTokens(content);

    if (originalTokens <= targetTokens) {
      return {
        original: content,
        compressed: content,
        originalTokens,
        compressedTokens: originalTokens,
        method: CompressionMethod.REMOVAL
      };
    }

    const selectedMethod = method || this.selectCompressionMethod(content, originalTokens, targetTokens);
    let compressed: string;

    switch (selectedMethod) {
      case CompressionMethod.SUMMARIZATION:
        compressed = this.summarize(content, targetTokens);
        break;
      case CompressionMethod.CODE_FOLDING:
        compressed = this.foldCode(content, targetTokens);
        break;
      case CompressionMethod.COMMENT_REMOVAL:
        compressed = this.removeComments(content);
        break;
      case CompressionMethod.WHITESPACE_NORMALIZATION:
        compressed = this.normalizeWhitespace(content);
        break;
      case CompressionMethod.TRUNCATION:
      default:
        compressed = this.truncate(content, targetTokens);
        break;
    }

    const compressedTokens = this.tokenCounter.countTokens(compressed);

    this.emit('compression:completed', {
      originalTokens,
      compressedTokens,
      method: selectedMethod
    });

    return {
      original: content,
      compressed,
      originalTokens,
      compressedTokens,
      method: selectedMethod
    };
  }

  /**
   * Select best compression method
   */
  private selectCompressionMethod(
    content: string, 
    originalTokens: number, 
    targetTokens: number
  ): CompressionMethod {
    const ratio = targetTokens / originalTokens;

    if (ratio > 0.8) {
      return CompressionMethod.WHITESPACE_NORMALIZATION;
    }
    if (ratio > 0.5) {
      return CompressionMethod.COMMENT_REMOVAL;
    }
    if (this.isCode(content) && ratio > 0.3) {
      return CompressionMethod.CODE_FOLDING;
    }
    if (ratio > 0.2) {
      return CompressionMethod.SUMMARIZATION;
    }
    return CompressionMethod.TRUNCATION;
  }

  /**
   * Remove comments from code
   */
  private removeComments(content: string): string {
    // Remove single-line comments
    let cleaned = content.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove Python-style comments
    cleaned = cleaned.replace(/#.*$/gm, '');
    // Remove docstrings
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, '');
    cleaned = cleaned.replace(/'''[\s\S]*?'''/g, '');
    
    return cleaned.trim();
  }

  /**
   * Normalize whitespace
   */
  private normalizeWhitespace(content: string): string {
    return content
      .replace(/[ \t]+/g, ' ')      // Multiple spaces/tabs to single space
      .replace(/\n{3,}/g, '\n\n')   // Max 2 consecutive newlines
      .trim();
  }

  /**
   * Fold code (replace function bodies with signatures)
   */
  private foldCode(content: string, targetTokens: number): string {
    const lines = content.split('\n');
    const folded: string[] = [];
    let depth = 0;
    let inFunction = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect function start
      if (/^\s*(async\s+)?(function|def|fn|func)\s+\w+/.test(trimmed)) {
        folded.push(line);
        inFunction = true;
        continue;
      }

      // Track brace depth
      if (trimmed.includes('{')) depth++;
      if (trimmed.includes('}')) {
        depth--;
        if (depth === 0 && inFunction) {
          folded.push(line);
          inFunction = false;
        }
        continue;
      }

      // Skip function body content
      if (inFunction && depth > 0) {
        if (trimmed.startsWith('return') || trimmed.startsWith('throw')) {
          folded.push('  // ...');
        }
        continue;
      }

      folded.push(line);
    }

    return folded.join('\n');
  }

  /**
   * Summarize content (simple extraction-based)
   */
  private summarize(content: string, targetTokens: number): string {
    const lines = content.split('\n');
    const summary: string[] = [];
    let currentTokens = 0;

    // Priority: signatures, imports, first lines of paragraphs
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Always include signatures
      if (this.isSignatureLine(trimmed)) {
        summary.push(line);
        currentTokens += this.tokenCounter.countTokens(line);
        continue;
      }

      // Include imports
      if (/^\s*(import|from|require|#include)/.test(trimmed)) {
        summary.push(line);
        currentTokens += this.tokenCounter.countTokens(line);
        continue;
      }

      // Add content until we hit the limit
      const lineTokens = this.tokenCounter.countTokens(line);
      if (currentTokens + lineTokens <= targetTokens) {
        summary.push(line);
        currentTokens += lineTokens;
      }
    }

    return summary.join('\n');
  }

  /**
   * Truncate content to target size
   */
  private truncate(content: string, targetTokens: number): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = this.tokenCounter.countTokens(line);
      if (currentTokens + lineTokens > targetTokens) {
        result.push('// ... [truncated]');
        break;
      }
      result.push(line);
      currentTokens += lineTokens;
    }

    return result.join('\n');
  }

  /**
   * Check if content is code
   */
  private isCode(content: string): boolean {
    const codeIndicators = [
      /\b(function|class|const|let|var|if|else|for|while|return)\b/,
      /[{}[\];(),]/,
      /\b(def|class|import|from)\b/
    ];
    return codeIndicators.some(p => p.test(content));
  }

  /**
   * Check if line is a signature
   */
  private isSignatureLine(line: string): boolean {
    const signaturePatterns = [
      /^\s*(export\s+)?(async\s+)?function\s+\w+/,
      /^\s*(export\s+)?class\s+\w+/,
      /^\s*(async\s+)?def\s+\w+/,
      /^\s*func\s+\w+/,
      /^\s*(pub\s+)?fn\s+\w+/,
      /^\s*(public|private|protected)\s+\w+\s+\w+\s*\(/,
      /^\s*interface\s+\w+/,
      /^\s*type\s+\w+\s*=/
    ];
    return signaturePatterns.some(p => p.test(line));
  }
}

// ============================================================================
// CONTEXT MANAGER
// ============================================================================

export class ContextManager extends EventEmitter {
  private config: ContextManagerConfig;
  private tokenCounter: TokenCounter;
  private chunker: SmartChunker;
  private compressor: ContextCompressor;
  private relevanceCache: Map<string, RelevanceScore[]> = new Map();

  constructor(config?: Partial<ContextManagerConfig>) {
    super();
    this.config = {
      defaultModel: 'gpt-4o',
      defaultMaxTokens: 128000,
      enableCompression: true,
      enableRelevanceScoring: true,
      cacheEmbeddings: true,
      ...config
    };

    this.tokenCounter = new TokenCounter({ model: this.config.defaultModel });
    this.chunker = new SmartChunker(this.tokenCounter);
    this.compressor = new ContextCompressor(this.tokenCounter);

    this.chunker.on('chunking:completed', (data) => this.emit('chunking:completed', data));
    this.compressor.on('compression:completed', (data) => this.emit('compression:completed', data));
  }

  /**
   * Calculate context budget
   */
  calculateBudget(
    maxTokens: number,
    reservedTokens: number = 0
  ): ContextBudget {
    return {
      maxTokens,
      reservedTokens,
      availableTokens: maxTokens - reservedTokens
    };
  }

  /**
   * Assemble context from chunks within budget
   */
  assembleContext(
    chunks: ContextChunk[],
    budget: ContextBudget,
    query?: string
  ): ContextAssembly {
    // Score chunks by relevance if query provided
    let scoredChunks = chunks;
    if (this.config.enableRelevanceScoring && query) {
      scoredChunks = this.scoreRelevance(chunks, query);
    }

    // Sort by priority (descending)
    scoredChunks.sort((a, b) => b.priority - a.priority);

    const selected: ContextChunk[] = [];
    let totalTokens = 0;
    const originalTokens = chunks.reduce((sum, c) => sum + c.tokens, 0);

    for (const chunk of scoredChunks) {
      if (totalTokens + chunk.tokens <= budget.availableTokens) {
        selected.push(chunk);
        totalTokens += chunk.tokens;
      } else if (this.config.enableCompression) {
        // Try to compress to fit
        const remaining = budget.availableTokens - totalTokens;
        if (remaining > 200) { // Minimum useful chunk size
          const compressed = this.compressor.compress(chunk.content, remaining);
          if (compressed.compressedTokens <= remaining) {
            selected.push({
              ...chunk,
              content: compressed.compressed,
              tokens: compressed.compressedTokens
            });
            totalTokens += compressed.compressedTokens;
          }
        }
      }
    }

    // Sort back by original order for coherence
    selected.sort((a, b) => {
      const aIndex = parseInt(a.id.split('_chunk_')[1] || '0');
      const bIndex = parseInt(b.id.split('_chunk_')[1] || '0');
      return aIndex - bIndex;
    });

    return {
      chunks: selected,
      totalTokens,
      coverage: selected.length / chunks.length,
      compressionRatio: originalTokens / totalTokens
    };
  }

  /**
   * Score chunks by relevance to query
   */
  private scoreRelevance(chunks: ContextChunk[], query: string): ContextChunk[] {
    const cacheKey = this.hashQuery(query);
    
    if (this.relevanceCache.has(cacheKey)) {
      const cached = this.relevanceCache.get(cacheKey)!;
      return chunks.map(chunk => ({
        ...chunk,
        priority: cached.find(c => c.chunkId === chunk.id)?.score ?? chunk.priority
      }));
    }

    // Simple keyword-based scoring (in production, use embeddings)
    const queryTerms = query.toLowerCase().split(/\s+/);
    const scores: RelevanceScore[] = [];

    const scored = chunks.map(chunk => {
      const content = chunk.content.toLowerCase();
      let score = chunk.priority;

      // Boost for query term matches
      for (const term of queryTerms) {
        if (term.length < 3) continue;
        const matches = (content.match(new RegExp(term, 'g')) || []).length;
        score += matches * 0.1;
      }

      // Boost for type-specific matches
      if (query.includes('function') && chunk.type === ChunkType.CODE) {
        if (/\b(function|def|fn|func)\b/.test(chunk.content)) {
          score += 0.2;
        }
      }

      // Boost for signature chunks
      if (chunk.type === ChunkType.SIGNATURE) {
        score += 0.15;
      }

      scores.push({ chunkId: chunk.id, score, reason: 'keyword-match' });

      return { ...chunk, priority: Math.min(score, 1) };
    });

    if (this.config.cacheEmbeddings) {
      this.relevanceCache.set(cacheKey, scores);
    }

    return scored;
  }

  /**
   * Chunk and assemble in one operation
   */
  processContent(
    content: string,
    source: string,
    budget: ContextBudget,
    query?: string,
    options?: Partial<ChunkingOptions>
  ): ContextAssembly {
    // Create temporary chunker with custom options
    const customChunker = options ? 
      new SmartChunker(this.tokenCounter, options) : 
      this.chunker;

    const chunks = customChunker.chunkCode(content, source);
    return this.assembleContext(chunks, budget, query);
  }

  /**
   * Process conversation history
   */
  processConversation(
    messages: Array<{ role: string; content: string }>,
    budget: ContextBudget,
    query?: string
  ): ContextAssembly {
    const chunks = this.chunker.chunkConversation(messages);
    return this.assembleContext(chunks, budget, query);
  }

  /**
   * Compress content if needed
   */
  compressIfNeeded(content: string, maxTokens: number): CompressionResult {
    return this.compressor.compress(content, maxTokens);
  }

  /**
   * Get token count
   */
  countTokens(text: string): number {
    return this.tokenCounter.countTokens(text);
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.tokenCounter.clearCache();
    this.relevanceCache.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    embeddingCacheSize: number;
    tokenCacheSize: number;
  } {
    return {
      embeddingCacheSize: this.relevanceCache.size,
      tokenCacheSize: 0 // TokenCounter doesn't expose this
    };
  }

  /**
   * Simple hash for query caching
   */
  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let defaultContextManager: ContextManager | null = null;

export function getDefaultContextManager(config?: Partial<ContextManagerConfig>): ContextManager {
  if (!defaultContextManager) {
    defaultContextManager = new ContextManager(config);
  }
  return defaultContextManager;
}

export function createContextManager(config?: Partial<ContextManagerConfig>): ContextManager {
  return new ContextManager(config);
}

export default {
  ContextManager,
  TokenCounter,
  SmartChunker,
  ContextCompressor,
  ChunkType,
  CompressionMethod,
  getDefaultContextManager,
  createContextManager
};
