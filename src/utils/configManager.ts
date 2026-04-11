/**
 * OpenKode Configuration Manager
 * ==============================
 * 
 * Manages extension configuration with VSCode settings integration,
 * validation, and caching for optimal performance.
 */

import * as vscode from 'vscode';
import { Logger } from './logger';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * OpenKode configuration schema
 */
export interface OpenKodeConfig {
  /** Enable/disable OpenKode */
  enabled: boolean;
  /** Directory for specifications */
  specDirectory: string;
  /** Directory for output files */
  outputDirectory: string;
  /** Logging level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** AI provider */
  aiProvider: 'openai' | 'anthropic' | 'azure' | 'custom';
  /** API key for AI provider */
  apiKey: string;
  /** AI model to use */
  model: string;
  /** Maximum tokens for responses */
  maxTokens: number;
  /** Temperature for AI responses */
  temperature: number;
  /** Auto-verify specs after changes */
  autoVerify: boolean;
  /** Show notification messages */
  showNotifications: boolean;
}

/**
 * Configuration change listener
 */
export type ConfigChangeListener = (key: keyof OpenKodeConfig, newValue: unknown, oldValue: unknown) => void;

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Is configuration valid */
  valid: boolean;
  /** Validation errors */
  errors: ConfigValidationError[];
  /** Validation warnings */
  warnings: ConfigValidationWarning[];
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  /** Configuration key */
  key: keyof OpenKodeConfig;
  /** Error message */
  message: string;
  /** Current value */
  value: unknown;
}

/**
 * Configuration validation warning
 */
export interface ConfigValidationWarning {
  /** Configuration key */
  key: keyof OpenKodeConfig;
  /** Warning message */
  message: string;
  /** Current value */
  value: unknown;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: OpenKodeConfig = {
  enabled: true,
  specDirectory: '.openkode/specs',
  outputDirectory: '.openkode/output',
  logLevel: 'info',
  aiProvider: 'openai',
  apiKey: '',
  model: 'gpt-4',
  maxTokens: 4000,
  temperature: 0.7,
  autoVerify: true,
  showNotifications: true
};

// ============================================================================
// CONFIGURATION MANAGER
// ============================================================================

export class ConfigManager {
  private static instance: ConfigManager | null = null;
  private logger: Logger;
  private config: vscode.WorkspaceConfiguration;
  private cache: Partial<OpenKodeConfig>;
  private listeners: ConfigChangeListener[];
  private disposables: vscode.Disposable[];

  /**
   * Private constructor - use getInstance()
   */
  private constructor() {
    this.logger = new Logger('ConfigManager');
    this.config = vscode.workspace.getConfiguration('openkode');
    this.cache = {};
    this.listeners = [];
    this.disposables = [];

    this.setupConfigWatcher();
    this.initializeCache();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.listeners = [];
    ConfigManager.instance = null;
  }

  /**
   * Setup configuration change watcher
   */
  private setupConfigWatcher(): void {
    const watcher = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('openkode')) {
        this.handleConfigChange(event);
      }
    });
    this.disposables.push(watcher);
  }

  /**
   * Initialize configuration cache
   */
  private initializeCache(): void {
    (Object.keys(DEFAULT_CONFIG) as Array<keyof OpenKodeConfig>).forEach(key => {
      this.cache[key] = this.get(key) as any;
    });
  }

  /**
   * Handle configuration changes
   */
  private handleConfigChange(event: vscode.ConfigurationChangeEvent): void {
    this.config = vscode.workspace.getConfiguration('openkode');

    (Object.keys(DEFAULT_CONFIG) as Array<keyof OpenKodeConfig>).forEach(key => {
      const oldValue = this.cache[key];
      const newValue = this.get(key);

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        this.cache[key] = newValue as any;
        this.notifyListeners(key, newValue, oldValue);
        this.logger.debug(`Configuration changed: ${key}`, { oldValue, newValue });
      }
    });
  }

  /**
   * Notify all listeners of configuration change
   */
  private notifyListeners<K extends keyof OpenKodeConfig>(
    key: K,
    newValue: OpenKodeConfig[K],
    oldValue: OpenKodeConfig[K] | undefined
  ): void {
    this.listeners.forEach(listener => {
      try {
        listener(key, newValue, oldValue);
      } catch (error) {
        this.logger.error('Error in config change listener', error);
      }
    });
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  /**
   * Get a configuration value
   */
  get<K extends keyof OpenKodeConfig>(key: K): OpenKodeConfig[K] {
    // Return from cache if available
    if (this.cache[key] !== undefined) {
      return this.cache[key] as OpenKodeConfig[K];
    }

    // Get from VSCode configuration
    const value = this.config.get<OpenKodeConfig[K]>(key);
    
    // Return value or default
    const result = value !== undefined ? value : DEFAULT_CONFIG[key];
    
    // Update cache
    this.cache[key] = result;
    
    return result;
  }

  /**
   * Get all configuration values
   */
  getAll(): OpenKodeConfig {
    return {
      enabled: this.get('enabled'),
      specDirectory: this.get('specDirectory'),
      outputDirectory: this.get('outputDirectory'),
      logLevel: this.get('logLevel'),
      aiProvider: this.get('aiProvider'),
      apiKey: this.get('apiKey'),
      model: this.get('model'),
      maxTokens: this.get('maxTokens'),
      temperature: this.get('temperature'),
      autoVerify: this.get('autoVerify'),
      showNotifications: this.get('showNotifications')
    };
  }

  /**
   * Check if OpenKode is enabled
   */
  isEnabled(): boolean {
    return this.get('enabled');
  }

  /**
   * Get the spec directory path
   */
  getSpecDirectory(): string {
    return this.get('specDirectory');
  }

  /**
   * Get the output directory path
   */
  getOutputDirectory(): string {
    return this.get('outputDirectory');
  }

  /**
   * Get the log level
   */
  getLogLevel(): OpenKodeConfig['logLevel'] {
    return this.get('logLevel');
  }

  /**
   * Get AI provider configuration
   */
  getAIProvider(): { provider: string; model: string; apiKey: string } {
    return {
      provider: this.get('aiProvider'),
      model: this.get('model'),
      apiKey: this.get('apiKey')
    };
  }

  /**
   * Get AI generation parameters
   */
  getAIParams(): { maxTokens: number; temperature: number } {
    return {
      maxTokens: this.get('maxTokens'),
      temperature: this.get('temperature')
    };
  }

  // ============================================================================
  // SETTERS
  // ============================================================================

  /**
   * Set a configuration value
   */
  async set<K extends keyof OpenKodeConfig>(
    key: K,
    value: OpenKodeConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const oldValue = this.get(key);
    
    await this.config.update(key, value, target);
    
    this.cache[key] = value;
    this.notifyListeners(key, value, oldValue);
    
    this.logger.debug(`Configuration set: ${key}`, { value });
  }

  /**
   * Set multiple configuration values
   */
  async setMultiple(
    values: Partial<OpenKodeConfig>,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.set(key as keyof OpenKodeConfig, value as never, target);
    }
  }

  /**
   * Reset a configuration to default
   */
  async reset<K extends keyof OpenKodeConfig>(
    key: K,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    await this.set(key, DEFAULT_CONFIG[key], target);
  }

  /**
   * Reset all configuration to defaults
   */
  async resetAll(target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof OpenKodeConfig>) {
      await this.reset(key, target);
    }
  }

  // ============================================================================
  // LISTENERS
  // ============================================================================

  /**
   * Add a configuration change listener
   */
  onChange(listener: ConfigChangeListener): vscode.Disposable {
    this.listeners.push(listener);
    
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      }
    };
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate current configuration
   */
  validate(): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    const config = this.getAll();

    // Validate spec directory
    if (!config.specDirectory || config.specDirectory.trim() === '') {
      errors.push({
        key: 'specDirectory',
        message: 'Spec directory cannot be empty',
        value: config.specDirectory
      });
    }

    // Validate output directory
    if (!config.outputDirectory || config.outputDirectory.trim() === '') {
      errors.push({
        key: 'outputDirectory',
        message: 'Output directory cannot be empty',
        value: config.outputDirectory
      });
    }

    // Validate API key (warn if empty)
    if (!config.apiKey || config.apiKey.trim() === '') {
      warnings.push({
        key: 'apiKey',
        message: 'API key is not set. AI features will not work.',
        value: config.apiKey
      });
    }

    // Validate max tokens
    if (config.maxTokens < 100 || config.maxTokens > 32000) {
      errors.push({
        key: 'maxTokens',
        message: 'Max tokens must be between 100 and 32000',
        value: config.maxTokens
      });
    }

    // Validate temperature
    if (config.temperature < 0 || config.temperature > 2) {
      errors.push({
        key: 'temperature',
        message: 'Temperature must be between 0 and 2',
        value: config.temperature
      });
    }

    // Validate AI provider
    const validProviders = ['openai', 'anthropic', 'azure', 'custom'];
    if (!validProviders.includes(config.aiProvider)) {
      errors.push({
        key: 'aiProvider',
        message: `Invalid AI provider. Must be one of: ${validProviders.join(', ')}`,
        value: config.aiProvider
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if configuration is valid
   */
  isValid(): boolean {
    return this.validate().valid;
  }

  /**
   * Show validation errors to user
   */
  async showValidationErrors(): Promise<void> {
    const result = this.validate();

    if (result.errors.length > 0) {
      const messages = result.errors.map(e => `${e.key}: ${e.message}`);
      await vscode.window.showErrorMessage(
        `OpenKode Configuration Errors:\n${messages.join('\n')}`,
        'Open Settings'
      );
    }

    if (result.warnings.length > 0) {
      const messages = result.warnings.map(w => `${w.key}: ${w.message}`);
      await vscode.window.showWarningMessage(
        `OpenKode Configuration Warnings:\n${messages.join('\n')}`
      );
    }
  }

  // ============================================================================
  // IMPORT/EXPORT
  // ============================================================================

  /**
   * Export configuration to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * Import configuration from JSON
   */
  async importFromJSON(json: string): Promise<void> {
    try {
      const imported = JSON.parse(json) as Partial<OpenKodeConfig>;
      await this.setMultiple(imported);
      this.logger.info('Configuration imported successfully');
    } catch (error) {
      this.logger.error('Failed to import configuration', error);
      throw new Error('Invalid configuration JSON');
    }
  }

  // ============================================================================
  // DEFAULTS
  // ============================================================================

  /**
   * Get default configuration
   */
  static getDefaults(): OpenKodeConfig {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Get default value for a key
   */
  static getDefault<K extends keyof OpenKodeConfig>(key: K): OpenKodeConfig[K] {
    return DEFAULT_CONFIG[key];
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get configuration manager instance
 */
export function getConfig(): ConfigManager {
  return ConfigManager.getInstance();
}

/**
 * Get a configuration value
 */
export function getConfigValue<K extends keyof OpenKodeConfig>(key: K): OpenKodeConfig[K] {
  return ConfigManager.getInstance().get(key);
}

/**
 * Set a configuration value
 */
export async function setConfigValue<K extends keyof OpenKodeConfig>(
  key: K,
  value: OpenKodeConfig[K]
): Promise<void> {
  await ConfigManager.getInstance().set(key, value);
}

/**
 * Check if OpenKode is enabled
 */
export function isOpenKodeEnabled(): boolean {
  return ConfigManager.getInstance().isEnabled();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ConfigManager,
  getConfig,
  getConfigValue,
  setConfigValue,
  isOpenKodeEnabled
};
