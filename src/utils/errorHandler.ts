/**
 * OpenKode Error Handler
 * ======================
 * 
 * Provides centralized error handling with categorization,
 * user-friendly messages, and recovery strategies.
 */

import * as vscode from 'vscode';
import { Logger } from './logger';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'validation'
  | 'file_system'
  | 'network'
  | 'ai_service'
  | 'git'
  | 'configuration'
  | 'workflow'
  | 'unknown';

/**
 * OpenKode error structure
 */
export interface OpenKodeError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Original error */
  originalError?: Error;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
  /** Recovery suggestion */
  recoverySuggestion?: string;
  /** Can this error be retried */
  retryable: boolean;
}

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Show error notifications */
  showNotifications: boolean;
  /** Log errors */
  logErrors: boolean;
  /** Rethrow errors after handling */
  rethrow: boolean;
  /** Custom error mapper */
  errorMapper?: (error: unknown) => OpenKodeError;
}

/**
 * Recovery strategy
 */
export interface RecoveryStrategy {
  /** Strategy name */
  name: string;
  /** Can this strategy handle the error */
  canHandle: (error: OpenKodeError) => boolean;
  /** Execute recovery */
  recover: (error: OpenKodeError) => Promise<boolean>;
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const ErrorCodes = {
  // Validation errors
  VALIDATION_INVALID_INPUT: 'VAL001',
  VALIDATION_MISSING_REQUIRED: 'VAL002',
  VALIDATION_TYPE_MISMATCH: 'VAL003',

  // File system errors
  FILE_NOT_FOUND: 'FS001',
  FILE_ACCESS_DENIED: 'FS002',
  FILE_ALREADY_EXISTS: 'FS003',
  DIRECTORY_NOT_FOUND: 'FS004',
  DISK_FULL: 'FS005',

  // Network errors
  NETWORK_TIMEOUT: 'NET001',
  NETWORK_CONNECTION_FAILED: 'NET002',
  NETWORK_UNAUTHORIZED: 'NET003',
  NETWORK_RATE_LIMITED: 'NET004',

  // AI service errors
  AI_SERVICE_UNAVAILABLE: 'AI001',
  AI_INVALID_RESPONSE: 'AI002',
  AI_CONTEXT_TOO_LONG: 'AI003',
  AI_QUOTA_EXCEEDED: 'AI004',

  // Git errors
  GIT_NOT_INITIALIZED: 'GIT001',
  GIT_CONFLICT: 'GIT002',
  GIT_PUSH_REJECTED: 'GIT003',
  GIT_BRANCH_NOT_FOUND: 'GIT004',

  // Configuration errors
  CONFIG_INVALID: 'CFG001',
  CONFIG_MISSING: 'CFG002',
  CONFIG_DEPRECATED: 'CFG003',

  // Workflow errors
  WORKFLOW_EXECUTION_FAILED: 'WF001',
  WORKFLOW_INVALID_STATE: 'WF002',
  WORKFLOW_TIMEOUT: 'WF003',

  // Unknown errors
  UNKNOWN_ERROR: 'UNK001'
} as const;

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

export class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private logger: Logger;
  private options: ErrorHandlerOptions;
  private recoveryStrategies: RecoveryStrategy[];
  private errorHistory: OpenKodeError[];

  /**
   * Private constructor - use getInstance()
   */
  private constructor(options: Partial<ErrorHandlerOptions> = {}) {
    this.logger = new Logger('ErrorHandler');
    this.options = {
      showNotifications: true,
      logErrors: true,
      rethrow: false,
      ...options
    };
    this.recoveryStrategies = [];
    this.errorHistory = [];

    this.registerDefaultStrategies();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(options?: Partial<ErrorHandlerOptions>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(options);
    }
    return ErrorHandler.instance;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.recoveryStrategies = [];
    this.errorHistory = [];
    ErrorHandler.instance = null;
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Handle an error
   */
  handle(error: unknown, context?: string, additionalContext?: Record<string, unknown>): OpenKodeError {
    const openKodeError = this.normalizeError(error, context, additionalContext);

    // Add to history
    this.errorHistory.push(openKodeError);
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }

    // Log error
    if (this.options.logErrors) {
      this.logError(openKodeError);
    }

    // Show notification
    if (this.options.showNotifications && openKodeError.severity !== 'info') {
      this.showNotification(openKodeError);
    }

    // Rethrow if configured
    if (this.options.rethrow) {
      throw this.toError(openKodeError);
    }

    return openKodeError;
  }

  /**
   * Handle an error asynchronously with recovery attempt
   */
  async handleAsync(
    error: unknown,
    context?: string,
    additionalContext?: Record<string, unknown>
  ): Promise<OpenKodeError> {
    const openKodeError = this.handle(error, context, additionalContext);

    // Attempt recovery if retryable
    if (openKodeError.retryable) {
      const recovered = await this.attemptRecovery(openKodeError);
      if (recovered) {
        this.logger.info(`Successfully recovered from error: ${openKodeError.code}`);
      }
    }

    return openKodeError;
  }

  /**
   * Normalize any error to OpenKodeError
   */
  private normalizeError(
    error: unknown,
    context?: string,
    additionalContext?: Record<string, unknown>
  ): OpenKodeError {
    // If already an OpenKodeError, return it
    if (this.isOpenKodeError(error)) {
      return error;
    }

    // Use custom mapper if provided
    if (this.options.errorMapper) {
      return this.options.errorMapper(error);
    }

    // Convert standard Error
    if (error instanceof Error) {
      return this.errorFromStandardError(error, context, additionalContext);
    }

    // Convert string error
    if (typeof error === 'string') {
      return {
        code: ErrorCodes.UNKNOWN_ERROR,
        message: error,
        category: 'unknown',
        severity: 'error',
        context: { ...additionalContext, handlerContext: context },
        timestamp: new Date(),
        retryable: false
      };
    }

    // Unknown error type
    return {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: 'An unknown error occurred',
      category: 'unknown',
      severity: 'error',
      context: { originalError: error, ...additionalContext, handlerContext: context },
      timestamp: new Date(),
      retryable: false
    };
  }

  /**
   * Check if value is an OpenKodeError
   */
  private isOpenKodeError(error: unknown): error is OpenKodeError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'category' in error &&
      'severity' in error &&
      'timestamp' in error
    );
  }

  /**
   * Convert standard Error to OpenKodeError
   */
  private errorFromStandardError(
    error: Error,
    context?: string,
    additionalContext?: Record<string, unknown>
  ): OpenKodeError {
    const message = error.message.toLowerCase();

    // Classify based on message patterns
    if (message.includes('enoent') || message.includes('no such file')) {
      return {
        code: ErrorCodes.FILE_NOT_FOUND,
        message: `File not found: ${error.message}`,
        category: 'file_system',
        severity: 'error',
        originalError: error,
        context: { ...additionalContext, handlerContext: context },
        timestamp: new Date(),
        retryable: false,
        recoverySuggestion: 'Check that the file path is correct and the file exists.'
      };
    }

    if (message.includes('eacces') || message.includes('permission denied')) {
      return {
        code: ErrorCodes.FILE_ACCESS_DENIED,
        message: `Access denied: ${error.message}`,
        category: 'file_system',
        severity: 'error',
        originalError: error,
        context: { ...additionalContext, handlerContext: context },
        timestamp: new Date(),
        retryable: false,
        recoverySuggestion: 'Check file permissions or run with elevated privileges.'
      };
    }

    if (message.includes('timeout') || message.includes('etimedout')) {
      return {
        code: ErrorCodes.NETWORK_TIMEOUT,
        message: `Operation timed out: ${error.message}`,
        category: 'network',
        severity: 'warning',
        originalError: error,
        context: { ...additionalContext, handlerContext: context },
        timestamp: new Date(),
        retryable: true,
        recoverySuggestion: 'Try the operation again. If it continues to fail, check your network connection.'
      };
    }

    if (message.includes('econnrefused') || message.includes('ENOTFOUND')) {
      return {
        code: ErrorCodes.NETWORK_CONNECTION_FAILED,
        message: `Connection failed: ${error.message}`,
        category: 'network',
        severity: 'error',
        originalError: error,
        context: { ...additionalContext, handlerContext: context },
        timestamp: new Date(),
        retryable: true,
        recoverySuggestion: 'Check your network connection and try again.'
      };
    }

    if (message.includes('401') || message.includes('unauthorized')) {
      return {
        code: ErrorCodes.NETWORK_UNAUTHORIZED,
        message: `Authentication failed: ${error.message}`,
        category: 'network',
        severity: 'error',
        originalError: error,
        context: { ...additionalContext, handlerContext: context },
        timestamp: new Date(),
        retryable: false,
        recoverySuggestion: 'Check your API key or credentials.'
      };
    }

    if (message.includes('429') || message.includes('rate limit')) {
      return {
        code: ErrorCodes.NETWORK_RATE_LIMITED,
        message: `Rate limited: ${error.message}`,
        category: 'network',
        severity: 'warning',
        originalError: error,
        context: { ...additionalContext, handlerContext: context },
        timestamp: new Date(),
        retryable: true,
        recoverySuggestion: 'Wait a moment and try again.'
      };
    }

    // Default error
    return {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: error.message,
      category: 'unknown',
      severity: 'error',
      originalError: error,
      context: { ...additionalContext, handlerContext: context },
      timestamp: new Date(),
      retryable: false
    };
  }

  // ============================================================================
  // LOGGING AND NOTIFICATIONS
  // ============================================================================

  /**
   * Log an error
   */
  private logError(error: OpenKodeError): void {
    const logMethod: Record<ErrorSeverity, (msg: string, err?: Error) => void> = {
      info: this.logger.info.bind(this.logger),
      warning: this.logger.warn.bind(this.logger),
      error: this.logger.error.bind(this.logger),
      fatal: this.logger.error.bind(this.logger)
    };

    logMethod[error.severity](`[${error.code}] ${error.message}`, error.originalError);
  }

  /**
   * Show error notification
   */
  private async showNotification(error: OpenKodeError): Promise<void> {
    const message = error.recoverySuggestion
      ? `${error.message}\n\nSuggestion: ${error.recoverySuggestion}`
      : error.message;

    switch (error.severity) {
      case 'warning':
        await vscode.window.showWarningMessage(message);
        break;
      case 'error':
      case 'fatal':
        await vscode.window.showErrorMessage(message, 'View Details').then(selection => {
          if (selection === 'View Details') {
            this.showErrorDetails(error);
          }
        });
        break;
    }
  }

  /**
   * Show detailed error information
   */
  private showErrorDetails(error: OpenKodeError): void {
    const details = [
      `Code: ${error.code}`,
      `Category: ${error.category}`,
      `Severity: ${error.severity}`,
      `Message: ${error.message}`,
      `Timestamp: ${error.timestamp.toISOString()}`,
      `Retryable: ${error.retryable}`
    ];

    if (error.context) {
      details.push('', 'Context:', JSON.stringify(error.context, null, 2));
    }

    if (error.originalError?.stack) {
      details.push('', 'Stack Trace:', error.originalError.stack);
    }

    const outputChannel = vscode.window.createOutputChannel('OpenKode Errors');
    outputChannel.appendLine(details.join('\n'));
    outputChannel.show();
  }

  // ============================================================================
  // RECOVERY STRATEGIES
  // ============================================================================

  /**
   * Register a recovery strategy
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  /**
   * Register default recovery strategies
   */
  private registerDefaultStrategies(): void {
    // Retry strategy for network errors
    this.registerRecoveryStrategy({
      name: 'network-retry',
      canHandle: (error) => error.category === 'network' && error.retryable,
      recover: async (error) => {
        this.logger.info(`Attempting network retry for: ${error.code}`);
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true; // Signal that retry can proceed
      }
    });

    // Create directory strategy for file not found
    this.registerRecoveryStrategy({
      name: 'create-directory',
      canHandle: (error) =>
        error.code === ErrorCodes.FILE_NOT_FOUND &&
        error.message.includes('directory'),
      recover: async (error) => {
        this.logger.info(`Attempting to create directory for: ${error.code}`);
        // Directory creation would be implemented here
        return false;
      }
    });
  }

  /**
   * Attempt to recover from an error
   */
  private async attemptRecovery(error: OpenKodeError): Promise<boolean> {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canHandle(error)) {
        this.logger.info(`Attempting recovery with strategy: ${strategy.name}`);
        try {
          const recovered = await strategy.recover(error);
          if (recovered) {
            return true;
          }
        } catch (recoveryError) {
          this.logger.error(`Recovery strategy ${strategy.name} failed`, recoveryError);
        }
      }
    }
    return false;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Convert OpenKodeError to standard Error
   */
  toError(openKodeError: OpenKodeError): Error {
    const error = new Error(`[${openKodeError.code}] ${openKodeError.message}`);
    error.name = 'OpenKodeError';
    return error;
  }

  /**
   * Get error history
   */
  getErrorHistory(): OpenKodeError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: unknown): boolean {
    const openKodeError = this.normalizeError(error);
    return openKodeError.retryable;
  }

  /**
   * Wrap a function with error handling
   */
  wrap<T extends (...args: unknown[]) => unknown>(
    fn: T,
    context?: string
  ): (...args: Parameters<T>) => ReturnType<T> | OpenKodeError {
    return (...args: Parameters<T>): ReturnType<T> | OpenKodeError => {
      try {
        return fn(...args) as ReturnType<T>;
      } catch (error) {
        return this.handle(error, context, { functionArgs: args });
      }
    };
  }

  /**
   * Wrap an async function with error handling
   */
  wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    context?: string
  ): (...args: Parameters<T>) => Promise<ReturnType<T> | OpenKodeError> {
    return async (...args: Parameters<T>): Promise<ReturnType<T> | OpenKodeError> => {
      try {
        return await fn(...args) as ReturnType<T>;
      } catch (error) {
        return this.handle(error, context, { functionArgs: args });
      }
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Handle an error
 */
export function handleError(
  error: unknown,
  context?: string,
  additionalContext?: Record<string, unknown>
): OpenKodeError {
  return ErrorHandler.getInstance().handle(error, context, additionalContext);
}

/**
 * Handle an error asynchronously
 */
export async function handleErrorAsync(
  error: unknown,
  context?: string,
  additionalContext?: Record<string, unknown>
): Promise<OpenKodeError> {
  return ErrorHandler.getInstance().handleAsync(error, context, additionalContext);
}

/**
 * Create a custom error
 */
export function createError(
  code: string,
  message: string,
  category: ErrorCategory,
  severity: ErrorSeverity,
  options: {
    retryable?: boolean;
    recoverySuggestion?: string;
    context?: Record<string, unknown>;
    originalError?: Error;
  } = {}
): OpenKodeError {
  return {
    code,
    message,
    category,
    severity,
    retryable: options.retryable ?? false,
    recoverySuggestion: options.recoverySuggestion,
    context: options.context,
    originalError: options.originalError,
    timestamp: new Date()
  };
}

/**
 * Try to execute a function with error handling
 */
export function tryCatch<T>(
  fn: () => T,
  context?: string,
  fallback?: T
): { success: true; data: T } | { success: false; error: OpenKodeError } {
  try {
    return { success: true, data: fn() };
  } catch (error) {
    const openKodeError = handleError(error, context);
    if (fallback !== undefined) {
      return { success: true, data: fallback };
    }
    return { success: false, error: openKodeError };
  }
}

/**
 * Try to execute an async function with error handling
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  context?: string,
  fallback?: T
): Promise<{ success: true; data: T } | { success: false; error: OpenKodeError }> {
  try {
    return { success: true, data: await fn() };
  } catch (error) {
    const openKodeError = await handleErrorAsync(error, context);
    if (fallback !== undefined) {
      return { success: true, data: fallback };
    }
    return { success: false, error: openKodeError };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ErrorHandler,
  ErrorCodes,
  handleError,
  handleErrorAsync,
  createError,
  tryCatch,
  tryCatchAsync
};
