/**
 * File Discovery Module
 * 
 * Intelligent file discovery with relevance scoring, ripgrep integration,
 * and file ranking based on imports, exports, and references.
 */

import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

// ============================================================================
// Interfaces
// ============================================================================

export interface FileInfo {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  lastModified: Date;
  language: string;
  relevanceScore: number;
  importCount: number;
  exportCount: number;
  referenceCount: number;
  isTest: boolean;
  isConfig: boolean;
  isEntry: boolean;
}

export interface DiscoveryOptions {
  rootPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  minRelevanceScore?: number;
  respectGitignore?: boolean;
}

export interface SearchResult {
  files: FileInfo[];
  totalCount: number;
  filteredCount: number;
  searchTime: number;
}

export interface FileContext {
  file: FileInfo;
  content: string;
  imports: string[];
  exports: string[];
  dependencies: string[];
  dependents: string[];
}

// ============================================================================
// Constants
// ============================================================================

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

const DEFAULT_INCLUDE_PATTERNS = [
  '*.{ts,tsx,js,jsx,py,go,rs,java,cpp,c,h,hpp}'
];

const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '*.test.*',
  '*.spec.*',
  '__tests__',
  '__mocks__',
  '*.min.js',
  '*.bundle.js'
];

const ENTRY_FILE_PATTERNS = [
  /index\.(ts|tsx|js|jsx)$/i,
  /main\.(ts|tsx|js|jsx)$/i,
  /app\.(ts|tsx|js|jsx)$/i,
  /server\.(ts|tsx|js|jsx)$/i,
  /cli\.(ts|tsx|js|jsx)$/i
];

const TEST_FILE_PATTERNS = [
  /\.(test|spec)\./i,
  /__tests__/i,
  /__mocks__/i,
  /test\/.*\.(ts|js)$/i
];

const CONFIG_FILE_PATTERNS = [
  /\.(config|rc)\./i,
  /tsconfig\.json/i,
  /package\.json/i,
  /webpack\./i,
  /vite\./i,
  /eslint/i,
  /prettier/i,
  /jest\./i
];

// ============================================================================
// File Discovery Class
// ============================================================================

export class FileDiscovery {
  private options: Required<DiscoveryOptions>;
  private fileCache: Map<string, FileInfo> = new Map();
  private referenceMap: Map<string, Set<string>> = new Map();

  constructor(options: DiscoveryOptions) {
    this.options = {
      includePatterns: DEFAULT_INCLUDE_PATTERNS,
      excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
      maxDepth: 10,
      minRelevanceScore: 0,
      respectGitignore: true,
      ...options
    };
  }

  /**
   * Discover files in the codebase with intelligent filtering
   */
  async discoverFiles(customPatterns?: string[]): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      const patterns = customPatterns || this.options.includePatterns;
      const files = await this.runRipgrepSearch(patterns);
      const fileInfos = await Promise.all(
        files.map(filePath => this.analyzeFile(filePath))
      );

      // Filter by relevance score and calculate rankings
      const filteredFiles = fileInfos
        .filter(f => f.relevanceScore >= this.options.minRelevanceScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Build reference map for dependency tracking
      this.buildReferenceMap(filteredFiles);

      // Update reference counts
      filteredFiles.forEach(file => {
        file.referenceCount = this.referenceMap.get(file.path)?.size || 0;
      });

      // Re-sort with updated reference counts
      filteredFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

      const searchTime = Date.now() - startTime;

      return {
        files: filteredFiles,
        totalCount: files.length,
        filteredCount: filteredFiles.length,
        searchTime
      };
    } catch (error) {
      console.error('File discovery failed:', error);
      return {
        files: [],
        totalCount: 0,
        filteredCount: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Rank files by relevance to a query or context
   */
  rankByRelevance(files: FileInfo[], context?: {
    query?: string;
    targetFiles?: string[];
    importGraph?: Map<string, string[]>;
  }): FileInfo[] {
    const ranked = [...files];

    ranked.forEach(file => {
      let score = file.relevanceScore;

      // Boost based on file type
      if (file.isEntry) score *= 1.5;
      if (file.isConfig) score *= 1.2;
      if (!file.isTest) score *= 1.3;

      // Boost based on connectivity
      score += Math.log(file.importCount + 1) * 0.5;
      score += Math.log(file.referenceCount + 1) * 0.7;

      // Query-based ranking
      if (context?.query) {
        const queryLower = context.query.toLowerCase();
        const nameLower = file.name.toLowerCase();
        const pathLower = file.relativePath.toLowerCase();

        if (nameLower.includes(queryLower)) score *= 2;
        if (pathLower.includes(queryLower)) score *= 1.5;
      }

      // Target file proximity
      if (context?.targetFiles) {
        const isTarget = context.targetFiles.some(target => 
          file.path === target || file.path.endsWith(target)
        );
        if (isTarget) score *= 3;
      }

      // Import graph proximity
      if (context?.importGraph) {
        const depth = this.calculateImportDepth(file.path, context.importGraph);
        score *= Math.max(0.5, 1 - depth * 0.1);
      }

      file.relevanceScore = score;
    });

    return ranked.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get comprehensive context for a file
   */
  async getFileContext(filePath: string): Promise<FileContext | null> {
    try {
      const fileInfo = this.fileCache.get(filePath);
      if (!fileInfo) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const imports = this.extractImports(content, fileInfo.extension);
      const exports = this.extractExports(content, fileInfo.extension);
      const dependencies = imports;
      const dependents = Array.from(this.referenceMap.get(filePath) || []);

      return {
        file: fileInfo,
        content,
        imports,
        exports,
        dependencies,
        dependents
      };
    } catch (error) {
      console.error(`Failed to get context for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Quick file search using ripgrep
   */
  async quickSearch(pattern: string, filePattern?: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const args = ['-l', '--type-add', 'custom:*.{ts,tsx,js,jsx,py,go,rs}'];
      
      if (filePattern) {
        args.push('-g', filePattern);
      }

      this.options.excludePatterns.forEach(exclude => {
        args.push('-g', `!${exclude}`);
      });

      args.push(pattern, this.options.rootPath);

      const rg = spawn('rg', args);
      const results: string[] = [];

      rg.stdout.on('data', (data) => {
        results.push(...data.toString().trim().split('\n').filter(Boolean));
      });

      rg.on('close', (code) => {
        if (code === 0 || code === 1) {
          resolve(results);
        } else {
          reject(new Error(`ripgrep exited with code ${code}`));
        }
      });

      rg.on('error', (error) => {
        // Fallback to grep if ripgrep not available
        this.fallbackGrepSearch(pattern).then(resolve).catch(reject);
      });
    });
  }

  /**
   * Find files that import a specific module
   */
  async findFilesImporting(moduleName: string): Promise<FileInfo[]> {
    const files = await this.discoverFiles();
    const importingFiles: FileInfo[] = [];

    for (const file of files.files) {
      const context = await this.getFileContext(file.path);
      if (context && context.imports.some(imp => imp.includes(moduleName))) {
        importingFiles.push(file);
      }
    }

    return importingFiles;
  }

  /**
   * Get file statistics summary
   */
  async getStatistics(): Promise<{
    totalFiles: number;
    byLanguage: Record<string, number>;
    totalLines: number;
    averageFileSize: number;
    testFiles: number;
    configFiles: number;
    entryFiles: number;
  }> {
    const result = await this.discoverFiles();
    const files = result.files;

    const byLanguage: Record<string, number> = {};
    let totalLines = 0;
    let totalSize = 0;
    let testFiles = 0;
    let configFiles = 0;
    let entryFiles = 0;

    for (const file of files) {
      byLanguage[file.language] = (byLanguage[file.language] || 0) + 1;
      totalSize += file.size;
      if (file.isTest) testFiles++;
      if (file.isConfig) configFiles++;
      if (file.isEntry) entryFiles++;

      // Estimate lines from size (rough approximation)
      totalLines += Math.ceil(file.size / 40);
    }

    return {
      totalFiles: files.length,
      byLanguage,
      totalLines,
      averageFileSize: files.length > 0 ? totalSize / files.length : 0,
      testFiles,
      configFiles,
      entryFiles
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async runRipgrepSearch(patterns: string[]): Promise<string[]> {
    const allFiles = new Set<string>();

    for (const pattern of patterns) {
      try {
        const files = await this.executeRipgrep(pattern);
        files.forEach(f => allFiles.add(f));
      } catch (error) {
        console.warn(`Ripgrep search failed for pattern ${pattern}, using fallback`);
        const files = await this.fallbackFileSearch(pattern);
        files.forEach(f => allFiles.add(f));
      }
    }

    return Array.from(allFiles);
  }

  private executeRipgrep(pattern: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '--files',
        '--type-add', 'custom:*.{ts,tsx,js,jsx,py,go,rs,java,cpp,c,h,hpp}',
        '-tcustom'
      ];

      this.options.excludePatterns.forEach(exclude => {
        args.push('-g', `!${exclude}`);
      });

      if (this.options.respectGitignore) {
        args.push('--ignore-file', '.gitignore');
      }

      args.push(this.options.rootPath);

      const rg = spawn('rg', args);
      const results: string[] = [];

      rg.stdout.on('data', (data) => {
        results.push(...data.toString().trim().split('\n').filter(Boolean));
      });

      rg.on('close', (code) => {
        if (code === 0 || code === 1) {
          resolve(results);
        } else {
          reject(new Error(`ripgrep exited with code ${code}`));
        }
      });

      rg.on('error', () => {
        reject(new Error('ripgrep not available'));
      });
    });
  }

  private async fallbackFileSearch(pattern: string): Promise<string[]> {
    const files: string[] = [];
    const globPattern = pattern.replace(/\*\*/g, '*');

    const walkDir = async (dir: string, depth: number) => {
      if (depth > this.options.maxDepth) return;

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.options.rootPath, fullPath);

        // Check exclude patterns
        if (this.shouldExclude(relativePath)) continue;

        if (entry.isDirectory()) {
          await walkDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          if (this.matchesPattern(entry.name, globPattern)) {
            files.push(fullPath);
          }
        }
      }
    };

    await walkDir(this.options.rootPath, 0);
    return files;
  }

  private async fallbackGrepSearch(pattern: string): Promise<string[]> {
    try {
      const result = execSync(
        `grep -r -l "${pattern}" ${this.options.rootPath} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true`,
        { encoding: 'utf-8' }
      );
      return result.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private async analyzeFile(filePath: string): Promise<FileInfo> {
    // Check cache first
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath);
    const relativePath = path.relative(this.options.rootPath, filePath);

    // Read file content for analysis
    let content = '';
    let importCount = 0;
    let exportCount = 0;

    try {
      content = await fs.readFile(filePath, 'utf-8');
      importCount = this.extractImports(content, ext).length;
      exportCount = this.extractExports(content, ext).length;
    } catch {
      // File might be binary or unreadable
    }

    // Calculate base relevance score
    const relevanceScore = this.calculateBaseRelevance(stats, content, ext);

    const fileInfo: FileInfo = {
      path: filePath,
      relativePath,
      name,
      extension: ext,
      size: stats.size,
      lastModified: stats.mtime,
      language: LANGUAGE_MAP[ext] || 'unknown',
      relevanceScore,
      importCount,
      exportCount,
      referenceCount: 0,
      isTest: TEST_FILE_PATTERNS.some(p => p.test(relativePath)),
      isConfig: CONFIG_FILE_PATTERNS.some(p => p.test(name)),
      isEntry: ENTRY_FILE_PATTERNS.some(p => p.test(name))
    };

    this.fileCache.set(filePath, fileInfo);
    return fileInfo;
  }

  private calculateBaseRelevance(stats: any, content: string, ext: string): number {
    let score = 1.0;

    // Size factor (prefer medium-sized files)
    const sizeKB = stats.size / 1024;
    if (sizeKB < 1) score *= 0.7;
    else if (sizeKB > 500) score *= 0.8;
    else score *= 1.2;

    // Content complexity
    const lines = content.split('\n').length;
    const codeLines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
    const complexity = codeLines / Math.max(lines, 1);
    score *= (0.8 + complexity * 0.4);

    // Language preference
    const preferredLangs = ['.ts', '.tsx', '.rs', '.go'];
    if (preferredLangs.includes(ext)) score *= 1.3;

    // Recency bonus
    const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    score *= Math.max(0.5, 1 - daysSinceModified / 365);

    return score;
  }

  private extractImports(content: string, ext: string): string[] {
    const imports: string[] = [];

    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      // ES6 imports
      const es6Regex = /import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"];?/g;
      let match;
      while ((match = es6Regex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // CommonJS requires
      const cjsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = cjsRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    } else if (ext === '.py') {
      const pyRegex = /^(?:from|import)\s+([\w.]+)/gm;
      let match;
      while ((match = pyRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    } else if (ext === '.go') {
      const goRegex = /import\s+\(?\s*(?:"([^"]+)"|\w+\s+"([^"]+)")\s*\)?/g;
      let match;
      while ((match = goRegex.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    } else if (ext === '.rs') {
      const rsRegex = /use\s+([\w:]+)/g;
      let match;
      while ((match = rsRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  private extractExports(content: string, ext: string): string[] {
    const exports: string[] = [];

    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      // Named exports
      const namedRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
      let match;
      while ((match = namedRegex.exec(content)) !== null) {
        exports.push(match[1]);
      }

      // Default export
      const defaultRegex = /export\s+default\s+(?:class|function)?\s*(\w+)?/g;
      while ((match = defaultRegex.exec(content)) !== null) {
        exports.push(match[1] || 'default');
      }

      // Export from
      const reexportRegex = /export\s+.*\s+from\s+['"]([^'"]+)['"];?/g;
      while ((match = reexportRegex.exec(content)) !== null) {
        exports.push(`from:${match[1]}`);
      }
    }

    return exports;
  }

  private buildReferenceMap(files: FileInfo[]): void {
    this.referenceMap.clear();

    for (const file of files) {
      if (!this.referenceMap.has(file.path)) {
        this.referenceMap.set(file.path, new Set());
      }
    }

    // Build cross-references
    for (const file of files) {
      for (const otherFile of files) {
        if (file.path === otherFile.path) continue;

        // Check if otherFile imports from file
        const otherContext = this.fileCache.get(otherFile.path);
        if (otherContext) {
          // This is a simplified check - in reality, you'd resolve the import path
          const fileName = path.basename(file.path, file.extension);
          if (otherFile.name.includes(fileName) || 
              (otherContext as any).imports?.some((imp: string) => imp.includes(fileName))) {
            this.referenceMap.get(file.path)?.add(otherFile.path);
          }
        }
      }
    }
  }

  private calculateImportDepth(
    filePath: string, 
    importGraph: Map<string, string[]>,
    visited: Set<string> = new Set(),
    depth: number = 0
  ): number {
    if (visited.has(filePath)) return depth;
    visited.add(filePath);

    const imports = importGraph.get(filePath) || [];
    if (imports.length === 0) return depth;

    let maxDepth = depth;
    for (const imp of imports) {
      maxDepth = Math.max(maxDepth, this.calculateImportDepth(imp, importGraph, visited, depth + 1));
    }

    return maxDepth;
  }

  private shouldExclude(relativePath: string): boolean {
    return this.options.excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern);
    });
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(filename);
    }
    return filename === pattern;
  }

  /**
   * Clear the file cache
   */
  clearCache(): void {
    this.fileCache.clear();
    this.referenceMap.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createFileDiscovery(options: DiscoveryOptions): FileDiscovery {
  return new FileDiscovery(options);
}

export async function discoverFiles(
  rootPath: string, 
  options?: Partial<DiscoveryOptions>
): Promise<SearchResult> {
  const discovery = new FileDiscovery({
    rootPath,
    ...options
  });
  return discovery.discoverFiles();
}
