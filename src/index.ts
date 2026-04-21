#!/usr/bin/env node
/**
 * codegen-lint-loop — CLI entry point
 * Wraps a code generation command with automatic lint → test → fix cycles.
 */
import { program } from 'commander';
import { runLoop } from './runner.js';

program
  .name('codegen-lint-loop')
  .description('Automatically run lint → test → fix cycles until code passes or max iterations hit')
  .requiredOption('--gen <command>', 'Code generation command (e.g., "claude-code generate auth.ts")')
  .requiredOption('--lint <command>', 'Linter command (e.g., "eslint src/" or "ruff check ."')
  .requiredOption('--test <command>', 'Test command (e.g., "npm test" or "pytest")')
  .option('-i, --max-iters <n>', 'Maximum iterations (default: 5)', '5')
  .option('--llm-api <url>', 'LLM API endpoint for fix suggestions (default: OpenAI)')
  .option('--llm-model <model>', 'LLM model to use (default: gpt-4o)')
  .option('--llm-key <key>', 'LLM API key (default: from OPENAI_API_KEY env var)')
  .option('--fixer <type>', 'Fixer type: openai | anthropic | custom (default: openai)', 'openai')
  .option('--dry-run', 'Print what would happen without executing', false)
  .option('-v, --verbose', 'Verbose output', false);

program.parse();

const opts = program.opts();
const maxIters = parseInt(opts.maxIters, 10);

runLoop({
  genCmd: opts.gen,
  lintCmd: opts.lint,
  testCmd: opts.test,
  maxIters,
  llmApi: opts.llmApi,
  llmModel: opts.llmModel,
  llmKey: opts.llmKey,
  fixerType: opts.fixer,
  dryRun: opts.dryRun,
  verbose: opts.verbose,
});