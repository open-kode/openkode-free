/**
 * OpenKode Orchestrator
 * 
 * Integrates codebase analysis, spec planning, and execution
 * Connects the codebase/, spec/, and orchestration/ modules to the vibe/ engines
 */

import { FileDiscovery, FileInfo } from '../codebase/fileDiscovery';
import { DependencyGraphBuilder, DependencyGraph } from '../codebase/dependencyGraph';
import { SymbolIndex } from '../codebase/symbolIndex';
import { TacticalPlanner, TacticalPlan, FileChange } from '../spec/tacticalPlanner';
import { ContextManager } from '../orchestration/contextManager';
import { LLMClient, LLMConfig } from '../llm/llmClient';
import { FileWriter } from '../vibe/fileWriter';
import { randomUUID } from 'crypto';

export interface ProjectContext {
  rootPath: string;
  files: FileInfo[];
  dependencies: Map<string, string[]>;
  entryPoints: string[];
  frameworks: string[];
}

export interface ExecutionStep {
  id: string;
  description: string;
  files: string[];
  action: 'create' | 'modify' | 'delete';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface OrchestratorResult {
  success: boolean;
  plan?: TacticalPlan;
  steps?: ExecutionStep[];
  filesCreated: string[];
  filesModified: string[];
  error?: string;
  latency: number;
}

export class OpenKodeOrchestrator {
  private workspaceRoot: string;
  private fileDiscovery: FileDiscovery;
  private dependencyGraph: DependencyGraphBuilder;
  private symbolIndex: SymbolIndex;
  private tacticalPlanner: TacticalPlanner;
  private contextManager: ContextManager;
  private llm: LLMClient;
  private fileWriter: FileWriter;
  private llmConfig: LLMConfig;

  constructor(
    workspaceRoot: string,
    llmConfig: LLMConfig
  ) {
    this.workspaceRoot = workspaceRoot;
    this.llmConfig = llmConfig;
    this.fileDiscovery = new FileDiscovery({ rootPath: workspaceRoot });
    this.dependencyGraph = new DependencyGraphBuilder({ rootPath: workspaceRoot });
    this.symbolIndex = new SymbolIndex(workspaceRoot);
    this.tacticalPlanner = new TacticalPlanner();
    this.contextManager = new ContextManager();
    this.llm = new LLMClient(llmConfig);
    this.fileWriter = new FileWriter(workspaceRoot);
  }

  /**
   * Full pipeline: Analyze → Plan → Execute
   */
  async executeFeature(
    prompt: string,
    onProgress?: (msg: string) => void,
    onStepUpdate?: (step: ExecutionStep) => void
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();

    try {
      // Phase 1: Analyze codebase
      onProgress?.('Analyzing project structure...');
      const context = await this.analyzeProject();

      // Phase 2: Create tactical plan
      onProgress?.('Creating implementation plan...');
      const plan = await this.createPlan(prompt, context);

      // Phase 3: Execute plan
      onProgress?.('Executing plan...');
      const result = await this.executePlan(plan, onStepUpdate);

      return {
        success: true,
        plan,
        steps: result.steps,
        filesCreated: result.filesCreated,
        filesModified: result.filesModified,
        latency: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        filesCreated: [],
        filesModified: [],
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Analyze existing codebase
   */
  async analyzeProject(): Promise<ProjectContext> {
    // Discover files
    const files = await this.fileDiscovery.discoverFiles();

    // Build dependency graph
    const graph = await this.dependencyGraph.buildGraph();
    const dependencies = this.convertGraphToMap(graph);

    // Find entry points
    const entryPoints = files.files
      .filter(f => f.isEntry || f.name === 'index.ts' || f.name === 'main.ts')
      .map(f => f.path);

    // Detect frameworks
    const frameworks = this.detectFrameworks(files.files);

    return {
      rootPath: this.workspaceRoot,
      files: files.files,
      dependencies,
      entryPoints,
      frameworks
    };
  }

  /**
   * Create tactical plan from user prompt
   */
  private async createPlan(prompt: string, context: ProjectContext): Promise<TacticalPlan> {
    // Use LLM to create plan based on prompt and context
    const systemPrompt = `You are an expert software architect. Create a detailed implementation plan.

PROJECT CONTEXT:
- Frameworks: ${context.frameworks.join(', ') || 'Unknown'}
- Entry Points: ${context.entryPoints.join(', ') || 'None'}
- Existing Files: ${context.files.length}

RESPONSE FORMAT (JSON):
{
  "id": "plan-123",
  "title": "Feature Implementation",
  "sourceTicketId": "ticket-1",
  "sourceIntentId": "intent-1",
  "version": "1.0",
  "createdAt": "2024-01-01T00:00:00Z",
  "filesToTouch": [
    {
      "path": "src/feature.ts",
      "action": "create",
      "description": "Main feature implementation",
      "fileType": "source"
    }
  ],
  "interfaces": [],
  "steps": [
    {
      "id": "step-1",
      "description": "Create feature file",
      "filePath": "src/feature.ts",
      "action": "create",
      "dependencies": [],
      "estimatedMinutes": 5
    }
  ],
  "dependencies": [],
  "testSpecs": [],
  "acceptanceCriteria": ["Feature works as expected"],
  "rollbackPlan": [],
  "verificationCommands": ["npm run build"],
  "estimatedHours": 1,
  "risks": []
}`;

    const response = await this.llm.generateJSON<TacticalPlan>({
      systemPrompt,
      userPrompt: `Create implementation plan for: ${prompt}\n\nExisting project has ${context.files.length} files.`,
      responseFormat: 'json'
    });

    return response;
  }

  /**
   * Execute tactical plan
   */
  private async executePlan(
    plan: TacticalPlan,
    onStepUpdate?: (step: ExecutionStep) => void
  ): Promise<{ steps: ExecutionStep[]; filesCreated: string[]; filesModified: string[] }> {
    const steps: ExecutionStep[] = plan.steps.map(s => ({
      id: s.title.replace(/\s+/g, '-').toLowerCase() || randomUUID(),
      description: s.description,
      files: s.relatedFiles,
      action: 'modify' as const, // Default action, could be determined from step type
      status: 'pending' as const
    }));

    const filesCreated: string[] = [];
    const filesModified: string[] = [];

    for (const step of steps) {
      step.status = 'in_progress';
      onStepUpdate?.(step);

      try {
        // Generate code for this step
        const fileChange = plan.filesToTouch.find(f => f.path === step.files[0]);
        if (fileChange) {
          await this.executeFileChange(fileChange);
          
          if (fileChange.action === 'create') {
            filesCreated.push(fileChange.path);
          } else if (fileChange.action === 'modify') {
            filesModified.push(fileChange.path);
          }
        }

        step.status = 'completed';
        onStepUpdate?.(step);

      } catch (error) {
        step.status = 'failed';
        onStepUpdate?.(step);
        throw error;
      }
    }

    return { steps, filesCreated, filesModified };
  }

  /**
   * Execute a single file change
   */
  private async executeFileChange(fileChange: FileChange): Promise<void> {
    if (fileChange.action === 'create') {
      // Generate content using LLM
      const content = await this.generateFileContent(fileChange);
      await this.fileWriter.writeFile(fileChange.path, content);
    } else if (fileChange.action === 'modify') {
      // Read existing content and modify
      const existing = await this.fileWriter.readFile(fileChange.path);
      const modified = await this.modifyFileContent(fileChange, existing);
      await this.fileWriter.writeFile(fileChange.path, modified);
    }
  }

  /**
   * Generate content for new file
   */
  private async generateFileContent(fileChange: FileChange): Promise<string> {
    const response = await this.llm.generateJSON<{ content: string }>({
      systemPrompt: `Generate complete, production-ready code for: ${fileChange.description}
Respond with JSON: { "content": "full file content here" }`,
      userPrompt: `Create file: ${fileChange.path}\n${fileChange.template || ''}`,
      responseFormat: 'json'
    });

    return response.content;
  }

  /**
   * Modify existing file content
   */
  private async modifyFileContent(fileChange: FileChange, existing: string): Promise<string> {
    const response = await this.llm.generateJSON<{ content: string }>({
      systemPrompt: `Modify the existing code according to: ${fileChange.description}
Respond with JSON: { "content": "full modified file content" }`,
      userPrompt: `File: ${fileChange.path}\n\nExisting content:\n${existing.substring(0, 2000)}`,
      responseFormat: 'json'
    });

    return response.content;
  }

  /**
   * Detect frameworks used in project
   */
  private detectFrameworks(files: FileInfo[]): string[] {
    const frameworks: string[] = [];
    const fileNames = files.map(f => f.name);
    
    if (fileNames.includes('package.json')) frameworks.push('nodejs');
    if (files.some(f => f.path.includes('react')))
      frameworks.push('react');
    if (files.some(f => f.path.includes('vue')))
      frameworks.push('vue');
    if (files.some(f => f.path.includes('angular')))
      frameworks.push('angular');
    if (files.some(f => f.name === 'Cargo.toml')) frameworks.push('rust');
    if (files.some(f => f.name === 'go.mod')) frameworks.push('go');
    
    return frameworks;
  }

  private convertGraphToMap(graph: DependencyGraph): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const [path, node] of graph.nodes) {
      map.set(path, node.dependencies);
    }
    return map;
  }
}
