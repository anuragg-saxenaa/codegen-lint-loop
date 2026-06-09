import { describe, it, expect } from 'vitest';
import { suggestFix } from '../src/fixer.js';

describe('suggestFix', () => {
  it('returns null when errors is empty', async () => {
    const result = await suggestFix({
      errors: [],
      context: 'lint',
      fixerType: 'openai',
      verbose: false,
    });
    expect(result).toBeNull();
  });

  it('returns null when no LLM API key is available', async () => {
    const savedOpenAI = process.env.OPENAI_API_KEY;
    const savedAnthropic = process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await suggestFix({
      errors: ['error: undefined variable'],
      context: 'lint',
      fixerType: 'openai',
      verbose: false,
    });
    expect(result).toBeNull();

    if (savedOpenAI) process.env.OPENAI_API_KEY = savedOpenAI;
    if (savedAnthropic) process.env.ANTHROPIC_API_KEY = savedAnthropic;
  });
});
