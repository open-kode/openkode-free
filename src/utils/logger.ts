/**
 * OpenKode Logger Utility
 * =======================
 * 
 * Provides structured logging with multiple levels, formatting,
 * and output to various destinations (console, file, VSCode output channel).
 */

import * as vscode from 'vscode';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Log level severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Timestamp of the log entry */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Logger namespace */
  namespace: string;
  /** Log message */
  message: string;
  /** Optional additional data */
  data?: unknown;
  /** Error object if applicable */
  error?: Error;
  /** Source location */
  source?: {
    file?: string;
    line?: number;
    column?: number;
  };
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Enable console output */
  console: boolean;
  /** Enable file output */
  file: boolean;
  /** Log file path */
  logFilePath?: string;
  /** Enable VSCode output channel */
  outputChannel: boolean;
  /** Output channel name */
  outputChannelName?: string;
  /** Include timestamps in output */
  includeTimestamps: boolean;
  /** Include namespace in output */
  includeNamespace: boolean;
  /** Custom formatter */
  formatter?: (entry: LogEntry) => string;
}

/**
 * Log level numeric values for comparison
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

// ============================================================================
// LOGGER CLASS
// ============================================================================

/**
 * Structured logger for OpenKode
 */
export class Logger {
  private static instance: Logger | null = null;
  private static config: LoggerConfig = {
    minLevel: 'info',
    console: true,
    file: true,
    logFilePath: undefined,
    outputChannel: false,
    includeTimestamps: true,
    includeNamespace: true
  };

  private namespace: string;
  private outputChannel: vscode.OutputChannel | null = null;

  /**
   * Create a new logger instance
   */
  constructor(namespace: string) {
    this.namespace = namespace;
    
    // Initialize output channel if enabled
    if (Logger.config.outputChannel && !this.outputChannel) {
      const channelName = Logger.config.outputChannelName || 'OpenKode';
      this.outputChannel = vscode.window.createOutputChannel(channelName);
    }

    // Ensure log directory exists
    if (Logger.config.file && Logger.config.logFilePath) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Get the singleton logger instance (legacy support)
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger('OpenKode');
    }
    return Logger.instance;
  }

  /**
   * Configure the global logger settings
   */
  static configure(config: Partial<LoggerConfig>): void {
    Logger.config = { ...Logger.config, ...config };
  }

  /**
   * Get current logger configuration
   */
  static getConfig(): LoggerConfig {
    return { ...Logger.config };
  }

  /**
   * Create a child logger with a sub-namespace
   */
  child(subNamespace: string): Logger {
    return new Logger(`${this.namespace}:${subNamespace}`);
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, data?: unknown): void {
    const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    this.log('error', message, data, err);
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error | unknown, data?: unknown): void {
    const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    this.log('fatal', message, data, err);
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[Logger.config.minLevel];
  }

  /**
   * Create a log entry
   */
  private createLogEntry(level: LogLevel, message: string, data?: unknown, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      namespace: this.namespace,
      message,
      data,
      error,
      source: this.captureSource()
    };
  }

  /**
   * Capture source location from stack trace
   */
  private captureSource(): LogEntry['source'] {
    const stack = new Error().stack;
    if (!stack) return undefined;

    const lines = stack.split('\n');
    // Find the first line that's not from this file
    for (const line of lines) {
      if (line.includes('logger.ts')) continue;
      const match = line.match(/at\s+(?:\S+\s+\()?(.+):(\d+):(\d+)\)?/);
      if (match) {
        return {
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10)
        };
      }
    }
    return undefined;
  }

  /**
   * Format a log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    if (Logger.config.formatter) {
      return Logger.config.formatter(entry);
    }

    const parts: string[] = [];

    if (Logger.config.includeTimestamps) {
      parts.push(`[${entry.timestamp}]`);
    }

    parts.push(`[${entry.level.toUpperCase()}]`);

    if (Logger.config.includeNamespace) {
      parts.push(`[${entry.namespace}]`);
    }

    parts.push(entry.message);

    let output = parts.join(' ');

    if (entry.data !== undefined) {
      try {
        output += ` ${JSON.stringify(entry.data)}`;
      } catch {
        output += ' [Object]';
      }
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  Stack: ${entry.error.stack.split('\n').slice(1, 4).join('\n         ')}`;
      }
    }

    return output;
  }

  /**
   * Format a log entry for structured output (JSON)
   */
  private formatStructured(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.level,
      namespace: entry.namespace,
      message: entry.message,
      data: entry.data,
      error: entry.error ? {
        message: entry.error.message,
        stack: entry.error.stack
      } : undefined,
      source: entry.source
    });
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry, formatted: string): void {
    if (!Logger.config.console) return;

    const consoleMethod: Record<LogLevel, keyof Console> = {
      debug: 'debug',
      info: 'log',
      warn: 'warn',
      error: 'error',
      fatal: 'error'
    };

    const method = console[consoleMethod[entry.level]] as (...args: unknown[]) => void;
    method(formatted);
  }

  /**
   * Output log entry to file
   */
  private outputToFile(entry: LogEntry): void {
    if (!Logger.config.file || !Logger.config.logFilePath) return;

    try {
      const line = this.formatStructured(entry) + '\n';
      appendFileSync(Logger.config.logFilePath, line, 'utf-8');
    } catch (err) {
      // Silently fail - can't log logging errors
    }
  }

  /**
   * Output log entry to VSCode output channel
   */
  private outputToChannel(entry: LogEntry, formatted: string): void {
    if (!Logger.config.outputChannel || !this.outputChannel) return;

    this.outputChannel.appendLine(formatted);

    // Show channel for errors
    if (entry.level === 'error' || entry.level === 'fatal') {
      this.outputChannel.show(true);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!Logger.config.logFilePath) return;

    const dir = dirname(Logger.config.logFilePath);
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        // Directory creation failed
      }
    }

    // Create log file if it doesn't exist
    if (!existsSync(Logger.config.logFilePath)) {
      try {
        writeFileSync(Logger.config.logFilePath, '', 'utf-8');
      } catch {
        // File creation failed
      }
    }
  }

  /**
   * Main log method
   */
  private log(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, data, error);
    const formatted = this.formatEntry(entry);

    this.outputToConsole(entry, formatted);
    this.outputToFile(entry);
    this.outputToChannel(entry, formatted);
  }

  /**
   * Show the output channel
   */
  showOutputChannel(preserveFocus?: boolean): void {
    this.outputChannel?.show(preserveFocus);
  }

  /**
   * Hide the output channel
   */
  hideOutputChannel(): void {
    this.outputChannel?.hide();
  }

  /**
   * Clear the output channel
   */
  clearOutputChannel(): void {
    this.outputChannel?.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.outputChannel?.dispose();
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a new logger with the specified namespace
 */
export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}

/**
 * Configure global logger settings
 */
export function configureLogging(config: Partial<LoggerConfig>): void {
  Logger.configure(config);
}

/**
 * Get current log level from VSCode configuration
 */
export function getLogLevelFromConfig(): LogLevel {
  const config = vscode.workspace.getConfiguration('openkode');
  return config.get<LogLevel>('logLevel', 'info');
}

/**
 * Initialize logger from VSCode configuration
 */
export function initializeLogger(context: vscode.ExtensionContext): Logger {
  const logLevel = getLogLevelFromConfig();
  const logDir = join(context.globalStoragePath, 'logs');
  const logFile = join(logDir, `openkode-${new Date().toISOString().split('T')[0]}.log`);

  Logger.configure({
    minLevel: logLevel,
    console: true,
    file: true,
    logFilePath: logFile,
    outputChannel: true,
    outputChannelName: 'OpenKode',
    includeTimestamps: true,
    includeNamespace: true
  });

  return Logger.getInstance();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Logger;
