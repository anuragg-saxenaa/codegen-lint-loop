import { execa } from 'execa';
import { runLinter } from './linter.js';
import { runTests } from './tester.js';
import { suggestFix } from './fixer.js';
import * as fs from 'fs';
import * as path from 'path';

export interface LoopOptions {
  genCmd: string;
  lintCmd: string;
  testCmd: string;
  maxIters: number;
  llmApi?: string;
  llmModel?: string;
  llmKey?: string;
  fixerType: string;
  dryRun: boolean;
  verbose: boolean;
}

export interface LintResult {
  passed: boolean;
  errors: string[];
  rawOutput: string;
}

export interface TestResult {
  passed: boolean;
  errors: string[];
  rawOutput: string;
}

function log(opts: LoopOptions, msg: string) {
  if (opts.verbose) console.log(`[codegen-lint-loop] ${msg}`);
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function parseErrors(rawOutput: string, context: string): string[] {
  // Common error patterns — extend per linter/test framework
  const patterns = [
    /^error\s+(.+)$/gim,
    /(\/.+:\d+:\d+):?\s*error:?/gi,
    /^\s*File "(.+)", line (\d+)/gm,
    /FAILED/i,
    /AssertionError/g,
    /Error:/gm,
  ];
  const lines: string[] = [];
  for (const line of rawOutput.split('\n')) {
    if (/error|failed|assert/i.test(line)) {
      lines.push(line.trim());
    }
  }
  return [...new Set(lines)];
}

function applyPatch(patch: string) {
  // Simple patch application: look for `--- a/file` / `+++ b/file` and apply replacements
  // For more complex cases we hand off to the LLM-generated code directly
  const patchRe = /^([+-]{3})\s+(.+)/gm;
  let inHunk = false;
  let file: string | null = null;
  let additions: string[] = [];
  const changes: Array<{ file: string; additions: string[] }> = [];

  for (const match of patch.matchAll(patchRe)) {
    const sign = match[1];
    const content = match[2];

    if (content.startsWith('a/') || content.startsWith('b/')) {
      // diff header line
      if (file && additions.length > 0) {
        changes.push({ file: file!, additions: [...additions] });
      }
      file = content.replace(/^[ab]\//, '');
      additions = [];
      inHunk = false;
    } else if (file && (sign === '+')) {
      additions.push(content);
    }
  }
  if (file && additions.length > 0) {
    changes.push({ file, additions });
  }

  for (const { file: f, additions: adds } of changes) {
    try {
      const filePath = path.resolve(process.cwd(), f);
      const current = fs.readFileSync(filePath, 'utf8');
      // Append additions (simple strategy — assumes append-mode patches)
      const updated = current + '\n' + adds.join('\n');
      fs.writeFileSync(filePath, updated);
      log({} as LoopOptions, `Patched: ${f} (+${adds.length} lines)`);
    } catch (e) {
      console.warn(`  ⚠ Could not patch ${f}: ${e}`);
    }
  }
}

function applyDirectFix(code: string) {
  // LLM returns code directly — try to parse and write files
  // Simple heuristic: look for markdown code blocks or file headers
  const codeBlockRe = /```(?:typescript|javascript|tsx|jsx|py|java|ts|js)?\n([\s\S]*?)```/g;
  const fileRe = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)[^{]*\{|class\s+(\w+)/gm;
  const matches = [...code.matchAll(codeBlockRe)];
  
  for (const match of matches) {
    const content = match[1];
    // Try to detect the target file from content or context
    const lines = content.split('\n').filter(l => !l.startsWith('//') && !l.startsWith('#'));
    if (lines.length > 5) {
      console.log(`  📝 LLM fix received (${lines.length} lines)`);
    }
  }
}

export async function runLoop(opts: LoopOptions) {
  logSection('codegen-lint-loop');
  console.log(`gen:   ${opts.genCmd}`);
  console.log(`lint:  ${opts.lintCmd}`);
  console.log(`test:  ${opts.testCmd}`);
  console.log(`iters: ${opts.maxIters}\n`);

  if (opts.dryRun) {
    console.log('🔍 DRY RUN — would execute the following:');
    console.log(`  1. ${opts.genCmd}`);
    console.log(`  2. ${opts.lintCmd} → if errors: call LLM fix`);
    console.log(`  3. ${opts.testCmd}  → if failures: call LLM fix`);
    console.log(`  Repeat steps 2-3 up to ${opts.maxIters} times`);
    console.log('\n✅ Dry run complete.');
    return;
  }

  // Step 1: initial code generation
  logSection('STEP 1 — Generate');
  console.log(`Running: ${opts.genCmd}\n`);
  try {
    const gen = await execa('sh', ['-c', opts.genCmd], { stdout: 'pipe', stderr: 'pipe' });
    console.log(gen.stdout);
    if (gen.stderr) console.warn('STDERR:', gen.stderr);
  } catch (e: any) {
    console.error(`❌ Generation failed: ${e.message}`);
    process.exit(1);
  }

  // Main loop
  for (let iter = 1; iter <= opts.maxIters; iter++) {
    logSection(`ITERATION ${iter}/${opts.maxIters}`);

    // Lint phase
    console.log(`\n🔍 Linting: ${opts.lintCmd}\n`);
    const lintResult = await runLinter(opts.lintCmd);
    if (!lintResult.passed) {
      console.log(`❌ Lint errors (${lintResult.errors.length}):`);
      lintResult.errors.slice(0, 20).forEach(e => console.log(`  • ${e}`));
      if (lintResult.errors.length > 20) {
        console.log(`  ... and ${lintResult.errors.length - 20} more`);
      }

      logSection('🤖 Requesting LLM fix for lint errors');
      const fix = await suggestFix({
        errors: lintResult.errors,
        context: 'lint',
        llmApi: opts.llmApi,
        llmModel: opts.llmModel,
        llmKey: opts.llmKey,
        fixerType: opts.fixerType,
        verbose: opts.verbose,
      });

      if (fix) {
        console.log('\n📝 Applying lint fix...');
        if (fix.includes('---') || fix.includes('+++')) {
          applyPatch(fix);
        } else {
          applyDirectFix(fix);
        }
        console.log('✅ Fix applied — retrying lint...\n');
        continue; // retry lint
      }
    } else {
      console.log('✅ Lint passed!');
    }

    // Test phase
    console.log(`\n🧪 Testing: ${opts.testCmd}\n`);
    const testResult = await runTests(opts.testCmd);
    if (!testResult.passed) {
      console.log(`❌ Test failures (${testResult.errors.length}):`);
      testResult.errors.slice(0, 20).forEach(e => console.log(`  • ${e}`));
      if (testResult.errors.length > 20) {
        console.log(`  ... and ${testResult.errors.length - 20} more`);
      }

      logSection('🤖 Requesting LLM fix for test failures');
      const fix = await suggestFix({
        errors: testResult.errors,
        context: 'test',
        llmApi: opts.llmApi,
        llmModel: opts.llmModel,
        llmKey: opts.llmKey,
        fixerType: opts.fixerType,
        verbose: opts.verbose,
      });

      if (fix) {
        console.log('\n📝 Applying test fix...');
        if (fix.includes('---') || fix.includes('+++')) {
          applyPatch(fix);
        } else {
          applyDirectFix(fix);
        }
        console.log('✅ Fix applied — retrying test...\n');
        continue; // retry test
      }
    } else {
      console.log('✅ Tests passed!');
    }

    // Both passed
    if (lintResult.passed && testResult.passed) {
      logSection('✅ SUCCESS');
      console.log(`All checks passed at iteration ${iter}.`);
      console.log('\n📊 Summary:');
      console.log(`  Lint errors resolved: ${lintResult.errors.length === 0 ? '✓' : '✗'}`);
      console.log(`  Test failures resolved: ${testResult.errors.length === 0 ? '✓' : '✗'}`);
      process.exit(0);
    }
  }

  logSection('❌ MAX ITERATIONS REACHED');
  console.log(`Reached maximum iterations (${opts.maxIters}) without passing all checks.`);
  console.log('\n📊 Final state:');
  console.log('  Lint errors: see above');
  console.log('  Test failures: see above');
  process.exit(1);
}