/**
 * AST Parser Module
 * 
 * Multi-language AST parsing using Tree-sitter for symbol extraction,
 * import/export analysis, and reference finding.
 */

import * as fs from 'fs';
import * as path from 'path';

// Tree-sitter types (for optional dependency)
interface TreeSitterParser {
  setLanguage(language: unknown): void;
  parse(source: string): { rootNode: unknown };
}

// ============================================================================
// Interfaces
// ============================================================================

export interface SymbolInfo {
  name: string;
  type: SymbolType;
  kind: SymbolKind;
  location: SourceLocation;
  filePath: string;
  parent?: string;
  children: string[];
  modifiers: string[];
  documentation?: string;
  signature?: string;
  isExported: boolean;
  isAsync: boolean;
  isStatic: boolean;
  isAbstract: boolean;
  visibility: 'public' | 'private' | 'protected' | 'internal';
}

export type SymbolType = 
  | 'function' 
  | 'class' 
  | 'interface' 
  | 'type' 
  | 'enum' 
  | 'variable' 
  | 'constant'
  | 'property'
  | 'method'
  | 'constructor'
  | 'parameter'
  | 'import'
  | 'export'
  | 'namespace'
  | 'module';

export type SymbolKind = 
  | 'declaration' 
  | 'definition' 
  | 'reference' 
  | 'call' 
  | 'assignment';

export interface SourceLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  startOffset: number;
  endOffset: number;
}

export interface ParseResult {
  filePath: string;
  language: string;
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  errors: ParseError[];
  ast?: any; // Tree-sitter AST (optional, for advanced use)
}

export interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  isDefault: boolean;
  isNamespace: boolean;
  location: SourceLocation;
}

export interface ImportSpecifier {
  name: string;
  alias?: string;
  location: SourceLocation;
}

export interface ExportInfo {
  name: string;
  type: 'named' | 'default' | 'namespace' | 'reexport';
  source?: string;
  location: SourceLocation;
}

export interface ParseError {
  message: string;
  location: SourceLocation;
  severity: 'error' | 'warning';
}

export interface ReferenceInfo {
  symbol: string;
  location: SourceLocation;
  type: 'read' | 'write' | 'call';
  context: string;
}

export interface ParserOptions {
  includeDocumentation?: boolean;
  includeAST?: boolean;
  includeBody?: boolean;
  maxFileSize?: number; // in bytes
}

// ============================================================================
// Language Configuration
// ============================================================================

interface LanguageConfig {
  name: string;
  extensions: string[];
  parser?: any; // Tree-sitter parser instance
  grammar?: any; // Tree-sitter grammar
}

const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  typescript: {
    name: 'TypeScript',
    extensions: ['.ts', '.tsx'],
  },
  javascript: {
    name: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
  },
  python: {
    name: 'Python',
    extensions: ['.py', '.pyi'],
  },
  go: {
    name: 'Go',
    extensions: ['.go'],
  },
  rust: {
    name: 'Rust',
    extensions: ['.rs'],
  },
  java: {
    name: 'Java',
    extensions: ['.java'],
  },
  cpp: {
    name: 'C++',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
  },
  c: {
    name: 'C',
    extensions: ['.c', '.h'],
  },
};

// ============================================================================
// AST Parser Class
// ============================================================================

export class ASTParser {
  private parsers: Map<string, any> = new Map();
  private options: Required<ParserOptions>;
  private parseCache: Map<string, ParseResult> = new Map();
  private treeSitterAvailable: boolean = false;

  constructor(options: ParserOptions = {}) {
    this.options = {
      includeDocumentation: true,
      includeAST: false,
      includeBody: false,
      maxFileSize: 1024 * 1024, // 1MB
      ...options
    };
  }

  /**
   * Initialize parsers for supported languages
   */
  async initialize(): Promise<void> {
    // Dynamically import tree-sitter to avoid issues if not installed
    try {
      // @ts-ignore - tree-sitter is optional dependency
      await import('tree-sitter').catch(() => undefined);
      this.treeSitterAvailable = true;
      
      // Load language parsers
      await this.loadLanguageParser('typescript', 'tree-sitter-typescript');
      await this.loadLanguageParser('javascript', 'tree-sitter-javascript');
      await this.loadLanguageParser('python', 'tree-sitter-python');
      await this.loadLanguageParser('go', 'tree-sitter-go');
      await this.loadLanguageParser('rust', 'tree-sitter-rust');
      await this.loadLanguageParser('java', 'tree-sitter-java');
      await this.loadLanguageParser('cpp', 'tree-sitter-cpp');
      await this.loadLanguageParser('c', 'tree-sitter-c');
    } catch (error) {
      console.warn('Tree-sitter not available, using fallback regex parser');
      this.treeSitterAvailable = false;
    }
  }

  /**
   * Parse a single file and extract symbols
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    // Check cache
    if (this.parseCache.has(filePath)) {
      return this.parseCache.get(filePath)!;
    }

    const ext = path.extname(filePath);
    const language = this.detectLanguage(ext);

    if (!language) {
      return {
        filePath,
        language: 'unknown',
        symbols: [],
        imports: [],
        exports: [],
        errors: [{
          message: `Unsupported file extension: ${ext}`,
          location: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0, startOffset: 0, endOffset: 0 },
          severity: 'error'
        }]
      };
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      if (content.length > this.options.maxFileSize) {
        return {
          filePath,
          language,
          symbols: [],
          imports: [],
          exports: [],
          errors: [{
            message: `File too large: ${content.length} bytes`,
            location: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0, startOffset: 0, endOffset: 0 },
            severity: 'error'
          }]
        };
      }

      const result = await this.parseContent(content, filePath, language);
      this.parseCache.set(filePath, result);
      return result;
    } catch (error) {
      return {
        filePath,
        language,
        symbols: [],
        imports: [],
        exports: [],
        errors: [{
          message: `Failed to read file: ${error}`,
          location: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0, startOffset: 0, endOffset: 0 },
          severity: 'error'
        }]
      };
    }
  }

  /**
   * Extract all symbols from a file
   */
  async extractSymbols(filePath: string): Promise<SymbolInfo[]> {
    const result = await this.parseFile(filePath);
    return result.symbols;
  }

  /**
   * Find all references to a symbol
   */
  async findReferences(
    filePath: string, 
    symbolName: string,
    _options?: { includeExternal?: boolean }
  ): Promise<ReferenceInfo[]> {
    const result = await this.parseFile(filePath);
    const references: ReferenceInfo[] = [];

    // Search within the file
    for (const symbol of result.symbols) {
      if (symbol.name === symbolName || symbol.name.includes(symbolName)) {
        references.push({
          symbol: symbol.name,
          location: symbol.location,
          type: 'read',
          context: this.extractContext(result, symbol.location)
        });
      }
    }

    return references;
  }

  /**
   * Find symbol definition
   */
  async findDefinition(
    filePath: string,
    symbolName: string
  ): Promise<SymbolInfo | null> {
    const result = await this.parseFile(filePath);
    
    return result.symbols.find(s => 
      s.name === symbolName && 
      (s.kind === 'definition' || s.kind === 'declaration')
    ) || null;
  }

  /**
   * Get import statements from a file
   */
  async getImports(filePath: string): Promise<ImportInfo[]> {
    const result = await this.parseFile(filePath);
    return result.imports;
  }

  /**
   * Get export statements from a file
   */
  async getExports(filePath: string): Promise<ExportInfo[]> {
    const result = await this.parseFile(filePath);
    return result.exports;
  }

  /**
   * Parse multiple files in batch
   */
  async parseFiles(filePaths: string[]): Promise<ParseResult[]> {
    const results: ParseResult[] = [];
    
    // Process in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(fp => this.parseFile(fp))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get file outline (top-level symbols only)
   */
  async getFileOutline(filePath: string): Promise<SymbolInfo[]> {
    const symbols = await this.extractSymbols(filePath);
    return symbols.filter(s => !s.parent);
  }

  /**
   * Clear parse cache
   */
  clearCache(): void {
    this.parseCache.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadLanguageParser(language: string, packageName: string): Promise<void> {
    try {
      const languageModule = await import(packageName);
      this.parsers.set(language, languageModule.default || languageModule);
    } catch (error) {
      console.warn(`Failed to load ${packageName}:`, error);
    }
  }

  private detectLanguage(ext: string): string | null {
    for (const [lang, config] of Object.entries(SUPPORTED_LANGUAGES)) {
      if (config.extensions.includes(ext)) {
        return lang;
      }
    }
    return null;
  }

  private async parseContent(
    content: string, 
    filePath: string, 
    language: string
  ): Promise<ParseResult> {
    const parser = this.parsers.get(language);

    if (parser) {
      try {
        return this.parseWithTreeSitter(content, filePath, language, parser);
      } catch (error) {
        console.warn(`Tree-sitter parse failed for ${filePath}, using fallback`);
        return this.parseWithRegex(content, filePath, language);
      }
    }

    return this.parseWithRegex(content, filePath, language);
  }

  private parseWithTreeSitter(
    content: string,
    filePath: string,
    language: string,
    languageModule: any
  ): ParseResult {
    // Tree-sitter full integration is not yet implemented; fall back to regex parser
    // so callers always get real symbol data rather than an empty result.
    return this.parseWithRegex(content, filePath, language);
  }

  private parseWithRegex(
    content: string,
    filePath: string,
    language: string
  ): ParseResult {
    const symbols: SymbolInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    const errors: ParseError[] = [];

    const lines = content.split('\n');

    switch (language) {
      case 'typescript':
      case 'javascript':
        this.parseTypeScript(content, lines, symbols, imports, exports);
        break;
      case 'python':
        this.parsePython(content, lines, symbols, imports, exports);
        break;
      case 'go':
        this.parseGo(content, lines, symbols, imports, exports);
        break;
      case 'rust':
        this.parseRust(content, lines, symbols, imports, exports);
        break;
      case 'java':
        this.parseJava(content, lines, symbols, imports, exports);
        break;
      default:
        errors.push({
          message: `Fallback parsing not implemented for ${language}`,
          location: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0, startOffset: 0, endOffset: 0 },
          severity: 'warning'
        });
    }

    return {
      filePath,
      language,
      symbols,
      imports,
      exports,
      errors
    };
  }

  private parseTypeScript(
    content: string,
    lines: string[],
    symbols: SymbolInfo[],
    imports: ImportInfo[],
    exports: ExportInfo[]
  ): void {
    // Import statements
    const importRegex = /import\s+(?:(\{[^}]*\})|(\*\s+as\s+(\w+))|(\w+))?\s*(?:from\s+)?['"]([^'"]+)['"];?/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const specifiers: ImportSpecifier[] = [];
      
      if (match[1]) {
        // Named imports
        const named = match[1].replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
        named.forEach(n => {
          const [name, alias] = n.split(/\s+as\s+/).map(s => s.trim());
          specifiers.push({ name, alias, location: this.getLocation(content, match!.index) });
        });
      }

      imports.push({
        source: match[5],
        specifiers,
        isDefault: !!match[4],
        isNamespace: !!match[2],
        location: this.getLocation(content, match.index)
      });
    }

    // Export statements
    const exportRegex = /export\s+(?:default\s+)?(?:async\s+)?(?:function\s+(\w+)|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+)|enum\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g;
    while ((match = exportRegex.exec(content)) !== null) {
      const name = match.slice(1).find(m => m) || 'default';
      const isDefault = content.substring(match.index, match.index + 15).includes('default');
      
      exports.push({
        name,
        type: isDefault ? 'default' : 'named',
        location: this.getLocation(content, match.index)
      });

      // Also add as symbol
      let symbolType: SymbolType = 'function';
      if (match[2]) symbolType = 'class';
      if (match[3]) symbolType = 'interface';
      if (match[4]) symbolType = 'type';
      if (match[5]) symbolType = 'enum';
      if (match[6] || match[7] || match[8]) symbolType = 'variable';

      symbols.push({
        name,
        type: symbolType,
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: isDefault ? ['export', 'default'] : ['export'],
        isExported: true,
        isAsync: content.substring(match.index, match.index + 20).includes('async'),
        isStatic: false,
        isAbstract: content.substring(match.index, match.index + 30).includes('abstract'),
        visibility: 'public'
      });
    }

    // Class methods and properties
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const classStart = match.index;
      
      // Find class body
      let braceCount = 1;
      let classEnd = classStart;
      for (let i = content.indexOf('{', classStart) + 1; i < content.length && braceCount > 0; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        classEnd = i;
      }

      const classBody = content.substring(content.indexOf('{', classStart), classEnd + 1);
      
      // Extract methods
      const methodRegex = /(?:async\s+)?(?:static\s+)?(?:private\s+|protected\s+|public\s+)?(?:abstract\s+)?(?:get\s+|set\s+)?(\w+)\s*\(/g;
      let methodMatch;
      while ((methodMatch = methodRegex.exec(classBody)) !== null) {
        const methodName = methodMatch[1];
        if (methodName === 'constructor') {
          symbols.push({
            name: `${className}.constructor`,
            type: 'constructor',
            kind: 'definition',
            location: this.getLocation(content, classStart + methodMatch.index),
            filePath: '',
            parent: className,
            children: [],
            modifiers: ['public'],
            isExported: false,
            isAsync: false,
            isStatic: false,
            isAbstract: false,
            visibility: 'public'
          });
        } else {
          const modifiers: string[] = [];
          const methodPrefix = classBody.substring(Math.max(0, methodMatch.index - 50), methodMatch.index);
          if (methodPrefix.includes('static')) modifiers.push('static');
          if (methodPrefix.includes('async')) modifiers.push('async');
          if (methodPrefix.includes('abstract')) modifiers.push('abstract');
          if (methodPrefix.includes('private')) modifiers.push('private');
          if (methodPrefix.includes('protected')) modifiers.push('protected');
          if (methodPrefix.includes('get ')) modifiers.push('getter');
          if (methodPrefix.includes('set ')) modifiers.push('setter');

          symbols.push({
            name: `${className}.${methodName}`,
            type: 'method',
            kind: 'definition',
            location: this.getLocation(content, classStart + methodMatch.index),
            filePath: '',
            parent: className,
            children: [],
            modifiers,
            isExported: false,
            isAsync: modifiers.includes('async'),
            isStatic: modifiers.includes('static'),
            isAbstract: modifiers.includes('abstract'),
            visibility: methodPrefix.includes('private') ? 'private' : 
                       methodPrefix.includes('protected') ? 'protected' : 'public'
          });
        }
      }
    }

    // Functions
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
    while ((match = funcRegex.exec(content)) !== null) {
      const isExported = content.substring(Math.max(0, match.index - 10), match.index).includes('export');
      const isAsync = content.substring(Math.max(0, match.index - 10), match.index).includes('async');
      
      symbols.push({
        name: match[1],
        type: 'function',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: isExported ? ['export'] : [],
        isExported,
        isAsync,
        isStatic: false,
        isAbstract: false,
        visibility: 'public'
      });
    }

    // Interfaces
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?\s*\{/g;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const isExported = content.substring(Math.max(0, match.index - 10), match.index).includes('export');
      
      symbols.push({
        name: match[1],
        type: 'interface',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: isExported ? ['export'] : [],
        isExported,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        visibility: 'public'
      });
    }
  }

  private parsePython(
    content: string,
    lines: string[],
    symbols: SymbolInfo[],
    imports: ImportInfo[],
    exports: ExportInfo[]
  ): void {
    // Import statements
    const importRegex = /^(?:from\s+([\w.]+)\s+import\s+([\w,\s*]+)|import\s+([\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+(?:\s+as\s+\w+)?)*))/gm;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1] || match[3];
      const specifiers: ImportSpecifier[] = [];
      
      if (match[2]) {
        match[2].split(',').forEach(s => {
          const [name, alias] = s.trim().split(/\s+as\s+/);
          specifiers.push({ name: name.trim(), alias: alias?.trim(), location: this.getLocation(content, match!.index) });
        });
      }

      imports.push({
        source,
        specifiers,
        isDefault: false,
        isNamespace: false,
        location: this.getLocation(content, match.index)
      });
    }

    // Classes
    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:/gm;
    while ((match = classRegex.exec(content)) !== null) {
      symbols.push({
        name: match[1],
        type: 'class',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: [],
        isExported: true,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        visibility: 'public'
      });
    }

    // Functions
    const funcRegex = /^(?:async\s+)?def\s+(\w+)\s*\(/gm;
    while ((match = funcRegex.exec(content)) !== null) {
      symbols.push({
        name: match[1],
        type: 'function',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: [],
        isExported: true,
        isAsync: content.substring(match.index, match.index + 10).includes('async'),
        isStatic: false,
        isAbstract: false,
        visibility: 'public'
      });
    }
  }

  private parseGo(
    content: string,
    lines: string[],
    symbols: SymbolInfo[],
    imports: ImportInfo[],
    exports: ExportInfo[]
  ): void {
    // Imports
    const importRegex = /import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const importList = match[1] || match[2];
      if (importList) {
        const singleImports = importList.match(/"([^"]+)"/g) || [];
        singleImports.forEach(imp => {
          imports.push({
            source: imp.replace(/"/g, ''),
            specifiers: [],
            isDefault: false,
            isNamespace: false,
            location: this.getLocation(content, match!.index)
          });
        });
      }
    }

    // Functions (exported if capitalized)
    const funcRegex = /^func\s+(?:\([^)]*\)\s+)?(\w+)/gm;
    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1];
      const isExported = name[0] === name[0].toUpperCase();
      
      symbols.push({
        name,
        type: 'function',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: isExported ? ['exported'] : [],
        isExported,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        visibility: isExported ? 'public' : 'private'
      });
    }

    // Types
    const typeRegex = /^type\s+(\w+)/gm;
    while ((match = typeRegex.exec(content)) !== null) {
      const name = match[1];
      const isExported = name[0] === name[0].toUpperCase();
      
      symbols.push({
        name,
        type: 'type',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: isExported ? ['exported'] : [],
        isExported,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        visibility: isExported ? 'public' : 'private'
      });
    }
  }

  private parseRust(
    content: string,
    lines: string[],
    symbols: SymbolInfo[],
    imports: ImportInfo[],
    exports: ExportInfo[]
  ): void {
    // Use statements
    const useRegex = /use\s+([\w:]+);/g;
    let match: RegExpExecArray | null;
    while ((match = useRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [],
        isDefault: false,
        isNamespace: false,
        location: this.getLocation(content, match.index)
      });
    }

    // Functions
    const funcRegex = /(?:pub\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)/g;
    while ((match = funcRegex.exec(content)) !== null) {
      const prefix = content.substring(Math.max(0, match.index - 20), match.index);
      const isExported = prefix.includes('pub');
      
      symbols.push({
        name: match[1],
        type: 'function',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: prefix.includes('async') ? ['async'] : [],
        isExported,
        isAsync: prefix.includes('async'),
        isStatic: false,
        isAbstract: false,
        visibility: isExported ? 'public' : 'private'
      });
    }

    // Structs
    const structRegex = /(?:pub\s+)?struct\s+(\w+)/g;
    while ((match = structRegex.exec(content)) !== null) {
      const prefix = content.substring(Math.max(0, match.index - 10), match.index);
      const isExported = prefix.includes('pub');
      
      symbols.push({
        name: match[1],
        type: 'class',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: [],
        isExported,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        visibility: isExported ? 'public' : 'private'
      });
    }

    // Traits
    const traitRegex = /(?:pub\s+)?trait\s+(\w+)/g;
    while ((match = traitRegex.exec(content)) !== null) {
      const prefix = content.substring(Math.max(0, match.index - 10), match.index);
      const isExported = prefix.includes('pub');
      
      symbols.push({
        name: match[1],
        type: 'interface',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: [],
        isExported,
        isAsync: false,
        isStatic: false,
        isAbstract: true,
        visibility: isExported ? 'public' : 'private'
      });
    }
  }

  private parseJava(
    content: string,
    lines: string[],
    symbols: SymbolInfo[],
    imports: ImportInfo[],
    exports: ExportInfo[]
  ): void {
    // Imports
    const importRegex = /import\s+(?:static\s+)?([\w.]+);/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [],
        isDefault: false,
        isNamespace: false,
        location: this.getLocation(content, match.index)
      });
    }

    // Classes
    const classRegex = /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      const prefix = content.substring(Math.max(0, match.index - 50), match.index);
      
      symbols.push({
        name: match[1],
        type: 'class',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: this.extractModifiers(prefix),
        isExported: prefix.includes('public'),
        isAsync: false,
        isStatic: prefix.includes('static'),
        isAbstract: prefix.includes('abstract'),
        visibility: prefix.includes('private') ? 'private' : 
                   prefix.includes('protected') ? 'protected' : 'public'
      });
    }

    // Methods
    const methodRegex = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:abstract\s+)?(?:final\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/g;
    while ((match = methodRegex.exec(content)) !== null) {
      const prefix = content.substring(Math.max(0, match.index - 100), match.index);
      
      symbols.push({
        name: match[1],
        type: 'method',
        kind: 'definition',
        location: this.getLocation(content, match.index),
        filePath: '',
        children: [],
        modifiers: this.extractModifiers(prefix),
        isExported: prefix.includes('public'),
        isAsync: false,
        isStatic: prefix.includes('static'),
        isAbstract: prefix.includes('abstract'),
        visibility: prefix.includes('private') ? 'private' : 
                   prefix.includes('protected') ? 'protected' : 'public'
      });
    }
  }

  private extractModifiers(prefix: string): string[] {
    const modifiers: string[] = [];
    if (prefix.includes('public')) modifiers.push('public');
    if (prefix.includes('private')) modifiers.push('private');
    if (prefix.includes('protected')) modifiers.push('protected');
    if (prefix.includes('static')) modifiers.push('static');
    if (prefix.includes('abstract')) modifiers.push('abstract');
    if (prefix.includes('final')) modifiers.push('final');
    return modifiers;
  }

  private getLocation(content: string, offset: number): SourceLocation {
    const lines = content.substring(0, offset).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    return {
      startLine: line,
      startColumn: column,
      endLine: line,
      endColumn: column + 10, // Approximate
      startOffset: offset,
      endOffset: offset + 10
    };
  }

  private extractContext(result: ParseResult, location: SourceLocation): string {
    // This would extract surrounding code context
    return '';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createASTParser(options?: ParserOptions): ASTParser {
  return new ASTParser(options);
}

export async function parseFile(filePath: string, options?: ParserOptions): Promise<ParseResult> {
  const parser = new ASTParser(options);
  await parser.initialize();
  return parser.parseFile(filePath);
}

export async function extractSymbols(filePath: string): Promise<SymbolInfo[]> {
  const parser = new ASTParser();
  await parser.initialize();
  return parser.extractSymbols(filePath);
}
