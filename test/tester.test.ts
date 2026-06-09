import { describe, it, expect } from 'vitest';
import { parseTestOutput } from '../src/tester.js';

describe('parseTestOutput', () => {
  it('returns empty for passing test output', () => {
    const result = parseTestOutput('Tests: 5 passed, 5 total\n');
    expect(result).toHaveLength(0);
  });

  it('parses Jest FAIL line', () => {
    const result = parseTestOutput('FAIL src/__tests__/auth.test.ts\n  ✕ login fails\n');
    expect(result).toContain('FAIL src/__tests__/auth.test.ts');
  });

  it('parses Pytest FAILED line with reason', () => {
    const result = parseTestOutput('FAILED test_auth.py::test_login - AssertionError: 1 != 2\n');
    expect(result[0]).toContain('test_auth.py::test_login');
    expect(result[0]).toContain('AssertionError');
  });

  it('parses Pytest file:line AssertionError', () => {
    const result = parseTestOutput('./test_auth.py:5: AssertionError\n');
    expect(result[0]).toContain('./test_auth.py:5');
  });

  it('captures N failed summary', () => {
    const result = parseTestOutput('Tests: 2 failed, 3 passed, 5 total\n');
    expect(result.some(e => /failed/i.test(e))).toBe(true);
  });

  it('captures Python Traceback', () => {
    const result = parseTestOutput('Traceback (most recent call last):\n');
    expect(result[0]).toContain('Traceback');
  });

  it('deduplicates', () => {
    const result = parseTestOutput('error: oops\nerror: oops\n');
    expect(result).toHaveLength(1);
  });
});
