import { execa } from 'execa';
import { LintResult } from './runner.js';

export async function runLinter(lintCmd: string): Promise<LintResult> {
  try {
    const result = await execa('sh', ['-c', lintCmd], {
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    });

    const rawOutput = result.stdout + (result.stderr ? '\n' + result.stderr : '');
    const errors = parseLintOutput(rawOutput);

    return {
      passed: result.exitCode === 0 && errors.length === 0,
      errors,
      rawOutput,
    };
  } catch (e: any) {
    const errors = parseLintOutput(e.stdout || e.message);
    return { passed: false, errors, rawOutput: e.stdout || e.message };
  }
}

function parseLintOutput(rawOutput: string): string[] {
  const errors: string[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    // Skip warnings, info messages
    if (/^\s*(warning|info|note|hint|✗|⚠)/i.test(line)) continue;
    if (/^\s*(\d+\s+(warning|error|issue)|errors?\s+(0|suppressed))/i.test(line)) continue;

    const trimmed = line.trim();

    // ESLint: src/auth.ts:5:10 error ... (skip warnings/info)
    const eslintMatch = trimmed.match(/^\[?\s*(\S+\.(?:ts|js|tsx|jsx|py|java|cpp|c|go|rs|swift|kt)):(\d+)(?::\d+)?\s+(?:error|warning)\s+(.+?)(?:\s+\[\S+\])?$/);
    if (eslintMatch) {
      const severity = trimmed.match(/\s+(error|warning|info|note|hint)\s+/i)?.[1] || '';
      if (/^error$/i.test(severity)) {
        errors.push(`${eslintMatch[1]}:${eslintMatch[2]} — ${eslintMatch[3]}`);
      }
      continue;
    }

    // Generic: path:line error message
    const genericMatch = trimmed.match(/^(\/.+?|\.\/.+?|[a-z]\:.+?):(\d+)(?::\d+)?\s+(.+)$/);
    if (genericMatch && /^(error|fail)/i.test(genericMatch[3])) {
      errors.push(`${genericMatch[1]}:${genericMatch[2]} — ${genericMatch[3]}`);
      continue;
    }

    // Ruff/PyLint: src/auth.py:5: E123 ...
    const pyMatch = trimmed.match(/^(\.\/.+?|[a-z]\:.+?):(\d+)\s+(E\d+)\s+(.+)$/);
    if (pyMatch) {
      errors.push(`${pyMatch[1]}:${pyMatch[2]} (${pyMatch[3]}) — ${pyMatch[4]}`);
      continue;
    }

    // Rust: error[E0001]: ...
    const rustMatch = trimmed.match(/^error(?:\[[^\]]+\])?\s*:\s*(.+)$/);
    if (rustMatch) {
      errors.push(`rust: ${rustMatch[1]}`);
      continue;
    }

    // Plain error messages
    if (/^(error|ERROR|failed|FAILED|✗)/.test(trimmed) && trimmed.length > 3 && trimmed.length < 200) {
      errors.push(trimmed);
    }
  }

  return [...new Set(errors)];
}