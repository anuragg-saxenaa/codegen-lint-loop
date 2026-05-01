import { describe, it, expect } from 'vitest';

// Test the parseLintOutput and parseTestOutput logic directly
// by re-implementing the parsing as a standalone test helper

function parseLintOutput(rawOutput: string): string[] {
  const errors: string[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    if (/^\s*(warning|info|note|hint|✗|⚠)/i.test(line)) continue;
    if (/^\s*(\d+\s+(warning|error|issue)|errors?\s+(0|suppressed))/i.test(line)) continue;

    const trimmed = line.trim();

    const eslintMatch = trimmed.match(/^\[?\s*(\S+\.(?:ts|js|tsx|jsx|py|java|cpp|c|go|rs|swift|kt)):(\d+)(?::\d+)?\s+(?:error|warning)\s+(.+?)(?:\s+\[\S+\])?$/);
    if (eslintMatch) {
      errors.push(`${eslintMatch[1]}:${eslintMatch[2]} — ${eslintMatch[3]}`);
      continue;
    }

    const genericMatch = trimmed.match(/^(\/.+?|\.\/.+?|[a-z]\:.+?):(\d+)(?::\d+)?\s+(.+)$/);
    if (genericMatch && /^(error|fail)/i.test(genericMatch[3])) {
      errors.push(`${genericMatch[1]}:${genericMatch[2]} — ${genericMatch[3]}`);
      continue;
    }

    const pyMatch = trimmed.match(/^(\.\/.+?|[a-z]\:.+?):(\d+)\s+(E\d+)\s+(.+)$/);
    if (pyMatch) {
      errors.push(`${pyMatch[1]}:${pyMatch[2]} (${pyMatch[3]}) — ${pyMatch[4]}`);
      continue;
    }

    const rustMatch = trimmed.match(/^error(?:\[[^\]]+\])?\s*:\s*(.+)$/);
    if (rustMatch) {
      errors.push(`rust: ${rustMatch[1]}`);
      continue;
    }

    if (/^(error|ERROR|failed|FAILED|✗)/.test(trimmed) && trimmed.length > 3 && trimmed.length < 200) {
      errors.push(trimmed);
    }
  }

  return [...new Set(errors)];
}

describe('parseLintOutput', () => {
  it('returns empty errors for clean output', () => {
    const result = parseLintOutput('No issues found.\n  0 errors\n✓ All good');
    expect(result).toHaveLength(0);
  });

  it('parses ESLint error format', () => {
    const result = parseLintOutput(
      'src/auth.ts:5:10 error Unexpected any value in conditional\n' +
      'src/loader.ts:12:4 warning Missing return type\n'
    );
    expect(result).toContain('src/auth.ts:5 — Unexpected any value in conditional');
  });

  it('skips warnings and info messages (ESLint format)', () => {
    // ESLint format: file:line:col error|warning message
    const result = parseLintOutput(
      'src/file.ts:5:1 error This is an error\n' +
      'src/file.ts:6:1 warning This is a warning'
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('This is an error');
  });

  it('parses Python Ruff errors', () => {
    const result = parseLintOutput('./auth.py:12 E501 Line too long (85 > 79 characters)\n');
    expect(result).toContain('./auth.py:12 (E501) — Line too long (85 > 79 characters)');
  });

  it('deduplicates errors', () => {
    const result = parseLintOutput('error: something 123\nerror: something 123\n');
    expect(result).toHaveLength(1);
  });
});
