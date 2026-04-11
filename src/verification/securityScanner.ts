/**
 * OpenKode Security Scanner
 * Detects secrets, injection risks, and authentication issues
 */

import {
  SecurityResult,
  SecurityIssue,
  DetectedSecret,
  SecurityRisk,
  SecuritySummary,
  SecurityConfig,
  SecurityIssueType,
  SecretType,
} from './types';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { execSync } from 'child_process';

export interface SecurityScannerOptions {
  config?: SecurityConfig;
  projectRoot?: string;
  customPatterns?: SecretPattern[];
  severityThreshold?: 'critical' | 'high' | 'medium' | 'low';
  scanDepth?: 'shallow' | 'deep';
}

export interface SecretPattern {
  name: SecretType;
  pattern: RegExp;
  entropyThreshold?: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScanTarget {
  path: string;
  content: string;
  type: 'file' | 'config' | 'env' | 'source';
}

export interface InjectionPattern {
  type: SecurityIssueType;
  pattern: RegExp;
  message: string;
  cwe: string;
  owasp: string;
  remediation: string;
}

/**
 * SecurityScanner - Comprehensive security scanning
 * Detects secrets, injection vulnerabilities, and auth issues
 */
export class SecurityScanner {
  private options: SecurityScannerOptions;
  private config: SecurityConfig;
  private projectRoot: string;
  private secretPatterns: SecretPattern[];
  private injectionPatterns: InjectionPattern[];

  constructor(options: SecurityScannerOptions = {}) {
    this.options = options;
    this.projectRoot = options.projectRoot ?? process.cwd();

    this.config = options.config ?? {
      enabled: true,
      secretPatterns: [],
      severityThreshold: 'low',
      excludePaths: ['node_modules', '.git', 'dist', 'build', 'coverage'],
    };

    this.secretPatterns = options.customPatterns ?? this.getDefaultSecretPatterns();
    this.injectionPatterns = this.getInjectionPatterns();
  }

  /**
   * Main entry point: scan for security issues
   */
  async scanSecurity(filePaths?: string[]): Promise<SecurityResult> {
    const targets = filePaths
      ? await this.loadSpecificFiles(filePaths)
      : await this.discoverFiles();

    if (targets.length === 0) {
      return {
        passed: true,
        score: 100,
        issues: [],
        secrets: [],
        risks: [],
        summary: {
          totalIssues: 0,
          criticalCount: 0,
          highCount: 0,
          secretsFound: 0,
          filesScanned: 0,
          riskScore: 0,
        },
      };
    }

    // Detect secrets
    const secrets = this.detectSecrets(targets);

    // Analyze injection risks
    const injectionIssues = this.analyzeRisks(targets);

    // Detect auth issues
    const authIssues = this.detectAuthIssues(targets);

    // Detect insecure configurations
    const configIssues = this.detectInsecureConfigs(targets);

    // Aggregate all issues
    const allIssues = [...injectionIssues, ...authIssues, ...configIssues];

    // Calculate risk score
    const riskScore = this.calculateRiskScore(allIssues, secrets);

    // Generate summary
    const summary = this.generateSummary(allIssues, secrets, targets.length);

    // Build security risks
    const risks = this.buildSecurityRisks(allIssues);

    // Determine pass/fail
    const passed = this.checkPassed(allIssues, secrets);

    return {
      passed,
      score: Math.max(0, 100 - riskScore),
      issues: allIssues,
      secrets,
      risks,
      summary,
    };
  }

  /**
   * Detect secrets in code
   */
  detectSecrets(targets: ScanTarget[]): DetectedSecret[] {
    const secrets: DetectedSecret[] = [];
    const seenMatches = new Set<string>();

    for (const target of targets) {
      // Skip binary files
      if (this.isBinaryFile(target.path)) continue;

      const lines = target.content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        for (const pattern of this.secretPatterns) {
          const matches = line.matchAll(pattern.pattern);

          for (const match of matches) {
            const matchedValue = match[0];
            const secretValue = match[1] ?? matchedValue;

            // Skip if already seen
            const key = `${target.path}:${lineNum + 1}:${matchedValue}`;
            if (seenMatches.has(key)) continue;
            seenMatches.add(key);

            // Calculate entropy
            const entropy = this.calculateEntropy(secretValue);

            // Check entropy threshold
            if (pattern.entropyThreshold && entropy < pattern.entropyThreshold) {
              continue;
            }

            secrets.push({
              id: `secret-${secrets.length}`,
              type: pattern.name,
              file: target.path,
              line: lineNum + 1,
              match: this.maskSecret(secretValue),
              entropy,
              confidence: pattern.confidence,
            });
          }
        }
      }
    }

    return secrets;
  }

  /**
   * Analyze injection and security risks
   */
  analyzeRisks(targets: ScanTarget[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (const target of targets) {
      if (!this.isCodeFile(target.path)) continue;

      const lines = target.content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        for (const pattern of this.injectionPatterns) {
          if (pattern.pattern.test(line)) {
            issues.push({
              id: `risk-${issues.length}`,
              type: pattern.type,
              severity: this.getSeverityForPattern(pattern.type),
              confidence: 'high',
              file: target.path,
              line: lineNum + 1,
              column: line.search(pattern.pattern) + 1,
              message: pattern.message,
              code: line.trim(),
              cwe: pattern.cwe,
              owasp: pattern.owasp,
              remediation: pattern.remediation,
              references: this.getReferencesForCWE(pattern.cwe),
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Detect authentication issues
   */
  detectAuthIssues(targets: ScanTarget[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (const target of targets) {
      if (!this.isCodeFile(target.path)) continue;

      const content = target.content;
      const lines = content.split('\n');

      // Check for hardcoded credentials
      const hardcodedPatterns = [
        { pattern: /password\s*[=:]\s*["'][^"']+["']/i, message: 'Hardcoded password detected' },
        { pattern: /username\s*[=:]\s*["'][^"']+["']/i, message: 'Hardcoded username detected' },
        { pattern: /auth\s*[=:]\s*["'][^"']+["']/i, message: 'Hardcoded auth value detected' },
      ];

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        for (const { pattern, message } of hardcodedPatterns) {
          if (pattern.test(line) && !line.includes('process.env') && !line.includes('process.argv')) {
            issues.push({
              id: `auth-${issues.length}`,
              type: 'auth-bypass',
              severity: 'critical',
              confidence: 'high',
              file: target.path,
              line: lineNum + 1,
              column: line.search(pattern) + 1,
              message,
              code: line.trim(),
              cwe: 'CWE-798',
              owasp: 'A07:2021',
              remediation: 'Use environment variables or a secure secrets manager',
              references: ['https://cwe.mitre.org/data/definitions/798.html'],
            });
          }
        }

        // Check for weak JWT secrets
        if (/jwt|jsonwebtoken/i.test(line) && /secret|key/i.test(line)) {
          const secretMatch = line.match(/secret\s*[=:]\s*["']([^"']{0,32})["']/);
          if (secretMatch && secretMatch[1].length < 32) {
            issues.push({
              id: `auth-weak-jwt-${issues.length}`,
              type: 'auth-bypass',
              severity: 'high',
              confidence: 'high',
              file: target.path,
              line: lineNum + 1,
              message: 'Weak JWT secret detected (should be at least 32 characters)',
              code: line.trim(),
              cwe: 'CWE-326',
              owasp: 'A02:2021',
              remediation: 'Use a cryptographically secure random string of at least 32 characters',
              references: ['https://cwe.mitre.org/data/definitions/326.html'],
            });
          }
        }

        // Check for insecure session configuration
        if (/session|cookie/i.test(line) && /secure|httpOnly|sameSite/i.test(line)) {
          if (!/secure:\s*true/i.test(line) || !/httpOnly:\s*true/i.test(line)) {
            issues.push({
              id: `auth-session-${issues.length}`,
              type: 'insecure-config',
              severity: 'medium',
              confidence: 'medium',
              file: target.path,
              line: lineNum + 1,
              message: 'Session/cookie may be missing secure or httpOnly flags',
              code: line.trim(),
              cwe: 'CWE-614',
              owasp: 'A05:2021',
              remediation: 'Set secure: true and httpOnly: true for session cookies',
              references: ['https://cwe.mitre.org/data/definitions/614.html'],
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Detect insecure configurations
   */
  private detectInsecureConfigs(targets: ScanTarget[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (const target of targets) {
      // Check package.json for vulnerable dependencies
      if (target.path.endsWith('package.json')) {
        try {
          const pkg = JSON.parse(target.content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };

          // Check for known insecure packages
          const insecurePackages = [
            { name: 'lodash', version: '<4.17.12', cve: 'CVE-2019-10744' },
            { name: 'minimist', version: '<1.2.3', cve: 'CVE-2020-7598' },
            { name: 'serialize-javascript', version: '<3.1.0', cve: 'CVE-2020-7660' },
          ];

          for (const [name, version] of Object.entries(deps as Record<string, string>)) {
            for (const insecure of insecurePackages) {
              if (name === insecure.name) {
                issues.push({
                  id: `dep-${name}`,
                  type: 'dependency-vuln',
                  severity: 'high',
                  confidence: 'medium',
                  file: target.path,
                  line: 0,
                  message: `Potentially vulnerable dependency: ${name}@${version} (${insecure.cve})`,
                  code: `"${name}": "${version}"`,
                  cwe: 'CWE-1035',
                  owasp: 'A06:2021',
                  remediation: `Update ${name} to a secure version`,
                  references: [`https://nvd.nist.gov/vuln/detail/${insecure.cve}`],
                });
              }
            }
          }
        } catch {
          // Invalid package.json
        }
      }

      // Check .env files for exposed secrets
      if (target.path.includes('.env') && !target.path.includes('.env.example')) {
        const lines = target.content.split('\n');
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          if (/^(SECRET|KEY|TOKEN|PWD|PASS|API_KEY)=.+$/i.test(line)) {
            issues.push({
              id: `env-exposed-${lineNum}`,
              type: 'data-exposure',
              severity: 'critical',
              confidence: 'high',
              file: target.path,
              line: lineNum + 1,
              message: 'Sensitive value exposed in environment file',
              code: line.split('=')[0] + '=***',
              cwe: 'CWE-532',
              owasp: 'A09:2021',
              remediation: 'Add .env files to .gitignore and use environment variables in production',
              references: ['https://cwe.mitre.org/data/definitions/532.html'],
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Discover files to scan
   */
  private async discoverFiles(): Promise<ScanTarget[]> {
    const targets: ScanTarget[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.env'];

    const scanDir = (dir: string) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(this.projectRoot, fullPath);

          // Skip excluded paths
          if (this.config.excludePaths.some(p => relativePath.includes(p))) continue;

          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = extname(entry.name);
            if (extensions.includes(ext) || entry.name.startsWith('.env')) {
              try {
                const content = readFileSync(fullPath, 'utf-8');
                targets.push({
                  path: fullPath,
                  content,
                  type: this.getFileType(fullPath),
                });
              } catch {
                // Skip unreadable files
              }
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    scanDir(this.projectRoot);
    return targets;
  }

  /**
   * Load specific files
   */
  private async loadSpecificFiles(filePaths: string[]): Promise<ScanTarget[]> {
    const targets: ScanTarget[] = [];

    for (const path of filePaths) {
      try {
        if (existsSync(path)) {
          const content = readFileSync(path, 'utf-8');
          targets.push({
            path,
            content,
            type: this.getFileType(path),
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return targets;
  }

  /**
   * Get file type
   */
  private getFileType(path: string): ScanTarget['type'] {
    if (path.includes('.env')) return 'env';
    if (path.endsWith('package.json') || path.endsWith('tsconfig.json')) return 'config';
    if (this.isCodeFile(path)) return 'source';
    return 'file';
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(path: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'];
    return codeExtensions.some(ext => path.endsWith(ext));
  }

  /**
   * Check if file is binary
   */
  private isBinaryFile(path: string): boolean {
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz'];
    return binaryExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  /**
   * Calculate Shannon entropy of a string
   */
  private calculateEntropy(str: string): number {
    const len = str.length;
    if (len === 0) return 0;

    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] ?? 0) + 1;
    }

    let entropy = 0;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Mask a secret value for display
   */
  private maskSecret(value: string): string {
    if (value.length <= 8) return '***';
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }

  /**
   * Get severity for pattern type
   */
  private getSeverityForPattern(type: SecurityIssueType): 'critical' | 'high' | 'medium' | 'low' {
    const severityMap: Record<SecurityIssueType, 'critical' | 'high' | 'medium' | 'low'> = {
      'injection': 'critical',
      'sql-injection': 'critical',
      'command-injection': 'critical',
      'xss': 'high',
      'csrf': 'high',
      'auth-bypass': 'critical',
      'data-exposure': 'high',
      'insecure-config': 'medium',
      'dependency-vuln': 'high',
      'secret-leak': 'critical',
      'path-traversal': 'high',
      'unsafe-deserialization': 'critical',
    };
    return severityMap[type] ?? 'medium';
  }

  /**
   * Get references for CWE
   */
  private getReferencesForCWE(cwe: string): string[] {
    return [
      `https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-', '')}.html`,
      'https://owasp.org/www-project-top-ten/',
    ];
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(issues: SecurityIssue[], secrets: DetectedSecret[]): number {
    let score = 0;

    // Critical issues
    score += issues.filter(i => i.severity === 'critical').length * 25;

    // High severity issues
    score += issues.filter(i => i.severity === 'high').length * 10;

    // Medium severity issues
    score += issues.filter(i => i.severity === 'medium').length * 3;

    // Low severity issues
    score += issues.filter(i => i.severity === 'low').length * 1;

    // Secrets found
    score += secrets.filter(s => s.confidence === 'high').length * 15;
    score += secrets.filter(s => s.confidence === 'medium').length * 5;

    return Math.min(100, score);
  }

  /**
   * Generate summary
   */
  private generateSummary(
    issues: SecurityIssue[],
    secrets: DetectedSecret[],
    filesScanned: number
  ): SecuritySummary {
    return {
      totalIssues: issues.length,
      criticalCount: issues.filter(i => i.severity === 'critical').length,
      highCount: issues.filter(i => i.severity === 'high').length,
      secretsFound: secrets.length,
      filesScanned,
      riskScore: this.calculateRiskScore(issues, secrets),
    };
  }

  /**
   * Build security risks summary
   */
  private buildSecurityRisks(issues: SecurityIssue[]): SecurityRisk[] {
    const risksByType = new Map<SecurityIssueType, SecurityRisk>();

    for (const issue of issues) {
      const existing = risksByType.get(issue.type);
      if (existing) {
        existing.affectedFiles.push(issue.file);
        existing.affectedFiles = [...new Set(existing.affectedFiles)];
      } else {
        risksByType.set(issue.type, {
          type: issue.type,
          level: issue.severity,
          description: issue.message,
          affectedFiles: [issue.file],
          mitigation: issue.remediation,
        });
      }
    }

    return Array.from(risksByType.values());
  }

  /**
   * Check if scan passed based on thresholds
   */
  private checkPassed(issues: SecurityIssue[], secrets: DetectedSecret[]): boolean {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highConfidenceSecrets = secrets.filter(s => s.confidence === 'high').length;

    return criticalIssues === 0 && highConfidenceSecrets === 0;
  }

  /**
   * Get default secret patterns
   */
  private getDefaultSecretPatterns(): SecretPattern[] {
    return [
      {
        name: 'api-key',
        pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["']([a-zA-Z0-9_\-]{16,})["']/gi,
        entropyThreshold: 3.5,
        confidence: 'high',
      },
      {
        name: 'token',
        pattern: /(?:token|access[_-]?token|auth[_-]?token)\s*[=:]\s*["']([a-zA-Z0-9_\-\.]{20,})["']/gi,
        entropyThreshold: 4.0,
        confidence: 'high',
      },
      {
        name: 'private-key',
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        confidence: 'high',
      },
      {
        name: 'password',
        pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']([^"']{8,})["']/gi,
        entropyThreshold: 3.0,
        confidence: 'medium',
      },
      {
        name: 'credential',
        pattern: /(?:credential|secret)\s*[=:]\s*["']([a-zA-Z0-9_\-]{16,})["']/gi,
        entropyThreshold: 3.5,
        confidence: 'medium',
      },
      {
        name: 'connection-string',
        pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"']+/gi,
        confidence: 'high',
      },
      {
        name: 'env-var',
        pattern: /process\.env\.(\w+_(?:KEY|TOKEN|SECRET|PASSWORD|API_KEY))/g,
        confidence: 'low',
      },
    ];
  }

  /**
   * Get injection patterns
   */
  private getInjectionPatterns(): InjectionPattern[] {
    return [
      {
        type: 'sql-injection',
        pattern: /(?:query|execute|exec)\s*\(\s*[`"'].*\$\{.*\}.*[`"']/,
        message: 'Potential SQL injection via template literal',
        cwe: 'CWE-89',
        owasp: 'A03:2021',
        remediation: 'Use parameterized queries or prepared statements',
      },
      {
        type: 'command-injection',
        pattern: /(?:exec|execSync|spawn)\s*\(\s*[`"'].*\+.*\)|exec\s*\(\s*[^,]*\+[^,]*\)/,
        message: 'Potential command injection',
        cwe: 'CWE-78',
        owasp: 'A03:2021',
        remediation: 'Use parameterized commands and avoid shell execution',
      },
      {
        type: 'xss',
        pattern: /innerHTML\s*=|dangerouslySetInnerHTML|document\.write\s*\(/,
        message: 'Potential XSS vulnerability',
        cwe: 'CWE-79',
        owasp: 'A03:2021',
        remediation: 'Use textContent instead of innerHTML, sanitize user input',
      },
      {
        type: 'path-traversal',
        pattern: /readFile|readFileSync|createReadStream\s*\(\s*[^)]*(?:req\.|request\.|params|query)/,
        message: 'Potential path traversal vulnerability',
        cwe: 'CWE-22',
        owasp: 'A01:2021',
        remediation: 'Validate and sanitize file paths, use path normalization',
      },
      {
        type: 'unsafe-deserialization',
        pattern: /JSON\.parse\s*\(\s*(?:req\.|request\.|params|query|body)/,
        message: 'Potential unsafe deserialization',
        cwe: 'CWE-502',
        owasp: 'A08:2021',
        remediation: 'Validate JSON schema before parsing, use safe parsing methods',
      },
      {
        type: 'injection',
        pattern: /eval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["']|setInterval\s*\(\s*["']/,
        message: 'Dangerous code execution detected',
        cwe: 'CWE-94',
        owasp: 'A03:2021',
        remediation: 'Avoid eval() and dynamic code execution',
      },
    ];
  }

  /**
   * Run npm audit for dependency vulnerabilities
   */
  async runNPMAudit(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      const output = execSync('npm audit --json', {
        encoding: 'utf-8',
        cwd: this.projectRoot,
        maxBuffer: 50 * 1024 * 1024,
      });

      const audit = JSON.parse(output);

      for (const [advisoryId, advisory] of Object.entries(audit.advisories ?? {})) {
        const adv = advisory as {
          module_name: string;
          overview: string;
          severity: string;
          cves: string[];
          findings: Array<{ version: string; paths: string[] }>;
        };

        for (const finding of adv.findings ?? []) {
          issues.push({
            id: `npm-audit-${advisoryId}`,
            type: 'dependency-vuln',
            severity: this.mapAuditSeverity(adv.severity),
            confidence: 'high',
            file: 'package.json',
            line: 0,
            message: `${adv.module_name}: ${adv.overview}`,
            code: `"${adv.module_name}": "${finding.version}"`,
            cwe: 'CWE-1035',
            owasp: 'A06:2021',
            remediation: `Run 'npm audit fix' or update ${adv.module_name}`,
            references: adv.cves?.map(cve => `https://nvd.nist.gov/vuln/detail/${cve}`) ?? [],
          });
        }
      }
    } catch (error) {
      // npm audit may fail but still produce valid output
      console.warn('npm audit failed:', error);
    }

    return issues;
  }

  /**
   * Map npm audit severity to our severity
   */
  private mapAuditSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'moderate':
        return 'medium';
      default:
        return 'low';
    }
  }
}

export default SecurityScanner;
