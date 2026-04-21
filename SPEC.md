# codegen-lint-loop

## Problem
Developers using AI coding agents must manually iterate through generate → lint → test → fix cycles, wasting time on repetitive error correction loops that should be automated.

## Source
https://www.reddit.com/r/AskProgramming/comments/1jjro92/how_do_you_manage_errors_when_using_ai_coding/

## Solution
A CLI tool that wraps any codegen command and automatically runs lint → test → fix cycles until the code passes or max iterations hit.

## Stack
Node.js (TypeScript)

## Files
1. `src/index.ts` — CLI entry point, parses args
2. `src/runner.ts` — orchestrates the gen-lint-test-fix loop
3. `src/linter.ts` — runs configurable linter (eslint, ruff, etc.) and parses output
4. `src/tester.ts` — runs test command and parses failures
5. `src/fixer.ts` — sends errors to LLM API for fix suggestions, applies patches
6. `package.json` — deps: commander, execa, openai/anthropic SDK

## Core Logic
```
function runLoop(genCmd, lintCmd, testCmd, maxIters=5):
  exec(genCmd)  # generate initial code
  for i in 1..maxIters:
    lintResult = exec(lintCmd)
    if lintResult.errors:
      fix = callLLM("fix these lint errors", lintResult.errors)
      applyPatch(fix)
      continue
    testResult = exec(testCmd)
    if testResult.passed:
      return SUCCESS
    fix = callLLM("fix these test failures", testResult.errors)
    applyPatch(fix)
  return MAX_ITERS_REACHED
```

## Usage Example
```bash
codegen-lint-loop \
  --gen "claude-code generate auth.ts" \
  --lint "eslint src/" \
  --test "npm test" \
  --max-iters 5
```

## Success Criteria
- Runs lint/test commands and parses their output
- Calls LLM API with errors and applies fixes
- Exits with success when tests pass, or failure after max iterations
- Works with any language (configurable commands)
