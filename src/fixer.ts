import * as fs from 'fs';

interface FixOptions {
  errors: string[];
  context: 'lint' | 'test';
  llmApi?: string;
  llmModel?: string;
  llmKey?: string;
  fixerType: string;
  verbose: boolean;
}

interface OpenAIMessage {
  role: 'system' | 'user';
  content: string;
}

export async function suggestFix(opts: FixOptions): Promise<string | null> {
  const { errors, context } = opts;

  if (errors.length === 0) return null;

  const apiKey = opts.llmKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  No LLM API key found — set OPENAI_API_KEY or --llm-key. Skipping auto-fix.');
    return null;
  }

  const errorList = errors.slice(0, 30).map((e, i) => `  ${i + 1}. ${e}`).join('\n');
  const truncated = errors.length > 30 ? `\n  ...and ${errors.length - 30} more errors` : '';

  const systemPrompt = `You are an expert software engineer. Fix the following ${context} errors in the codebase.
Return your fix as either:
1. A unified diff (--- a/filename / +++ b/filename) for simple file changes
2. A markdown code block with the complete corrected file content (for new or rewritten files)
3. Plain code block for small changes

Be precise. Only change what is necessary. Do not add unrelated improvements.`;

  const userPrompt = `Fix these ${context} errors:\n${errorList}${truncated}\n\nContext: These errors were detected in a ${context} run. Apply only the minimal changes needed to resolve them.`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  if (opts.verbose) {
    console.log(`  🤖 Calling LLM (${opts.fixerType})...`);
  }

  try {
    if (opts.fixerType === 'anthropic') {
      const resp = await callAnthropic(messages, opts);
      return resp;
    } else {
      const resp = await callOpenAI(messages, opts);
      return resp;
    }
  } catch (e: any) {
    console.error(`  ❌ LLM call failed: ${e.message}`);
    return null;
  }
}

async function callOpenAI(messages: OpenAIMessage[], opts: FixOptions): Promise<string | null> {
  const { execa } = await import('execa');
  const apiKey = opts.llmKey || process.env.OPENAI_API_KEY || '';
  const baseUrl = opts.llmApi || 'https://api.openai.com/v1';
  const model = opts.llmModel || 'gpt-4o';

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 4000,
  };

  const resp = await execa('curl', [
    '-s', '-X', 'POST',
    `${baseUrl}/chat/completions`,
    '-H', `Authorization: Bearer ${apiKey}`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body),
  ], { timeout: 60000 });

  const data = JSON.parse(resp.stdout as string);
  if (data.error) throw new Error(data.error.message || 'OpenAI API error');
  return (data.choices?.[0]?.message?.content as string) || null;
}

async function callAnthropic(messages: OpenAIMessage[], opts: FixOptions): Promise<string | null> {
  const { execa } = await import('execa');
  const apiKey = opts.llmKey || process.env.ANTHROPIC_API_KEY || '';
  const model = opts.llmModel || 'claude-3-5-sonnet-20241022';

  const system = messages.find(m => m.role === 'system')?.content || '';
  const userMsgs = messages.filter(m => m.role === 'user');

  const body: Record<string, unknown> = {
    model,
    system,
    messages: userMsgs.map(m => ({ role: 'user', content: m.content })),
    temperature: 0.2,
    max_tokens: 4000,
  };

  const resp = await execa('curl', [
    '-s', '-X', 'POST',
    'https://api.anthropic.com/v1/messages',
    '-H', `x-api-key: ${apiKey}`,
    '-H', 'anthropic-version: 2023-06-01',
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body),
  ], { timeout: 60000 });

  const data = JSON.parse(resp.stdout as string);
  if (data.error) throw new Error(data.error.message || 'Anthropic API error');
  return (data.content?.[0]?.text as string) || null;
}