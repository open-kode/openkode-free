import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileWriter, GenerationResult } from '../vibe/fileWriter';

describe('FileWriter', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openkode-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('writes a single file', async () => {
        const writer = new FileWriter(tempDir);
        await writer.writeFile('test.txt', 'Hello World');
        const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
        expect(content).toBe('Hello World');
    });

    test('creates intermediate directories for nested paths', async () => {
        const writer = new FileWriter(tempDir);
        await writer.writeFile('src/components/Button.tsx', 'export default function Button() {}');
        const content = await fs.readFile(path.join(tempDir, 'src/components/Button.tsx'), 'utf-8');
        expect(content).toBe('export default function Button() {}');
    });

    test('writes a GenerationResult with multiple files', async () => {
        const writer = new FileWriter(tempDir);
        const result: GenerationResult = {
            files: [
                { path: 'package.json', content: '{"name": "test"}' },
                { path: 'src/index.ts', content: 'console.log("hello")' },
                { path: 'README.md', content: '# Test Project' },
            ],
            description: 'Test project',
        };

        const writeResult = await writer.writeGenerationResult(result);

        expect(writeResult.success).toBe(true);
        expect(writeResult.operations.length).toBe(3);

        const pkgContent = await fs.readFile(path.join(tempDir, 'package.json'), 'utf-8');
        expect(pkgContent).toBe('{"name": "test"}');
    });

    test('marks first write as created and second as updated', async () => {
        const writer = new FileWriter(tempDir);

        const op1 = await writer.writeFile('existing.txt', 'v1');
        expect(op1.created).toBe(true);

        const op2 = await writer.writeFile('existing.txt', 'v2');
        expect(op2.created).toBe(false);
    });

    test('rejects path traversal attempts', async () => {
        const writer = new FileWriter(tempDir);
        await expect(writer.writeFile('../outside.txt', 'malicious')).rejects.toThrow('Invalid path');
    });

    test('lists all written files', async () => {
        const writer = new FileWriter(tempDir);
        await writer.writeFile('test.txt', 'a');
        await writer.writeFile('src/components/Button.tsx', 'b');

        const files = await writer.listFiles();

        expect(files).toContain('test.txt');
        expect(files).toContain(path.join('src', 'components', 'Button.tsx'));
    });
});
