/**
 * Vibe Engine - Orchestrates code generation
 * 
 * Prompt → LLM → Parse → Write Files
 * No mocks. Real API calls. Real file writes.
 */

import { LLMClient, LLMConfig, CompiledPrompt } from '../llm/llmClient';
import { FileWriter, GenerationResult, GeneratedFile } from './fileWriter';

export interface VibeOptions {
  llmConfig: LLMConfig;
  workspaceRoot: string;
}

export interface VibeResult {
  success: boolean;
  filesCreated: string[];
  filesUpdated: string[];
  description?: string;
  commands?: string[];
  error?: string;
  latency: number;
}

export class VibeEngine {
  private llm: LLMClient;
  private fileWriter: FileWriter;

  constructor(options: VibeOptions) {
    this.llm = new LLMClient(options.llmConfig);
    this.fileWriter = new FileWriter(options.workspaceRoot);
  }

  /**
   * Generate code from user prompt
   * Real implementation - calls LLM, writes files
   */
  async generate(userPrompt: string, conversationHistory?: string[]): Promise<VibeResult> {
    const startTime = Date.now();

    try {
      // 1. Build the prompt
      const compiledPrompt = this.buildPrompt(userPrompt, conversationHistory);

      // 2. Call LLM
      const generated = await this.llm.generateJSON<GenerationResult>(compiledPrompt);

      // 3. Validate result
      if (!generated.files || Object.keys(generated.files).length === 0) {
        throw new Error('LLM returned no files');
      }

      // Convert GenerationResult.files to array (handle both object and array formats)
      const filesArray = Array.isArray(generated.files) 
        ? generated.files 
        : Object.entries(generated.files as Record<string, string>).map(([filePath, content]) => ({
            path: filePath,
            content
          }));

      // Deduplicate files by path
      const uniqueFiles = new Map<string, GeneratedFile>();
      for (const file of filesArray) {
        uniqueFiles.set(file.path, file);
      }
      const deduplicatedFiles = Array.from(uniqueFiles.values());

      // 4. Write files
      const writeResult = await this.fileWriter.writeGenerationResult({
        files: deduplicatedFiles,
        description: generated.description,
        dependencies: generated.dependencies,
        commands: generated.commands
      });

      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write files');
      }

      // 5. Return result
      const created = writeResult.operations.filter(op => op.created).map(op => 
        op.absolutePath.replace(this.fileWriter['workspaceRoot'] + '/', '')
      );
      const updated = writeResult.operations.filter(op => !op.created).map(op => 
        op.absolutePath.replace(this.fileWriter['workspaceRoot'] + '/', '')
      );

      return {
        success: true,
        filesCreated: created,
        filesUpdated: updated,
        description: generated.description,
        commands: generated.commands,
        latency: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        filesCreated: [],
        filesUpdated: [],
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime
      };
    }
  }

  private buildPrompt(userPrompt: string, conversationHistory?: string[]): CompiledPrompt {
    const systemPrompt = `You are an expert full-stack developer. Your task is to generate complete, working code files.

RULES:
1. Generate production-ready code with proper error handling
2. Use modern best practices (TypeScript, ES modules)
3. Include ALL necessary files for the app to run
4. Write clean, readable code
5. Files must be complete and valid

RESPONSE FORMAT:
Return ONLY a JSON object in this exact format:
{
  "description": "Brief description of what was created",
  "files": {
    "path/to/file1.tsx": "complete file content here",
    "path/to/file2.ts": "complete file content here"
  },
  "dependencies": ["package1", "package2"],
  "commands": ["npm install", "npm run dev"]
}

IMPORTANT:
- File paths must be relative (e.g., "src/App.tsx")
- package.json must be included if it's a Node.js project
- All file content must be complete and valid
- Use proper JSON escaping`;

    const userPromptCompiled = `Create the following application:

${userPrompt}

${conversationHistory && conversationHistory.length > 0 ? `Previous conversation context:
${conversationHistory.join('\n')}

` : ''}Generate all files needed for this application to run immediately after npm install.`;

    return {
      systemPrompt,
      userPrompt: userPromptCompiled,
      responseFormat: 'json'
    };
  }
}
