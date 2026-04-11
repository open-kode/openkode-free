import { LLMClient, LLMConfig } from '../llm/llmClient';

// Live API tests are skipped unless the matching env var is set.
const skipIf = (condition: boolean) => (condition ? test.skip : test);

describe('LLMClient', () => {
    describe('instantiation', () => {
        test('constructs without throwing for each provider', () => {
            const providers: LLMConfig['provider'][] = ['openai', 'anthropic', 'gemini'];
            for (const provider of providers) {
                expect(() => new LLMClient({ provider, apiKey: 'test-key' })).not.toThrow();
            }
        });
    });

    describe('OpenAI — live (requires OPENAI_API_KEY)', () => {
        skipIf(!process.env.OPENAI_API_KEY)('generates a response', async () => {
            const client = new LLMClient({ provider: 'openai', apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini' });
            const response = await client.generate({
                systemPrompt: 'Respond with only valid JSON.',
                userPrompt: 'Return {"ok": true}',
                responseFormat: 'json',
            });
            expect(response.raw).toBeTruthy();
            expect(response.latency).toBeGreaterThan(0);
            const parsed = JSON.parse(response.raw);
            expect(parsed.ok).toBe(true);
        });
    });

    describe('Anthropic — live (requires ANTHROPIC_API_KEY)', () => {
        skipIf(!process.env.ANTHROPIC_API_KEY)('generates a response', async () => {
            const client = new LLMClient({ provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY!, model: 'claude-3-5-haiku-20241022' });
            const response = await client.generate({
                systemPrompt: 'Respond with only valid JSON.',
                userPrompt: 'Return {"ok": true}',
                responseFormat: 'json',
            });
            expect(response.raw).toBeTruthy();
            const parsed = JSON.parse(response.raw);
            expect(parsed.ok).toBe(true);
        });
    });

    describe('Gemini — live (requires GEMINI_API_KEY)', () => {
        skipIf(!process.env.GEMINI_API_KEY)('generates a response', async () => {
            const client = new LLMClient({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY!, model: 'gemini-1.5-flash' });
            const response = await client.generate({
                systemPrompt: 'Respond with only valid JSON.',
                userPrompt: 'Return {"ok": true}',
                responseFormat: 'json',
            });
            expect(response.raw).toBeTruthy();
        });
    });
});
