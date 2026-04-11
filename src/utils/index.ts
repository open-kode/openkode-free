/**
 * OpenKode Utilities Module
 * =========================
 * 
 * Central export point for all utility modules.
 */

// Logger
export { Logger, createLogger, configureLogging, initializeLogger, getLogLevelFromConfig } from './logger';
export type { LogLevel, LogEntry, LoggerConfig } from './logger';

// File Utils
export {
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
} from './fileUtils';
export type { FileInfo, FileSearchOptions, FileOperationResult, DirectoryTree } from './fileUtils';

// Git Utils
export {
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
} from './gitUtils';
export type {
  GitRepositoryInfo,
  GitStatus,
  GitFileStatus,
  GitDiff,
  GitCommit,
  GitBranch,
  GitOperationResult
} from './gitUtils';

// Config Manager
export {
  ConfigManager,
  getConfig,
  getConfigValue,
  setConfigValue,
  isOpenKodeEnabled
} from './configManager';
export type {
  OpenKodeConfig,
  ConfigChangeListener,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigValidationWarning
} from './configManager';

// Error Handler
export {
  ErrorHandler,
  ErrorCodes,
  handleError,
  handleErrorAsync,
  createError,
  tryCatch,
  tryCatchAsync
} from './errorHandler';
export type {
  ErrorSeverity,
  ErrorCategory,
  OpenKodeError,
  ErrorHandlerOptions,
  RecoveryStrategy
} from './errorHandler';

// Policy Loader
export { PolicyLoader } from './policyLoader';
