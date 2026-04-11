/**
 * Context Reader - Reads existing codebase for LLM context
 * 
 * Sends relevant files to LLM so it understands the project
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileContext {
  path: string;
  content: string;
  language: string;
}

export interface ProjectContext {
  rootPath: string;
  files: FileContext[];
  packageJson?: any;
  framework?: string;
  language?: string;
}

export class ContextReader {
  private workspaceRoot: string;
  private maxFileSize: number = 50000; // 50KB max per file
  private maxTotalSize: number = 100000; // 100KB total context

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Read project context for LLM
   */
  async readContext(): Promise<ProjectContext> {
    const files: FileContext[] = [];
    let totalSize = 0;

    // Read package.json if exists
    const packageJson = await this.readPackageJson();

    // Detect framework
    const framework = this.detectFramework(packageJson);
    const language = this.detectLanguage(packageJson);

    // Get important files
    const importantFiles = await this.getImportantFiles();

    for (const filePath of importantFiles) {
      try {
        const content = await this.readFile(filePath);
        if (!content) { continue; }

        const size = Buffer.byteLength(content, 'utf8');
        if (size > this.maxFileSize) { continue; }
        if (totalSize + size > this.maxTotalSize) { break; }

        files.push({
          path: filePath,
          content,
          language: this.detectLanguageFromPath(filePath)
        });

        totalSize += size;
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      rootPath: this.workspaceRoot,
      files,
      packageJson,
      framework,
      language
    };
  }

  /**
   * Read specific file
   */
  async readFile(relativePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.workspaceRoot, relativePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Format context for LLM prompt
   */
  formatContextForPrompt(context: ProjectContext): string {
    if (context.files.length === 0) {
      return '';
    }

    let prompt = '\n\nEXISTING PROJECT CONTEXT:\n';
    prompt += `Framework: ${context.framework || 'Unknown'}\n`;
    prompt += `Language: ${context.language || 'Unknown'}\n\n`;

    prompt += 'Existing files:\n';
    for (const file of context.files) {
      prompt += `\n--- ${file.path} ---\n`;
      // Truncate very long files
      const content = file.content.length > 2000 
        ? file.content.substring(0, 2000) + '\n... [truncated]'
        : file.content;
      prompt += content + '\n';
    }

    prompt += '\n\nWhen generating code, match the existing style and framework.\n';

    return prompt;
  }

  private async readPackageJson(): Promise<any | undefined> {
    try {
      const content = await this.readFile('package.json');
      return content ? JSON.parse(content) : undefined;
    } catch {
      return undefined;
    }
  }

  private async getImportantFiles(): Promise<string[]> {
    const importantPatterns = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'tailwind.config.js',
      'src/index.tsx',
      'src/index.ts',
      'src/App.tsx',
      'src/App.vue',
      'src/main.ts',
      'src/styles.css',
      'src/types/index.ts',
      'README.md'
    ];

    const existing: string[] = [];

    for (const pattern of importantPatterns) {
      try {
        const fullPath = path.join(this.workspaceRoot, pattern);
        await fs.access(fullPath);
        existing.push(pattern);
      } catch {
        // File doesn't exist, skip
      }
    }

    return existing;
  }

  private detectFramework(packageJson?: any): string | undefined {
    if (!packageJson) { return undefined; }
    
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps['next']) { return 'nextjs'; }
    if (deps['react']) { return 'react'; }
    if (deps['vue']) { return 'vue'; }
    if (deps['@angular/core']) { return 'angular'; }
    if (deps['express']) { return 'express'; }
    if (deps['fastify']) { return 'fastify'; }
    
    return undefined;
  }

  private detectLanguage(packageJson?: any): string | undefined {
    if (!packageJson) { return undefined; }
    
    if (packageJson.devDependencies?.['typescript']) { return 'typescript'; }
    if (packageJson.dependencies?.['typescript']) { return 'typescript'; }
    
    return 'javascript';
  }

  private detectLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath);
    const map: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.vue': 'vue',
      '.css': 'css',
      '.html': 'html',
      '.json': 'json'
    };
    return map[ext] || 'text';
  }
}
