/**
 * OpenKode File Utilities
 * =======================
 * 
 * Provides file operations with proper error handling,
 * path normalization, and VSCode workspace integration.
 */

import * as vscode from 'vscode';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmdirSync,
  renameSync,
  copyFileSync,
  createReadStream,
  createWriteStream,
  promises as fsPromises
} from 'fs';
import { join, resolve, relative, dirname, basename, extname, normalize, sep, posix } from 'path';
import { createHash } from 'crypto';
import { Logger } from './logger';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * File information
 */
export interface FileInfo {
  /** Absolute path */
  path: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** File name */
  name: string;
  /** File extension */
  extension: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  modified: Date;
  /** Creation timestamp */
  created: Date;
  /** Is directory */
  isDirectory: boolean;
  /** Is file */
  isFile: boolean;
  /** Is symbolic link */
  isSymbolicLink: boolean;
}

/**
 * File search options
 */
export interface FileSearchOptions {
  /** Include pattern (glob) */
  include?: string | string[];
  /** Exclude pattern (glob) */
  exclude?: string | string[];
  /** Maximum depth to search */
  maxDepth?: number;
  /** Current depth (internal use) */
  currentDepth?: number;
  /** Include hidden files */
  includeHidden?: boolean;
  /** Filter function */
  filter?: (info: FileInfo) => boolean;
}

/**
 * File operation result
 */
export interface FileOperationResult<T = unknown> {
  /** Success status */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Full error object */
  errorObject?: Error;
}

/**
 * Directory tree node
 */
export interface DirectoryTree {
  /** Node name */
  name: string;
  /** Full path */
  path: string;
  /** Is directory */
  isDirectory: boolean;
  /** Children (if directory) */
  children?: DirectoryTree[];
  /** File size (if file) */
  size?: number;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

const logger = new Logger('FileUtils');

/**
 * Get the workspace root folder
 */
export function getWorkspaceRoot(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }
  return workspaceFolders[0].uri.fsPath;
}

/**
 * Resolve a path relative to workspace root
 */
export function resolveWorkspacePath(relativePath: string): string {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return resolve(relativePath);
  }
  return resolve(workspaceRoot, relativePath);
}

/**
 * Get relative path from workspace root
 */
export function getRelativePath(absolutePath: string): string {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return absolutePath;
  }
  return relative(workspaceRoot, absolutePath);
}

/**
 * Normalize path separators for current platform
 */
export function normalizePath(filePath: string): string {
  return normalize(filePath);
}

/**
 * Convert path to POSIX format (forward slashes)
 */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Check if a file or directory exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Check if path is a directory
 */
export function isDirectory(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if path is a file
 */
export function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Read file contents as string
 */
export function readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): FileOperationResult<string> {
  try {
    const content = readFileSync(filePath, encoding);
    return { success: true, data: content };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to read file: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Read file contents as string (async)
 */
export async function readFileAsync(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<FileOperationResult<string>> {
  try {
    const content = await fsPromises.readFile(filePath, encoding);
    return { success: true, data: content };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to read file async: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Write content to file
 */
export function writeFile(
  filePath: string,
  content: string,
  options: { encoding?: BufferEncoding; createDirs?: boolean } = {}
): FileOperationResult<void> {
  try {
    if (options.createDirs !== false) {
      ensureDirectory(dirname(filePath));
    }
    writeFileSync(filePath, content, options.encoding || 'utf-8');
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to write file: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Write content to file (async)
 */
export async function writeFileAsync(
  filePath: string,
  content: string,
  options: { encoding?: BufferEncoding; createDirs?: boolean } = {}
): Promise<FileOperationResult<void>> {
  try {
    if (options.createDirs !== false) {
      await ensureDirectoryAsync(dirname(filePath));
    }
    await fsPromises.writeFile(filePath, content, options.encoding || 'utf-8');
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to write file async: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Append content to file
 */
export function appendFile(filePath: string, content: string): FileOperationResult<void> {
  try {
    ensureDirectory(dirname(filePath));
    appendFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to append to file: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Delete a file
 */
export function deleteFile(filePath: string): FileOperationResult<void> {
  try {
    unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to delete file: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Copy a file
 */
export function copyFile(sourcePath: string, destPath: string): FileOperationResult<void> {
  try {
    ensureDirectory(dirname(destPath));
    copyFileSync(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to copy file: ${sourcePath} -> ${destPath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Move/rename a file
 */
export function moveFile(sourcePath: string, destPath: string): FileOperationResult<void> {
  try {
    ensureDirectory(dirname(destPath));
    renameSync(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to move file: ${sourcePath} -> ${destPath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

// ============================================================================
// DIRECTORY OPERATIONS
// ============================================================================

/**
 * Ensure a directory exists (create if not)
 */
export function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Ensure a directory exists (async)
 */
export async function ensureDirectoryAsync(dirPath: string): Promise<void> {
  try {
    await fsPromises.access(dirPath);
  } catch {
    await fsPromises.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Create a directory
 */
export function createDirectory(dirPath: string, recursive = true): FileOperationResult<void> {
  try {
    mkdirSync(dirPath, { recursive });
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to create directory: ${dirPath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Delete a directory
 */
export function deleteDirectory(dirPath: string, recursive = false): FileOperationResult<void> {
  try {
    if (recursive) {
      fsPromises.rm(dirPath, { recursive: true, force: true });
    } else {
      rmdirSync(dirPath);
    }
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to delete directory: ${dirPath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * List directory contents
 */
export function listDirectory(dirPath: string): FileOperationResult<FileInfo[]> {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const files: FileInfo[] = entries.map(entry => {
      const fullPath = join(dirPath, entry.name);
      const stats = statSync(fullPath);
      return {
        path: fullPath,
        relativePath: getRelativePath(fullPath),
        name: entry.name,
        extension: extname(entry.name),
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        isSymbolicLink: entry.isSymbolicLink()
      };
    });
    return { success: true, data: files };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to list directory: ${dirPath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Get directory tree structure
 */
export function getDirectoryTree(dirPath: string, maxDepth = 10, currentDepth = 0): DirectoryTree | null {
  try {
    const stats = statSync(dirPath);
    const name = basename(dirPath);

    const tree: DirectoryTree = {
      name,
      path: dirPath,
      isDirectory: stats.isDirectory(),
      size: stats.size
    };

    if (stats.isDirectory() && currentDepth < maxDepth) {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      tree.children = entries
        .filter(entry => !entry.name.startsWith('.')) // Skip hidden files
        .map(entry => getDirectoryTree(join(dirPath, entry.name), maxDepth, currentDepth + 1))
        .filter((child): child is DirectoryTree => child !== null);
    }

    return tree;
  } catch (error) {
    logger.error(`Failed to get directory tree: ${dirPath}`, error);
    return null;
  }
}

// ============================================================================
// FILE SEARCH
// ============================================================================

/**
 * Search for files matching pattern
 */
export function findFiles(
  rootPath: string,
  options: FileSearchOptions = {}
): FileInfo[] {
  const results: FileInfo[] = [];
  const currentDepth = options.currentDepth || 0;
  const maxDepth = options.maxDepth || Infinity;

  if (currentDepth > maxDepth) {
    return results;
  }

  try {
    const entries = readdirSync(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(rootPath, entry.name);

      // Skip hidden files unless included
      if (!options.includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subResults = findFiles(fullPath, {
          ...options,
          currentDepth: currentDepth + 1
        });
        results.push(...subResults);
      } else if (entry.isFile()) {
        const stats = statSync(fullPath);
        const fileInfo: FileInfo = {
          path: fullPath,
          relativePath: getRelativePath(fullPath),
          name: entry.name,
          extension: extname(entry.name),
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          isDirectory: false,
          isFile: true,
          isSymbolicLink: entry.isSymbolicLink()
        };

        // Apply filter if provided
        if (options.filter && !options.filter(fileInfo)) {
          continue;
        }

        // Check include patterns
        if (options.include) {
          const patterns = Array.isArray(options.include) ? options.include : [options.include];
          const matches = patterns.some(pattern => matchesGlob(entry.name, pattern));
          if (!matches) continue;
        }

        // Check exclude patterns
        if (options.exclude) {
          const patterns = Array.isArray(options.exclude) ? options.exclude : [options.exclude];
          const matches = patterns.some(pattern => matchesGlob(entry.name, pattern));
          if (matches) continue;
        }

        results.push(fileInfo);
      }
    }
  } catch (error) {
    logger.error(`Failed to search files in: ${rootPath}`, error);
  }

  return results;
}

/**
 * Simple glob pattern matching
 */
function matchesGlob(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/<<<GLOBSTAR>>>/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(filename);
}

/**
 * Find files by extension
 */
export function findFilesByExtension(rootPath: string, extension: string): FileInfo[] {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return findFiles(rootPath, {
    include: `*${ext}`,
    includeHidden: false
  });
}

/**
 * Find TypeScript/JavaScript files
 */
export function findSourceFiles(rootPath: string): FileInfo[] {
  return findFiles(rootPath, {
    include: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    exclude: ['*.d.ts', '*.spec.ts', '*.test.ts', '*.spec.js', '*.test.js'],
    includeHidden: false
  });
}

/**
 * Find test files
 */
export function findTestFiles(rootPath: string): FileInfo[] {
  return findFiles(rootPath, {
    include: ['*.spec.ts', '*.test.ts', '*.spec.js', '*.test.js', '*.spec.tsx', '*.test.tsx'],
    includeHidden: false
  });
}

// ============================================================================
// FILE INFORMATION
// ============================================================================

/**
 * Get file information
 */
export function getFileInfo(filePath: string): FileOperationResult<FileInfo> {
  try {
    const stats = statSync(filePath);
    const info: FileInfo = {
      path: filePath,
      relativePath: getRelativePath(filePath),
      name: basename(filePath),
      extension: extname(filePath),
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymbolicLink: stats.isSymbolicLink()
    };
    return { success: true, data: info };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to get file info: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Calculate file hash (MD5)
 */
export function calculateFileHash(filePath: string): FileOperationResult<string> {
  try {
    const content = readFileSync(filePath);
    const hash = createHash('md5').update(content).digest('hex');
    return { success: true, data: hash };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to calculate file hash: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// ============================================================================
// TEMPORARY FILES
// ============================================================================

/**
 * Create a temporary file
 */
export function createTempFile(prefix = 'openkode-', suffix = '.tmp'): FileOperationResult<string> {
  try {
    const tempDir = process.env.TEMP || process.env.TMPDIR || '/tmp';
    const fileName = `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}${suffix}`;
    const filePath = join(tempDir, fileName);
    writeFileSync(filePath, '', 'utf-8');
    return { success: true, data: filePath };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to create temp file', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Clean up temporary file
 */
export function cleanupTempFile(filePath: string): FileOperationResult<void> {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to cleanup temp file: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

// ============================================================================
// VSCode INTEGRATION
// ============================================================================

/**
 * Open a file in the editor
 */
export async function openFileInEditor(
  filePath: string,
  options?: vscode.TextDocumentShowOptions
): Promise<FileOperationResult<vscode.TextEditor>> {
  try {
    const document = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(document, options);
    return { success: true, data: editor };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to open file in editor: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Save all open documents
 */
export async function saveAllDocuments(): Promise<boolean> {
  try {
    await vscode.workspace.saveAll();
    return true;
  } catch (error) {
    logger.error('Failed to save all documents', error);
    return false;
  }
}

/**
 * Get currently open file
 */
export function getCurrentFile(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  return editor?.document.uri.fsPath;
}

/**
 * Get current file content
 */
export function getCurrentFileContent(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  return editor?.document.getText();
}

/**
 * Get selected text in current editor
 */
export function getSelectedText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  return editor?.document.getText(editor.selection);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getWorkspaceRoot,
  resolveWorkspacePath,
  getRelativePath,
  normalizePath,
  toPosixPath,
  fileExists,
  isDirectory,
  isFile,
  readFile,
  readFileAsync,
  writeFile,
  writeFileAsync,
  appendFile,
  deleteFile,
  copyFile,
  moveFile,
  ensureDirectory,
  ensureDirectoryAsync,
  createDirectory,
  deleteDirectory,
  listDirectory,
  getDirectoryTree,
  findFiles,
  findFilesByExtension,
  findSourceFiles,
  findTestFiles,
  getFileInfo,
  calculateFileHash,
  formatFileSize,
  createTempFile,
  cleanupTempFile,
  openFileInEditor,
  saveAllDocuments,
  getCurrentFile,
  getCurrentFileContent,
  getSelectedText
};
