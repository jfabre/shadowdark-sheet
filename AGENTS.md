# Agent Guidelines — shadowdark-sheet

## Core Rule

**Before every commit, run the full test suite. Do not commit if tests fail.**

```bash
npm test
```

If `npm test` fails, fix the failures first, then commit.

## Quality Gates

Run all of the following before committing:

```bash
npm test          # Must pass — no exceptions
```

If a build step is configured:

```bash
npm run build     # Must succeed
```

## Test Suite

Tests live alongside source files. Run them with `npm test` (Vitest).

When adding new features or fixing bugs, add or update the relevant tests.

## Commit Convention

```
<type>: <description> (<issue-id>)
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
