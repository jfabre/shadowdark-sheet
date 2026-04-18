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

## Writing Tests

When implementing a feature or fix, ask yourself: *can this behavior be tested?*
If yes, write the test. This is not optional — untested features are incomplete features.

**Write tests when:**
- Adding new logic, calculations, or state transitions
- Fixing a bug (add a test that would have caught it)
- Changing existing behavior

**You may skip tests when:**
- The change is purely visual (CSS, layout tweaks)
- The change is configuration or copy only
- Testing would require a full browser rendering environment and no harness exists for it

When in doubt, write the test.

## Commit Convention

```
<type>: <description> (<issue-id>)
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
