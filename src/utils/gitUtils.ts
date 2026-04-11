/**
 * OpenKode Git Utilities
 * ======================
 * 
 * Provides Git operations for version control integration,
 * including diff, status, commit, and branch management.
 */

import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { Logger } from './logger';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Git repository information
 */
export interface GitRepositoryInfo {
  /** Is this a git repository */
  isRepo: boolean;
  /** Repository root path */
  rootPath: string | null;
  /** Current branch name */
  currentBranch: string | null;
  /** Remote URL */
  remoteUrl: string | null;
  /** Last commit hash */
  lastCommitHash: string | null;
  /** Last commit message */
  lastCommitMessage: string | null;
  /** Last commit author */
  lastCommitAuthor: string | null;
  /** Last commit date */
  lastCommitDate: Date | null;
}

/**
 * Git status information
 */
export interface GitStatus {
  /** Current branch */
  branch: string;
  /** Is clean (no uncommitted changes) */
  isClean: boolean;
  /** Files staged for commit */
  staged: GitFileStatus[];
  /** Files modified but not staged */
  modified: GitFileStatus[];
  /** Untracked files */
  untracked: GitFileStatus[];
  /** Files with conflicts */
  conflicted: GitFileStatus[];
  /** Files deleted */
  deleted: GitFileStatus[];
  /** Files renamed */
  renamed: GitFileStatus[];
  /** Ahead of remote by N commits */
  ahead: number;
  /** Behind remote by N commits */
  behind: number;
}

/**
 * Git file status
 */
export interface GitFileStatus {
  /** File path */
  path: string;
  /** Status code (M, A, D, R, C, U, ?) */
  status: string;
  /** Original path (for renames) */
  originalPath?: string;
}

/**
 * Git diff information
 */
export interface GitDiff {
  /** File path */
  filePath: string;
  /** Change type */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Number of additions */
  additions: number;
  /** Number of deletions */
  deletions: number;
  /** Diff content */
  content: string;
}

/**
 * Git commit information
 */
export interface GitCommit {
  /** Commit hash */
  hash: string;
  /** Short hash */
  shortHash: string;
  /** Commit message */
  message: string;
  /** Author name */
  author: string;
  /** Author email */
  authorEmail: string;
  /** Commit date */
  date: Date;
  /** Changed files */
  files: string[];
}

/**
 * Git branch information
 */
export interface GitBranch {
  /** Branch name */
  name: string;
  /** Is current branch */
  isCurrent: boolean;
  /** Is remote branch */
  isRemote: boolean;
  /** Remote tracking branch */
  remoteTracking?: string;
  /** Last commit on branch */
  lastCommit?: string;
}

/**
 * Git operation result
 */
export interface GitOperationResult<T = unknown> {
  /** Success status */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Full error object */
  errorObject?: Error;
}

// ============================================================================
// GIT DETECTION
// ============================================================================

const logger = new Logger('GitUtils');

/**
 * Check if a directory is a git repository
 */
export function isGitRepository(dirPath: string): boolean {
  const gitDir = join(dirPath, '.git');
  return existsSync(gitDir);
}

/**
 * Find the git repository root starting from a directory
 */
export function findGitRoot(startPath: string): string | null {
  let currentPath = resolve(startPath);

  while (currentPath !== '/') {
    if (isGitRepository(currentPath)) {
      return currentPath;
    }
    const parentPath = resolve(currentPath, '..');
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }

  return null;
}

/**
 * Get repository information
 */
export function getRepositoryInfo(dirPath: string): GitRepositoryInfo {
  const rootPath = findGitRoot(dirPath);

  if (!rootPath) {
    return {
      isRepo: false,
      rootPath: null,
      currentBranch: null,
      remoteUrl: null,
      lastCommitHash: null,
      lastCommitMessage: null,
      lastCommitAuthor: null,
      lastCommitDate: null
    };
  }

  try {
    const currentBranch = execGitCommand('rev-parse --abbrev-ref HEAD', rootPath);
    const remoteUrl = execGitCommand('config --get remote.origin.url', rootPath);
    const lastCommitHash = execGitCommand('rev-parse HEAD', rootPath);
    const lastCommitMessage = execGitCommand('log -1 --pretty=%B', rootPath);
    const lastCommitAuthor = execGitCommand('log -1 --pretty=%an', rootPath);
    const lastCommitDateStr = execGitCommand('log -1 --pretty=%ai', rootPath);

    return {
      isRepo: true,
      rootPath,
      currentBranch: currentBranch || null,
      remoteUrl: remoteUrl || null,
      lastCommitHash: lastCommitHash || null,
      lastCommitMessage: lastCommitMessage || null,
      lastCommitAuthor: lastCommitAuthor || null,
      lastCommitDate: lastCommitDateStr ? new Date(lastCommitDateStr) : null
    };
  } catch (error) {
    logger.error('Failed to get repository info', error);
    return {
      isRepo: true,
      rootPath,
      currentBranch: null,
      remoteUrl: null,
      lastCommitHash: null,
      lastCommitMessage: null,
      lastCommitAuthor: null,
      lastCommitDate: null
    };
  }
}

// ============================================================================
// GIT COMMANDS
// ============================================================================

/**
 * Execute a git command
 */
function execGitCommand(command: string, cwd?: string): string | null {
  try {
    const result = execSync(`git ${command}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim();
  } catch (error) {
    logger.debug(`Git command failed: git ${command}`, error);
    return null;
  }
}

/**
 * Execute git command asynchronously
 */
function execGitCommandAsync(command: string, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = command.split(' ');
    const gitProcess = spawn('git', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    gitProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    gitProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    gitProcess.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Git command failed with code ${code}`));
      }
    });

    gitProcess.on('error', (error) => {
      reject(error);
    });
  });
}

// ============================================================================
// STATUS OPERATIONS
// ============================================================================

/**
 * Get git status
 */
export function getStatus(cwd?: string): GitOperationResult<GitStatus> {
  try {
    const output = execGitCommand('status --porcelain -b', cwd);
    if (output === null) {
      return { success: false, error: 'Failed to get git status' };
    }

    const status: GitStatus = {
      branch: 'unknown',
      isClean: true,
      staged: [],
      modified: [],
      untracked: [],
      conflicted: [],
      deleted: [],
      renamed: [],
      ahead: 0,
      behind: 0
    };

    const lines = output.split('\n');

    for (const line of lines) {
      if (line.startsWith('##')) {
        // Parse branch info
        const branchMatch = line.match(/##\s+(\S+)(?:\.\.\.(\S+))?\s*(?:\[ahead (\d+)(?:, behind (\d+))?\])?/);
        if (branchMatch) {
          status.branch = branchMatch[1];
          status.ahead = parseInt(branchMatch[3] || '0', 10);
          status.behind = parseInt(branchMatch[4] || '0', 10);
        }
      } else if (line.length >= 2) {
        // Parse file status
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const filePath = line.substring(3).trim();

        const fileStatus: GitFileStatus = { path: filePath, status: `${indexStatus}${workTreeStatus}` };

        // Handle renamed files
        if (indexStatus === 'R' || workTreeStatus === 'R') {
          const parts = filePath.split(' -> ');
          if (parts.length === 2) {
            fileStatus.originalPath = parts[0];
            fileStatus.path = parts[1];
          }
          status.renamed.push(fileStatus);
        }

        // Staged changes
        if (indexStatus !== ' ' && indexStatus !== '?') {
          status.staged.push(fileStatus);
        }

        // Work tree changes
        if (workTreeStatus !== ' ') {
          if (workTreeStatus === 'M') {
            status.modified.push(fileStatus);
          } else if (workTreeStatus === 'D') {
            status.deleted.push(fileStatus);
          } else if (workTreeStatus === 'U') {
            status.conflicted.push(fileStatus);
          }
        }

        // Untracked files
        if (indexStatus === '?' && workTreeStatus === '?') {
          status.untracked.push(fileStatus);
        }

        status.isClean = false;
      }
    }

    return { success: true, data: status };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get git status', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Check if working directory is clean
 */
export function isClean(cwd?: string): boolean {
  const result = getStatus(cwd);
  return result.success && result.data ? result.data.isClean : false;
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(cwd?: string): boolean {
  return !isClean(cwd);
}

// ============================================================================
// DIFF OPERATIONS
// ============================================================================

/**
 * Get diff for staged changes
 */
export function getStagedDiff(cwd?: string): GitOperationResult<string> {
  try {
    const output = execGitCommand('diff --cached', cwd);
    return { success: true, data: output || '' };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get staged diff', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Get diff for unstaged changes
 */
export function getUnstagedDiff(cwd?: string): GitOperationResult<string> {
  try {
    const output = execGitCommand('diff', cwd);
    return { success: true, data: output || '' };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get unstaged diff', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Get diff for a specific file
 */
export function getFileDiff(filePath: string, cwd?: string): GitOperationResult<string> {
  try {
    const output = execGitCommand(`diff "${filePath}"`, cwd);
    return { success: true, data: output || '' };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to get file diff: ${filePath}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Get diff statistics
 */
export function getDiffStats(cwd?: string): GitOperationResult<{ additions: number; deletions: number; files: number }> {
  try {
    const output = execGitCommand('diff --stat', cwd);
    if (!output) {
      return { success: true, data: { additions: 0, deletions: 0, files: 0 } };
    }

    // Parse diff stat output
    const lines = output.split('\n');
    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

    if (match) {
      return {
        success: true,
        data: {
          files: parseInt(match[1], 10),
          additions: parseInt(match[2] || '0', 10),
          deletions: parseInt(match[3] || '0', 10)
        }
      };
    }

    return { success: true, data: { additions: 0, deletions: 0, files: 0 } };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get diff stats', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

// ============================================================================
// STAGING OPERATIONS
// ============================================================================

/**
 * Stage files
 */
export function stageFiles(filePaths: string | string[], cwd?: string): GitOperationResult<void> {
  try {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const pathArg = paths.map(p => `"${p}"`).join(' ');
    execGitCommand(`add ${pathArg}`, cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to stage files', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Stage all changes
 */
export function stageAll(cwd?: string): GitOperationResult<void> {
  try {
    execGitCommand('add -A', cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to stage all', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Unstage files
 */
export function unstageFiles(filePaths: string | string[], cwd?: string): GitOperationResult<void> {
  try {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const pathArg = paths.map(p => `"${p}"`).join(' ');
    execGitCommand(`reset HEAD ${pathArg}`, cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to unstage files', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Unstage all changes
 */
export function unstageAll(cwd?: string): GitOperationResult<void> {
  try {
    execGitCommand('reset HEAD', cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to unstage all', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

// ============================================================================
// COMMIT OPERATIONS
// ============================================================================

/**
 * Commit staged changes
 */
export function commit(message: string, options: { amend?: boolean; noVerify?: boolean } = {}, cwd?: string): GitOperationResult<string> {
  try {
    let command = 'commit';
    
    if (options.amend) {
      command += ' --amend --no-edit';
    } else {
      command += ` -m "${message.replace(/"/g, '\\"')}"`;
    }
    
    if (options.noVerify) {
      command += ' --no-verify';
    }

    const output = execGitCommand(command, cwd);
    return { success: true, data: output || '' };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to commit', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Commit all changes (stage and commit)
 */
export function commitAll(message: string, cwd?: string): GitOperationResult<string> {
  const stageResult = stageAll(cwd);
  if (!stageResult.success) {
    return stageResult as GitOperationResult<string>;
  }
  return commit(message, {}, cwd);
}

/**
 * Get commit history
 */
export function getCommitHistory(count = 10, cwd?: string): GitOperationResult<GitCommit[]> {
  try {
    const format = '%H|%h|%s|%an|%ae|%ai';
    const output = execGitCommand(`log -${count} --pretty=format:"${format}"`, cwd);
    
    if (!output) {
      return { success: true, data: [] };
    }

    const commits: GitCommit[] = output.split('\n').map(line => {
      const parts = line.split('|');
      return {
        hash: parts[0],
        shortHash: parts[1],
        message: parts[2],
        author: parts[3],
        authorEmail: parts[4],
        date: new Date(parts[5]),
        files: []
      };
    });

    return { success: true, data: commits };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get commit history', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Get the last commit message
 */
export function getLastCommitMessage(cwd?: string): string | null {
  return execGitCommand('log -1 --pretty=%B', cwd);
}

// ============================================================================
// BRANCH OPERATIONS
// ============================================================================

/**
 * Get list of branches
 */
export function getBranches(cwd?: string): GitOperationResult<GitBranch[]> {
  try {
    const output = execGitCommand('branch -a', cwd);
    if (!output) {
      return { success: true, data: [] };
    }

    const branches: GitBranch[] = output.split('\n').map(line => {
      const isCurrent = line.startsWith('*');
      const name = line.replace(/^\*?\s*/, '').trim();
      const isRemote = name.startsWith('remotes/');

      return {
        name: isRemote ? name.replace('remotes/', '') : name,
        isCurrent,
        isRemote,
        remoteTracking: isCurrent ? execGitCommand('rev-parse --abbrev-ref --symbolic-full-name @{u}', cwd) || undefined : undefined
      };
    });

    return { success: true, data: branches };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get branches', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Create a new branch
 */
export function createBranch(branchName: string, checkout = false, cwd?: string): GitOperationResult<void> {
  try {
    execGitCommand(`branch "${branchName}"`, cwd);
    if (checkout) {
      checkoutBranch(branchName, cwd);
    }
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to create branch: ${branchName}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Checkout a branch
 */
export function checkoutBranch(branchName: string, cwd?: string): GitOperationResult<void> {
  try {
    execGitCommand(`checkout "${branchName}"`, cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to checkout branch: ${branchName}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Delete a branch
 */
export function deleteBranch(branchName: string, force = false, cwd?: string): GitOperationResult<void> {
  try {
    const flag = force ? '-D' : '-d';
    execGitCommand(`branch ${flag} "${branchName}"`, cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to delete branch: ${branchName}`, err);
    return { success: false, error: err.message, errorObject: err };
  }
}

// ============================================================================
// REMOTE OPERATIONS
// ============================================================================

/**
 * Fetch from remote
 */
export function fetch(remote = 'origin', cwd?: string): GitOperationResult<void> {
  try {
    execGitCommand(`fetch ${remote}`, cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to fetch', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Pull from remote
 */
export function pull(remote = 'origin', branch?: string, cwd?: string): GitOperationResult<void> {
  try {
    const branchArg = branch || '';
    execGitCommand(`pull ${remote} ${branchArg}`, cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to pull', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Push to remote
 */
export function push(remote = 'origin', branch?: string, force = false, cwd?: string): GitOperationResult<void> {
  try {
    const branchArg = branch || '';
    const forceFlag = force ? '--force' : '';
    execGitCommand(`push ${forceFlag} ${remote} ${branchArg}`, cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to push', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

// ============================================================================
// STASH OPERATIONS
// ============================================================================

/**
 * Stash changes
 */
export function stash(message?: string, cwd?: string): GitOperationResult<void> {
  try {
    const messageArg = message ? `-m "${message}"` : '';
    execGitCommand(`stash push ${messageArg}`, cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to stash', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * Pop stash
 */
export function stashPop(cwd?: string): GitOperationResult<void> {
  try {
    execGitCommand('stash pop', cwd);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to pop stash', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

/**
 * List stashes
 */
export function stashList(cwd?: string): GitOperationResult<string[]> {
  try {
    const output = execGitCommand('stash list', cwd);
    const stashes = output ? output.split('\n').filter(s => s.trim()) : [];
    return { success: true, data: stashes };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to list stashes', err);
    return { success: false, error: err.message, errorObject: err };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a commit message from changes
 */
export function generateCommitMessage(changes: { added: string[]; modified: string[]; deleted: string[] }): string {
  const parts: string[] = [];

  if (changes.added.length > 0) {
    parts.push(`add ${changes.added.length} file${changes.added.length > 1 ? 's' : ''}`);
  }

  if (changes.modified.length > 0) {
    parts.push(`update ${changes.modified.length} file${changes.modified.length > 1 ? 's' : ''}`);
  }

  if (changes.deleted.length > 0) {
    parts.push(`remove ${changes.deleted.length} file${changes.deleted.length > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return 'chore: update files';
  }

  return `chore: ${parts.join(', ')}`;
}

/**
 * Get files changed in the last commit
 */
export function getChangedFilesInLastCommit(cwd?: string): string[] {
  const output = execGitCommand('diff-tree --no-commit-id --name-only -r HEAD', cwd);
  return output ? output.split('\n').filter(f => f.trim()) : [];
}

/**
 * Check if file is tracked by git
 */
export function isTracked(filePath: string, cwd?: string): boolean {
  const output = execGitCommand(`ls-files "${filePath}"`, cwd);
  return output ? output.trim().length > 0 : false;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  isGitRepository,
  findGitRoot,
  getRepositoryInfo,
  getStatus,
  isClean,
  hasUncommittedChanges,
  getStagedDiff,
  getUnstagedDiff,
  getFileDiff,
  getDiffStats,
  stageFiles,
  stageAll,
  unstageFiles,
  unstageAll,
  commit,
  commitAll,
  getCommitHistory,
  getLastCommitMessage,
  getBranches,
  createBranch,
  checkoutBranch,
  deleteBranch,
  fetch,
  pull,
  push,
  stash,
  stashPop,
  stashList,
  generateCommitMessage,
  getChangedFilesInLastCommit,
  isTracked
};
