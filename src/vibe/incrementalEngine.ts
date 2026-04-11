/**
 * Incremental Engine - Modify existing files, not just create
 * 
 * Can add features to existing code, not just generate from scratch
 */

import { LLMConfig } from '../llm/llmClient';
import { FileWriter } from './fileWriter';
import { ContextReader, ProjectContext } from './contextReader';
import { LLMClient } from '../llm/llmClient';

export interface IncrementalResult {
  success: boolean;
  filesModified: string[];
  filesCreated: string[];
  filesUpdated?: string[];  // Alias for filesModified for compatibility
  explanation?: string;
  description?: string;  // Alias for explanation for compatibility
  error?: string;
  latency?: number;
}

export interface FileModification {
  path: string;
  originalContent: string;
  newContent: string;
  changeType: 'modify' | 'create' | 'delete';
}

export class IncrementalEngine {
  private fileWriter: FileWriter;
  private contextReader: ContextReader;
  private llm: LLMClient;

  constructor(
    options: { workspaceRoot: string; llmConfig: LLMConfig }
  ) {
    this.fileWriter = new FileWriter(options.workspaceRoot);
    this.contextReader = new ContextReader(options.workspaceRoot);
    this.llm = new LLMClient(options.llmConfig);
  }

  /**
   * Add feature to existing codebase
   */
  async addFeature(prompt: string): Promise<IncrementalResult> {
    const startTime = Date.now();
    
    try {
      // 1. Read existing context
      const context = await this.contextReader.readContext();

      // 2. Determine what files need to change
      const plan = await this.planChanges(prompt, context);

      // 3. Execute changes
      const modified: string[] = [];
      const created: string[] = [];

      for (const change of plan.changes) {
        if (change.changeType === 'modify') {
          await this.fileWriter.writeFile(change.path, change.newContent);
          modified.push(change.path);
        } else if (change.changeType === 'create') {
          await this.fileWriter.writeFile(change.path, change.newContent);
          created.push(change.path);
        }
      }

      return {
        success: true,
        filesModified: modified,
        filesCreated: created,
        filesUpdated: modified,  // Alias for compatibility
        explanation: plan.explanation,
        description: plan.explanation,  // Alias for compatibility
        latency: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        filesModified: [],
        filesCreated: [],
        filesUpdated: [],
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Fix error in existing code
   */
  async fixError(errorMessage: string, filePath?: string): Promise<IncrementalResult> {
    const startTime = Date.now();
    
    try {
      // Read the problematic file
      let context: ProjectContext;
      
      if (filePath) {
        const content = await this.contextReader.readFile(filePath);
        context = {
          rootPath: this.fileWriter['workspaceRoot'],
          files: content ? [{ path: filePath, content, language: 'typescript' }] : [],
          framework: undefined,
          language: undefined
        };
      } else {
        context = await this.contextReader.readContext();
      }

      // Ask LLM to fix
      const fix = await this.generateFix(errorMessage, context);

      // Apply fix
      const modified: string[] = [];
      
      for (const change of fix.changes) {
        if (change.changeType === 'modify') {
          await this.fileWriter.writeFile(change.path, change.newContent);
          modified.push(change.path);
        }
      }

      return {
        success: true,
        filesModified: modified,
        filesCreated: [],
        filesUpdated: modified,
        explanation: fix.explanation,
        description: fix.explanation,
        latency: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        filesModified: [],
        filesCreated: [],
        filesUpdated: [],
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime
      };
    }
  }

  private async planChanges(prompt: string, context: ProjectContext): Promise<any> {
    // Build prompt for LLM
    const systemPrompt = `You are an expert developer. Given an existing codebase and a feature request, determine what files need to be created or modified.

Respond with JSON in this format:
{
  "explanation": "Brief description of changes",
  "changes": [
    {
      "path": "src/components/NewFeature.tsx",
      "changeType": "create",
      "newContent": "full file content"
    },
    {
      "path": "src/App.tsx", 
      "changeType": "modify",
      "newContent": "complete modified file content"
    }
  ]
}`;

    const userPrompt = `Feature request: ${prompt}\n${this.contextReader.formatContextForPrompt(context)}`;

    const response = await this.llm.generateJSON<any>({
      systemPrompt,
      userPrompt,
      responseFormat: 'json'
    });

    return response;
  }

  private async generateFix(errorMessage: string, context: ProjectContext): Promise<any> {
    const systemPrompt = `You are a debugging expert. Given an error and code, fix the error.

Respond with JSON:
{
  "explanation": "What was wrong and how it was fixed",
  "changes": [
    {
      "path": "src/file.ts",
      "changeType": "modify",
      "newContent": "complete fixed file content"
    }
  ]
}`;

    const userPrompt = `Error: ${errorMessage}\n${this.contextReader.formatContextForPrompt(context)}`;

    return this.llm.generateJSON<any>({
      systemPrompt,
      userPrompt,
      responseFormat: 'json'
    });
  }
}
