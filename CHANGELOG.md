# Changelog

## 1.0.0 — 2026-06-09

### Added
- Initial MVP release.
- `codegen-lint-loop` CLI with `--gen`, `--lint`, `--test`, `--max-iters` options.
- Linter output parser supporting ESLint, Ruff/PyLint, Rust `cargo`, and generic `path:line:col error` formats.
- Tester output parser supporting Jest, Pytest, Mocha/Chai, and generic `Error:` / `Traceback` outputs.
- Fixer that calls OpenAI- or Anthropic-compatible chat APIs to suggest fixes (OpenAI default, `--fixer anthropic` for Claude).
- `--dry-run` mode to print the plan without executing commands.
- `parseLintOutput` and `parseTestOutput` exported for programmatic use and unit testing.
- Test suite: 14 vitest cases across `linter`, `tester`, and `fixer` modules. 100% green.
- GitHub Actions CI matrix on Node 20.x and 22.x (build + test).
