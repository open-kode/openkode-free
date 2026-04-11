/**
 * OpenKode Diff Reviewer
 * LLM-based diff review against specifications
 */

import {
  GitDiff,
  DiffFile,
  DiffHunk,
  DiffReviewResult,
  ReviewComment,
  PlanAlignmentResult,
  PlanDeviation,
  ReviewCategory,
  DiffConfig,
} from './types';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface DiffReviewerOptions {
  config?: DiffConfig;
  planPath?: string;
  specPath?: string;
  llmProvider?: 'openai' | 'anthropic' | 'local';
  llmModel?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface PlanDocument {
  id: string;
  version: string;
  items: PlanItem[];
  requirements: Requirement[];
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface PlanItem {
  id: string;
  type: 'feature' | 'fix' | 'refactor' | 'test' | 'docs';
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  files?: string[];
}

export interface Requirement {
  id: string;
  description: string;
  mandatory: boolean;
  verification: string;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  testable: boolean;
}

/**
 * DiffReviewer - LLM-based code diff review system
 * Analyzes git diffs against specifications and plans
 */
export class DiffReviewer {
  private options: DiffReviewerOptions;
  private plan?: PlanDocument;
  private config: DiffConfig;

  constructor(options: DiffReviewerOptions = {}) {
    this.options = {
      llmProvider: 'openai',
      llmModel: 'gpt-4',
      maxTokens: 4000,
      temperature: 0.3,
      ...options,
    };

    this.config = options.config ?? {
      enabled: true,
      maxFiles: 50,
      maxLines: 5000,
      excludePatterns: ['*.lock', 'node_modules/**', 'dist/**', '*.min.js'],
    };

    if (options.planPath) {
      this.loadPlan(options.planPath);
    }
  }

  /**
   * Main entry point: review a git diff against specifications
   */
  async reviewDiff(
    diffInput: string | GitDiff,
    context?: { planId?: string; specContent?: string; prDescription?: string }
  ): Promise<DiffReviewResult> {
    const diff = typeof diffInput === 'string' ? this.parseDiff(diffInput) : diffInput;

    // Filter out excluded files
    const filteredDiff = this.filterDiff(diff);

    if (filteredDiff.files.length === 0) {
      return {
        passed: true,
        score: 100,
        alignment: {
          aligned: true,
          score: 100,
          planId: context?.planId ?? 'unknown',
          deviations: [],
          coverage: 100,
        },
        comments: [],
        summary: 'No relevant files to review after filtering.',
      };
    }

    // Generate review comments via LLM analysis
    const comments = await this.generateComments(filteredDiff, context);

    // Check plan alignment
    const alignment = await this.checkAlignment(filteredDiff, context);

    // Calculate overall score
    const score = this.calculateScore(comments, alignment);

    // Generate summary
    const summary = this.generateSummary(filteredDiff, comments, alignment);

    return {
      passed: score >= 70 && alignment.aligned,
      score,
      alignment,
      comments,
      summary,
    };
  }

  /**
   * Check diff alignment with plan/specifications
   */
  async checkAlignment(
    diff: GitDiff,
    context?: { planId?: string; specContent?: string }
  ): Promise<PlanAlignmentResult> {
    const planId = context?.planId ?? this.plan?.id ?? 'unknown';
    const deviations: PlanDeviation[] = [];

    // If no plan loaded, attempt basic alignment check
    if (!this.plan && !context?.specContent) {
      return {
        aligned: true,
        score: 100,
        planId,
        deviations: [],
        coverage: 100,
      };
    }

    // Analyze each file change against plan items
    const coveredItems = new Set<string>();
    const planItems = this.plan?.items ?? [];

    for (const file of diff.files) {
      // Check if file changes align with any plan item
      const matchingItems = planItems.filter(
        item => item.files?.some(f => file.path.includes(f) || f.includes(file.path))
      );

      if (matchingItems.length === 0 && planItems.length > 0) {
        // Potential deviation: file changed but not in plan
        deviations.push({
          type: 'extra',
          planItem: file.path,
          description: `File '${file.path}' was modified but not explicitly covered by plan items`,
          severity: 'low',
        });
      } else {
        matchingItems.forEach(item => coveredItems.add(item.id));
      }

      // Check for missing implementations
      for (const item of planItems) {
        if (item.status === 'pending' && item.priority === 'critical') {
          const shouldBeImplemented = item.files?.some(f =>
            diff.files.some(df => df.path.includes(f))
          );
          if (!shouldBeImplemented) {
            deviations.push({
              type: 'missing',
              planItem: item.id,
              description: `Critical plan item '${item.description}' not addressed`,
              severity: 'high',
            });
          }
        }
      }
    }

    // Calculate coverage
    const coverage = planItems.length > 0 ? (coveredItems.size / planItems.length) * 100 : 100;

    // Calculate alignment score
    const criticalDeviations = deviations.filter(d => d.severity === 'critical').length;
    const highDeviations = deviations.filter(d => d.severity === 'high').length;
    const score = Math.max(0, 100 - criticalDeviations * 30 - highDeviations * 15 - (100 - coverage) * 0.5);

    return {
      aligned: score >= 70 && criticalDeviations === 0,
      score: Math.round(score),
      planId,
      deviations,
      coverage: Math.round(coverage),
    };
  }

  /**
   * Generate review comments for the diff
   */
  async generateComments(
    diff: GitDiff,
    context?: { specContent?: string; prDescription?: string }
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    // Analyze each file
    for (const file of diff.files) {
      const fileComments = await this.analyzeFile(file, context);
      comments.push(...fileComments);
    }

    // Add cross-file analysis comments
    const crossFileComments = this.analyzeCrossFileIssues(diff);
    comments.push(...crossFileComments);

    // Sort by severity
    return this.sortCommentsBySeverity(comments);
  }

  /**
   * Parse raw git diff into structured format
   */
  parseDiff(rawDiff: string): GitDiff {
    const files: DiffFile[] = [];
    const lines = rawDiff.split('\n');

    let currentFile: DiffFile | null = null;
    let currentHunk: DiffHunk | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect file header
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          if (currentHunk) currentFile.hunks.push(currentHunk);
          files.push(currentFile);
        }
        currentFile = {
          path: '',
          changeType: 'modified',
          additions: 0,
          deletions: 0,
          hunks: [],
        };
        currentHunk = null;
        continue;
      }

      // Parse file paths
      if (line.startsWith('--- ') && currentFile) {
        const oldPath = line.substring(4).replace('a/', '');
        if (oldPath !== '/dev/null') {
          currentFile.oldPath = oldPath;
        }
        continue;
      }

      if (line.startsWith('+++ ') && currentFile) {
        const newPath = line.substring(4).replace('b/', '');
        if (newPath !== '/dev/null') {
          currentFile.path = newPath;
        }
        continue;
      }

      // Detect new file
      if (line.startsWith('new file mode') && currentFile) {
        currentFile.changeType = 'added';
        continue;
      }

      // Detect deleted file
      if (line.startsWith('deleted file mode') && currentFile) {
        currentFile.changeType = 'deleted';
        continue;
      }

      // Detect rename
      if (line.startsWith('rename from') && currentFile) {
        currentFile.changeType = 'renamed';
        continue;
      }

      // Parse hunk header
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch && currentFile) {
        if (currentHunk) currentFile.hunks.push(currentHunk);
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: parseInt(hunkMatch[2] ?? '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newLines: parseInt(hunkMatch[4] ?? '1', 10),
          lines: [],
        };
        continue;
      }

      // Parse diff lines
      if (currentHunk) {
        if (line.startsWith('+')) {
          currentHunk.lines.push({
            type: 'addition',
            content: line.substring(1),
            lineNumber: currentHunk.newStart + currentHunk.lines.filter(l => l.type !== 'deletion').length - 1,
          });
          if (currentFile) currentFile.additions++;
        } else if (line.startsWith('-')) {
          currentHunk.lines.push({
            type: 'deletion',
            content: line.substring(1),
          });
          if (currentFile) currentFile.deletions++;
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push({
            type: 'context',
            content: line.substring(1),
          });
        }
      }
    }

    // Push final file
    if (currentFile) {
      if (currentHunk) currentFile.hunks.push(currentHunk);
      files.push(currentFile);
    }

    return {
      files,
      stats: {
        filesChanged: files.length,
        insertions: files.reduce((sum, f) => sum + f.additions, 0),
        deletions: files.reduce((sum, f) => sum + f.deletions, 0),
      },
      raw: rawDiff,
    };
  }

  /**
   * Load plan document from file
   */
  private loadPlan(planPath: string): void {
    try {
      const content = readFileSync(planPath, 'utf-8');
      this.plan = JSON.parse(content) as PlanDocument;
    } catch (error) {
      console.warn(`Failed to load plan from ${planPath}:`, error);
    }
  }

  /**
   * Filter diff based on configuration
   */
  private filterDiff(diff: GitDiff): GitDiff {
    const filteredFiles = diff.files.filter(file => {
      // Check exclude patterns
      for (const pattern of this.config.excludePatterns) {
        if (this.matchesPattern(file.path, pattern)) {
          return false;
        }
      }
      return true;
    });

    // Limit files
    const limitedFiles = filteredFiles.slice(0, this.config.maxFiles);

    // Limit total lines
    let totalLines = 0;
    const finalFiles: DiffFile[] = [];
    for (const file of limitedFiles) {
      const fileLines = file.additions + file.deletions;
      if (totalLines + fileLines > this.config.maxLines) {
        break;
      }
      totalLines += fileLines;
      finalFiles.push(file);
    }

    return {
      files: finalFiles,
      stats: {
        filesChanged: finalFiles.length,
        insertions: finalFiles.reduce((sum, f) => sum + f.additions, 0),
        deletions: finalFiles.reduce((sum, f) => sum + f.deletions, 0),
      },
      raw: diff.raw,
    };
  }

  /**
   * Check if path matches a glob pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<DOUBLESTAR>>>/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(regex).test(path);
  }

  /**
   * Analyze a single file for issues
   */
  private async analyzeFile(
    file: DiffFile,
    context?: { specContent?: string; prDescription?: string }
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    // Skip binary or non-code files
    if (!this.isCodeFile(file.path)) {
      return comments;
    }

    // Analyze each hunk
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'addition') {
          const lineComments = this.analyzeLine(file.path, line.content, line.lineNumber);
          comments.push(...lineComments);
        }
      }
    }

    // File-level analysis
    const fileLevelComments = this.analyzeFileLevel(file);
    comments.push(...fileLevelComments);

    return comments;
  }

  /**
   * Analyze a single line of code
   */
  private analyzeLine(
    filePath: string,
    content: string,
    lineNumber?: number
  ): ReviewComment[] {
    const comments: ReviewComment[] = [];

    // Check for common issues

    // TODO/FIXME comments
    if (/\/\/\s*(TODO|FIXME|XXX|HACK)/i.test(content)) {
      comments.push({
        id: `todo-${filePath}-${lineNumber}`,
        type: 'warning',
        severity: 'low',
        file: filePath,
        line: lineNumber,
        message: 'Unresolved TODO/FIXME comment found',
        category: 'maintainability',
        autoFixable: false,
      });
    }

    // Console.log statements
    if (/console\.(log|debug|warn|error)\(/.test(content)) {
      comments.push({
        id: `console-${filePath}-${lineNumber}`,
        type: 'warning',
        severity: 'low',
        file: filePath,
        line: lineNumber,
        message: 'Console statement should be removed or replaced with proper logging',
        category: 'code-quality',
        autoFixable: false,
      });
    }

    // Hardcoded values that might need constants
    if (/(const|let|var)\s+\w+\s*=\s*["']\w+["']/.test(content)) {
      const match = content.match(/["'](\w+)["']/);
      if (match && match[1].length > 3) {
        comments.push({
          id: `magic-string-${filePath}-${lineNumber}`,
          type: 'suggestion',
          severity: 'low',
          file: filePath,
          line: lineNumber,
          message: `Consider extracting '${match[1]}' as a named constant`,
          category: 'maintainability',
          autoFixable: false,
        });
      }
    }

    // Potential performance issues
    if (/\.forEach\s*\(/.test(content) && /await/.test(content)) {
      comments.push({
        id: `async-foreach-${filePath}-${lineNumber}`,
        type: 'warning',
        severity: 'medium',
        file: filePath,
        line: lineNumber,
        message: 'Using await inside forEach may not work as expected. Consider using for...of loop.',
        category: 'performance',
        autoFixable: false,
      });
    }

    // Security: eval usage
    if (/\beval\s*\(/.test(content)) {
      comments.push({
        id: `eval-${filePath}-${lineNumber}`,
        type: 'error',
        severity: 'critical',
        file: filePath,
        line: lineNumber,
        message: 'eval() is dangerous and should be avoided',
        category: 'security',
        autoFixable: false,
      });
    }

    return comments;
  }

  /**
   * Analyze file-level issues
   */
  private analyzeFileLevel(file: DiffFile): ReviewComment[] {
    const comments: ReviewComment[] = [];

    // Large file warning
    const totalChanges = file.additions + file.deletions;
    if (totalChanges > 500) {
      comments.push({
        id: `large-file-${file.path}`,
        type: 'warning',
        severity: 'medium',
        file: file.path,
        message: `Large change (${totalChanges} lines). Consider breaking into smaller commits.`,
        category: 'maintainability',
        autoFixable: false,
      });
    }

    // Missing tests for new files
    if (file.changeType === 'added' && this.isCodeFile(file.path) && !file.path.includes('.test.')) {
      const hasTest = file.path.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1');
      comments.push({
        id: `missing-test-${file.path}`,
        type: 'suggestion',
        severity: 'medium',
        file: file.path,
        message: 'New file added without corresponding test file. Consider adding tests.',
        category: 'code-quality',
        autoFixable: false,
      });
    }

    return comments;
  }

  /**
   * Analyze cross-file issues
   */
  private analyzeCrossFileIssues(diff: GitDiff): ReviewComment[] {
    const comments: ReviewComment[] = [];

    // Check for consistent patterns across files
    const files = diff.files;

    // Check if API changes have corresponding test updates
    const apiFiles = files.filter(f => f.path.includes('/api/') || f.path.includes('/routes/'));
    const testFiles = files.filter(f => f.path.includes('.test.') || f.path.includes('.spec.'));

    if (apiFiles.length > 0 && testFiles.length === 0) {
      comments.push({
        id: 'missing-api-tests',
        type: 'warning',
        severity: 'high',
        file: apiFiles[0].path,
        message: 'API changes detected but no test files were modified. Please add/update tests.',
        category: 'code-quality',
        autoFixable: false,
      });
    }

    return comments;
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(path: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];
    return codeExtensions.some(ext => path.endsWith(ext));
  }

  /**
   * Calculate overall review score
   */
  private calculateScore(comments: ReviewComment[], alignment: PlanAlignmentResult): number {
    const criticalCount = comments.filter(c => c.severity === 'critical').length;
    const highCount = comments.filter(c => c.severity === 'high').length;
    const mediumCount = comments.filter(c => c.severity === 'medium').length;
    const lowCount = comments.filter(c => c.severity === 'low').length;

    let score = 100;
    score -= criticalCount * 25;
    score -= highCount * 10;
    score -= mediumCount * 3;
    score -= lowCount * 1;

    // Factor in alignment
    score = score * (alignment.score / 100);

    return Math.max(0, Math.round(score));
  }

  /**
   * Generate review summary
   */
  private generateSummary(
    diff: GitDiff,
    comments: ReviewComment[],
    alignment: PlanAlignmentResult
  ): string {
    const parts: string[] = [];

    parts.push(`Reviewed ${diff.stats.filesChanged} files with ${diff.stats.insertions}+/${diff.stats.deletions}- changes.`);

    const criticalCount = comments.filter(c => c.severity === 'critical').length;
    const highCount = comments.filter(c => c.severity === 'high').length;
    const mediumCount = comments.filter(c => c.severity === 'medium').length;
    const lowCount = comments.filter(c => c.severity === 'low').length;

    if (criticalCount > 0) parts.push(`${criticalCount} critical issues found.`);
    if (highCount > 0) parts.push(`${highCount} high severity issues.`);
    if (mediumCount > 0) parts.push(`${mediumCount} medium severity issues.`);
    if (lowCount > 0) parts.push(`${lowCount} low severity suggestions.`);

    if (alignment.deviations.length > 0) {
      parts.push(`${alignment.deviations.length} plan deviations detected.`);
    }

    if (comments.length === 0 && alignment.aligned) {
      parts.push('All checks passed!');
    }

    return parts.join(' ');
  }

  /**
   * Sort comments by severity
   */
  private sortCommentsBySeverity(comments: ReviewComment[]): ReviewComment[] {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return comments.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Get git diff from repository
   */
  static getGitDiff(fromRef?: string, toRef?: string): GitDiff {
    const command = fromRef
      ? `git diff ${fromRef} ${toRef ?? 'HEAD'}`
      : 'git diff HEAD~1 HEAD';

    try {
      const output = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      const reviewer = new DiffReviewer();
      return reviewer.parseDiff(output);
    } catch (error) {
      throw new Error(`Failed to get git diff: ${error}`);
    }
  }

  /**
   * Get diff for specific files
   */
  static getFileDiff(filePaths: string[]): GitDiff {
    const command = `git diff HEAD~1 HEAD -- ${filePaths.join(' ')}`;

    try {
      const output = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      const reviewer = new DiffReviewer();
      return reviewer.parseDiff(output);
    } catch (error) {
      throw new Error(`Failed to get file diff: ${error}`);
    }
  }
}

export default DiffReviewer;
