/**
 * File Writer - Actually writes files to disk
 * 
 * Real fs operations. No mocks. No dummies.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface GeneratedFile {
  path: string;           // Relative path: "src/App.tsx"
  content: string;        // Full file content
}

export interface GenerationResult {
  files: GeneratedFile[] | Record<string, string>;  // Array or object map
  description?: string;
  dependencies?: string[];
  commands?: string[];
}

export interface FileWriteOperation {
  absolutePath: string;
  content: string;
  created: boolean;       // true if new, false if updated
}

export interface WriteResult {
  success: boolean;
  operations: FileWriteOperation[];
  error?: string;
}

export class FileWriter {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Write a single file
   * Creates directories if needed
   * Returns whether file was created or updated
   */
  async writeFile(relativePath: string, content: string): Promise<FileWriteOperation> {
    // Validate path - prevent directory traversal
    const resolvedPath = path.resolve(this.workspaceRoot, relativePath);
    if (!resolvedPath.startsWith(this.workspaceRoot)) {
      throw new Error(`Invalid path: ${relativePath} (attempts to escape workspace)`);
    }

    // Check if file already exists
    const existed = await this.exists(relativePath);

    // Create directory structure
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(resolvedPath, content, 'utf-8');

    return {
      absolutePath: resolvedPath,
      content,
      created: !existed
    };
  }

  /**
   * Write multiple files from generation result
   */
  async writeGenerationResult(result: GenerationResult): Promise<WriteResult> {
    const operations: FileWriteOperation[] = [];

    try {
      // Handle both array format and record format
      const files = Array.isArray(result.files) 
        ? result.files 
        : Object.entries(result.files as Record<string, string>).map(([path, content]) => ({ path, content }));
      
      for (const file of files) {
        const op = await this.writeFile(file.path, file.content);
        operations.push(op);
      }

      return {
        success: true,
        operations
      };

    } catch (error) {
      return {
        success: false,
        operations,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if file exists
   */
  async exists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.workspaceRoot, relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read existing file
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.resolve(this.workspaceRoot, relativePath);
    return fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Get list of files in directory
   */
  async listFiles(dirPath: string = ''): Promise<string[]> {
    const fullPath = path.resolve(this.workspaceRoot, dirPath);
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files: string[] = [];
      
      for (const entry of entries) {
        const relativePath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively list subdirectories
          const subFiles = await this.listFiles(relativePath);
          files.push(...subFiles);
        } else {
          files.push(relativePath);
        }
      }
      
      return files;
    } catch {
      return [];
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = path.resolve(this.workspaceRoot, relativePath);
    await fs.unlink(fullPath);
  }

  /**
   * Create directory
   */
  async createDirectory(relativePath: string): Promise<void> {
    const fullPath = path.resolve(this.workspaceRoot, relativePath);
    await fs.mkdir(fullPath, { recursive: true });
  }
}
