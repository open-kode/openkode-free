/**
 * Workspace Context Builder
 *
 * Reads the current project's file tree and relevant file contents so the
 * LLM has full awareness of what exists before answering questions about
 * UI design, features, database schemas, etc.
 */

import * as fs from 'fs';
import * as path from 'path';

const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'out', 'dist', 'build', '.next', '.nuxt',
    '__pycache__', '.venv', 'venv', 'env', 'coverage', '.nyc_output',
    '.turbo', '.cache', 'tmp', 'temp', '.expo', 'android', 'ios',
]);

const IGNORE_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.mp3', '.avi', '.mov', '.wav',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.lock', '.map', '.min.js', '.min.css',
    '.pdf', '.docx', '.xlsx',
    '.vsix', '.exe', '.dll', '.so', '.dylib',
]);

const IGNORE_FILES = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
    '.DS_Store', 'Thumbs.db',
]);

// Files that are always valuable for context regardless of keyword match
const HIGH_VALUE_FILES = ['package.json', 'tsconfig.json', 'tsconfig.app.json', '.env.example', 'schema.prisma', 'schema.sql', 'webpack.config.js', 'vite.config.ts', 'vite.config.js', 'tailwind.config.js', 'tailwind.config.ts', 'next.config.js', 'next.config.ts', 'app.config.ts', 'index.ts', 'index.js', 'main.ts', 'main.js', 'App.tsx', 'App.ts', 'App.vue'];

const MAX_TREE_DEPTH = 4;
const MAX_FILE_CONTENT_CHARS = 10000; // total chars across all files
const MAX_SINGLE_FILE_CHARS = 2500;   // per file cap
const MAX_FILES_TO_READ = 10;

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'was', 'one', 'our', 'out', 'get', 'has', 'how', 'its', 'let', 'may',
    'new', 'now', 'see', 'who', 'did', 'say', 'she', 'too', 'use', 'this',
    'that', 'with', 'from', 'they', 'will', 'been', 'have', 'then', 'than',
    'when', 'what', 'make', 'like', 'into', 'time', 'just', 'come', 'over',
    'also', 'back', 'could', 'there', 'would', 'which', 'their', 'about',
    'after', 'build', 'create', 'add', 'fix', 'help', 'want', 'need',
    'should', 'code', 'file', 'files', 'please', 'using', 'work', 'make',
    'show', 'give', 'write', 'update', 'change', 'remove', 'delete',
]);

interface ScoredFile {
    filePath: string;
    score: number;
}

/**
 * Builds a workspace context string for injection into the LLM system prompt.
 * Includes the project file tree and contents of the most relevant files.
 */
export async function buildWorkspaceContext(
    workspaceRoot: string,
    userMessage: string
): Promise<string> {
    try {
        // 1. File tree
        const treeLines: string[] = [];
        buildTree(workspaceRoot, treeLines, 0);
        const treeStr = treeLines.join('\n');

        // 2. Collect and score all files
        const allFiles = collectFiles(workspaceRoot);
        const keywords = extractKeywords(userMessage);
        const scored = scoreFiles(allFiles, keywords, workspaceRoot);
        scored.sort((a, b) => b.score - a.score);

        // 3. Read file contents
        let filesSections = '';
        let usedChars = 0;
        let filesRead = 0;

        for (const { filePath } of scored) {
            if (filesRead >= MAX_FILES_TO_READ) break;
            if (usedChars >= MAX_FILE_CONTENT_CHARS) break;

            try {
                const stat = fs.statSync(filePath);
                if (stat.size > 150 * 1024) continue; // skip files > 150KB

                const content = fs.readFileSync(filePath, 'utf-8');
                const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
                const snippet = content.slice(0, MAX_SINGLE_FILE_CHARS);
                const truncNote = content.length > MAX_SINGLE_FILE_CHARS
                    ? `\n// ... (${content.length - MAX_SINGLE_FILE_CHARS} chars truncated)`
                    : '';
                const ext = path.extname(filePath).slice(1) || 'text';
                filesSections += `\n\n### ${relPath}\n\`\`\`${ext}\n${snippet}${truncNote}\n\`\`\``;
                usedChars += snippet.length;
                filesRead++;
            } catch { /* skip unreadable */ }
        }

        const projectName = path.basename(workspaceRoot);
        return [
            `## Project: ${projectName}`,
            '',
            '### File Structure',
            '```',
            treeStr,
            '```',
            filesSections ? `### Relevant Source Files${filesSections}` : '',
        ].filter(Boolean).join('\n');

    } catch {
        return '';
    }
}

function buildTree(dir: string, lines: string[], depth: number): void {
    if (depth > MAX_TREE_DEPTH) return;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
            .filter(e => !shouldIgnoreName(e.name))
            .sort((a, b) => {
                // Dirs first, then files
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

        for (const entry of entries) {
            const indent = '  '.repeat(depth);
            const icon = entry.isDirectory() ? '/' : '';
            lines.push(`${indent}${entry.name}${icon}`);
            if (entry.isDirectory()) {
                buildTree(path.join(dir, entry.name), lines, depth + 1);
            }
        }
    } catch { /* skip inaccessible dirs */ }
}

function collectFiles(dir: string, results: string[] = []): string[] {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (shouldIgnoreName(entry.name)) continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                collectFiles(fullPath, results);
            } else if (!shouldIgnoreFile(entry.name)) {
                results.push(fullPath);
            }
        }
    } catch { /* skip */ }
    return results;
}

function shouldIgnoreName(name: string): boolean {
    if (IGNORE_DIRS.has(name)) return true;
    // Hidden dirs (not hidden files like .env)
    if (name.startsWith('.') && !name.includes('.')) return true;
    return false;
}

function shouldIgnoreFile(name: string): boolean {
    if (IGNORE_FILES.has(name)) return true;
    const ext = path.extname(name).toLowerCase();
    if (IGNORE_EXTENSIONS.has(ext)) return true;
    // Skip generated/minified files
    if (name.endsWith('.min.js') || name.endsWith('.min.css') || name.endsWith('.d.ts')) return true;
    return false;
}

function extractKeywords(message: string): string[] {
    return message
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function scoreFiles(files: string[], keywords: string[], workspaceRoot: string): ScoredFile[] {
    return files.map(filePath => {
        const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/').toLowerCase();
        const fileName = path.basename(filePath).toLowerCase();
        let score = 0;

        // Keyword match in file path
        for (const kw of keywords) {
            if (fileName === kw || fileName.startsWith(kw) || fileName.includes(kw)) {
                score += 8;
            } else if (relPath.includes(kw)) {
                score += 3;
            }
        }

        // Always include high-value files
        if (HIGH_VALUE_FILES.some(hv => fileName === hv.toLowerCase())) {
            score += 6;
        }

        // Prefer src/ and app/ dirs
        if (relPath.startsWith('src/') || relPath.startsWith('app/') || relPath.startsWith('lib/')) {
            score += 2;
        }

        // Prefer known source extensions
        const ext = path.extname(filePath).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py', '.go', '.rs', '.java'].includes(ext)) {
            score += 1;
        }
        if (['.css', '.scss', '.html', '.sql', '.prisma', '.graphql'].includes(ext)) {
            score += 1;
        }

        // Domain keyword boosts — map common user request topics to file path patterns
        const uiKeywords = ['ui', 'design', 'component', 'layout', 'style', 'theme', 'color', 'button', 'form', 'modal', 'page', 'view', 'screen'];
        const dbKeywords = ['database', 'db', 'model', 'schema', 'migration', 'repository', 'store', 'entity', 'table', 'query'];
        const apiKeywords = ['api', 'route', 'endpoint', 'controller', 'service', 'handler', 'middleware', 'request', 'response'];
        const authKeywords = ['auth', 'login', 'logout', 'session', 'token', 'jwt', 'password', 'user', 'permission', 'role'];

        const domainMatch = (domainKws: string[], pathKws: string[]) => {
            const msgHasDomain = keywords.some(k => domainKws.some(d => d.includes(k) || k.includes(d)));
            const fileInDomain = pathKws.some(d => relPath.includes(d));
            return msgHasDomain && fileInDomain ? 4 : 0;
        };

        score += domainMatch(uiKeywords, ['component', 'ui', 'style', 'view', 'page', 'screen', 'layout', 'theme']);
        score += domainMatch(dbKeywords, ['model', 'schema', 'database', 'migration', 'repository', 'store', 'entity']);
        score += domainMatch(apiKeywords, ['route', 'api', 'controller', 'service', 'handler', 'middleware']);
        score += domainMatch(authKeywords, ['auth', 'user', 'session', 'permission', 'role']);

        return { filePath, score };
    });
}
