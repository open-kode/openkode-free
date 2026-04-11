/**
 * Terminal Controller - Execute commands in PowerShell or WSL
 * 
 * Provides unified interface for:
 * - PowerShell (Windows)
 * - WSL (Windows Subsystem for Linux)
 * - CMD (Windows Command Prompt)
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import * as os from 'os';
import * as path from 'path';

export type ShellType = 'powershell' | 'wsl' | 'cmd' | 'bash';

export interface TerminalOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  shell?: ShellType;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface TerminalSession {
  id: string;
  shell: ShellType;
  childProcess: ChildProcess;
  cwd: string;
}

export class TerminalController {
  private sessions: Map<string, TerminalSession> = new Map();
  private defaultShell: ShellType;

  constructor() {
    this.defaultShell = this.detectDefaultShell();
  }

  private detectDefaultShell(): ShellType {
    if (os.platform() === 'win32') {
      // Check if WSL is available
      try {
        const { execSync } = require('child_process');
        execSync('wsl.exe --version', { stdio: 'pipe' });
        return 'wsl';
      } catch {
        return 'powershell';
      }
    }
    return 'bash';
  }

  /**
   * Execute a single command and return result
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options: TerminalOptions = {}
  ): Promise<CommandResult> {
    const shell = options.shell || this.defaultShell;
    const cwd = options.cwd || process.cwd();
    const timeout = options.timeout || 60000;

    const startTime = Date.now();

    return new Promise((resolve) => {
      const { cmd, cmdArgs } = this.buildCommand(shell, command, args);

      const spawnOptions: SpawnOptions = {
        cwd,
        env: { ...process.env, ...options.env },
        shell: shell === 'cmd' || shell === 'powershell',
        windowsHide: true
      };

      console.log(`[Terminal] Executing: ${cmd} ${cmdArgs.join(' ')} in ${cwd}`);

      const child = spawn(cmd, cmdArgs, spawnOptions);

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout;

      // Collect stdout
      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.log(`[Terminal stdout] ${chunk.trim()}`);
      });

      // Collect stderr
      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.error(`[Terminal stderr] ${chunk.trim()}`);
      });

      // Handle timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({
            success: false,
            stdout,
            stderr: stderr + '\nCommand timed out',
            exitCode: -1,
            duration: Date.now() - startTime
          });
        }, timeout);
      }

      // Handle completion
      child.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        const success = code === 0;

        console.log(`[Terminal] Command completed with exit code ${code} in ${duration}ms`);

        resolve({
          success,
          stdout,
          stderr,
          exitCode: code || 0,
          duration
        });
      });

      // Handle errors
      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        resolve({
          success: false,
          stdout,
          stderr: stderr + '\n' + error.message,
          exitCode: -1,
          duration: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Start an interactive terminal session
   */
  async startSession(
    sessionId: string,
    shell: ShellType = this.defaultShell,
    cwd: string = process.cwd()
  ): Promise<TerminalSession> {
    const { cmd, cmdArgs } = this.getShellCommand(shell);

    const childProcess = spawn(cmd, cmdArgs, {
      cwd,
      env: process.env,
      shell: shell === 'cmd' || shell === 'powershell',
      windowsHide: false
    });

    const session: TerminalSession = {
      id: sessionId,
      shell,
      childProcess,
      cwd
    };

    this.sessions.set(sessionId, session);

    console.log(`[Terminal] Started ${shell} session ${sessionId} in ${cwd}`);

    return session;
  }

  /**
   * Send input to an interactive session
   */
  sendInput(sessionId: string, input: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[Terminal] Session ${sessionId} not found`);
      return false;
    }

    if (session.childProcess.stdin) {
      session.childProcess.stdin.write(input + '\n');
      return true;
    }

    return false;
  }

  /**
   * Kill a terminal session
   */
  killSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.childProcess.kill('SIGTERM');
    this.sessions.delete(sessionId);
    
    console.log(`[Terminal] Killed session ${sessionId}`);
    return true;
  }

  /**
   * Execute npm install
   */
  async npmInstall(cwd: string, packages?: string[]): Promise<CommandResult> {
    const args = packages ? ['install', ...packages] : ['install'];
    return this.executeCommand('npm', args, { cwd });
  }

  /**
   * Execute git commands
   */
  async git(command: string, args: string[] = [], cwd?: string): Promise<CommandResult> {
    return this.executeCommand('git', [command, ...args], { cwd });
  }

  /**
   * List directory contents
   */
  async ls(cwd: string): Promise<CommandResult> {
    const isWindows = os.platform() === 'win32';
    return this.executeCommand(isWindows ? 'dir' : 'ls', isWindows ? [] : ['-la'], { cwd });
  }

  /**
   * Run a build command
   */
  async build(projectPath: string, buildCommand: string = 'npm run build'): Promise<CommandResult> {
    const parts = buildCommand.split(' ');
    return this.executeCommand(parts[0], parts.slice(1), { cwd: projectPath });
  }

  /**
   * Run tests
   */
  async test(projectPath: string, testCommand: string = 'npm test'): Promise<CommandResult> {
    const parts = testCommand.split(' ');
    return this.executeCommand(parts[0], parts.slice(1), { cwd: projectPath });
  }

  /**
   * Check if a command exists
   */
  async commandExists(command: string): Promise<boolean> {
    const checkCmd = os.platform() === 'win32' ? 'where' : 'which';
    const result = await this.executeCommand(checkCmd, [command], { timeout: 5000 });
    return result.success;
  }

  private buildCommand(
    shell: ShellType,
    command: string,
    args: string[]
  ): { cmd: string; cmdArgs: string[] } {
    switch (shell) {
      case 'wsl':
        // Wrap command for WSL
        return {
          cmd: 'wsl.exe',
          cmdArgs: [command, ...args]
        };
      
      case 'powershell':
        // Use PowerShell
        return {
          cmd: 'powershell.exe',
          cmdArgs: ['-Command', command, ...args]
        };
      
      case 'cmd':
        // Use CMD
        return {
          cmd: 'cmd.exe',
          cmdArgs: ['/c', command, ...args]
        };
      
      case 'bash':
      default:
        // Direct execution
        return {
          cmd: command,
          cmdArgs: args
        };
    }
  }

  private getShellCommand(shell: ShellType): { cmd: string; cmdArgs: string[] } {
    switch (shell) {
      case 'wsl':
        return { cmd: 'wsl.exe', cmdArgs: ['bash'] };
      case 'powershell':
        return { cmd: 'powershell.exe', cmdArgs: ['-NoExit', '-Command', '-'] };
      case 'cmd':
        return { cmd: 'cmd.exe', cmdArgs: [] };
      case 'bash':
      default:
        return { cmd: 'bash', cmdArgs: [] };
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  getDefaultShell(): ShellType {
    return this.defaultShell;
  }
}

export const terminal = new TerminalController();
