import { execa } from 'execa';
import { TestResult } from './runner.js';

export async function runTests(testCmd: string): Promise<TestResult> {
  try {
    const result = await execa('sh', ['-c', testCmd], {
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    });

    const rawOutput = result.stdout + (result.stderr ? '\n' + result.stderr : '');
    const errors = parseTestOutput(rawOutput);

    return {
      passed: result.exitCode === 0 && errors.length === 0,
      errors,
      rawOutput,
    };
  } catch (e: any) {
    const errors = parseTestOutput(e.stdout || e.message);
    return { passed: false, errors, rawOutput: e.stdout || e.message };
  }
}

function parseTestOutput(rawOutput: string): string[] {
  const errors: string[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Jest: FAIL src/__tests__/auth.test.ts
    const jestFail = trimmed.match(/^(FAIL|PASS|Tests:\s+.*failed)/i);
    if (jestFail && trimmed.includes('FAIL')) {
      errors.push(trimmed);
      continue;
    }

    // Jest: expect(received).toBe(expected) — ACTUAL !== EXPECTED
    const jestMismatch = trimmed.match(/^(expected|received|差异|期望|实际)/i);
    if (jestMismatch) {
      errors.push(trimmed);
      continue;
    }

    // Pytest: FAILED test_auth.py::test_login - AssertionError
    const pytestMatch = trimmed.match(/^FAILED\s+([^\s-]+(?:::[^\s-]+)?)\s*(?:-?\s*(.+))?$/);
    if (pytestMatch) {
      errors.push(`${pytestMatch[1]}${pytestMatch[2] ? ' — ' + pytestMatch[2] : ''}`);
      continue;
    }

    // Pytest: test_auth.py:5: AssertionError
    const pytestDetail = trimmed.match(/^((?:\.\/)?[^\s(]+\.py):(\d+):\s+(AssertionError|.*Error.*)$/);
    if (pytestDetail) {
      errors.push(`${pytestDetail[1]}:${pytestDetail[2]} — ${pytestDetail[3]}`);
      continue;
    }

    // Mocha/Chai: AssertionError
    if (/assertion\s*error/i.test(trimmed) || /chai/.test(trimmed)) {
      errors.push(trimmed);
      continue;
    }

    // Generic "X failed, Y passed" summary
    const summaryFailed = trimmed.match(/(\d+)\s+failed/i);
    if (summaryFailed && parseInt(summaryFailed[1]) > 0) {
      errors.push(`Tests: ${trimmed.match(/[\d,]+/)?.[0]} failed — ${trimmed}`);
      continue;
    }

    // Runtime errors in test output
    if (/^(Error|FAIL|FAILED|Traceback|panic|runtime error)/i.test(trimmed) && trimmed.length < 300) {
      errors.push(trimmed);
    }
  }

  return [...new Set(errors)];
}