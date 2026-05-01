# codegen-lint-loop

CLI that wraps any code generation command and automatically runs lint → test → fix cycles until code passes or max iterations hit.

## Install

```bash
npm install -g codegen-lint-loop
```

Or run locally:

```bash
npx codegen-lint-loop --gen "claude-code generate auth.ts" --lint "eslint src/" --test "npm test"
```

## Usage

```bash
codegen-lint-loop \
  --gen "claude-code generate auth.ts" \
  --lint "eslint src/" \
  --test "npm test" \
  --max-iters 5
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--gen <command>` | Code generation command | **required** |
| `--lint <command>` | Linter command | **required** |
| `--test <command>` | Test command | **required** |
| `-i, --max-iters <n>` | Maximum iterations | `5` |
| `--llm-api <url>` | LLM API endpoint | OpenAI |
| `--llm-model <model>` | LLM model | `gpt-4o` |
| `--llm-key <key>` | LLM API key | env var |
| `--fixer <type>` | Fixer: `openai` \| `anthropic` | `openai` |
| `--dry-run` | Print plan without executing | `false` |
| `-v, --verbose` | Verbose output | `false` |

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

## How It Works

```
1. Run code generation command
2. Loop (up to max-iters):
   a. Run linter → if errors: ask LLM to fix → apply patch → retry
   b. Run tests → if failures: ask LLM to fix → apply patch → retry
   c. If both pass → exit success
3. Exit failure after max iterations
```

## Architecture

- `src/index.ts` — CLI entry point (commander)
- `src/runner.ts` — Main loop orchestration
- `src/linter.ts` — Runs linter, parses errors (ESLint, Ruff, Rust, Pytest, Jest, Mocha)
- `src/tester.ts` — Runs tests, parses failures
- `src/fixer.ts` — Calls LLM API (OpenAI/Anthropic) to generate fixes

## License

MIT
