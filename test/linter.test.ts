import { describe, it, expect } from 'vitest';
import { parseLintOutput } from '../src/linter.js';

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
